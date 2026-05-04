import { NativeModules, Platform } from 'react-native';

const API_BASE_URL_FROM_ENV = process.env.RN_API_BASE_URL?.trim();
const API_PORT = Number(process.env.RN_API_PORT ?? '4000');

function getMetroHost(): string | null {
  const scriptURL = NativeModules?.SourceCode?.scriptURL as string | undefined;
  if (!scriptURL) {
    return null;
  }

  const match = scriptURL.match(/^https?:\/\/([^/:]+)/i);
  return match?.[1] ?? null;
}

function buildCandidates(): string[] {
  const unique = new Set<string>();
  const add = (url?: string | null) => {
    if (!url) {
      return;
    }
    unique.add(url.replace(/\/$/, ''));
  };

  add(API_BASE_URL_FROM_ENV);

  if (Platform.OS === 'android') {
    // Prefer reverse-mapped loopback first on physical devices.
    add(`http://localhost:${API_PORT}`);
    add(`http://10.110.3.212:${API_PORT}`);
  } else {
    add(`http://localhost:${API_PORT}`);
  }

  const metroHost = getMetroHost();
  if (metroHost) {
    add(`http://${metroHost}:${API_PORT}`);
  }

  if (Platform.OS === 'android') {
    add(`http://10.0.2.2:${API_PORT}`);
  }

  return Array.from(unique);
}

const API_BASE_CANDIDATES = buildCandidates();

let resolvedApiBaseUrl: string | null = null;
const REQUEST_TIMEOUT_MS = 8000;

type ApiErrorPayload = {
  error?: string;
  code?: string;
};

async function parseJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const candidates = resolvedApiBaseUrl
    ? [resolvedApiBaseUrl]
    : API_BASE_CANDIDATES;

  let networkFailureCount = 0;
  let lastNetworkError: unknown = null;

  for (const baseUrl of candidates) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(options?.headers ?? {}),
        },
        ...options,
      });

      clearTimeout(timeoutId);

      const json = await parseJsonSafe(response);

      if (!response.ok) {
        const payload = json as ApiErrorPayload | null;
        const errorMessage =
          payload?.error ??
          `Request failed (${response.status}) at ${baseUrl}${path}`;
        throw new Error(errorMessage);
      }

      resolvedApiBaseUrl = baseUrl;
      return json as T;
    } catch (error) {
      clearTimeout(timeoutId);
      const message =
        error instanceof Error ? error.message.toLowerCase() : String(error);
      const isNetworkError =
        message.includes('network request failed') ||
        message.includes('fetch failed') ||
        message.includes('failed to fetch');

      if (!isNetworkError) {
        throw error;
      }

      networkFailureCount += 1;
      lastNetworkError = error;
    }
  }

  if (networkFailureCount > 0) {
    const detail =
      lastNetworkError instanceof Error
        ? lastNetworkError.message
        : 'Network request failed';

    throw new Error(
      `Cannot reach backend API (${detail}). Tried: ${API_BASE_CANDIDATES.join(
        ', ',
      )}. Configure RN_API_BASE_URL and RN_API_PORT if needed.`,
    );
  }

  throw new Error('Request failed');
}
