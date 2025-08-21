import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { FirecrawlBaseHandler } from './FirecrawlBaseHandler.js';
import { SearchOptions } from '../../firecrawl/client.js';

export class SearchHandler extends FirecrawlBaseHandler {
    async runTool(args: {
        query: string;
        limit?: number;
        tbs?: string;
        filter?: string;
        location?: string;
        scrapeOptions?: {
            formats?: ('markdown' | 'html' | 'rawHtml' | 'links' | 'screenshot')[];
            includeTags?: string[];
            excludeTags?: string[];
            onlyMainContent?: boolean;
        };
    }): Promise<CallToolResult> {
        try {
            const { query, ...options } = args;
            
            if (!query) {
                return this.formatResult('Search query is required', true);
            }

            const searchOptions: SearchOptions = {
                query,
                limit: options.limit || 5,
                scrapeOptions: {
                    formats: ['markdown'],
                    ...options.scrapeOptions
                },
                ...options
            };

            const result = await this.client.searchAndScrape(searchOptions);
            
            // Format the response
            // Result is an array of ScrapeResult directly
            const results = Array.isArray(result) ? result : [];
            const response = {
                query: query,
                results_count: results.length,
                results: results.map((page, index) => ({
                    result_number: index + 1,
                    url: page.metadata?.sourceURL || page.url,
                    title: page.metadata?.title,
                    description: page.metadata?.description,
                    markdown: page.markdown,
                    metadata: page.metadata
                }))
            };
            
            return this.formatResult(response);
        } catch (error) {
            return this.formatResult(error instanceof Error ? error.message : String(error), true);
        }
    }
}