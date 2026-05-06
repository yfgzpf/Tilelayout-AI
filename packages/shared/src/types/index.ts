export interface User {
  id: string;
  phone: string;
  isMember: boolean;
  memberUntil?: Date;
  storeProfile?: StoreProfile;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoreProfile {
  userId: string;
  storeName: string;
  logoUrl?: string;
  phone: string;
  address: string;
  qrCodeUrl?: string;
  updatedAt: Date;
}

export interface Texture {
  id: string;
  ownerId: string;
  name: string;
  originalImageUrl: string;
  processedImageUrl?: string;
  widthMm: number;
  heightMm: number;
  createdAt: Date;
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  imageUrl?: string;
  textureId?: string;
  skus: ProductSKU[];
  createdAt: Date;
}

export interface ProductSKU {
  id: string;
  productId: string;
  sizeXMm: number;
  sizeYMm: number;
  unitPrice?: number;
  unit: string;
  stock: number;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  roomPolygon: number[][];
  edgesAnnotated: EdgeAnnotation[];
  tileConfig: TileConfig;
  showPrice: boolean;
  confirmationData?: ConfirmationData;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface EdgeAnnotation {
  edgeIndex: number;
  length: number;
  unit: 'mm' | 'cm' | 'm';
}

export interface TileConfig {
  tileWidth: number;
  tileHeight: number;
  gapWidth: number;
  direction: 'horizontal' | 'vertical' | 'diagonal';
  startPoint: { x: number; y: number };
}

export type ProjectStatus = 'draft' | 'in_progress' | 'completed' | 'archived';

export interface LayoutResult {
  id: string;
  projectId: string;
  textureId: string;
  tiles: Tile[];
  statistics: LayoutStatistics;
  previewImageUrl: string;
  createdAt: Date;
}

export interface Tile {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  isCut: boolean;
  cutFrom?: string;
}

export interface LayoutStatistics {
  totalTiles: number;
  wholeTiles: number;
  cutTiles: number;
  wastePercentage: number;
  totalArea: number;
}

export interface Order {
  id: string;
  projectId: string;
  storeUserId: string;
  customerName: string;
  customerPhone: string;
  status: OrderStatus;
  totalAmount: number;
  showTotalPrice: boolean;
  confirmToken: string;
  confirmedAt?: Date;
  items: OrderItem[];
  createdAt: Date;
}

export type OrderStatus = 'draft' | 'pending' | 'confirmed' | 'processing' | 'completed' | 'cancelled';

export interface OrderItem {
  id: string;
  orderId: string;
  skuId: string;
  textureId: string;
  quantityWhole: number;
  quantityCut: number;
  pricePerPiece: number;
  layoutSnapshot: Tile[];
}

export interface ConfirmationData {
  generatedAt: Date;
  materials: ConfirmationMaterial[];
  storeInfo?: StoreProfile;
  totalPrice?: number;
}

export interface ConfirmationMaterial {
  textureId: string;
  productId: string;
  skuId: string;
  productName: string;
  productImage: string;
  sizeXMm: number;
  sizeYMm: number;
  quantityWhole: number;
  quantityCut: number;
  unitPrice?: number;
  totalPrice?: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ApiError {
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}
