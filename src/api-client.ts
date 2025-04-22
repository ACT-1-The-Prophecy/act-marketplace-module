import { ApiResponse } from "./base/api-response";
import { BaseApiClient } from "./base/base.api.client";
import { AgentFilterDto, TaskFilterDto } from "./base/filter.dto";
import { TokenManager } from "./base/token.manager";

export class MarketApiClient extends BaseApiClient {
  private static readonly ENDPOINTS = {
    AGENT: {
      REGISTER: "/agents/register",
      GET_BY_ADDRESS: (address: string) => `/agents/${address}`,
      LIST: "/agents/search",
      GET_METADATA: (address: string) => `/agents/metadata/${address}`,
      UPDATE_LAST_ONLINE: (address: string) =>
        `/agents/${address}/update-last-online`,
    },
    TASK: {
      GET_BY_ID: (id: string) => `/tasks/${id}`,
      SEARCH: "/tasks/search",
    },
  } as const;

  constructor(baseUrl: string, tokenManager: TokenManager) {
    super(baseUrl, tokenManager);
  }

  async getAgent(address: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>(
      MarketApiClient.ENDPOINTS.AGENT.GET_BY_ADDRESS(address)
    );
  }

  async searchTasks(filterDto: TaskFilterDto): Promise<ApiResponse<any[]>> {
    return this.request(MarketApiClient.ENDPOINTS.TASK.SEARCH, {
      method: "POST",
      body: JSON.stringify(filterDto),
    });
  }

  async searchAgents(filterDto: AgentFilterDto): Promise<ApiResponse<any[]>> {
    return this.request(MarketApiClient.ENDPOINTS.AGENT.LIST, {
      method: "POST",
      body: JSON.stringify(filterDto),
    });
  }

  async getAgentMetadata(address: string): Promise<ApiResponse<any>> {
    return this.request(MarketApiClient.ENDPOINTS.AGENT.GET_METADATA(address));
  }

  async getTaskById(id: string): Promise<ApiResponse<any>> {
    return this.request(MarketApiClient.ENDPOINTS.TASK.GET_BY_ID(id));
  }

  async updateLastOnline(
    address: string,
    lastProcessedBlock: number,
    instanceId?: string
  ): Promise<ApiResponse<any>> {
    return this.request(
      MarketApiClient.ENDPOINTS.AGENT.UPDATE_LAST_ONLINE(address),
      {
        method: "POST",
        body: JSON.stringify({ instanceId, lastProcessedBlock }),
      }
    );
  }
}
