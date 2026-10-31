export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export interface StructuredApiError {
  errorCode?: string;
  title?: string;
  message?: string;
  action?: string;
  isNetworkError?: boolean;
}

export function getStructuredApiError(err: unknown): StructuredApiError | null {
  if (err instanceof ApiError && err.data?.detail && typeof err.data.detail === 'object' && !Array.isArray(err.data.detail)) {
    return {
      errorCode: err.data.detail.error_code,
      title: err.data.detail.title,
      message: err.data.detail.message,
      action: err.data.detail.action,
      isNetworkError: err.data.detail.is_network_error,
    };
  }
  return null;
}

export function formatErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0) {
      return 'Unable to connect to RolePilot. Check your connection and try again.';
    }
    if (err.status === 401) {
      return 'Your session has expired. Please sign in again.';
    }
    if (err.status === 403) {
      return typeof err.data?.detail === 'string'
        ? err.data.detail
        : 'You do not have permission to perform this action.';
    }
    if (err.status >= 500) {
      return "An unexpected server error occurred. Please try again.";
    }
    if (typeof err.data?.detail === 'string') {
      return err.data.detail;
    }
    if (err.data?.detail && typeof err.data.detail === 'object' && !Array.isArray(err.data.detail)) {
      if (typeof err.data?.detail?.message === 'string') {
        return err.data.detail.message;
      }
    }
    if (Array.isArray(err.data?.detail)) {
      return err.data.detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ');
    }
    return err.message;
  }
  if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) {
    return 'Unable to connect to RolePilot. Check your connection and try again.';
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed')) {
      return 'Unable to connect to RolePilot. Check your connection and try again.';
    }
    return err.message;
  }
  return 'An unexpected error occurred. Please try again.';
}

const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export interface ApiRequestOptions extends RequestInit {
  bypassCache?: boolean;
  cacheTtlMs?: number;
  noCache?: boolean;
}

interface CacheRecord<T> {
  data: T;
  timestamp: number;
}

// In-memory response cache and in-flight request deduplication map
const apiCache = new Map<string, CacheRecord<any>>();
const inflightRequests = new Map<string, Promise<any>>();
const DEFAULT_CACHE_TTL_MS = 60_000; // 60 seconds
let lastActiveUserScope: string = 'uninitialized';

function hashToken(token: string | null): string {
  if (!token) return 'anonymous';
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    hash = (hash << 5) - hash + token.charCodeAt(i);
    hash |= 0;
  }
  return `user_${Math.abs(hash).toString(36)}`;
}

const SENSITIVE_PATH_PATTERNS = [
  '/auth/',
  '/credentials',
  '/tokens',
  '/password',
  '/session',
  '/automation/runs',
];

function isSensitiveEndpoint(endpoint: string): boolean {
  const lower = endpoint.toLowerCase();
  return SENSITIVE_PATH_PATTERNS.some((pattern) => lower.includes(pattern));
}

export function clearApiCache(): void {
  apiCache.clear();
  inflightRequests.clear();
}

export function invalidateApiCache(prefix?: string): void {
  if (!prefix) {
    apiCache.clear();
    return;
  }
  for (const key of apiCache.keys()) {
    if (key.includes(prefix)) {
      apiCache.delete(key);
    }
  }
}

// Clear all cache records immediately on authentication state changes
if (typeof window !== 'undefined') {
  window.addEventListener('auth:logout', clearApiCache);
  window.addEventListener('auth:cleared', clearApiCache);
  window.addEventListener('auth:unauthorized', clearApiCache);
}

async function request<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  const bypassCache = !!options.bypassCache || !!options.noCache;
  const ttl = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const token =
    (typeof localStorage !== 'undefined' ? localStorage.getItem('supabase_access_token') : null) ||
    (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('supabase_access_token') : null);

  // Determine user-scoped context for cache partition
  const userScope = hashToken(token);

  // If user context switched (e.g. login, logout, account switch), flush stale cache
  if (lastActiveUserScope !== 'uninitialized' && lastActiveUserScope !== userScope) {
    clearApiCache();
  }
  lastActiveUserScope = userScope;

  // Sensitive endpoints are never cached
  const isSensitive = isSensitiveEndpoint(endpoint);
  const shouldCache = isGet && !bypassCache && !isSensitive;

  // Cache key incorporates authenticated user scope, full endpoint path and query parameters
  const cacheKey = `${userScope}::${endpoint}`;

  // 1. Check in-memory cache for eligible GET requests
  if (shouldCache) {
    const cached = apiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data as T;
    }

    // 2. Deduplicate simultaneous in-flight GET requests
    const pending = inflightRequests.get(cacheKey);
    if (pending) {
      return pending as Promise<T>;
    }
  }

  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');

  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const fetchPromise = (async () => {
    let response: Response;
    try {
      response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (netErr: any) {
      throw new ApiError(
        0,
        'Unable to connect to RolePilot. Check your connection and try again.',
        netErr
      );
    }

    if (response.status === 204) {
      return {} as T;
    }

    let data: any = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      if (response.status === 401) {
        clearApiCache();
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }

      let errorMessage = `HTTP Error ${response.status}`;
      if (response.status === 401) {
        errorMessage = 'Your session has expired. Please sign in again.';
      } else if (response.status === 403) {
        errorMessage = 'You do not have permission to perform this action.';
      } else if (response.status >= 500) {
        errorMessage = "We couldn't save your policy acceptance. Please try again.";
      }

      if (data && typeof data === 'object') {
        if (typeof data.detail === 'string') {
          errorMessage = data.detail;
        } else if (Array.isArray(data.detail)) {
          errorMessage = data.detail.map((d: any) => `${d.loc?.slice(-1)[0] || 'Field'}: ${d.msg}`).join(', ');
        }
      }

      throw new ApiError(response.status, errorMessage, data);
    }

    // Cache successful GET responses
    if (shouldCache) {
      apiCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });
    } else if (!isGet) {
      // Mutations invalidate related cache records for this resource
      const rootPrefix = endpoint.split('?')[0].split('/').slice(0, 4).join('/');
      invalidateApiCache(rootPrefix);
    }

    return data as T;
  })();

  if (shouldCache) {
    inflightRequests.set(cacheKey, fetchPromise);
    try {
      return await fetchPromise;
    } finally {
      inflightRequests.delete(cacheKey);
    }
  }

  return fetchPromise;
}

export const apiClient = {
  get: <T>(endpoint: string, options?: ApiRequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  getFresh: <T>(endpoint: string, options?: ApiRequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET', bypassCache: true }),

  post: <T>(endpoint: string, body?: any, options?: ApiRequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  put: <T>(endpoint: string, body?: any, options?: ApiRequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  patch: <T>(endpoint: string, body?: any, options?: ApiRequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  delete: <T>(endpoint: string, options?: ApiRequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),

  invalidateCache: invalidateApiCache,
};
