import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { FirecrawlClient } from '../../firecrawl/client.js';

export abstract class FirecrawlBaseHandler {
    protected client: FirecrawlClient;

    constructor(client: FirecrawlClient) {
        this.client = client;
    }

    abstract runTool(args: any): Promise<CallToolResult>;

    protected formatResult(data: any, isError: boolean = false): CallToolResult {
        if (isError) {
            return {
                content: [{
                    type: "text",
                    text: `Error: ${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}`
                }],
                isError: true
            };
        }

        return {
            content: [{
                type: "text",
                text: typeof data === 'string' ? data : JSON.stringify(data, null, 2)
            }]
        };
    }
}