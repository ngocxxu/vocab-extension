import { apiClient } from '../../background/api-client';
import { tokenManager } from '../../background/token-manager';
import { storage } from './storage';
import type { UserDto } from '../types/api';
import { validateToken } from './validation';
import { getCookie } from './cookies';

export async function completeLogin(): Promise<UserDto> {
  const accessToken = await getCookie('accessToken');
  const refreshToken = await getCookie('refreshToken');

  if (!accessToken || !refreshToken) {
    throw new Error('Access token and refresh token are required');
  }

  validateToken(accessToken, 'Access token');
  validateToken(refreshToken, 'Refresh token');

  await tokenManager.setTokens(accessToken, refreshToken);
  const user = await apiClient.get<UserDto>('/auth/verify');
  await storage.set('user', user);
  return user;
}
