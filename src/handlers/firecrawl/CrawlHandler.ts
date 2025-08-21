import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { FirecrawlBaseHandler } from './FirecrawlBaseHandler.js';
import { CrawlOptions } from '../../firecrawl/client.js';

export class CrawlHandler extends FirecrawlBaseHandler {
    async runTool(args: {
        url: string;
        includePaths?: string[];
        excludePaths?: string[];
        maxDepth?: number;
        limit?: number;
        allowBackwardLinks?: boolean;
        allowExternalLinks?: boolean;
        scrapeOptions?: {
            formats?: ('markdown' | 'html' | 'rawHtml' | 'links' | 'screenshot')[];
            includeTags?: string[];
            excludeTags?: string[];
            onlyMainContent?: boolean;
        };
    }): Promise<CallToolResult> {
        try {
            const { url, ...options } = args;
            
            if (!url) {
                return this.formatResult('URL is required', true);
            }

            // Validate URL format
            try {
                new URL(url);
            } catch {
                return this.formatResult('Invalid URL format', true);
            }

            const crawlOptions: CrawlOptions = {
                maxDepth: options.maxDepth || 2,
                limit: options.limit || 10,
                scrapeOptions: {
                    formats: ['markdown'],
                    ...options.scrapeOptions
                },
                ...options
            };

            const result = await this.client.crawlWebsite(url, crawlOptions);
            
            // Format the response
            const response = {
                url: url,
                jobId: result.jobId,
                status: result.completed ? 'completed' : 'in_progress',
                ...(result.total && { total_pages: result.total }),
                ...(result.current && { current_page: result.current }),
                ...(result.data && { 
                    pages: result.data.map((page, index) => ({
                        page_number: index + 1,
                        url: page.metadata.sourceURL,
                        title: page.metadata.title,
                        markdown: page.markdown,
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