import { useState } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { apiClient } from "../../background/api-client";
import { completeLogin } from "../../shared/utils/auth";
import type { UserDto } from "../../shared/types/api";
import { cn } from "@/shared/utils/utils";

type Variant = "popup" | "options";

interface AuthFormProps {
  variant?: Variant;
  onSuccess?: (user: UserDto) => void | Promise<void>;
}

export function AuthForm({ variant = "options", onSuccess }: AuthFormProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      if (mode === "signin") {
        const res = await apiClient.post<{
          accessToken: string;
          refreshToken: string;
        }>("/auth/signin", { email, password });
        const user = await completeLogin(res);
        await onSuccess?.(user);
      } else {
        const res = await apiClient.post<{
          accessToken?: string;
          refreshToken?: string;
        }>("/auth/signup", { email, password, firstName, lastName });
        if (res.accessToken && res.refreshToken) {
          const user = await completeLogin({
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
          });
          await onSuccess?.(user);
        } else {
          // Some APIs return no tokens on signup; try sign-in immediately
          const login = await apiClient.post<{
            accessToken: string;
            refreshToken: string;
          }>("/auth/signin", { email, password });
          const user = await completeLogin(login);
          await onSuccess?.(user);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn('bg-white  border border-slate-200 shadow-xl', container, variant === "popup" ? "" : "rounded-2xl")}>
      <div className="mb-4 flex items-center justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-r from-purple-600 to-blue-600">
          <span className="text-xl font-bold text-white">V</span>
        </div>
      </div>
      <h2 className={`${titleCls} font-semibold text-slate-900 text-center`}>
        {mode === "signin" ? "Welcome back" : "Create Account"}
      </h2>
      <p className="text-center text-gray-600 mb-6">
        {mode === "signin"
          ? "Sign in to your account to continue"
          : "Sign up to get started with your vocabulary management"}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "signup" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700">
                First name
              </label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-700">
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
          <label className="block text-xs font-semibold mb-1 text-slate-700">
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
          <label className="block text-xs font-semibold mb-1 text-slate-700">
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
          <div className="p-2 bg-red-50 border border-red-200 rounded">
            <p className="text-xs text-red-700 font-medium">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        >
          {loading
            ? mode === "signin"
              ? "Signing in..."
              : "Creating Account..."
            : mode === "signin"
            ? "Sign In"
            : "Create Account"}
        </Button>

        <div className="text-center text-sm text-gray-600 mt-1">
          {mode === "signin" ? (
            <>
              Don't have an account?{' '}
              <button
                type="button"
                className="font-medium text-purple-600 hover:text-purple-500"
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
                className="font-medium text-purple-600 hover:text-purple-500"
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
