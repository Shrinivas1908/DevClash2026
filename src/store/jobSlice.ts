import type { StateCreator } from 'zustand';
import type { Job } from '@/types/job';
import { DEFAULT_STAGES } from '@/types/job';

export interface JobSlice {
  currentJob: Job | null;
  setJob: (job: Job) => void;
  updateJob: (partial: Partial<Job>) => void;
  clearJob: () => void;
}

export const createJobSlice: StateCreator<JobSlice> = (set) => ({
  currentJob: null,
  setJob: (job) => set({ currentJob: job }),
  updateJob: (partial) =>
    set((state) => ({
      currentJob: state.currentJob ? { ...state.currentJob, ...partial } : null,
    })),
  clearJob: () =>
    set({
      currentJob: {
        id: '',
        repo_url: '',
        status: 'pending',
        stages: DEFAULT_STAGES,
        graph_json: null,
        created_at: new Date().toISOString(),
      },
    }),
});
