import { create } from 'zustand';

interface QueueState {
  pendingCount: number;
  isSyncing: boolean;
  lastSyncError: string | null;

  // Actions
  setPendingCount: (count: number) => void;
  incrementPendingCount: () => void;
  decrementPendingCount: () => void;
  setIsSyncing: (isSyncing: boolean) => void;
  setLastSyncError: (error: string | null) => void;
}

export const useQueueStore = create<QueueState>((set) => ({
  pendingCount: 0,
  isSyncing: false,
  lastSyncError: null,

  setPendingCount: (count) => set({ pendingCount: Math.max(0, count) }),
  incrementPendingCount: () => set((state) => ({ pendingCount: state.pendingCount + 1 })),
  decrementPendingCount: () => set((state) => ({ pendingCount: Math.max(0, state.pendingCount - 1) })),
  setIsSyncing: (isSyncing) => set({ isSyncing }),
  setLastSyncError: (lastSyncError) => set({ lastSyncError }),
}));
