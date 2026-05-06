import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import type { User, Project, Texture, Product, Order } from '../types';

interface AppState {
  user: User | null;
  currentProject: Project | null;
  projects: Project[];
  textures: Texture[];
  products: Product[];
  orders: Order[];
  isLoading: boolean;
  error: string | null;
}

interface AppActions {
  setUser: (user: User | null) => void;
  setCurrentProject: (project: Project | null) => void;
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  setTextures: (textures: Texture[]) => void;
  addTexture: (texture: Texture) => void;
  deleteTexture: (id: string) => void;
  setProducts: (products: Product[]) => void;
  addProduct: (product: Product) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  setOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  updateOrder: (id: string, updates: Partial<Order>) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState: AppState = {
  user: null, currentProject: null, projects: [], textures: [],
  products: [], orders: [], isLoading: false, error: null,
};

export const useAppStore = create<AppState & AppActions>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,
        setUser: (user) => set({ user }),
        setCurrentProject: (currentProject) => set({ currentProject }),
        setProjects: (projects) => set({ projects }),
        addProject: (project) => set((s) => ({ projects: [...s.projects, project] })),
        updateProject: (id, updates) => set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
          currentProject: s.currentProject?.id === id ? { ...s.currentProject, ...updates } : s.currentProject,
        })),
        deleteProject: (id) => set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          currentProject: s.currentProject?.id === id ? null : s.currentProject,
        })),
        setTextures: (textures) => set({ textures }),
        addTexture: (t) => set((s) => ({ textures: [...s.textures, t] })),
        deleteTexture: (id) => set((s) => ({ textures: s.textures.filter((t) => t.id !== id) })),
        setProducts: (products) => set({ products }),
        addProduct: (p) => set((s) => ({ products: [...s.products, p] })),
        updateProduct: (id, u) => set((s) => ({
          products: s.products.map((p) => (p.id === id ? { ...p, ...u } : p)),
        })),
        deleteProduct: (id) => set((s) => ({ products: s.products.filter((p) => p.id !== id) })),
        setOrders: (orders) => set({ orders }),
        addOrder: (o) => set((s) => ({ orders: [...s.orders, o] })),
        updateOrder: (id, u) => set((s) => ({
          orders: s.orders.map((o) => (o.id === id ? { ...o, ...u } : o)),
        })),
        setLoading: (isLoading) => set({ isLoading }),
        setError: (error) => set({ error }),
        reset: () => set(initialState),
      }),
      { name: 'tilelayout-storage', partialize: (s) => ({ projects: s.projects, currentProject: s.currentProject }) }
    ),
    { name: 'TileLayout Store' }
  )
);
