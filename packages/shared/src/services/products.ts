import { api } from './index';
import type { Product, ProductSKU, ApiResponse } from '../types';

export interface CreateProductRequest {
  name: string;
  imageUrl?: string;
  textureId?: string;
}

export interface CreateSKURequest {
  sizeXMm: number;
  sizeYMm: number;
  unitPrice?: number;
  unit?: string;
  stock?: number;
}

export const productsApi = {
  async list(): Promise<Product[]> {
    const response = await api.get<ApiResponse<Product[]>>('/products');
    return response.data;
  },

  async get(id: string): Promise<Product> {
    const response = await api.get<ApiResponse<Product>>(`/products/${id}`);
    return response.data;
  },

  async create(data: CreateProductRequest): Promise<Product> {
    const response = await api.post<ApiResponse<Product>>('/products', data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/products/${id}`);
  },

  async addSKU(productId: string, data: CreateSKURequest): Promise<ProductSKU> {
    const response = await api.post<ApiResponse<ProductSKU>>(
      `/products/${productId}/skus`,
      data
    );
    return response.data;
  },

  async updateSKU(
    productId: string,
    skuId: string,
    data: Partial<ProductSKU>
  ): Promise<ProductSKU> {
    const response = await api.put<ApiResponse<ProductSKU>>(
      `/products/${productId}/skus/${skuId}`,
      data
    );
    return response.data;
  },

  async deleteSKU(productId: string, skuId: string): Promise<void> {
    await api.delete(`/products/${productId}/skus/${skuId}`);
  },
};
