import { ApiError } from "./api-error";
import { TokenManager } from "./token.manager";

export abstract class BaseApiClient {
  protected constructor(
    private baseUrl: string,
    private tokenManager: TokenManager,
    private maxRetries: number = 3,
    private baseRetryDelay: number = 1000
  ) {}

  protected async request<T>(
    endpoint: string,
    options: RequestInit = {},
    refreshAttempts = 1
  ): Promise<T> {
    return this.executeWithRetry(() =>
      this.performRequest<T>(endpoint, options, refreshAttempts)
    );
  }

  private async executeWithRetry<T>(
    requestFn: () => Promise<T>,
    maxRetries = this.maxRetries
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        if (attempt === maxRetries) throw error;
        await this.delay(attempt);
      }
    }
    throw new Error("Request failed after max retries");
  }

  private async performRequest<T>(
    endpoint: string,
    options: RequestInit,
    refreshAttempts: number
  ): Promise<T> {
    const token = await this.tokenManager.getValidToken();

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401 && refreshAttempts > 0) {
        this.tokenManager.invalidateToken();
        return this.request(endpoint, options, refreshAttempts - 1);
      }

      throw ApiError.fromResponse(response);
    }

    return response.json();
  }

  private delay(attempt: number): Promise<void> {
    const delay = this.baseRetryDelay * Math.pow(2, attempt);
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
}
