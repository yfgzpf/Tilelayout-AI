const API_BASE = '/api/v1';
const REQUEST_TIMEOUT_MS = 15000;

class ApiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

class ApiService {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) { this.token = token; }
  getToken(): string | null { return this.token; }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const headers: Record<string, string> = {};
    if (options.body && options.body instanceof FormData) {
      // FormData - don't set Content-Type
    } else if (options.body) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    if (options.headers) {
      Object.entries(options.headers as Record<string, string>).forEach(([k, v]) => { headers[k] = v; });
    }

    try {
      const response = await fetch(url, { ...options, headers, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) {
        let errorBody: { message?: string; detail?: string } = {};
        try { errorBody = await response.json(); } catch {}
        const msg = errorBody.message || errorBody.detail || `API request failed (${response.status})`;
        throw new ApiError(msg, response.status);
      }
      const text = await response.text();
      if (text.length === 0) return {} as T;
      return JSON.parse(text) as T;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof ApiError) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') throw new ApiError('请求超时', 408);
      throw new ApiError(err instanceof Error ? err.message : '网络请求失败', 0);
    }
  }

  async get<T>(endpoint: string): Promise<T> { return this.request<T>(endpoint, { method: 'GET' }); }
  async post<T>(endpoint: string, data?: unknown): Promise<T> { return this.request<T>(endpoint, { method: 'POST', body: data ? JSON.stringify(data) : undefined }); }
  async put<T>(endpoint: string, data?: unknown): Promise<T> { return this.request<T>(endpoint, { method: 'PUT', body: data ? JSON.stringify(data) : undefined }); }
  async delete<T>(endpoint: string): Promise<T> { return this.request<T>(endpoint, { method: 'DELETE' }); }

  async upload<T>(endpoint: string, file: File): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const formData = new FormData();
    formData.append('file', file);
    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    try {
      const response = await fetch(url, { method: 'POST', headers, body: formData, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const errorBody = await response.json();
        throw new ApiError(errorBody.message || errorBody.detail || 'Upload failed', response.status);
      }
      return response.json() as T;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof ApiError) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') throw new ApiError('上传超时', 408);
      throw new ApiError(err instanceof Error ? err.message : '上传失败', 0);
    }
  }

  async downloadBlob(endpoint: string): Promise<Blob> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      let msg = `下载失败(${resp.status})`;
      try { const j = await resp.json(); msg = j.detail || j.message || msg; } catch {}
      throw new ApiError(msg, resp.status);
    }
    return resp.blob();
  }
}

export const api = new ApiService(API_BASE);
export { ApiError };

export * from './auth';
export * from './projects';
export * from './textures';
export * from './products';
export * from './orders';
