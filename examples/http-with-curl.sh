#!/bin/bash

# Test script for Firecrawl MCP Server HTTP mode using curl  
# This demonstrates basic HTTP requests to test the MCP server

SERVER_URL="${1:-http://localhost:3000}"
SESSION_ID="curl-test-session-$(date +%s)"

echo "🚀 Testing Firecrawl MCP Server at: $SERVER_URL"
echo "🆔 Using session ID: $SESSION_ID"
echo "=================================================="

# Test 1: Health check
echo -e "\n🏥 Testing health endpoint..."
curl -s "$SERVER_URL/health" | jq '.' || echo "Health check failed"

# Test 2: Initialize MCP session
echo -e "\n🤝 Testing MCP initialize..."

# MCP Initialize request
INIT_REQUEST='{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {}
    },
    "clientInfo": {
      "name": "curl-test-client",
      "version": "1.0.0"
    }
  }
}'

echo "Sending initialize request..."
INIT_RESPONSE=$(curl -s -X POST "$SERVER_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SESSION_ID" \
  -d "$INIT_REQUEST")

echo "Raw response:"
echo "$INIT_RESPONSE"
echo ""

# Try to parse as JSON, if that fails, check if it's SSE format
if echo "$INIT_RESPONSE" | jq '.' >/dev/null 2>&1; then
  echo "✅ JSON response:"
  echo "$INIT_RESPONSE" | jq '.'
elif echo "$INIT_RESPONSE" | grep -q "^data:"; then
  echo "📡 SSE response detected, extracting JSON:"
  echo "$INIT_RESPONSE" | grep "^data:" | sed 's/^data: //' | jq '.'
else
  echo "❌ Unknown response format"
fi

# Check if initialization was successful
if echo "$INIT_RESPONSE" | grep -q "result\|initialize"; then
  echo "✅ Initialization successful"
else
  echo "❌ Initialization failed - stopping tests"
  exit 1
fi

# Test 3: List Tools request (after successful initialization)
echo -e "\n📋 Testing list tools..."
LIST_TOOLS_REQUEST='{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}'

TOOLS_RESPONSE=$(curl -s -X POST "$SERVER_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SESSION_ID" \
  -d "$LIST_TOOLS_REQUEST")

echo "Raw response:"
echo "$TOOLS_RESPONSE"
echo ""

# Parse response appropriately
if echo "$TOOLS_RESPONSE" | jq '.' >/dev/null 2>&1; then
  echo "✅ JSON response:"
  echo "$TOOLS_RESPONSE" | jq '.'
elif echo "$TOOLS_RESPONSE" | grep -q "^data:"; then
  echo "📡 SSE response detected, extracting JSON:"
  echo "$TOOLS_RESPONSE" | grep "^data:" | sed 's/^data: //' | jq '.'
else
  echo "❌ List tools failed - unknown format"
fi

# Test 4: Call firecrawl_health tool
echo -e "\n🏥 Testing firecrawl_health tool..."

HEALTH_REQUEST='{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "firecrawl_health",
    "arguments": {}
  }
}'

HEALTH_RESPONSE=$(curl -s -X POST "$SERVER_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SESSION_ID" \
  -d "$HEALTH_REQUEST")

echo "Raw response:"
echo "$HEALTH_RESPONSE"
echo ""

# Parse response appropriately
if echo "$HEALTH_RESPONSE" | jq '.' >/dev/null 2>&1; then
  echo "✅ JSON response:"
  echo "$HEALTH_RESPONSE" | jq '.'
elif echo "$HEALTH_RESPONSE" | grep -q "^data:"; then
  echo "📡 SSE response detected, extracting JSON:"
  echo "$HEALTH_RESPONSE" | grep "^data:" | sed 's/^data: //' | jq '.'
else
  echo "❌ Health check failed - unknown format"
fi

# Test 5: Call firecrawl_scrape tool
echo -e "\n🕷️ Testing firecrawl_scrape tool..."

SCRAPE_REQUEST='{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "firecrawl_scrape",
    "arguments": {
      "url": "https://example.com",
      "formats": ["markdown"]
    }
  }
}'

SCRAPE_RESPONSE=$(curl -s -X POST "$SERVER_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SESSION_ID" \
  -d "$SCRAPE_REQUEST")

echo "Raw response:"
echo "$SCRAPE_RESPONSE"
echo ""

# Parse response appropriately
if echo "$SCRAPE_RESPONSE" | jq '.' >/dev/null 2>&1; then
  echo "✅ JSON response:"
  echo "$SCRAPE_RESPONSE" | jq '.' | head -20
  echo "..."
elif echo "$SCRAPE_RESPONSE" | grep -q "^data:"; then
  echo "📡 SSE response detected, extracting JSON:"
  echo "$SCRAPE_RESPONSE" | grep "^data:" | sed 's/^data: //' | jq '.' | head -20
  echo "..."
else
  echo "❌ Scrape failed - unknown format"
fi

echo -e "\n✅ HTTP testing completed!"
echo -e "\n💡 To test with different server URL: $0 http://your-server:port"