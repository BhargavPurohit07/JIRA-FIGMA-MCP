#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FigmaMcpServer } from "./server.js";
import { getServerConfig } from "./config.js";
import { resolve } from "path";
import { config } from "dotenv";
import { fileURLToPath } from "url";

// Load .env from the current working directory
config({ path: resolve(process.cwd(), ".env") });

export async function startServer(): Promise<void> {
  // Check if we're running in stdio mode (e.g., via CLI)
  const isStdioMode = process.env.NODE_ENV === "cli" || process.argv.includes("--stdio");

  const config = getServerConfig(isStdioMode);

  // Create a new server with Figma API key and optional Jira config
  const jiraConfig = config.jira.domain && config.jira.email && config.jira.apiToken
    ? {
      domain: config.jira.domain,
      email: config.jira.email,
      apiToken: config.jira.apiToken
    }
    : undefined;

  const server = new FigmaMcpServer(config.figmaApiKey, jiraConfig);

  if (isStdioMode) {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } else {
    console.log(`Initializing Figma & Jira MCP Server in HTTP mode on port ${config.port}...`);
    await server.startHttpServer(config.port);
  }
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
