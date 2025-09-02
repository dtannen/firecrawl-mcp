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
  process.stdout.write(`
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
  process.stdout.write(`Firecrawl Local MCP Server v${VERSION}\n`);
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

// CLI logic here (run always)
const { command } = parseCliArgs();

switch (command) {
  case "setup":
    checkFirecrawlSetup().catch((error) => {
      process.stderr.write(`Setup check failed: ${error}\n`);
      process.exit(1);
    });
    break;
  case "start":
  case void 0:
    main().catch((error) => {
      process.stderr.write(`Failed to start server: ${error}\n`);
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
    process.stderr.write(`Unknown command: ${command}\n`);
    showHelp();
    process.exit(1);
}