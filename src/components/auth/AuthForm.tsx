import { cn } from "@/shared/utils/utils";
import { useState } from "react";
import { apiClient } from "../../background/api-client";
import type { UserDto } from "../../shared/types/api";
import { completeLogin } from "../../shared/utils/auth";
import {
  validateEmail,
  validateName,
  validatePassword,
  ValidationError,
} from "../../shared/utils/validation";
import { Logo } from '../branding/Logo';
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type Variant = "popup" | "options";

interface AuthFormProps {
  variant?: Variant;
  onSuccess?: (user: UserDto) => void | Promise<void>;
}

export function AuthForm({ variant = "options", onSuccess }: Readonly<AuthFormProps>) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [oauthLoading, setOauthLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const container = variant === "popup" ? "w-80 p-6" : "max-w-md mx-auto p-8";
  const titleCls = variant === "popup" ? "text-xl" : "text-2xl";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      validateEmail(email);
      validatePassword(password);

      if (mode === "signup") {
        validateName(firstName, "First name");
        validateName(lastName, "Last name");
      }

      if (mode === "signin") {
        await apiClient.post("/auth/signin", { email, password });
        const user = await completeLogin();
        await onSuccess?.(user);
      } else {
        await apiClient.post("/auth/signup", { email, password, firstName, lastName });
        const user = await completeLogin();
        await onSuccess?.(user);
      }
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(err.message);
      } else {
        const msg = err instanceof Error ? err.message : "Authentication failed";
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setOauthLoading(true);
    try {
      const redirectTo = chrome.runtime.getURL("src/oauth-callback/index.html");
      const result = await apiClient.post<{ url: string }>("/auth/oauth", {
        provider: "google",
        redirectTo,
      });

      const authUrl = (result as { url?: string }).url;
      if (!authUrl) {
        throw new Error("Missing OAuth URL from server");
      }

      await chrome.tabs.create({ url: authUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign in failed");
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "bg-card border border-border shadow-xl",
        container,
        variant === "popup" ? "" : "rounded-2xl"
      )}
    >
      <div className="mb-4 flex items-center justify-center">
        <Logo className="h-10 w-10" />
      </div>
      <h2 className={`${titleCls} font-semibold text-foreground text-center`}>
        {mode === "signin" ? "Welcome back" : "Create Account"}
      </h2>
      <p className="text-center text-muted-foreground mb-6">
        {mode === "signin"
          ? "Sign in to your account to continue"
          : "Sign up to get started with your vocabulary management"}
      </p>

      <div className="mb-4">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogleLogin}
          disabled={loading || oauthLoading}
        >
          {oauthLoading ? (
            "Connecting…"
          ) : (
            <>
              <svg className="mr-2 size-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </>
          )}
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "signup" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1 text-foreground">
                First name
              </label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-foreground">
                Last name
              </label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold mb-1 text-foreground">
            Email
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="your@email.com"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1 text-foreground">
            Password
          </label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="p-2 bg-accent border border-border rounded">
            <p className="text-xs text-destructive font-medium">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full"
        >
          {loading
            ? mode === "signin"
              ? "Signing in..."
              : "Creating Account..."
            : mode === "signin"
            ? "Sign In"
            : "Create Account"}
        </Button>

        <div className="text-center text-sm text-muted-foreground mt-1">
          {mode === "signin" ? (
            <>
              Don't have an account?{' '}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => {
                  setMode("signup");
                  setError("");
                }}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => {
                  setMode("signin");
                  setError("");
                }}
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

export default AuthForm;
