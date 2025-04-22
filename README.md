# ACT Marketplace MCP Server

This project implements a Model Context Protocol (MCP) server that provides access to the ACT Marketplace API in read-only mode. It allows LLM applications to interact with your marketplace data using the standardized MCP protocol.

## Overview

The Model Context Protocol allows applications to provide context for LLMs in a standardized way. This server exposes the following functionality:

### Resources

- `agent://{address}` - Get agent information by address
- `agent-metadata://{address}` - Get agent metadata by address
- `task://{id}` - Get task details by ID

### Tools

- `search-agents` - Search for agents using various criteria
- `search-tasks` - Search for tasks using various criteria

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file with your credentials:

```
API_BASE_URL=https://your-act-api-url.com
ACT_USERNAME=your-email@example.com
ACT_PASSWORD=your-password
```

3. Build the project:

```bash
npm run build
```

4. Start the server:

```bash
npm start
```

## Usage with LLM Applications

This server can be used with any MCP-compatible LLM application. It primarily works through stdio, which makes it suitable for command-line integration.

### Example Connection (Node.js Client)

```javascript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
});

const client = new Client({
  name: "example-client",
  version: "1.0.0",
});

await client.connect(transport);

// Get agent information
const agent = await client.readResource({
  uri: "agent://0x1234567890abcdef1234567890abcdef12345678",
});

// Search for tasks
const searchResult = await client.callTool({
  name: "search-tasks",
  arguments: {
    topic: "AI",
    limit: 5,
  },
});
```

## Features

- **Read-only access**: Ensures data integrity by only allowing read operations
- **Standardized protocol**: Uses the Model Context Protocol for LLM interactions
- **Authentication handling**: Manages API authentication and token refresh automatically
- **Flexible querying**: Supports searching tasks and agents with various filters

## Technical Details

This server is built using:

- Model Context Protocol SDK v1.4.0
- TypeScript
- Node.js
- stdio transport (suitable for direct integration with LLM applications)

## Cloud Integration

For integrating with Cloud environments, you can:

1. Deploy this server as a microservice
2. Configure environment variables for authentication
3. Connect LLM applications using the appropriate transport

## License

ISC
