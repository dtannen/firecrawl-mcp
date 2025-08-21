import { spawn, ChildProcess } from 'child_process';
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

export interface FirecrawlConfig {
    redisUrl?: string;
    port?: number;
    firecrawlPath?: string;
}

export class FirecrawlProcessManager {
    private redisProcess?: ChildProcess;
    private workerProcess?: ChildProcess;
    private apiProcess?: ChildProcess;
    private config: FirecrawlConfig;
    private isShuttingDown = false;

    constructor(config: FirecrawlConfig = {}) {
        this.config = {
            redisUrl: config.redisUrl || 'redis://localhost:6379',
            port: config.port || 3002,
            firecrawlPath: config.firecrawlPath || process.cwd(),
            ...config
        };
    }

    async start(): Promise<void> {
        console.log('Starting Firecrawl services...');
        
        try {
            // Start Redis if not already running
            await this.startRedis();
            
            // Wait a bit for Redis to be ready
            await this.delay(2000);
            
            // Start Firecrawl workers
            await this.startWorkers();
            
            // Start Firecrawl API server
            await this.startApiServer();
            
            // Wait for services to be ready
            await this.waitForServices();
            
            console.log('Firecrawl services started successfully');
        } catch (error) {
            await this.stop();
            throw error;
        }
    }

    async stop(): Promise<void> {
        if (this.isShuttingDown) return;
        this.isShuttingDown = true;
        
        console.log('Stopping Firecrawl services...');
        
        const processes = [
            { name: 'API Server', process: this.apiProcess },
            { name: 'Workers', process: this.workerProcess },
            { name: 'Redis', process: this.redisProcess }
        ];

        for (const { name, process } of processes) {
            if (process && !process.killed) {
                console.log(`Stopping ${name}...`);
                process.kill('SIGTERM');
                
                // Wait for graceful shutdown, then force kill if needed
                await new Promise<void>((resolve) => {
                    const timeout = setTimeout(() => {
                        if (process && !process.killed) {
                            console.log(`Force killing ${name}...`);
                            process.kill('SIGKILL');
                        }
                        resolve();
                    }, 5000);
                    
                    process.on('exit', () => {
                        clearTimeout(timeout);
                        resolve();
                    });
                });
            }
        }
        
        console.log('Firecrawl services stopped');
    }

    private async startRedis(): Promise<void> {
        return new Promise((resolve, reject) => {
            // First check if Redis is already running
            const testProcess = spawn('redis-cli', ['ping'], { stdio: 'pipe' });
            
            testProcess.on('exit', (code) => {
                if (code === 0) {
                    console.log('Redis is already running');
                    resolve();
                } else {
                    // Start Redis server
                    console.log('Starting Redis server...');
                    this.redisProcess = spawn('redis-server', [], {
                        stdio: ['ignore', 'pipe', 'pipe']
                    });

                    this.redisProcess.stdout?.on('data', (data) => {
                        const output = data.toString();
                        if (output.includes('Ready to accept connections')) {
                            resolve();
                        }
                    });

                    this.redisProcess.on('error', (error) => {
                        reject(new McpError(
                            ErrorCode.InternalError,
                            `Failed to start Redis: ${error.message}. Make sure Redis is installed.`
                        ));
                    });

                    this.redisProcess.on('exit', (code) => {
                        if (code !== 0 && !this.isShuttingDown) {
                            reject(new McpError(
                                ErrorCode.InternalError,
                                `Redis exited with code ${code}`
                            ));
                        }
                    });

                    // Timeout after 10 seconds
                    setTimeout(() => {
                        reject(new McpError(
                            ErrorCode.InternalError,
                            'Redis failed to start within 10 seconds'
                        ));
                    }, 10000);
                }
            });
        });
    }

    private async startWorkers(): Promise<void> {
        console.log('Starting Firecrawl workers...');
        
        const apiPath = `${this.config.firecrawlPath}/apps/api`;
        const workerScript = `${apiPath}/dist/src/services/queue-worker.js`;
        console.log(`[Debug] Starting worker with script: ${workerScript}`);
        this.workerProcess = spawn(process.execPath, [workerScript], {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {
                ...process.env,
                REDIS_URL: this.config.redisUrl,
                PATH: process.env.PATH
            }
        });

        this.workerProcess.stdout?.on('data', (data) => {
            console.log(`[Workers] ${data.toString().trim()}`);
        });

        this.workerProcess.stderr?.on('data', (data) => {
            console.error(`[Workers Error] ${data.toString().trim()}`);
        });

        this.workerProcess.on('error', (error) => {
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to start Firecrawl workers: ${error.message}`
            );
        });
    }

    private async startApiServer(): Promise<void> {
        console.log('Starting Firecrawl API server...');
        
        const apiPath = `${this.config.firecrawlPath}/apps/api`;
        const apiScript = `${apiPath}/dist/src/index.js`;
        console.log(`[Debug] Starting API with script: ${apiScript}`);
        this.apiProcess = spawn(process.execPath, [apiScript], {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {
                ...process.env,
                REDIS_URL: this.config.redisUrl,
                PORT: this.config.port?.toString(),
                PATH: process.env.PATH
            }
        });

        this.apiProcess.stdout?.on('data', (data) => {
            console.log(`[API] ${data.toString().trim()}`);
        });

        this.apiProcess.stderr?.on('data', (data) => {
            console.error(`[API Error] ${data.toString().trim()}`);
        });

        this.apiProcess.on('error', (error) => {
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to start Firecrawl API server: ${error.message}`
            );
        });
    }

    private async waitForServices(): Promise<void> {
        const maxAttempts = 30;
        const delayMs = 1000;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const response = await fetch(`http://localhost:${this.config.port}/test`);
                if (response.ok) {
                    return;
                }
            } catch (error) {
                // Service not ready yet
            }
            
            if (attempt === maxAttempts) {
                throw new McpError(
                    ErrorCode.InternalError,
                    `Firecrawl API server failed to respond after ${maxAttempts} seconds`
                );
            }
            
            await this.delay(delayMs);
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async healthCheck(): Promise<boolean> {
        try {
            const response = await fetch(`http://localhost:${this.config.port}/test`, {
                method: 'GET',
                timeout: 5000
            } as RequestInit);
            return response.ok;
        } catch {
            return false;
        }
    }
}