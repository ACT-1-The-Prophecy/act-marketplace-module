import dotenv from "dotenv";

dotenv.config();

import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { MarketApiClient } from "./api-client";
import { TokenManager } from "./base/token.manager";
import { AgentFilterDto, TaskFilterDto } from "./base/filter.dto";

/**
 * MCP Server for ACT Marketplace API
 * This server provides LLM access to the marketplace API in read-only mode
 */
class MarketplaceMcpServer {
  private server: McpServer;
  private apiClient: MarketApiClient;
  private apiUrl: string;
  private login: string;
  private password: string;

  constructor() {
    this.apiUrl = "https://api.actflow.ai";
    this.login = "great-example-bro@actflow.ai";
    this.password = "great-example-bro@actflow.ai";

    if (!this.apiUrl || !this.login || !this.password) {
      throw new Error(
        "Missing required environment variables: API_BASE_URL, ACT_USERNAME, ACT_PASSWORD"
      );
    }

    const tokenManager = new TokenManager(async () => {
      try {
        console.log(
          `Logging in to ACT API. URL: ${this.apiUrl}, User: ${this.login}`
        );

        const requestBody = JSON.stringify({
          email: this.login,
          password: this.password,
        });

        const response = await fetch(`${this.apiUrl}/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (Node.js)",
          },
          body: requestBody,
          //   agent: agent as any,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `Cannot login to ACT API. URL: ${this.apiUrl} Status: ${response.status} Error: ${errorText}`
          );
          throw new Error(
            `Cannot login to ACT API: ${response.status} - ${errorText}`
          );
        }

        const data = await response.json();
        console.log("ACT API login successful");
        return data.data.access_token;
      } catch (error: any) {
        console.error(`Exception during login to ACT API: ${error.message}`);
        throw error;
      }
    }, 60);

    this.apiClient = new MarketApiClient(this.apiUrl, tokenManager);

    this.server = new McpServer({
      name: "ACT Marketplace API",
      version: "1.0.0",
    });

    this.registerResources();
    this.registerTools();
  }

  private registerResources() {
    this.server.resource(
      "agent",
      new ResourceTemplate("agent://{address}", { list: undefined }),
      async (uri, { address }) => {
        if (Array.isArray(address)) {
          throw new Error("Address must be a single string");
        }
        const response = await this.apiClient.getAgent(address);
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(response.data || {}, null, 2),
            },
          ],
        };
      }
    );

    this.server.resource(
      "agent-metadata",
      new ResourceTemplate("agent-metadata://{address}", { list: undefined }),
      async (uri, { address }) => {
        if (Array.isArray(address)) {
          throw new Error("Address must be a single string");
        }
        const response = await this.apiClient.getAgentMetadata(address);
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(response.data || {}, null, 2),
            },
          ],
        };
      }
    );

    this.server.resource(
      "task",
      new ResourceTemplate("task://{id}", { list: undefined }),
      async (uri, { id }) => {
        if (Array.isArray(id)) {
          throw new Error("Task ID must be a single string");
        }
        const response = await this.apiClient.getTaskById(id);
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(response.data || {}, null, 2),
            },
          ],
        };
      }
    );
  }

  private registerTools() {
    this.server.tool(
      "search-agents",
      {
        topics: z.array(z.string()).optional(),
        skills: z.array(z.string()).optional(),
        isPaused: z.boolean().optional(),
        isDeleted: z.boolean().optional(),
        isAutoAssigned: z.boolean().optional(),
        offset: z.number().optional(),
        limit: z.number().optional(),
      },
      async (params) => {
        try {
          const filterDto: AgentFilterDto = {
            topics: params.topics,
            skills: params.skills,
            isPaused: params.isPaused,
            isDeleted: params.isDeleted,
            isAutoAssigned: params.isAutoAssigned,
            offset: params.offset,
            limit: params.limit || 10,
          };

          const response = await this.apiClient.searchAgents(filterDto);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(response.data || [], null, 2),
              },
            ],
          };
        } catch (error: any) {
          console.error("Error searching agents:", error);
          return {
            content: [
              {
                type: "text",
                text: `Error searching agents: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
      }
    );

    this.server.tool(
      "search-tasks",
      {
        state: z.number().optional(),
        creatorWallets: z.array(z.string()).optional(),
        assignedAgent: z.string().optional(),
        topic: z.string().optional(),
        offset: z.number().optional(),
        limit: z.number().optional(),
      },
      async (params) => {
        try {
          const filterDto: TaskFilterDto = {
            state: params.state,
            creatorWallets: params.creatorWallets,
            assignedAgent: params.assignedAgent,
            topic: params.topic,
            offset: params.offset,
            limit: params.limit || 10,
          };

          const response = await this.apiClient.searchTasks(filterDto);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(response.data || [], null, 2),
              },
            ],
          };
        } catch (error: any) {
          console.error("Error searching tasks:", error);
          return {
            content: [
              {
                type: "text",
                text: `Error searching tasks: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  async start() {
    try {
      console.log("Starting ACT Marketplace MCP Server...");
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      console.log("ACT Marketplace MCP Server ready");
    } catch (error) {
      console.error("Failed to start MCP server:", error);
      process.exit(1);
    }
  }
}

async function main() {
  const server = new MarketplaceMcpServer();
  await server.start();
  console.error("Marketplace MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
