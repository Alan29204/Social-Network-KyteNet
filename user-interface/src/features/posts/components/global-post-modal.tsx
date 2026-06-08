import { useState, useEffect } from 'react';
import { usePostModalStore } from '../stores/post-modal-store';
import { PostDetailModal } from './post-detail-modal';
import { useQuery } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';

export function GlobalPostModal() {
  const { isOpen, postId, commentId, closePost } = usePostModalStore();
  const [localOpen, setLocalOpen] = useState(false);
  const [localPostId, setLocalPostId] = useState<string | null>(null);
  const [localCommentId, setLocalCommentId] = useState<string | null>(null);

  // Sync zustand store → local state with a micro-delay to avoid React batching issues
  useEffect(() => {
    if (isOpen && postId) {
      setLocalPostId(postId);
      setLocalCommentId(commentId);
      // Small delay to ensure notification drawer has finished its close animation/unmount
      const timer = setTimeout(() => {
        setLocalOpen(true);
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setLocalOpen(false);
      // Delay clearing data so close animation can finish
      const timer = setTimeout(() => {
        setLocalPostId(null);
        setLocalCommentId(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, postId, commentId]);

  // Fetch the post data independently using the postId
  const { data: postData } = useQuery({
    queryKey: ['postDetail', localPostId],
    queryFn: () => orvalClient<any>({ url: `/posts/${localPostId}`, method: 'GET' }),
    enabled: !!localPostId,
  });

  if (!localPostId) return null;

  const post = postData?.data || {
    id: localPostId,
    user: { id: '', username: '' },
  };

  return (
    <PostDetailModal
      post={post}
      open={localOpen}
      defaultCommentId={localCommentId}
      onOpenChange={(open) => {
        if (!open) {
          setLocalOpen(false);
          closePost();
        }
      }}
    />
  );
}
