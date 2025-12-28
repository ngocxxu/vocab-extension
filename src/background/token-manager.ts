import { storage } from '../shared/utils/storage';
import { API_BASE_URL } from '../shared/constants';
import { validateToken } from '../shared/utils/validation';
import { NetworkError, TimeoutError } from '../shared/utils/errors';
import { getCookie, removeCookie } from '../shared/utils/cookies';

interface JWTPayload {
  exp?: number;
  iat?: number;
}

export class TokenManager {
  private refreshPromise: Promise<string | null> | null = null;
  private readonly refreshThresholdSeconds = 60;

  private parseJWT(token: string): JWTPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = JSON.parse(
        atob(parts[1].replaceAll('-', '+').replaceAll('_', '/'))
      );
      return payload;
    } catch {
      return null;
    }
  }

  private isTokenExpired(token: string): boolean {
    const payload = this.parseJWT(token);
    if (!payload?.exp) {
      return false;
    }

    const expirationTime = payload.exp * 1000;
    const now = Date.now();
    const threshold = this.refreshThresholdSeconds * 1000;

    return expirationTime - now < threshold;
  }

  async getAccessToken(): Promise<string | null> {
    const token = await getCookie('accessToken');
    if (!token) {
      return null;
    }

    if (this.isTokenExpired(token)) {
      const newToken = await this.refreshAccessToken();
      return newToken;
    }

    return token;
  }

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    if (!accessToken || !refreshToken) {
      throw new Error('Access token and refresh token are required');
    }

    validateToken(accessToken, 'Access token');
    validateToken(refreshToken, 'Refresh token');
  }

  async clearTokens(): Promise<void> {
    await Promise.all([
      removeCookie('accessToken'),
      removeCookie('refreshToken'),
    ]);
    await storage.remove(['user']);
  }

  async refreshAccessToken(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
          const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            await this.clearTokens();
            return null;
          }

          const newAccessToken = await getCookie('accessToken');
          if (!newAccessToken) {
            await this.clearTokens();
            return null;
          }

          validateToken(newAccessToken, 'Access token');

          return newAccessToken;
        } catch (error) {
          clearTimeout(timeoutId);

          if (error instanceof Error && error.name === 'AbortError') {
            throw new TimeoutError('Refresh token request timed out');
          }

          if (error instanceof NetworkError || error instanceof TimeoutError) {
            throw error;
          }

          throw new NetworkError(
            'Failed to refresh access token',
            error instanceof Error ? error : undefined
          );
        }
      } catch (error) {
        if (error instanceof NetworkError || error instanceof TimeoutError) {
          throw error;
        }
        throw new NetworkError(
          'Failed to refresh access token',
          error instanceof Error ? error : undefined
        );
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }
}

export const tokenManager = new TokenManager();
