import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

export interface ScrapeOptions {
    formats?: ('markdown' | 'html' | 'rawHtml' | 'links' | 'screenshot')[];
    includeTags?: string[];
    excludeTags?: string[];
    onlyMainContent?: boolean;
    timeout?: number;
}

export interface CrawlOptions {
    includePaths?: string[];
    excludePaths?: string[];
    maxDepth?: number;
    limit?: number;
    allowBackwardLinks?: boolean;
    allowExternalLinks?: boolean;
    scrapeOptions?: ScrapeOptions;
}

export interface SearchOptions {
    query: string;
    limit?: number;
    tbs?: string;
    filter?: string;
    location?: string;
    scrapeOptions?: ScrapeOptions;
}

export interface ScrapeResult {
    markdown?: string;
    html?: string;
    rawHtml?: string;
    links?: string[];
    screenshot?: string;
    metadata: {
        title?: string;
        description?: string;
        language?: string;
        keywords?: string;
        robots?: string;
        ogTitle?: string;
        ogDescription?: string;
        ogUrl?: string;
        ogImage?: string;
        ogAudio?: string;
        ogVideo?: string;
        dctermsCreated?: string;
        dctermsType?: string;
        dctermsLanguage?: string;
        dctermsSubject?: string;
        dctermsTitle?: string;
        sourceURL?: string;
        statusCode?: number;
        error?: string;
    };
}

export interface CrawlResult {
    jobId: string;
    data?: ScrapeResult[];
    completed?: boolean;
    total?: number;
    current?: number;
    next?: string;
}

export interface SearchResult {
    data: ScrapeResult[];
}

export class FirecrawlClient {
    private baseUrl: string;
    private timeout: number;

    constructor(baseUrl: string = 'http://localhost:3002', timeout: number = 60000) {
        this.baseUrl = baseUrl;
        this.timeout = timeout;
    }

    async scrapeUrl(url: string, options: ScrapeOptions = {}): Promise<ScrapeResult> {
        try {
            const response = await this.makeRequest('/v1/scrape', 'POST', {
                url,
                ...options
            });

            if (!response.success) {
                throw new McpError(
                    ErrorCode.InvalidRequest,
                    `Scrape failed: ${response.error || 'Unknown error'}`
                );
            }

            return response.data;
        } catch (error) {
            this.handleError(error, 'scrape URL');
        }
    }

    async crawlWebsite(url: string, options: CrawlOptions = {}): Promise<CrawlResult> {
        try {
            const response = await this.makeRequest('/v1/crawl', 'POST', {
                url,
                ...options
            });

            if (!response.success) {
                throw new McpError(
                    ErrorCode.InvalidRequest,
                    `Crawl failed: ${response.error || 'Unknown error'}`
                );
            }

            return response.data;
        } catch (error) {
            this.handleError(error, 'crawl website');
        }
    }

    async getCrawlStatus(jobId: string): Promise<CrawlResult> {
        try {
            const response = await this.makeRequest(`/v1/crawl/${jobId}`, 'GET');

            if (!response.success) {
                throw new McpError(
                    ErrorCode.InvalidRequest,
                    `Get crawl status failed: ${response.error || 'Unknown error'}`
                );
            }

            return response.data;
        } catch (error) {
            this.handleError(error, 'get crawl status');
        }
    }

    async searchAndScrape(options: SearchOptions): Promise<SearchResult> {
        try {
            const response = await this.makeRequest('/v1/search', 'POST', options);

            if (!response.success) {
                throw new McpError(
                    ErrorCode.InvalidRequest,
                    `Search failed: ${response.error || 'Unknown error'}`
                );
            }

            return response.data;
        } catch (error) {
            this.handleError(error, 'search and scrape');
        }
    }

    async healthCheck(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/test`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    private async makeRequest(endpoint: string, method: 'GET' | 'POST', body?: any): Promise<any> {
        const url = `${this.baseUrl}${endpoint}`;
        const options: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(this.timeout)
        };

        if (body && method === 'POST') {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        
        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage: string;
            
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.error || errorJson.message || errorText;
            } catch {
                errorMessage = errorText || `HTTP ${response.status}`;
            }
            
            throw new McpError(
                ErrorCode.InternalError,
                `Firecrawl API error (${response.status}): ${errorMessage}`
            );
        }

        return await response.json();
    }

    private handleError(error: unknown, operation: string): never {
        if (error instanceof McpError) {
            throw error;
        }
        
        if (error instanceof Error) {
            if (error.name === 'AbortError' || error.message.includes('timeout')) {
                throw new McpError(
                    ErrorCode.InternalError,
                    `Request to ${operation} timed out. The operation may still be processing.`
                );
            }
            
            if (error.message.includes('fetch')) {
                throw new McpError(
                    ErrorCode.InternalError,
                    `Unable to connect to Firecrawl server at ${this.baseUrl}. Make sure Firecrawl is running locally.`
                );
            }
            
            throw new McpError(
                ErrorCode.InternalError,
                `Failed to ${operation}: ${error.message}`
            );
        }
        
        throw new McpError(
            ErrorCode.InternalError,
            `Unknown error occurred while trying to ${operation}`
        );
    }
}