import { create } from 'zustand';

interface FollowState {
  optimisticFollows: Record<string, boolean>; // { userId: isFollowing }
  setOptimisticFollow: (userId: string, isFollowing: boolean) => void;
}

export const useFollowStore = create<FollowState>((set) => ({
  optimisticFollows: {},
  setOptimisticFollow: (userId, isFollowing) =>
    set((state) => ({
      optimisticFollows: {
        ...state.optimisticFollows,
        [userId]: isFollowing,
      },
    })),
}));
