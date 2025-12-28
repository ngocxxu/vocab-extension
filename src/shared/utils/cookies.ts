import { API_BASE_URL } from '../constants';

function getCookieDomain(): string {
  try {
    const url = new URL(API_BASE_URL);
    return url.origin;
  } catch {
    throw new Error('Invalid API_BASE_URL format');
  }
}

export async function getCookie(name: string): Promise<string | null> {
  try {
    const domain = getCookieDomain();
    const cookie = await chrome.cookies.get({
      url: domain,
      name,
    });

    return cookie?.value || null;
  } catch (error) {
    throw new Error(
      `Failed to get cookie ${name}: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

export async function removeCookie(name: string): Promise<void> {
  try {
    const domain = getCookieDomain();
    await chrome.cookies.remove({
      url: domain,
      name,
    });
  } catch (error) {
    throw new Error(
      `Failed to remove cookie ${name}: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

