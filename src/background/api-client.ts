import { tokenManager } from "./token-manager";
import { API_BASE_URL } from "../shared/constants";
import { getAuthHeaders } from "../shared/utils/utils";

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await tokenManager.getAccessToken();

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      credentials: "include",
      headers: {
        ...getAuthHeaders(token || undefined),
        ...options.headers,
      },
    });

    if (response.status === 401 || response.status === 403) {
      const newToken = await tokenManager.refreshAccessToken();

      if (newToken) {
        const retryResponse = await fetch(`${this.baseUrl}${endpoint}`, {
          ...options,
          credentials: "include",
          headers: {
            ...getAuthHeaders(newToken),
            ...options.headers,
          },
        });

        if (!retryResponse.ok) {
          if (retryResponse.status === 401 || retryResponse.status === 403) {
            await tokenManager.clearTokens();
            chrome.runtime.sendMessage({
              type: "LOGOUT",
            });
            throw new Error("Session expired. Please login again.");
          }
          const error = await retryResponse
            .json()
            .catch(() => ({ message: retryResponse.statusText }));
          throw new Error(
            error.message || `API request failed: ${retryResponse.statusText}`
          );
        }

        return retryResponse.json();
      }

      await tokenManager.clearTokens();
      chrome.runtime.sendMessage({
        type: "LOGOUT",
      });
      throw new Error("Session expired. Please login again.");
    }

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: response.statusText }));
      throw new Error(
        error.message || `API request failed: ${response.statusText}`
      );
    }

    return response.json();
  }

  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  async post<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async put<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
