import { z } from "zod";

export const FirecrawlSchemas = {
  'firecrawl_scrape': z.object({
    url: z.string().url().describe("URL to scrape"),
    formats: z.array(z.enum(['markdown', 'html', 'rawHtml', 'links', 'screenshot'])).optional().describe("Output formats to include"),
    includeTags: z.array(z.string()).optional().describe("HTML tags to include in extraction"),
    excludeTags: z.array(z.string()).optional().describe("HTML tags to exclude from extraction"),
    onlyMainContent: z.boolean().optional().describe("Extract only main content"),
    timeout: z.number().optional().describe("Request timeout in milliseconds")
  }),

  'firecrawl_crawl': z.object({
    url: z.string().url().describe("URL to crawl"),
    includePaths: z.array(z.string()).optional().describe("URL patterns to include"),
    excludePaths: z.array(z.string()).optional().describe("URL patterns to exclude"),
    maxDepth: z.number().int().min(0).max(10).optional().describe("Maximum crawl depth (default: 2)"),
    limit: z.number().int().min(1).max(1000).optional().describe("Maximum number of pages to crawl (default: 10)"),
    allowBackwardLinks: z.boolean().optional().describe("Allow crawling backward links"),
    allowExternalLinks: z.boolean().optional().describe("Allow crawling external links")
  }),

  'firecrawl_crawl_status': z.object({
    jobId: z.string().describe("Crawl job ID to check status for")
  }),

  'firecrawl_search': z.object({
    query: z.string().describe("Search query"),
    limit: z.number().int().min(1).max(20).optional().describe("Maximum number of results (default: 5)"),
    location: z.string().optional().describe("Geographic location for search")
  }),

  'firecrawl_health': z.object({})
} as const;

export type FirecrawlToolInputs = {
  [K in keyof typeof FirecrawlSchemas]: z.infer<typeof FirecrawlSchemas[K]>
};