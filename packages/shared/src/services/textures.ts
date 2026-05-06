import { api } from './index';
import type { Texture, ApiResponse } from '../types';

export const texturesApi = {
  async list(): Promise<Texture[]> {
    const response = await api.get<ApiResponse<Texture[]>>('/textures');
    return response.data;
  },

  async get(id: string): Promise<Texture> {
    const response = await api.get<ApiResponse<Texture>>(`/textures/${id}`);
    return response.data;
  },

  async upload(file: File): Promise<Texture> {
    const response = await api.upload<ApiResponse<Texture>>('/textures/upload', file);
    return response.data;
  },

  async process(id: string, data: { processedImageUrl: string }): Promise<Texture> {
    const response = await api.post<ApiResponse<Texture>>(
      `/textures/${id}/process`,
      data
    );
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/textures/${id}`);
  },
};
