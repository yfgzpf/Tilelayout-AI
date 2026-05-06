import { api } from './index';
import type { Order, ApiResponse } from '../types';

export interface CreateOrderRequest {
  projectId: string;
  customerName: string;
  customerPhone: string;
  showTotalPrice: boolean;
  items: {
    skuId: string;
    textureId: string;
    quantityWhole: number;
    quantityCut: number;
  }[];
}

export const ordersApi = {
  async list(): Promise<Order[]> {
    const response = await api.get<ApiResponse<Order[]>>('/orders');
    return response.data;
  },

  async get(id: string): Promise<Order> {
    const response = await api.get<ApiResponse<Order>>(`/orders/${id}`);
    return response.data;
  },

  async create(data: CreateOrderRequest): Promise<Order> {
    const response = await api.post<ApiResponse<Order>>('/orders', data);
    return response.data;
  },

  async updateStatus(id: string, status: string): Promise<Order> {
    const response = await api.put<ApiResponse<Order>>(`/orders/${id}/status`, {
      status,
    });
    return response.data;
  },

  async confirm(id: string, token: string): Promise<Order> {
    const response = await api.post<ApiResponse<Order>>(
      `/orders/${id}/confirm`,
      { token }
    );
    return response.data;
  },

  async getConfirmationData(token: string): Promise<Order> {
    const response = await api.get<ApiResponse<Order>>(
      `/confirmations/${token}`
    );
    return response.data;
  },
};
