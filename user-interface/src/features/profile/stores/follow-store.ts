import { create } from 'zustand';

export type FollowRelationStatus = 'none' | 'following' | 'pending' | 'block';

interface FollowState {
  optimisticFollows: Record<string, FollowRelationStatus>;
  setOptimisticFollow: (
    userId: string,
    relationStatus: FollowRelationStatus,
  ) => void;
}

export const useFollowStore = create<FollowState>((set) => ({
  optimisticFollows: {},
  setOptimisticFollow: (userId, relationStatus) =>
    set((state) => ({
      optimisticFollows: {
        ...state.optimisticFollows,
        [userId]: relationStatus,
      },
    })),
}));
