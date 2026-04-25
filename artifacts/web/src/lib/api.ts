// ---------------------------------------------------------------------------
// Type-safe API client for the planning platform backend.
// Attaches the JWT bearer token (stored in localStorage) to every request and
// provides a uniform ApiResponse<T> envelope.
// ---------------------------------------------------------------------------

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export class ApiError extends Error {
  status: number;
  body: ApiResponse;

  constructor(status: number, body: ApiResponse) {
    super(body.error ?? `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

const TOKEN_KEY = 'pp_token';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
  }

  // ------------------------------------------------------------------
  // Token helpers
  // ------------------------------------------------------------------

  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  setToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // SSR / incognito – silently ignore
    }
  }

  clearToken(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // SSR / incognito – silently ignore
    }
  }

  // ------------------------------------------------------------------
  // Internal fetch wrapper
  // ------------------------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const init: RequestInit = {
      method,
      headers,
      credentials: 'same-origin',
    };

    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const res = await fetch(url, init);

    // Attempt to parse JSON; fall back to a generic envelope on failure.
    let json: ApiResponse<T>;
    try {
      json = (await res.json()) as ApiResponse<T>;
    } catch {
      json = {
        success: false,
        error: `Unexpected response (${res.status})`,
      };
    }

    if (!res.ok) {
      throw new ApiError(res.status, json);
    }

    return json;
  }

  // ------------------------------------------------------------------
  // Public HTTP verb helpers
  // ------------------------------------------------------------------

  get<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, body);
  }

  patch<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, body);
  }

  delete<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path, body);
  }
}

/** Singleton API client instance used across the application. */
export const api = new ApiClient();
