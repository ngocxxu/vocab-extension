import { apiClient } from "../../background/api-client";
import { tokenManager } from "../../background/token-manager";
import { storage } from "./storage";
import type { UserDto } from "../types/api";

export async function completeLogin(tokens: {
  accessToken: string;
  refreshToken: string;
}): Promise<UserDto> {
  await tokenManager.setTokens(tokens.accessToken, tokens.refreshToken);
  const user = await apiClient.get<UserDto>("/auth/verify");
  await storage.set("user", user);
  return user;
}
