import { api } from './index';
import type { Project, LayoutResult, ApiResponse } from '../types';

export interface CreateProjectRequest {
  name: string;
  roomPolygon: number[][];
  edgesAnnotated?: { edgeIndex: number; length: number; unit: string }[];
  tileConfig?: {
    tileWidth: number;
    tileHeight: number;
    gapWidth: number;
    direction: string;
    startPoint: { x: number; y: number };
  };
}

export interface CalculateLayoutRequest {
  textureId?: string;
  config?: {
    tileWidth: number;
    tileHeight: number;
    gapWidth: number;
    direction: string;
    startPoint: { x: number; y: number };
  };
  optimize?: boolean;
}

function transformProjectResponse(data: any): Project {
  return {
    id: data.id,
    userId: data.userId || '',
    name: data.name,
    roomPolygon: data.roomPolygon || [],
    edgesAnnotated: data.edgesAnnotated || [],
    tileConfig: data.tileConfig || {
      tileWidth: 800,
      tileHeight: 800,
      gapWidth: 3,
      direction: 'horizontal',
      startPoint: { x: 0, y: 0 },
    },
    showPrice: data.showPrice ?? true,
    confirmationData: data.confirmationData,
    status: data.status || 'draft',
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  };
}

function transformLayoutResponse(data: any): LayoutResult {
  return {
    id: data.id,
    projectId: data.projectId,
    textureId: data.textureId || '',
    tiles: data.tiles || [],
    statistics: data.statistics || {
      totalTiles: 0,
      wholeTiles: 0,
      cutTiles: 0,
      wastePercentage: 0,
      totalArea: 0,
    },
    previewImageUrl: data.previewImageUrl || '',
    createdAt: new Date(data.createdAt),
  };
}

export const projectsApi = {
  async list(): Promise<Project[]> {
    try {
      const response = await api.get<ApiResponse<any[]>>('/projects/');
      return response.data.map(transformProjectResponse);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      return [];
    }
  },

  async get(id: string): Promise<Project> {
    const response = await api.get<ApiResponse<any>>(`/projects/${id}`);
    return transformProjectResponse(response.data);
  },

  async create(data: CreateProjectRequest): Promise<Project> {
    const payload = {
      name: data.name,
      room_polygon: data.roomPolygon,
      edges_annotated: data.edgesAnnotated || [],
      tile_config: data.tileConfig ? {
        tile_width: data.tileConfig.tileWidth,
        tile_height: data.tileConfig.tileHeight,
        gap_width: data.tileConfig.gapWidth,
        direction: data.tileConfig.direction,
        start_point: [data.tileConfig.startPoint.x, data.tileConfig.startPoint.y],
      } : null,
    };
    const response = await api.post<ApiResponse<any>>('/projects/', payload);
    return transformProjectResponse(response.data);
  },

  async update(id: string, data: Partial<CreateProjectRequest>): Promise<Project> {
    const payload: any = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.roomPolygon !== undefined) payload.room_polygon = data.roomPolygon;
    if (data.edgesAnnotated !== undefined) payload.edges_annotated = data.edgesAnnotated;
    if (data.tileConfig !== undefined) {
      payload.tile_config = {
        tile_width: data.tileConfig.tileWidth,
        tile_height: data.tileConfig.tileHeight,
        gap_width: data.tileConfig.gapWidth,
        direction: data.tileConfig.direction,
        start_point: [data.tileConfig.startPoint.x, data.tileConfig.startPoint.y],
      };
    }
    const response = await api.put<ApiResponse<any>>(`/projects/${id}`, payload);
    return transformProjectResponse(response.data);
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/projects/${id}`);
  },

  async calculateLayout(
    projectId: string,
    data: CalculateLayoutRequest
  ): Promise<LayoutResult> {
    const payload = {
      texture_id: data.textureId,
      config: data.config ? {
        tile_width: data.config.tileWidth,
        tile_height: data.config.tileHeight,
        gap_width: data.config.gapWidth,
        direction: data.config.direction,
        start_point: [data.config.startPoint.x, data.config.startPoint.y],
      } : null,
      optimize: data.optimize || false,
    };
    const response = await api.post<ApiResponse<any>>(
      `/projects/${projectId}/calculate`,
      payload
    );
    return transformLayoutResponse(response.data);
  },

  async getLayout(projectId: string): Promise<LayoutResult> {
    const response = await api.get<ApiResponse<any>>(
      `/projects/${projectId}/layout`
    );
    return transformLayoutResponse(response.data);
  },

  async exportPdf(projectId: string): Promise<Blob> {
    const response = await fetch(
      `/api/v1/projects/${projectId}/export/pdf`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      }
    );
    return response.blob();
  },

  async exportPpt(projectId: string): Promise<Blob> {
    const response = await fetch(
      `/api/v1/projects/${projectId}/export/ppt`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      }
    );
    return response.blob();
  },
};

export const createProject = (data: any) => projectsApi.create(data);
export const getProjectById = (id: string) => projectsApi.get(id);
export const updateProject = (id: string, data: any) => projectsApi.update(id, data);
