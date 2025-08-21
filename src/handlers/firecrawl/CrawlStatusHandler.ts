import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { FirecrawlBaseHandler } from './FirecrawlBaseHandler.js';

export class CrawlStatusHandler extends FirecrawlBaseHandler {
    async runTool(args: {
        jobId: string;
    }): Promise<CallToolResult> {
        try {
            const { jobId } = args;
            
            if (!jobId) {
                return this.formatResult('Job ID is required', true);
            }

            const result = await this.client.getCrawlStatus(jobId);
            
            // Format the response
            const response = {
                jobId: jobId,
                status: result.completed ? 'completed' : 'in_progress',
                ...(result.total && { total_pages: result.total }),
                ...(result.current && { current_page: result.current }),
                ...(result.data && { 
                    pages_count: result.data.length,
                    pages: result.data.map((page, index) => ({
                        page_number: index + 1,
                        url: page.metadata.sourceURL,
                        title: page.metadata.title,
                        has_markdown: !!page.markdown,
                        metadata: page.metadata
                    }))
                }),
                ...(result.next && { next_batch_url: result.next })
            };
            
            return this.formatResult(response);
        } catch (error) {
            return this.formatResult(error instanceof Error ? error.message : String(error), true);
        }
    }
}