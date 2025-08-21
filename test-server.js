// Simple test server to verify MCP tool definitions
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioTransportHandler } from "./build/transports/stdio.js";

const server = new McpServer({
  name: "firecrawl-local-test",
  version: "1.0.0"
});

// Register the same tools as our Firecrawl MCP
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'firecrawl_scrape',
      description: 'Scrape a single web page and extract content in various formats',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to scrape'
          },
          formats: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['markdown', 'html', 'rawHtml', 'links', 'screenshot']
            },
            description: 'Output formats to include (default: markdown)'
          }
        },
        required: ['url']
      }
    },
    {
      name: 'firecrawl_health',
      description: 'Check if Firecrawl services are running and healthy',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    }
  ]
}));

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'firecrawl_scrape':
      return {
        content: [{
          type: "text",
          text: `Mock scrape result for ${args.url}: This would contain the scraped content from Firecrawl.`
        }]
      };
    case 'firecrawl_health':
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: 'healthy (mock)',
            message: 'This is a test - Firecrawl services would be checked here',
            timestamp: new Date().toISOString()
          }, null, 2)
        }]
      };
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

console.log('Starting test MCP server...');
const stdioHandler = new StdioTransportHandler(server);
await stdioHandler.start();