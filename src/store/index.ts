import { create } from 'zustand';
import { createJobSlice, type JobSlice } from './jobSlice';
import { createGraphSlice, type GraphSlice } from './graphSlice';
import { createUISlice, type UISlice } from './uiSlice';

type RootStore = JobSlice & GraphSlice & UISlice;

export const useStore = create<RootStore>()((...args) => ({
  ...createJobSlice(...args),
  ...createGraphSlice(...args),
  ...createUISlice(...args),
}));

// Convenience selectors
export const useJobStore = useStore;
export const useGraphStore = useStore;
export const useUIStore = useStore;
