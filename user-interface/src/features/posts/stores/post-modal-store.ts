import { create } from 'zustand';

interface PostModalState {
  isOpen: boolean;
  postId: string | null;
  commentId: string | null;
  openPost: (postId: string, commentId?: string | null) => void;
  closePost: () => void;
}

export const usePostModalStore = create<PostModalState>((set) => ({
  isOpen: false,
  postId: null,
  commentId: null,
  openPost: (postId, commentId = null) => set({ isOpen: true, postId, commentId }),
  closePost: () => set({ isOpen: false, postId: null, commentId: null }),
}));
