import { Logger } from "~/server.js";

export interface JiraIssue {
    id: string;
    key: string;
    summary: string;
    description: string;
    status: string;
    priority: string;
    assignee?: {
        name: string;
        displayName: string;
        emailAddress: string;
    };
    reporter?: {
        name: string;
        displayName: string;
        emailAddress: string;
    };
    created: string;
    updated: string;
    figmaLinks: string[];
    subtasks: JiraIssue[];
    labels: string[];
    issueType: string;
    url: string;
}

export interface JiraError {
    status: number;
    message: string;
}

export class JiraService {
    private readonly baseUrl: string;
    private readonly auth: string;

    constructor(domain: string, email: string, apiToken: string) {
        // Handle both formats: domain with or without .atlassian.net suffix
        const baseDomain = domain.endsWith('.atlassian.net') ? domain : `${domain}.atlassian.net`;
        this.baseUrl = `https://${baseDomain}/rest/api/3`;
        this.auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    }

    private async request<T>(endpoint: string, method: string = 'GET', body?: any): Promise<T> {
        try {
            Logger.log(`Calling ${this.baseUrl}${endpoint}`);

            const options: RequestInit = {
                method,
                headers: {
                    'Authorization': `Basic ${this.auth}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                // Add timeout to prevent hanging requests
                signal: AbortSignal.timeout(30000) // 30 second timeout
            };

            if (body) {
                options.body = JSON.stringify(body);
            }

            const response = await fetch(`${this.baseUrl}${endpoint}`, options);

            if (!response.ok) {
                throw {
                    status: response.status,
                    message: response.statusText || "Unknown error"
                } as JiraError;
            }

            return await response.json();
        } catch (error) {
            if ((error as JiraError).status) {
                throw error;
            }
            if (error instanceof Error) {
                throw new Error(`Failed to make request to Jira API: ${error.message}`);
            }
            throw new Error(`Failed to make request to Jira API: ${error}`);
        }
    }

    private extractFigmaLinks(description: any): string[] {
        if (!description || !description.content) {
            return [];
        }

        const figmaLinks: string[] = [];

        // Recursive function to traverse Atlassian Document Format
        const traverse = (content: any[]) => {
            if (!content || !Array.isArray(content)) return;

            for (const node of content) {
                // Check for links in text nodes with marks
                if (node.type === 'text' && node.marks) {
                    for (const mark of node.marks) {
                        if (mark.type === 'link' && mark.attrs && mark.attrs.href) {
                            const url = mark.attrs.href;
                            if (url.includes('figma.com')) {
                                figmaLinks.push(url);
                            }
                        }
                    }
                }

                // Check for links in paragraph nodes
                if (node.type === 'paragraph') {
                    // Check for links in paragraph marks
                    if (node.marks) {
                        for (const mark of node.marks) {
                            if (mark.type === 'link' && mark.attrs && mark.attrs.href) {
                                const url = mark.attrs.href;
                                if (url.includes('figma.com')) {
                                    figmaLinks.push(url);
                                }
                            }
                        }
                    }
                }

                // Check for links in inlineCard nodes (embedded links)
                if (node.type === 'inlineCard' && node.attrs && node.attrs.url) {
                    const url = node.attrs.url;
                    if (url.includes('figma.com')) {
                        figmaLinks.push(url);
                    }
                }

                // Traverse children
                if (node.content) {
                    traverse(node.content);
                }
            }
        };

        traverse(description.content);

        // Log the raw description content for debugging
        Logger.log('Raw description content:', JSON.stringify(description.content, null, 2));
        Logger.log('Extracted Figma links:', figmaLinks);

        return figmaLinks;
    }

    async getIssue(issueKey: string, depth: number = 1): Promise<JiraIssue> {
        const endpoint = `/issue/${issueKey}?expand=renderedFields,subtasks`;
        const response = await this.request<any>(endpoint);

        // Log all available fields for debugging
        Logger.log('Available fields:', Object.keys(response.fields));

        // Extract Figma links from various potential fields
        const descriptionLinks = this.extractFigmaLinks(response.fields.description);

        // Extract Figma links from customfield_10083 (Designs field)
        let designsFieldLinks: string[] = [];
        if (response.fields.customfield_10083 && Array.isArray(response.fields.customfield_10083)) {
            response.fields.customfield_10083.forEach((item: any) => {
                if (item.url && item.url.includes('figma.com')) {
                    designsFieldLinks.push(item.url);
                }
            });
        }

        const figmaLinks = [...new Set([...descriptionLinks, ...designsFieldLinks])]; // Remove duplicates

        // Process subtasks recursively, but with a depth limit
        let subtasks: JiraIssue[] = [];
        if (depth > 0 && response.fields.subtasks && response.fields.subtasks.length > 0) {
            subtasks = await Promise.all(
                response.fields.subtasks.map((subtask: any) =>
                    this.getIssue(subtask.key, depth - 1)
                )
            );
        } else if (response.fields.subtasks && response.fields.subtasks.length > 0) {
            // If we've reached depth limit but there are subtasks, just include basic info
            subtasks = response.fields.subtasks.map((subtask: any) => ({
                id: subtask.id,
                key: subtask.key,
                summary: subtask.fields?.summary || '',
                description: '',
                status: subtask.fields?.status?.name || '',
                priority: subtask.fields?.priority?.name || '',
                created: '',
                updated: '',
                figmaLinks: [],
                subtasks: [],
                labels: [],
                issueType: subtask.fields?.issuetype?.name || '',
                url: `https://${this.baseUrl.split('/')[2].split('.')[0]}.atlassian.net/browse/${subtask.key}`
            }));
        }

        // Extract text content from description if it exists
        let descriptionText = '';
        if (response.fields.description && response.fields.description.content) {
            const traverse = (content: any[]): string => {
                if (!content || !Array.isArray(content)) return '';
                return content.map(node => {
                    if (node.type === 'text') {
                        return node.text || '';
                    }
                    if (node.content) {
                        return traverse(node.content);
                    }
                    return '';
                }).join(' ');
            };
            descriptionText = traverse(response.fields.description.content);
        }

        const issueData = {
            id: response.id,
            key: response.key,
            summary: response.fields.summary,
            description: descriptionText,
            status: response.fields.status?.name || '',
            priority: response.fields.priority?.name || '',
            assignee: response.fields.assignee ? {
                name: response.fields.assignee.name,
                displayName: response.fields.assignee.displayName,
                emailAddress: response.fields.assignee.emailAddress
            } : undefined,
            reporter: response.fields.reporter ? {
                name: response.fields.reporter.name,
                displayName: response.fields.reporter.displayName,
                emailAddress: response.fields.reporter.emailAddress
            } : undefined,
            created: response.fields.created,
            updated: response.fields.updated,
            figmaLinks,
            subtasks,
            labels: response.fields.labels || [],
            issueType: response.fields.issuetype?.name || '',
            url: `https://${this.baseUrl.split('/')[2].split('.')[0]}.atlassian.net/browse/${response.key}`
        };

        // Log the response size to help diagnose potential timeouts
        const responseSize = JSON.stringify(issueData).length;
        Logger.log(`Response size for ${issueKey}: ${responseSize} characters`);

        return issueData;
    }

    async searchIssues(jql: string, maxResults: number = 50): Promise<JiraIssue[]> {
        const endpoint = `/search`;
        const body = {
            jql,
            maxResults,
            fields: [
                'summary',
                'description',
                'status',
                'priority',
                'assignee',
                'reporter',
                'created',
                'updated',
                'subtasks',
                'labels',
                'issuetype',
                'customfield_10083' // Include designs field
            ]
        };

        const response = await this.request<any>(endpoint, 'POST', body);

        // Get issues in parallel but with limited depth
        const issues = await Promise.all(
            response.issues.map((issue: any) => this.getIssue(issue.key, 1))
        );

        return issues;
    }

    // Extract issue key from Jira URL
    extractIssueKey(url: string): string | null {
        // Handle URLs like https://company.atlassian.net/browse/PROJECT-123
        const match = url.match(/\/browse\/([A-Z]+-\d+)/);
        return match ? match[1] : null;
    }
} 