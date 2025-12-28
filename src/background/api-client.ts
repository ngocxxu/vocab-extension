import { tokenManager } from './token-manager';
import { API_BASE_URL } from '../shared/constants';
import { validateEndpoint, ValidationError } from '../shared/utils/validation';
import { ApiError, NetworkError, TimeoutError } from '../shared/utils/errors';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class ApiClient {
  private baseUrl: string;
  private requestCache = new Map<string, CacheEntry<unknown>>();
  private pendingRequests = new Map<string, Promise<unknown>>();
  private readonly defaultTimeout = 30000;
  private readonly maxRetries = 3;
  private readonly cacheTTL = 60000;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getCacheKey(endpoint: string, options?: RequestInit): string {
    return `${options?.method || 'GET'}:${endpoint}`;
  }

  private isCacheValid(entry: CacheEntry<unknown>): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  private shouldRetry(error: unknown, attempt: number): boolean {
    if (attempt >= this.maxRetries) {
      return false;
    }

    if (error instanceof TimeoutError) {
      return true;
    }

    if (error instanceof NetworkError) {
      return true;
    }

    if (error instanceof ApiError && error.statusCode) {
      return error.statusCode >= 500 && error.statusCode < 600;
    }

    return false;
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    attempt: number = 0
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (!this.shouldRetry(error, attempt)) {
        throw error;
      }

      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      await this.sleep(delay);

      return this.retryWithBackoff(fn, attempt + 1);
    }
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    useCache: boolean = false
  ): Promise<T> {
    validateEndpoint(endpoint);

    const cacheKey = this.getCacheKey(endpoint, options);
    const isGetRequest = (options.method || 'GET').toUpperCase() === 'GET';

    if (isGetRequest && useCache) {
      const cached = this.requestCache.get(cacheKey);
      if (cached && this.isCacheValid(cached)) {
        return cached.data as T;
      }
    }

    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey) as Promise<T>;
    }

    const requestPromise = this.retryWithBackoff(async () => {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}${endpoint}`,
        {
          ...options,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        },
        this.defaultTimeout
      );

      if (response.status === 401 || response.status === 403) {
        const newToken = await tokenManager.refreshAccessToken();

        if (newToken) {
          const retryResponse = await this.fetchWithTimeout(
            `${this.baseUrl}${endpoint}`,
            {
              ...options,
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                ...options.headers,
              },
            },
            this.defaultTimeout
          );

          if (!retryResponse.ok) {
            if (retryResponse.status === 401 || retryResponse.status === 403) {
              await tokenManager.clearTokens();
              chrome.runtime.sendMessage({
                type: 'LOGOUT',
              });
              throw new ApiError('Session expired. Please login again.', 401);
            }
            let errorData;
            try {
              errorData = await retryResponse.json();
            } catch {
              errorData = { message: retryResponse.statusText };
            }
            throw new ApiError(
              errorData.message ||
                `API request failed: ${retryResponse.statusText}`,
              retryResponse.status
            );
          }

          const data = await retryResponse.json();
          if (isGetRequest && useCache) {
            this.requestCache.set(cacheKey, {
              data,
              timestamp: Date.now(),
              ttl: this.cacheTTL,
            });
          }
          return data;
        }

        await tokenManager.clearTokens();
        chrome.runtime.sendMessage({
          type: 'LOGOUT',
        });
        throw new ApiError('Session expired. Please login again.', 401);
      }

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: response.statusText };
        }
        throw new ApiError(
          errorData.message || `API request failed: ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json();
      if (isGetRequest && useCache) {
        this.requestCache.set(cacheKey, {
          data,
          timestamp: Date.now(),
          ttl: this.cacheTTL,
        });
      }
      return data;
    }).catch((error) => {
      if (error instanceof TimeoutError || error instanceof ApiError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimeoutError('Request timeout');
      }
      throw new NetworkError(
        `Network error: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        error instanceof Error ? error : undefined
      );
    }) as Promise<T>;

    this.pendingRequests.set(cacheKey, requestPromise);
    try {
      const result = await requestPromise;
      return result;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  async get<T>(
    endpoint: string,
    options?: RequestInit,
    useCache: boolean = true
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' }, useCache);
  }

  clearCache(): void {
    this.requestCache.clear();
  }

  async post<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestInit
  ): Promise<T> {
    if (body === null || body === undefined) {
      throw new ValidationError('Request body is required for POST requests');
    }

    const headers = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  async put<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestInit
  ): Promise<T> {
    if (body === null || body === undefined) {
      throw new ValidationError('Request body is required for PUT requests');
    }

    const headers = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
