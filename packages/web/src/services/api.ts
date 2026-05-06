import type { ApiResponse, Project } from '../types';

const API_BASE = '/api/v1';
const TIMEOUT_MS = 15000;

export class ApiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message); this.name = 'ApiError'; this.statusCode = statusCode;
  }
}

class ApiService {
  private token: string | null = null;
  setToken(t: string | null) { this.token = t; }

  private async request<T>(endpoint: string, opts: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const headers: Record<string, string> = opts.body ? { 'Content-Type': 'application/json' } : {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    try {
      const resp = await fetch(url, { ...opts, headers, signal: ctrl.signal });
      clearTimeout(tid);
      const text = await resp.text();
      if (!resp.ok) {
        let msg = `请求失败(${resp.status})`;
        try { const j = JSON.parse(text); msg = j.detail || j.message || msg; } catch {}
        throw new ApiError(msg, resp.status);
      }
      return text ? JSON.parse(text) : ({} as T);
    } catch (err) {
      clearTimeout(tid);
      if (err instanceof ApiError) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') throw new ApiError('请求超时', 408);
      throw new ApiError(err instanceof Error ? err.message : '网络错误', 0);
    }
  }

  get<T>(url: string) { return this.request<T>(url, { method: 'GET' }); }
  post<T>(url: string, data?: unknown) { return this.request<T>(url, { method: 'POST', body: data ? JSON.stringify(data) : undefined }); }
  put<T>(url: string, data?: unknown) { return this.request<T>(url, { method: 'PUT', body: data ? JSON.stringify(data) : undefined }); }
  delete<T>(url: string) { return this.request<T>(url, { method: 'DELETE' }); }
}

export const api = new ApiService();

export async function fetchProjects() { return api.get<ApiResponse<Project[]>>('/projects/'); }
export async function createProject(data: any) { return api.post<ApiResponse<Project>>('/projects/', data); }
export async function deleteProjectApi(id: string) { return api.delete<ApiResponse<null>>(`/projects/${id}`); }
export async function calculateLayout(projectId: string, payload: any) {
  return api.post<ApiResponse<any>>(`/projects/${projectId}/calculate`, payload);
}

export async function sendSketch(file: File | Blob) {
  const fd = new FormData();
  fd.append('file', file);
  const url = `${API_BASE}/sketch/recognize`;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 30000);
  try {
    const resp = await fetch(url, { method: 'POST', body: fd, signal: ctrl.signal });
    clearTimeout(tid);
    const text = await resp.text();
    if (!resp.ok) throw new ApiError(`识别失败(${resp.status})`, resp.status);
    return text ? JSON.parse(text) : { success: false };
  } catch (err) {
    clearTimeout(tid);
    if (err instanceof ApiError) throw err;
    throw new ApiError(err instanceof Error ? err.message : '网络错误', 0);
  }
}

export async function calcAuxiliaryMaterials(data: any) {
  return api.post<ApiResponse<any>>('/materials/calculate', data);
}

export async function getMaterialsReference() {
  return api.get<ApiResponse<any>>('/materials/reference');
}
