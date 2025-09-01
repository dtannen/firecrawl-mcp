import { fileURLToPath } from "url";
import { FirecrawlMcpServer } from './firecrawlServer.js';
import { parseArgs } from './config/TransportConfig.js';
import { readFileSync } from "fs";
import { join, dirname } from "path";

// Get package version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const VERSION = packageJson.version;

// --- Main Application Logic --- 
async function main() {
  try {
    // Parse command line arguments
    const config = parseArgs(process.argv.slice(2));
    
    // Create Firecrawl config from environment
    const firecrawlConfig = {
      firecrawlPath: process.env.FIRECRAWL_PATH || process.cwd(),
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      port: parseInt(process.env.FIRECRAWL_PORT || '3002')
    };
    
    // Create and initialize the Firecrawl server
    const server = new FirecrawlMcpServer(config, firecrawlConfig);
    await server.initialize();
    
    // Start the server with the appropriate transport
    await server.start();

  } catch (error: unknown) {
    process.stderr.write(`Failed to start server: ${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  }
}


// --- Command Line Interface ---
async function checkFirecrawlSetup(): Promise<void> {
  try {
    // Check if required commands are available
    const { spawn } = await import('child_process');
    
    // Check for Redis
    const redisCheck = spawn('redis-server', ['--version'], { stdio: 'pipe' });
    redisCheck.on('error', () => {
      process.stderr.write("Redis server not found. Please install Redis to use Firecrawl MCP.\n");
      process.exit(1);
    });
    
    // Check for pnpm
    const pnpmCheck = spawn('pnpm', ['--version'], { stdio: 'pipe' });
    pnpmCheck.on('error', () => {
      process.stderr.write("pnpm not found. Please install pnpm to use Firecrawl MCP.\n");
      process.exit(1);
    });
    
    process.stderr.write("Firecrawl dependencies check passed.\n");
    process.exit(0);
  } catch (error) {
    process.stderr.write(`Dependency check failed: ${error}\n`);
    process.exit(1);
  }
}

function showHelp(): void {
  process.stderr.write(`
Firecrawl Local MCP Server v${VERSION}

Usage:
  npx firecrawl-local-mcp [command]

Commands:
  setup    Check if dependencies (Redis, pnpm, Firecrawl) are installed
  start    Start the MCP server with local Firecrawl (default)
  version  Show version information
  help     Show this help message

Examples:
  npx firecrawl-local-mcp setup
  npx firecrawl-local-mcp start
  npx firecrawl-local-mcp version
  npx firecrawl-local-mcp

Environment Variables:
  FIRECRAWL_PATH     Path to Firecrawl repository (default: current directory)
  REDIS_URL          Redis connection URL (default: redis://localhost:6379)
  FIRECRAWL_PORT     Port for Firecrawl API (default: 3002)
`);
}

function showVersion(): void {
  process.stderr.write(`Firecrawl Local MCP Server v${VERSION}
`);
}

// --- Exports & Execution Guard --- 
// Export main for testing or potential programmatic use
export { main, checkFirecrawlSetup };

// Parse CLI arguments
function parseCliArgs(): { command: string | undefined } {
  const args = process.argv.slice(2);
  let command: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    // Handle special version/help flags as commands
    if (arg === '--version' || arg === '-v' || arg === '--help' || arg === '-h') {
      command = arg;
      continue;
    }
    
    // Skip transport options and their values
    if (arg === '--transport' || arg === '--port' || arg === '--host') {
      i++; // Skip the next argument (the value)
      continue;
    }
    
    // Skip other flags
    if (arg === '--debug') {
      continue;
    }
    
    // Check for command (first non-option argument)
    if (!command && !arg.startsWith('--')) {
      command = arg;
      continue;
    }
  }

  return { command };
}

// Only run CLI logic if not using stdio transport or if explicit commands are given
const args = process.argv.slice(2);
const hasTransportFlag = args.includes('--transport');
const transportType = hasTransportFlag ? 
  args[args.indexOf('--transport') + 1] : 
  (process.env.TRANSPORT || 'stdio');

const { command } = parseCliArgs();

// In stdio mode, route all console logs to stderr to avoid stdout JSON pollution
if (transportType === 'stdio') {
  // Hint to any child process manager to avoid inheriting stdout
  process.env.MCP_STDIO_MODE = 'true';

  // Route console.* to stderr to avoid stdout pollution
  const toStderr = (...args: any[]) => {
    try {
      process.stderr.write(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') + '\n');
    } catch {
      process.stderr.write(args.join(' ') + '\n');
    }
  };
  console.log = toStderr as any;
  console.info = toStderr as any;
  console.warn = toStderr as any;
  console.debug = toStderr as any;

  // Guardrail: only allow JSON (objects/arrays) on stdout; divert everything else to stderr
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: any, encoding?: any, cb?: any) => {
    try {
      const s = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
      const trimmed = s.trimStart();
      // Allow JSON-RPC payloads (objects/arrays); divert other text
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return originalStdoutWrite(chunk as any, encoding as any, cb as any);
      }
      // Non-JSON text -> stderr
      process.stderr.write(chunk as any);
      if (typeof cb === 'function') cb();
      return true;
    } catch {
      return originalStdoutWrite(chunk as any, encoding as any, cb as any);
    }
  }) as any;
  console.info = toStderr as any;
  console.warn = toStderr as any;
  console.debug = toStderr as any;
}

// If using stdio transport and no explicit command, just run main()
if (transportType === 'stdio' && !command) {
  main().catch((error) => {
    process.stderr.write(`Failed to start server: ${error}
`);
    process.exit(1);
  });
} else {
  // Handle explicit commands
  switch (command) {
    case "setup":
      checkFirecrawlSetup().catch((error) => {
        process.stderr.write(`Setup check failed: ${error}
`);
        process.exit(1);
      });
      break;
    case "start":
    case void 0:
      main().catch((error) => {
        process.stderr.write(`Failed to start server: ${error}
`);
        process.exit(1);
      });
      break;
    case "version":
    case "--version":
    case "-v":
      showVersion();
      break;
    case "help":
    case "--help":
    case "-h":
      showHelp();
      break;
    default:
      process.stderr.write(`Unknown command: ${command}
`);
      showHelp();
      process.exit(1);
  }
}