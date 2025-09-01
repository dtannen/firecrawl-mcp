import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

// Simple logger that can be disabled for stdio mode
class Logger {
    constructor(private enabled: boolean = true) {}
    
    log(message: string, ...args: any[]) {
        if (!this.enabled) return;
        if (process.env.NODE_ENV !== 'production') {
            console.error(`[Firecrawl MCP] ${message}`, ...args);
        }
    }
    
    error(message: string, ...args: any[]) {
        if (!this.enabled) return;
        console.error(`[Firecrawl MCP ERROR] ${message}`, ...args);
    }
    
    debug(message: string, ...args: any[]) {
        if (!this.enabled) return;
        if (process.env.DEBUG === 'true') {
            console.error(`[Firecrawl MCP DEBUG] ${message}`, ...args);
        }
    }
}

// Import Firecrawl components
import { FirecrawlProcessManager, FirecrawlConfig } from './firecrawl/processManager.js';
import { FirecrawlClient } from './firecrawl/client.js';

// Import tool handlers
import { ScrapeHandler } from './handlers/firecrawl/ScrapeHandler.js';
import { CrawlHandler } from './handlers/firecrawl/CrawlHandler.js';
import { CrawlStatusHandler } from './handlers/firecrawl/CrawlStatusHandler.js';
import { SearchHandler } from './handlers/firecrawl/SearchHandler.js';
import { HealthCheckHandler } from './handlers/firecrawl/HealthCheckHandler.js';

// Import schemas
import { FirecrawlSchemas } from './firecrawl/schemas.js';

// Import transport handlers
import { StdioTransportHandler } from './transports/stdio.js';
import { HttpTransportHandler, HttpTransportConfig } from './transports/http.js';

// Import config
import { ServerConfig } from './config/TransportConfig.js';

export class FirecrawlMcpServer {
    private server: McpServer;
    private processManager: FirecrawlProcessManager;
    private firecrawlClient: FirecrawlClient;
    private config: ServerConfig;
    private logger: Logger;

    // Tool handlers
    private scrapeHandler: ScrapeHandler;
    private crawlHandler: CrawlHandler;
    private crawlStatusHandler: CrawlStatusHandler;
    private searchHandler: SearchHandler;
    private healthCheckHandler: HealthCheckHandler;

    constructor(config: ServerConfig, firecrawlConfig?: FirecrawlConfig) {
        this.config = config;
        // Disable logging for stdio transport to prevent stdout pollution
        this.logger = new Logger(config.transport.type !== 'stdio');
        this.server = new McpServer({
            name: "firecrawl-local",
            version: "1.0.0"
        });

        // Initialize Firecrawl components
        this.processManager = new FirecrawlProcessManager(firecrawlConfig);
        this.firecrawlClient = new FirecrawlClient(
            `http://localhost:${firecrawlConfig?.port || 3002}`
        );

        // Initialize tool handlers
        this.scrapeHandler = new ScrapeHandler(this.firecrawlClient);
        this.crawlHandler = new CrawlHandler(this.firecrawlClient);
        this.crawlStatusHandler = new CrawlStatusHandler(this.firecrawlClient);
        this.searchHandler = new SearchHandler(this.firecrawlClient);
        this.healthCheckHandler = new HealthCheckHandler(this.firecrawlClient);
    }

    async initialize(): Promise<void> {
        // 1. Start Firecrawl services
        this.logger.log('Initializing Firecrawl MCP Server...');
        await this.processManager.start();

        // 2. Wait for services to be ready
        let attempts = 0;
        const maxAttempts = 10;
        while (attempts < maxAttempts) {
            const isHealthy = await this.firecrawlClient.healthCheck();
            if (isHealthy) break;
            
            attempts++;
            if (attempts >= maxAttempts) {
                throw new McpError(
                    ErrorCode.InternalError,
                    'Firecrawl services failed to become healthy'
                );
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // 3. Set up tool definitions
        this.registerTools();

        // 4. Set up graceful shutdown
        this.setupGracefulShutdown();

        this.logger.log('Firecrawl MCP Server initialized successfully');
    }

    private extractSchemaShape(schema: any): any {
        const schemaAny = schema as any;
        
        // Handle ZodEffects (schemas with .refine())
        if (schemaAny._def && schemaAny._def.typeName === 'ZodEffects') {
            return this.extractSchemaShape(schemaAny._def.schema);
        }
        
        // Handle regular ZodObject
        if ('shape' in schemaAny) {
            return schemaAny.shape;
        }
        
        // Handle other nested structures
        if (schemaAny._def && schemaAny._def.schema) {
            return this.extractSchemaShape(schemaAny._def.schema);
        }
        
        // Fallback to the original approach
        return schemaAny._def?.schema?.shape || schemaAny.shape;
    }

    private registerTools(): void {
        // Register each tool using the modern MCP SDK API
        this.server.registerTool(
            'firecrawl_scrape',
            {
                description: 'Scrape a single web page and extract content in various formats. Parameters: url (required), formats (optional array), includeTags (optional), excludeTags (optional), onlyMainContent (optional boolean)',
                inputSchema: this.extractSchemaShape(FirecrawlSchemas['firecrawl_scrape'])
            },
            async (args) => {
                this.logger.debug('Scrape handler received args:', JSON.stringify(args));
                // Validate input using our Zod schema
                const validatedArgs = FirecrawlSchemas['firecrawl_scrape'].parse(args);
                this.logger.debug('Validated args:', JSON.stringify(validatedArgs));
                return await this.scrapeHandler.runTool(validatedArgs);
            }
        );

        this.server.registerTool(
            'firecrawl_crawl',
            {
                description: 'Crawl a website and extract content from multiple pages. Parameters: url (required), includePaths (optional), excludePaths (optional), maxDepth (optional number, default 2), limit (optional number, default 10), allowBackwardLinks (optional boolean), allowExternalLinks (optional boolean)',
                inputSchema: this.extractSchemaShape(FirecrawlSchemas['firecrawl_crawl'])
            },
            async (args) => {
                const validatedArgs = FirecrawlSchemas['firecrawl_crawl'].parse(args);
                return await this.crawlHandler.runTool(validatedArgs);
            }
        );

        this.server.registerTool(
            'firecrawl_crawl_status',
            {
                description: 'Check the status of a crawl job. Parameters: jobId (required string)',
                inputSchema: this.extractSchemaShape(FirecrawlSchemas['firecrawl_crawl_status'])
            },
            async (args) => {
                const validatedArgs = FirecrawlSchemas['firecrawl_crawl_status'].parse(args);
                return await this.crawlStatusHandler.runTool(validatedArgs);
            }
        );

        this.server.registerTool(
            'firecrawl_search',
            {
                description: 'Search the web and scrape results. Parameters: query (required string), limit (optional number, default 5), location (optional string)',
                inputSchema: this.extractSchemaShape(FirecrawlSchemas['firecrawl_search'])
            },
            async (args) => {
                const validatedArgs = FirecrawlSchemas['firecrawl_search'].parse(args);
                return await this.searchHandler.runTool(validatedArgs);
            }
        );

        this.server.registerTool(
            'firecrawl_health',
            {
                description: 'Check if Firecrawl services are running and healthy. No parameters required.',
                inputSchema: this.extractSchemaShape(FirecrawlSchemas['firecrawl_health'])
            },
            async (args) => {
                const validatedArgs = FirecrawlSchemas['firecrawl_health'].parse(args);
                return await this.healthCheckHandler.runTool(validatedArgs);
            }
        );
    }

    private setupGracefulShutdown(): void {
        const cleanup = async () => {
            this.logger.log('Shutting down Firecrawl MCP Server...');
            try {
                await this.processManager.stop();
                this.logger.log('Firecrawl services stopped');
            } catch (error) {
                this.logger.error('Error during shutdown:', error);
            }
            process.exit(0);
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('uncaughtException', (error) => {
            this.logger.error('Uncaught exception:', error);
            cleanup();
        });
    }

    async start(): Promise<void> {
        this.logger.log('Starting Firecrawl MCP Server...');

        if (this.config.transport.type === 'stdio') {
            const stdioHandler = new StdioTransportHandler(this.server);
            await stdioHandler.connect();
        } else if (this.config.transport.type === 'http') {
            const httpConfig: HttpTransportConfig = {
                port: this.config.transport.port || 3000,
                host: this.config.transport.host || 'localhost'
            };
            const httpHandler = new HttpTransportHandler(this.server, httpConfig);
            await httpHandler.connect();
        } else {
            throw new McpError(
                ErrorCode.InvalidRequest,
                `Unsupported transport: ${this.config.transport.type}`
            );
        }
    }
}