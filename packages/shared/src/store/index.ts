import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { User, Project, Texture, Product, Order } from '../types';

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
  user: null,
  currentProject: null,
  projects: [],
  textures: [],
  products: [],
  orders: [],
  isLoading: false,
  error: null,
};

export const useAppStore = create<AppState & AppActions>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        setUser: (user) => set({ user }),

        setCurrentProject: (currentProject) => set({ currentProject }),

        setProjects: (projects) => set({ projects }),

        addProject: (project) =>
          set((state) => ({ projects: [...state.projects, project] })),

        updateProject: (id, updates) =>
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === id ? { ...p, ...updates } : p
            ),
            currentProject:
              state.currentProject?.id === id
                ? { ...state.currentProject, ...updates }
                : state.currentProject,
          })),

        deleteProject: (id) =>
          set((state) => ({
            projects: state.projects.filter((p) => p.id !== id),
            currentProject:
              state.currentProject?.id === id ? null : state.currentProject,
          })),

        setTextures: (textures) => set({ textures }),

        addTexture: (texture) =>
          set((state) => ({ textures: [...state.textures, texture] })),

        deleteTexture: (id) =>
          set((state) => ({
            textures: state.textures.filter((t) => t.id !== id),
          })),

        setProducts: (products) => set({ products }),

        addProduct: (product) =>
          set((state) => ({ products: [...state.products, product] })),

        updateProduct: (id, updates) =>
          set((state) => ({
            products: state.products.map((p) =>
              p.id === id ? { ...p, ...updates } : p
            ),
          })),

        deleteProduct: (id) =>
          set((state) => ({
            products: state.products.filter((p) => p.id !== id),
          })),

        setOrders: (orders) => set({ orders }),

        addOrder: (order) =>
          set((state) => ({ orders: [...state.orders, order] })),

        updateOrder: (id, updates) =>
          set((state) => ({
            orders: state.orders.map((o) =>
              o.id === id ? { ...o, ...updates } : o
            ),
          })),

        setLoading: (isLoading) => set({ isLoading }),

        setError: (error) => set({ error }),

        reset: () => set(initialState),
      }),
      {
        name: 'tilelayout-storage',
        partialize: (state) => ({
          projects: state.projects,
          textures: state.textures,
          currentProject: state.currentProject,
        }),
      }
    ),
    { name: 'TileLayout Store' }
  )
);
