import type { UserDto } from '@/shared/types/api';
import { useEffect, useRef, useState } from "react";
import { apiClient } from "../background/api-client";
import { tokenManager } from "../background/token-manager";
import { Button } from "../components/ui/button";
import { API_BASE_URL } from "../shared/constants";
import { getCookie } from "../shared/utils/cookies";
import { storage } from "../shared/utils/storage";

type Status = "loading" | "success" | "error";

function parseHashParams(hash: string) {
  const cleaned = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(cleaned);
  return {
    accessToken: params.get("access_token") ?? "",
    refreshToken: params.get("refresh_token") ?? "",
    expiresIn: Number(params.get("expires_in") ?? "0") || 0,
    error: params.get("error_description") ?? params.get("error") ?? "",
  };
}

function getApiCookieUrl(): string {
  const url = new URL(API_BASE_URL);
  return `${url.protocol}//${url.host}/`;
}

async function setAuthCookies(params: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}) {
  const url = getApiCookieUrl();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const accessExp =
    params.expiresIn > 0 ? nowSeconds + params.expiresIn : undefined;
  const refreshExp = nowSeconds + 60 * 60 * 24 * 7;

  console.log("=== Cookie Debug ===");
  console.log("API URL for cookie:", url);
  console.log("accessToken length:", params.accessToken.length);
  console.log("refreshToken length:", params.refreshToken.length);
  console.log("accessExp:", accessExp);
  console.log("secure:", url.startsWith("https"));

  const setOneCookie = (name: string, value: string, exp?: number): Promise<void> => {
    const isSecure = url.startsWith("https");
    
    const details: chrome.cookies.SetDetails = {
      url,
      name,
      value,
      path: "/",
      secure: url.startsWith("https"),
      sameSite: isSecure ? "no_restriction" : "unspecified" as chrome.cookies.SameSiteStatus,
      ...(exp && { expirationDate: exp }),
    };

    console.log(`Setting cookie [${name}]:`, JSON.stringify({
      ...details,
      value: value.slice(0, 20) + "...", // truncate token
    }));

    return new Promise((resolve, reject) => {
      chrome.cookies.set(details, (cookie) => {
        if (chrome.runtime.lastError) {
          console.error(`Cookie [${name}] lastError:`, chrome.runtime.lastError.message);
          reject(new Error(`Failed to set cookie [${name}]: ${chrome.runtime.lastError.message}`));
        } else if (!cookie) {
          console.error(`Cookie [${name}] returned null, no lastError`);
          reject(new Error(`Failed to set cookie [${name}]: returned null`));
        } else {
          console.log(`Cookie [${name}] OK:`, cookie);
          resolve();
        }
      });
    });
  };

  await setOneCookie("accessToken", params.accessToken, accessExp);
  await setOneCookie("refreshToken", params.refreshToken, refreshExp);
}

export default function OAuthCallback() {
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string>("Completing sign in…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const parsed = parseHashParams(window.location.hash);

    history.replaceState(null, "", window.location.pathname);

    const run = async () => {
      try {
        if (parsed.error) {
          throw new Error(parsed.error);
        }
        if (!parsed.accessToken || !parsed.refreshToken) {
          throw new Error("Missing OAuth tokens. Please try signing in again.");
        }

        setMessage("Syncing account…");
        await apiClient.post("/auth/oauth/sync", {
          accessToken: parsed.accessToken,
          refreshToken: parsed.refreshToken,
        });

        setMessage("Saving session…");
        await setAuthCookies({
          accessToken: parsed.accessToken,
          refreshToken: parsed.refreshToken,
          expiresIn: parsed.expiresIn,
        });

        const accessToken = await getCookie("accessToken");
        const refreshToken = await getCookie("refreshToken");
        if (!accessToken || !refreshToken) {
          throw new Error("Failed to persist session cookies.");
        }

        await tokenManager.setTokens(accessToken, refreshToken);
        const user = await apiClient.get("/auth/verify");
        await storage.set("user", user as unknown as UserDto);

        setStatus("success");
        setMessage("Signed in successfully. You can close this tab.");
        setTimeout(() => window.close(), 700);
      } catch (err) {
        setStatus("error");
        setMessage(
          err instanceof Error ? err.message : "OAuth sign in failed."
        );
      }
    };

    run();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-xl space-y-4">
        <div className="text-lg font-semibold">
          {status === "success"
            ? "Success"
            : status === "error"
              ? "Sign in failed"
              : "Signing in"}
        </div>
        <div className="text-sm text-muted-foreground">{message}</div>

        {status === "error" && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                ran.current = false;
                window.location.reload();
              }}
            >
              Retry
            </Button>
            <Button type="button" onClick={() => window.close()}>
              Close
            </Button>
          </div>
        )}

        {status === "success" && (
          <Button type="button" onClick={() => window.close()}>
            Close
          </Button>
        )}
      </div>
    </div>
  );
}