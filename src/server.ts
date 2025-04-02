import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FigmaService } from "./services/figma.js";
import { JiraService } from "./services/jira.js";
import express, { Request, Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { IncomingMessage, ServerResponse } from "http";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { SimplifiedDesign } from "./services/simplify-node-response.js";

export const Logger = {
  log: (...args: any[]) => {},
  error: (...args: any[]) => {},
};

export class FigmaMcpServer {
  private readonly server: McpServer;
  private readonly figmaService: FigmaService;
  private readonly jiraService: JiraService | null = null;
  private sseTransport: SSEServerTransport | null = null;

  constructor(figmaApiKey: string, jiraConfig?: { domain: string; email: string; apiToken: string }) {
    this.figmaService = new FigmaService(figmaApiKey);
    
    if (jiraConfig && jiraConfig.domain && jiraConfig.email && jiraConfig.apiToken) {
      this.jiraService = new JiraService(jiraConfig.domain, jiraConfig.email, jiraConfig.apiToken);
    }
    
    this.server = new McpServer(
      {
        name: "Figma & Jira MCP Server",
        version: "0.1.12",
      },
      {
        capabilities: {
          logging: {},
          tools: {},
        },
      },
    );

    this.registerTools();
  }

  private registerTools(): void {
    // Tool to get file information
    this.server.tool(
      "get_figma_data",
      "When the nodeId cannot be obtained, obtain the layout information about the entire Figma file",
      {
        fileKey: z
          .string()
          .describe(
            "The key of the Figma file to fetch, often found in a provided URL like figma.com/(file|design)/<fileKey>/...",
          ),
        nodeId: z
          .string()
          .optional()
          .describe(
            "The ID of the node to fetch, often found as URL parameter node-id=<nodeId>, always use if provided",
          ),
        depth: z
          .number()
          .optional()
          .describe(
            "How many levels deep to traverse the node tree, only use if explicitly requested by the user",
          ),
      },
      async ({ fileKey, nodeId, depth }) => {
        try {
          Logger.log(
            `Fetching ${
              depth ? `${depth} layers deep` : "all layers"
            } of ${nodeId ? `node ${nodeId} from file` : `full file`} ${fileKey}`,
          );

          let file: SimplifiedDesign;
          if (nodeId) {
            file = await this.figmaService.getNode(fileKey, nodeId, depth);
          } else {
            file = await this.figmaService.getFile(fileKey, depth);
          }

          Logger.log(`Successfully fetched file: ${file.name}`);
          const { nodes, globalVars, ...metadata } = file;

          // Stringify each node individually to try to avoid max string length error with big files
          const nodesJson = `[${nodes.map((node) => JSON.stringify(node, null, 2)).join(",")}]`;
          const metadataJson = JSON.stringify(metadata, null, 2);
          const globalVarsJson = JSON.stringify(globalVars, null, 2);
          const resultJson = `{ "metadata": ${metadataJson}, "nodes": ${nodesJson}, "globalVars": ${globalVarsJson} }`;

          return {
            content: [{ type: "text", text: resultJson }],
          };
        } catch (error) {
          Logger.error(`Error fetching file ${fileKey}:`, error);
          return {
            isError: true,
            content: [{ type: "text", text: `Error fetching file: ${error}` }],
          };
        }
      },
    );

    // Tool to get Jira issue information
    if (this.jiraService) {
      this.server.tool(
        "get_jira_issue",
        "Fetch information about a Jira issue including its description, status, subtasks, and Figma links",
        {
          issueKey: z
            .string()
            .optional()
            .describe("The key of the Jira issue to fetch (e.g., PROJECT-123)"),
          issueUrl: z
            .string()
            .optional()
            .describe("URL to the Jira issue (e.g., https://company.atlassian.net/browse/PROJECT-123)"),
        },
        async ({ issueKey, issueUrl }) => {
          try {
            let key = issueKey;
            
            // If URL is provided but no key, extract the key from the URL
            if (!key && issueUrl) {
              key = this.jiraService.extractIssueKey(issueUrl) || '';
            }
            
            if (!key) {
              return {
                isError: true,
                content: [{ type: "text", text: "Error: No valid Jira issue key or URL provided" }],
              };
            }
            
            Logger.log(`Fetching Jira issue: ${key}`);
            const issue = await this.jiraService.getIssue(key);
            
            Logger.log(`Successfully fetched Jira issue: ${issue.key} - ${issue.summary}`);
            
            return {
              content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
            };
          } catch (error) {
            Logger.error(`Error fetching Jira issue:`, error);
            return {
              isError: true,
              content: [{ type: "text", text: `Error fetching Jira issue: ${error}` }],
            };
          }
        },
      );
      
      // Tool to search Jira issues
      this.server.tool(
        "search_jira_issues",
        "Search for Jira issues using JQL (Jira Query Language)",
        {
          jql: z
            .string()
            .describe("JQL query to search for issues"),
          maxResults: z
            .number()
            .optional()
            .describe("Maximum number of results to return (default: 50)"),
        },
        async ({ jql, maxResults }) => {
          try {
            Logger.log(`Searching Jira issues with query: ${jql}`);
            const issues = await this.jiraService.searchIssues(jql, maxResults);
            
            Logger.log(`Found ${issues.length} Jira issues`);
            
            return {
              content: [{ type: "text", text: JSON.stringify(issues, null, 2) }],
            };
          } catch (error) {
            Logger.error(`Error searching Jira issues:`, error);
            return {
              isError: true,
              content: [{ type: "text", text: `Error searching Jira issues: ${error}` }],
            };
          }
        },
      );
    }

    // TODO: Clean up all image download related code, particularly getImages in Figma service
    // Tool to download images
    this.server.tool(
      "download_figma_images",
      "Download SVG and PNG images used in a Figma file based on the IDs of image or icon nodes",
      {
        fileKey: z.string().describe("The key of the Figma file containing the node"),
        nodes: z
          .object({
            nodeId: z
              .string()
              .describe("The ID of the Figma image node to fetch, formatted as 1234:5678"),
            imageRef: z
              .string()
              .optional()
              .describe(
                "If a node has an imageRef fill, you must include this variable. Leave blank when downloading Vector SVG images.",
              ),
            fileName: z.string().describe("The local name for saving the fetched file"),
          })
          .array()
          .describe("The nodes to fetch as images"),
        localPath: z
          .string()
          .describe(
            "The absolute path to the directory where images are stored in the project. If the directory does not exist, it will be created. The format of this path should respect the directory format of the operating system you are running on. Don't use any special character escaping in the path name either.",
          ),
      },
      async ({ fileKey, nodes, localPath }) => {
        try {
          const imageFills = nodes.filter(({ imageRef }) => !!imageRef) as {
            nodeId: string;
            imageRef: string;
            fileName: string;
          }[];
          const fillDownloads = this.figmaService.getImageFills(fileKey, imageFills, localPath);
          const renderRequests = nodes
            .filter(({ imageRef }) => !imageRef)
            .map(({ nodeId, fileName }) => ({
              nodeId,
              fileName,
              fileType: fileName.endsWith(".svg") ? ("svg" as const) : ("png" as const),
            }));

          const renderDownloads = this.figmaService.getImages(fileKey, renderRequests, localPath);

          const downloads = await Promise.all([fillDownloads, renderDownloads]).then(([f, r]) => [
            ...f,
            ...r,
          ]);

          // If any download fails, return false
          const saveSuccess = !downloads.find((success) => !success);
          return {
            content: [
              {
                type: "text",
                text: saveSuccess
                  ? `Success, ${downloads.length} images downloaded: ${downloads.join(", ")}`
                  : "Failed",
              },
            ],
          };
        } catch (error) {
          Logger.error(`Error downloading images from file ${fileKey}:`, error);
          return {
            isError: true,
            content: [{ type: "text", text: `Error downloading images: ${error}` }],
          };
        }
      },
    );
  }

  async connect(transport: Transport): Promise<void> {
    // Logger.log("Connecting to transport...");
    await this.server.connect(transport);

    Logger.log = (...args: any[]) => {
      this.server.server.sendLoggingMessage({
        level: "info",
        data: args,
      });
    };
    Logger.error = (...args: any[]) => {
      this.server.server.sendLoggingMessage({
        level: "error",
        data: args,
      });
    };

    Logger.log("Server connected and ready to process requests");
  }

  async startHttpServer(port: number): Promise<void> {
    const app = express();

    app.get("/sse", async (req: Request, res: Response) => {
      console.log("New SSE connection established");
      this.sseTransport = new SSEServerTransport(
        "/messages",
        res as unknown as ServerResponse<IncomingMessage>,
      );
      await this.server.connect(this.sseTransport);
    });

    app.post("/messages", async (req: Request, res: Response) => {
      if (!this.sseTransport) {
        res.sendStatus(400);
        return;
      }
      await this.sseTransport.handlePostMessage(
        req as unknown as IncomingMessage,
        res as unknown as ServerResponse<IncomingMessage>,
      );
    });

    Logger.log = console.log;
    Logger.error = console.error;

    app.listen(port, () => {
      Logger.log(`HTTP server listening on port ${port}`);
      Logger.log(`SSE endpoint available at http://localhost:${port}/sse`);
      Logger.log(`Message endpoint available at http://localhost:${port}/messages`);
      
      if (this.jiraService) {
        Logger.log(`Jira integration is enabled`);
      } else {
        Logger.log(`Jira integration is not enabled. Set JIRA_DOMAIN, JIRA_EMAIL, and JIRA_API_TOKEN to enable it.`);
      }
    });
  }
}
