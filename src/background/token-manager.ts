import { storage } from "../shared/utils/storage";
import { API_BASE_URL } from "../shared/constants";

export class TokenManager {
  private refreshPromise: Promise<string> | null = null;

  async getAccessToken(): Promise<string | null> {
    const token = await storage.get("accessToken");
    if (!token) {
      return null;
    }

    // TODO: Implement token expiration check and refresh if needed
    return token;
  }

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([
      storage.set("accessToken", accessToken),
      storage.set("refreshToken", refreshToken),
    ]);
  }

  async clearTokens(): Promise<void> {
    await storage.remove(["accessToken", "refreshToken", "user"]);
  }

  async refreshAccessToken(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const refreshToken = await storage.get("refreshToken");
        if (!refreshToken) {
          return null;
        }

        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
          await this.clearTokens();
          return null;
        }

        const data = await response.json();
        await this.setTokens(data.accessToken, data.refreshToken);

        return data.accessToken;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }
}

export const tokenManager = new TokenManager();
