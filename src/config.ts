import { config } from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

// Load environment variables from .env file
config();

interface ServerConfig {
  figmaApiKey: string;
  port: number;
  jira: {
    domain: string;
    email: string;
    apiToken: string;
  };
  configSources: {
    figmaApiKey: "cli" | "env";
    port: "cli" | "env" | "default";
    jiraDomain: "cli" | "env" | "none";
    jiraEmail: "cli" | "env" | "none";
    jiraApiToken: "cli" | "env" | "none";
  };
}

function maskApiKey(key: string): string {
  if (!key || key.length <= 4) return "****";
  return `****${key.slice(-4)}`;
}

interface CliArgs {
  "figma-api-key"?: string;
  port?: number;
  "jira-domain"?: string;
  "jira-email"?: string;
  "jira-api-token"?: string;
}

export function getServerConfig(isStdioMode: boolean): ServerConfig {
  // Parse command line arguments
  const argv = yargs(hideBin(process.argv))
    .options({
      "figma-api-key": {
        type: "string",
        description: "Figma API key",
      },
      port: {
        type: "number",
        description: "Port to run the server on",
      },
      "jira-domain": {
        type: "string",
        description: "Jira domain (e.g., 'company' for company.atlassian.net)",
      },
      "jira-email": {
        type: "string",
        description: "Jira account email",
      },
      "jira-api-token": {
        type: "string",
        description: "Jira API token",
      },
    })
    .help()
    .version("0.1.12")
    .parseSync() as CliArgs;

  const config: ServerConfig = {
    figmaApiKey: "",
    port: 3333,
    jira: {
      domain: "",
      email: "",
      apiToken: "",
    },
    configSources: {
      figmaApiKey: "env",
      port: "default",
      jiraDomain: "none",
      jiraEmail: "none",
      jiraApiToken: "none",
    },
  };

  // Handle FIGMA_API_KEY
  if (argv["figma-api-key"]) {
    config.figmaApiKey = argv["figma-api-key"];
    config.configSources.figmaApiKey = "cli";
  } else if (process.env.FIGMA_API_KEY) {
    config.figmaApiKey = process.env.FIGMA_API_KEY;
    config.configSources.figmaApiKey = "env";
  }

  // Handle PORT
  if (argv.port) {
    config.port = argv.port;
    config.configSources.port = "cli";
  } else if (process.env.PORT) {
    config.port = parseInt(process.env.PORT, 10);
    config.configSources.port = "env";
  }

  // Handle Jira Domain
  if (argv["jira-domain"]) {
    config.jira.domain = argv["jira-domain"];
    config.configSources.jiraDomain = "cli";
  } else if (process.env.JIRA_DOMAIN) {
    config.jira.domain = process.env.JIRA_DOMAIN;
    config.configSources.jiraDomain = "env";
  }

  // Handle Jira Email
  if (argv["jira-email"]) {
    config.jira.email = argv["jira-email"];
    config.configSources.jiraEmail = "cli";
  } else if (process.env.JIRA_EMAIL) {
    config.jira.email = process.env.JIRA_EMAIL;
    config.configSources.jiraEmail = "env";
  }

  // Handle Jira API Token
  if (argv["jira-api-token"]) {
    config.jira.apiToken = argv["jira-api-token"];
    config.configSources.jiraApiToken = "cli";
  } else if (process.env.JIRA_API_TOKEN) {
    config.jira.apiToken = process.env.JIRA_API_TOKEN;
    config.configSources.jiraApiToken = "env";
  }

  // Validate configuration
  if (!config.figmaApiKey) {
    console.error("FIGMA_API_KEY is required (via CLI argument --figma-api-key or .env file)");
    process.exit(1);
  }

  // Log configuration sources
  if (!isStdioMode) {
    console.log("\nConfiguration:");
    console.log(
      `- FIGMA_API_KEY: ${maskApiKey(config.figmaApiKey)} (source: ${config.configSources.figmaApiKey})`,
    );
    console.log(`- PORT: ${config.port} (source: ${config.configSources.port})`);
    
    // Log Jira config if available
    if (config.jira.domain) {
      console.log(`- JIRA_DOMAIN: ${config.jira.domain} (source: ${config.configSources.jiraDomain})`);
    }
    if (config.jira.email) {
      console.log(`- JIRA_EMAIL: ${config.jira.email} (source: ${config.configSources.jiraEmail})`);
    }
    if (config.jira.apiToken) {
      console.log(`- JIRA_API_TOKEN: ${maskApiKey(config.jira.apiToken)} (source: ${config.configSources.jiraApiToken})`);
    }
    
    console.log(); // Empty line for better readability
  }

  return config;
}
