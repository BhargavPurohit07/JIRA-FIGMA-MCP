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
        this.baseUrl = `https://${domain}.atlassian.net/rest/api/3`;
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
                }
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

                // Traverse children
                if (node.content) {
                    traverse(node.content);
                }
            }
        };

        traverse(description.content);
        return figmaLinks;
    }

    async getIssue(issueKey: string): Promise<JiraIssue> {
        const endpoint = `/issue/${issueKey}?expand=renderedFields,subtasks`;
        const response = await this.request<any>(endpoint);

        const figmaLinks = this.extractFigmaLinks(response.fields.description);

        // Process subtasks recursively
        const subtasks = await Promise.all(
            (response.fields.subtasks || []).map((subtask: any) =>
                this.getIssue(subtask.key)
            )
        );

        return {
            id: response.id,
            key: response.key,
            summary: response.fields.summary,
            description: response.fields.description ? JSON.stringify(response.fields.description) : '',
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
                'issuetype'
            ]
        };

        const response = await this.request<any>(endpoint, 'POST', body);

        const issues = await Promise.all(
            response.issues.map((issue: any) => this.getIssue(issue.key))
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