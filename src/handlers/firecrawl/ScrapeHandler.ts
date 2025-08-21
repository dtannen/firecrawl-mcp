import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { FirecrawlBaseHandler } from './FirecrawlBaseHandler.js';
import { ScrapeOptions } from '../../firecrawl/client.js';

export class ScrapeHandler extends FirecrawlBaseHandler {
    async runTool(args: {
        url: string;
        formats?: ('markdown' | 'html' | 'rawHtml' | 'links' | 'screenshot')[];
        includeTags?: string[];
        excludeTags?: string[];
        onlyMainContent?: boolean;
        timeout?: number;
    }): Promise<CallToolResult> {
        try {
            console.log('[DEBUG] ScrapeHandler received args:', JSON.stringify(args));
            const { url, ...options } = args;
            
            if (!url) {
                return this.formatResult(`URL is required. Received args: ${JSON.stringify(args)}`, true);
            }

            // Validate URL format
            try {
                new URL(url);
            } catch {
                return this.formatResult('Invalid URL format', true);
            }

            const scrapeOptions: ScrapeOptions = {
                formats: options.formats || ['markdown'],
                ...options
            };

            const result = await this.client.scrapeUrl(url, scrapeOptions);
            
            // Format the response for better readability
            const response = {
                url: url,
                scraped_data: {
                    ...(result.markdown && { markdown: result.markdown }),
                    ...(result.html && { html: result.html }),
                    ...(result.rawHtml && { rawHtml: result.rawHtml }),
                    ...(result.links && { links: result.links }),
                    ...(result.screenshot && { screenshot: result.screenshot })
                },
                metadata: result.metadata
            };
            
            return this.formatResult(response);
        } catch (error) {
            return this.formatResult(error instanceof Error ? error.message : String(error), true);
        }
    }
}