<a href="https://www.framelink.ai/?utm_source=github&utm_medium=readme&utm_campaign=readme" target="_blank" rel="noopener">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://www.framelink.ai/github/HeaderDark.png" />
    <img alt="Framelink" src="https://www.framelink.ai/github/HeaderLight.png" />
  </picture>
</a>

<div align="center">
  <h1>Framelink Figma & Jira MCP Server</h1>
  <h3>Give your coding agent access to your Figma and Jira data.<br/>Implement designs in any framework in one-shot.</h3>
</div>

<br/>

Give [Cursor](https://cursor.sh/), [Windsurf](https://codeium.com/windsurf), [Cline](https://cline.bot/), and other AI-powered coding tools access to your Figma files and Jira tickets with this [Model Context Protocol](https://modelcontextprotocol.io/introduction) server.

When Cursor has access to Figma design data and Jira tickets, it's **way** better at one-shotting designs accurately and implementing features based on specifications.

<h3><a href="https://www.framelink.ai/docs/quickstart?utm_source=github&utm_medium=readme&utm_campaign=readme">See quickstart instructions →</a></h3>

## Demo

[Watch a demo of building a UI in Cursor with Figma design data](https://youtu.be/6G9yb-LrEqg)

[![Watch the video](https://img.youtube.com/vi/6G9yb-LrEqg/maxresdefault.jpg)](https://youtu.be/6G9yb-LrEqg)

## How it works

1. Open your IDE's chat (e.g. agent mode in Cursor).
2. Paste a link to a Figma file, frame, or group, or a Jira ticket URL.
3. Ask Cursor to do something with the Figma file or Jira ticket—e.g. implement the design or analyze the requirements.
4. Cursor will fetch the relevant metadata and use it to write your code.

This MCP server is specifically designed for use with Cursor. Before responding with context from the [Figma API](https://www.figma.com/developers/api) or [Jira API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/), it simplifies and translates the response so only the most relevant information is provided to the model.

Reducing the amount of context provided to the model helps make the AI more accurate and the responses more relevant.

## Getting Started

Many code editors and other AI clients use a configuration file to manage MCP servers.

The `figma-developer-mcp` server can be configured by adding the following to your configuration file.

> NOTE: You will need to create a Figma access token to use the Figma functionality. Instructions on how to create a Figma API access token can be found [here](https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens).
>
> To use the Jira functionality, you will also need to create a Jira API token. Instructions on how to create a Jira API token can be found [here](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/).

### MacOS / Linux

```json
{
  "mcpServers": {
    "Framelink Figma & Jira MCP": {
      "command": "npx",
      "args": ["-y", "figma-developer-mcp", "--figma-api-key=YOUR-FIGMA-KEY", "--jira-domain=YOUR-JIRA-DOMAIN", "--jira-email=YOUR-JIRA-EMAIL", "--jira-api-token=YOUR-JIRA-TOKEN", "--stdio"]
    }
  }
}
```

### Windows

```json
{
  "mcpServers": {
    "Framelink Figma & Jira MCP": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "figma-developer-mcp", "--figma-api-key=YOUR-FIGMA-KEY", "--jira-domain=YOUR-JIRA-DOMAIN", "--jira-email=YOUR-JIRA-EMAIL", "--jira-api-token=YOUR-JIRA-TOKEN", "--stdio"]
    }
  }
}
```

### Environment Variables

You can also configure the server using environment variables:

```
FIGMA_API_KEY=your-figma-api-key
PORT=3333
JIRA_DOMAIN=your-company-domain
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-jira-api-token
```

Create a `.env` file in your project root with these variables.

## Jira Integration

The Jira integration allows you to:

1. **Fetch Jira tickets**: Provide a Jira ticket URL or issue key to fetch detailed information.
2. **Access linked Figma designs**: The server automatically extracts Figma links from Jira ticket descriptions.
3. **Get subtasks**: View all subtasks associated with a Jira ticket.
4. **Search Jira issues**: Use JQL (Jira Query Language) to find relevant tickets.

### How to Use Jira Integration

1. **Configure Jira credentials** as shown above.
2. In your AI-powered coding tool, paste a Jira ticket URL like `https://yourcompany.atlassian.net/browse/PROJECT-123`.
3. Your AI assistant will automatically extract information from the ticket, including any Figma links contained in it.
4. You can ask questions about the ticket, request implementation based on specifications, or inquire about linked designs.

### Required Jira Configuration

- **JIRA_DOMAIN**: Your Jira domain (e.g., `mycompany` for `mycompany.atlassian.net`)
- **JIRA_EMAIL**: The email associated with your Atlassian account
- **JIRA_API_TOKEN**: Your Jira API token

If you need more information on how to configure the Framelink Figma & Jira MCP server, see the [Framelink docs](https://www.framelink.ai/docs/quickstart?utm_source=github&utm_medium=readme&utm_campaign=readme).


## Learn More

The Framelink Figma & Jira MCP server is simple but powerful. Get the most out of it by learning more at the [Framelink](https://framelink.ai?utm_source=github&utm_medium=readme&utm_campaign=readme) site.
