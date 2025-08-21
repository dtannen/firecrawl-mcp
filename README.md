# Firecrawl Local MCP Server

A Model Context Protocol (MCP) server that provides local Firecrawl integration for AI assistants like Claude. This server manages a local Firecrawl instance and exposes web scraping and crawling capabilities through MCP tools.

## Features

- **Local Firecrawl Management**: Automatically starts and manages Redis, Firecrawl workers, and API server
- **Web Scraping**: Scrape single web pages and extract content in various formats (Markdown, HTML, etc.)
- **Website Crawling**: Crawl entire websites with depth control and filtering options
- **Search and Scrape**: Search the web and scrape results automatically
- **Health Monitoring**: Check the status of local Firecrawl services
- **Process Management**: Graceful startup and shutdown of all Firecrawl components

## Quick Start

### Prerequisites

1. **Redis**: Required for Firecrawl's job queue
   ```bash
   # macOS
   brew install redis
   
   # Ubuntu/Debian
   sudo apt-get install redis-server
   ```

2. **pnpm**: Required to run Firecrawl
   ```bash
   npm install -g pnpm
   ```

3. **Firecrawl Repository**: Clone Firecrawl to your system
   ```bash
   git clone https://github.com/firecrawl/firecrawl.git
   cd firecrawl
   pnpm install
   ```

### Installation and Setup

1. **Clone this repository**:
   ```bash
   git clone https://github.com/dtannen/firecrawl-mcp.git
   cd firecrawl-mcp
   npm install
   ```

2. **Clone Firecrawl repository** (inside this project directory):
   ```bash
   git clone https://github.com/firecrawl/firecrawl.git
   cd firecrawl
   pnpm install
   cd ..
   ```
   
   **Note**: The Firecrawl directory is gitignored and should be cloned into this project root.

3. **Start Redis server**:
   ```bash
   # macOS with Homebrew
   brew services start redis
   
   # Linux
   sudo systemctl start redis
   
   # Or run directly
   redis-server
   ```

### Starting the Server

```bash
# Build the project
npm run build

# Start with HTTP transport for testing
export FIRECRAWL_PATH=/path/to/firecrawl-mcp/firecrawl && node build/index.js --transport http --port 3000

# Or start with stdio transport (for MCP clients)
export FIRECRAWL_PATH=/path/to/firecrawl-mcp/firecrawl && node build/index.js --transport stdio
```

### Testing the Setup

You can test the server using curl against the HTTP endpoint:

```bash
# Test scraping
curl -X POST http://127.0.0.1:3000 -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "firecrawl_scrape",
    "arguments": {
      "url": "https://example.com",
      "formats": ["markdown"]
    }
  }
}'

# Test search
curl -X POST http://127.0.0.1:3000 -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d '{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "firecrawl_search",
    "arguments": {
      "query": "TypeScript tutorial",
      "limit": 2
    }
  }
}'
```

## Available Tools

### `firecrawl_scrape`
Scrape a single web page and extract content.

**Parameters:**
- `url` (required): The URL to scrape
- `formats`: Array of output formats (`markdown`, `html`, `rawHtml`, `links`, `screenshot`)
- `includeTags`: HTML tags to include
- `excludeTags`: HTML tags to exclude  
- `onlyMainContent`: Extract only main content

**Example:**
```json
{
  "url": "https://example.com",
  "formats": ["markdown", "links"],
  "onlyMainContent": true
}
```

### `firecrawl_crawl`
Crawl a website and extract content from multiple pages.

**Parameters:**
- `url` (required): The base URL to start crawling
- `includePaths`: URL patterns to include
- `excludePaths`: URL patterns to exclude
- `maxDepth`: Maximum crawl depth (default: 2)
- `limit`: Maximum number of pages (default: 10)
- `allowBackwardLinks`: Allow crawling backward links
- `allowExternalLinks`: Allow crawling external links

**Example:**
```json
{
  "url": "https://docs.example.com",
  "includePaths": ["/docs/*"],
  "maxDepth": 3,
  "limit": 20
}
```

### `firecrawl_crawl_status`
Check the status of a crawl job.

**Parameters:**
- `jobId` (required): The crawl job ID to check

### `firecrawl_search`
Search the web and scrape results.

**Parameters:**
- `query` (required): Search query
- `limit`: Number of results (default: 5)
- `location`: Geographic location for results

**Example:**
```json
{
  "query": "machine learning tutorials",
  "limit": 3
}
```

### `firecrawl_health`
Check if Firecrawl services are running and healthy.

## Environment Variables

- `FIRECRAWL_PATH`: Path to Firecrawl repository (default: current directory)
- `REDIS_URL`: Redis connection URL (default: redis://localhost:6379)  
- `FIRECRAWL_PORT`: Port for Firecrawl API (default: 3002)

## Using with Claude Desktop

**Option 1: Using Claude MCP CLI (if available):**
```bash
claude mcp add firecrawl-local \
  "node" \
  "/path/to/firecrawl-mcp/build/index.js" \
  "--transport" \
  "stdio" \
  --env "FIRECRAWL_PATH=/path/to/firecrawl-mcp/firecrawl"
```

**Option 2: Manual configuration**
Add this to your Claude Desktop MCP settings:

```json
{
  "mcpServers": {
    "firecrawl-local": {
      "command": "node",
      "args": ["/path/to/firecrawl-mcp/build/index.js", "--transport", "stdio"],
      "env": {
        "FIRECRAWL_PATH": "/path/to/firecrawl-mcp/firecrawl"
      }
    }
  }
}
```

## Architecture

The MCP server consists of several components:

1. **Process Manager**: Manages Redis, Firecrawl workers, and API server
2. **Firecrawl Client**: HTTP client for communicating with local Firecrawl API
3. **Tool Handlers**: Individual handlers for each MCP tool
4. **Transport Layer**: Supports both stdio and HTTP transports

## Development

```bash
# Clone and setup
git clone https://github.com/dtannen/firecrawl-mcp.git
cd firecrawl-mcp
npm install

# Build
npm run build

# Development mode with auto-rebuild
npm run dev
```

## Troubleshooting

### "Redis server not found"
Install Redis on your system. The MCP server will try to start Redis automatically if it's not running.

### "pnpm not found"  
Install pnpm globally: `npm install -g pnpm`

### "Firecrawl services failed to start"
- Check that you have Firecrawl cloned and dependencies installed
- Verify `FIRECRAWL_PATH` points to the correct directory
- Ensure ports 3002 and 6379 are available

### Process cleanup
If processes don't shut down cleanly, you can manually kill them:
```bash
pkill -f "redis-server"
pkill -f "firecrawl"
```

## License

MIT