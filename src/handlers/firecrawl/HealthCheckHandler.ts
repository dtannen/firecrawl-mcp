import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { FirecrawlBaseHandler } from './FirecrawlBaseHandler.js';

export class HealthCheckHandler extends FirecrawlBaseHandler {
    async runTool(args: {}): Promise<CallToolResult> {
        try {
            const isHealthy = await this.client.healthCheck();
            
            const response = {
                status: isHealthy ? 'healthy' : 'unhealthy',
                message: isHealthy 
                    ? 'Firecrawl services are running and accessible'
                    : 'Firecrawl services are not responding',
                timestamp: new Date().toISOString()
            };
            
            return this.formatResult(response, !isHealthy);
        } catch (error) {
            return this.formatResult(error instanceof Error ? error.message : String(error), true);
        }
    }
}