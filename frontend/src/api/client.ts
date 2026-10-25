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
      return "We couldn't save your policy acceptance. Please try again.";
    }
    if (typeof err.data?.detail === 'string') {
      return err.data.detail;
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

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('supabase_access_token');

  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');

  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

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

  return data as T;
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  put: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  patch: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  delete: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};
