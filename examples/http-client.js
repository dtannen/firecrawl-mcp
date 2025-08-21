#!/usr/bin/env node

/**
 * Modern HTTP Client for Firecrawl MCP Server
 * 
 * This demonstrates how to connect to the Firecrawl MCP server
 * when it's running in StreamableHTTP transport mode. To test this
 * make sure you have the server running locally with HTTP transport.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function main() {
  const serverUrl = process.argv[2] || 'http://localhost:3000';
  
  console.log(`🔗 Connecting to Firecrawl MCP Server at: ${serverUrl}`);
  
  try {
    // First test health endpoint to ensure server is running
    console.log('🏥 Testing server health...');
    const healthResponse = await fetch(`${serverUrl}/health`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Server is healthy:', healthData);
    } else {
      console.error('❌ Server health check failed');
      return;
    }

    // Create MCP client
    const client = new Client({
      name: "firecrawl-http-client",
      version: "1.0.0"
    }, {
      capabilities: {
        tools: {}
      }
    });

    // Skip direct initialization test to avoid double-initialization error
    console.log('\n🔍 Skipping direct initialization test...');

    // Connect with SDK transport
    console.log('\n🚀 Connecting with MCP SDK transport...');
    const transport = new StreamableHTTPClientTransport(new URL(serverUrl));
    
    await client.connect(transport);
    console.log('✅ Connected to server');

    // List available tools
    console.log('\n📋 Listing available tools...');
    const tools = await client.listTools();
    console.log(`Found ${tools.tools.length} tools:`);
    
    tools.tools.forEach((tool, index) => {
      console.log(`  ${index + 1}. ${tool.name}`);
      console.log(`     Description: ${tool.description}`);
    });

    // Test some basic tools
    console.log('\n🛠️ Testing tools...');
    
    // Test health check
    try {
      console.log('\n🏥 Testing firecrawl_health...');
      const healthResult = await client.callTool({
        name: 'firecrawl_health',
        arguments: {}
      });
      console.log('✅ firecrawl_health successful');
      console.log('Result:', healthResult.content[0].text.substring(0, 300) + '...');
    } catch (error) {
      console.log('❌ firecrawl_health failed:', error.message);
    }

    // Test scraping
    try {
      console.log('\n🕷️ Testing firecrawl_scrape...');
      const scrapeResult = await client.callTool({
        name: 'firecrawl_scrape',
        arguments: {
          url: 'https://example.com',
          formats: ['markdown']
        }
      });
      console.log('✅ firecrawl_scrape successful');
      console.log('Result:', scrapeResult.content[0].text.substring(0, 300) + '...');
    } catch (error) {
      console.log('❌ firecrawl_scrape failed:', error.message);
    }

    // Test search
    try {
      console.log('\n🔍 Testing firecrawl_search...');
      const searchResult = await client.callTool({
        name: 'firecrawl_search',
        arguments: {
          query: 'TypeScript tutorial',
          limit: 2
        }
      });
      console.log('✅ firecrawl_search successful');
      console.log('Result:', searchResult.content[0].text.substring(0, 500) + '...');
    } catch (error) {
      console.log('❌ firecrawl_search failed:', error.message);
    }

    // Close the connection
    console.log('\n🔒 Closing connection...');
    await client.close();
    console.log('✅ Connection closed');
    
    console.log('\n🎉 Firecrawl MCP client test completed!');

  } catch (error) {
    console.error('❌ Error:', error);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Server not running:');
      console.log('   Start server: npm run build && export FIRECRAWL_PATH=/path/to/firecrawl && node build/index.js --transport http --port 3000');
    } else {
      console.log('\n💡 Check that:');
      console.log('   1. Server is running with HTTP transport');
      console.log('   2. FIRECRAWL_PATH environment variable is set');
      console.log('   3. Firecrawl services are healthy');
      console.log('   4. Redis is running');
    }
    
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down HTTP client...');
  process.exit(0);
});

main().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});