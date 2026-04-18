import type { StateCreator } from 'zustand';
import type { SearchResult } from '@/types/search';

export interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'persistent';
  message: string;
}

export interface UISlice {
  sidebarOpen: boolean;
  rightPanelOpen: boolean;
  searchQuery: string;
  searchResults: SearchResult[];
  isSearching: boolean;
  toasts: Toast[];
  isOffline: boolean;
  userTask: string;
  taskFiles: string[];
  aiQuery: string;
  aiAnswer: string | null;
  isLiveConnected: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setSearchQuery: (q: string) => void;
  setSearchResults: (r: SearchResult[]) => void;
  setIsSearching: (v: boolean) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  setIsOffline: (v: boolean) => void;
  setUserTask: (task: string) => void;
  setTaskFiles: (files: string[]) => void;
  setAiQuery: (q: string) => void;
  setAiAnswer: (a: string | null) => void;
  setIsLiveConnected: (v: boolean) => void;
}

export const createUISlice: StateCreator<UISlice> = (set) => ({
  sidebarOpen: true,
  rightPanelOpen: false,
  searchQuery: '',
  searchResults: [],
  isSearching: false,
  toasts: [],
  isOffline: false,
  userTask: '',
  taskFiles: [],
  aiQuery: '',
  aiAnswer: null,
  isLiveConnected: false,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchResults: (r) => set({ searchResults: r }),
  setIsSearching: (v) => set({ isSearching: v }),

  addToast: (toast) =>
    set((s) => ({
      toasts: [...s.toasts, { ...toast, id: `toast-${Date.now()}-${Math.random()}` }],
    })),
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setIsOffline: (v) => set({ isOffline: v }),
  setUserTask: (task: string) => set({ userTask: task }),
  setTaskFiles: (files: string[]) => set({ taskFiles: files }),
  setAiQuery: (q) => set({ aiQuery: q }),
  setAiAnswer: (a) => set({ aiAnswer: a }),
  setIsLiveConnected: (v) => set({ isLiveConnected: v }),
});
