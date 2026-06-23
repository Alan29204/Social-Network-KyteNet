import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orvalClient } from '@/services/apis/axios-client';
import {
  FollowRelationStatus,
  useFollowStore,
} from '@/features/profile/stores/follow-store';
import {
  restorePostSurfaces,
  snapshotPostSurfaces,
  updateAuthorRelationInPostSurfaces,
} from '@/features/posts/utils/post-cache';
import { getChatRoomsControllerGetListChatRoomQueryKey } from '@/services/apis/gen/queries';
import { useToast } from '@/hooks/use-toast';

type FollowTarget = {
  id?: string;
  privacy?: string;
  relationStatus?: FollowRelationStatus;
  relation_status?: FollowRelationStatus;
  isFollowing?: boolean;
  is_following?: boolean;
};

const getResponsePayload = (response: any) =>
  response?.data?.data || response?.data || response || {};

const getInitialStatus = (target?: FollowTarget): FollowRelationStatus => {
  if (!target?.id) return 'none';
  return (
    target.relationStatus ||
    target.relation_status ||
    (target.isFollowing || target.is_following ? 'following' : 'none')
  );
};

const updateRelationValue = (
  value: unknown,
  userId: string,
  relationStatus: FollowRelationStatus,
): unknown => {
  if (!value || !userId) return value;

  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const updated = updateRelationValue(item, userId, relationStatus);
      if (updated !== item) changed = true;
      return updated;
    });
    return changed ? next : value;
  }

  if (typeof value !== 'object') return value;

  const current = value as Record<string, any>;
  const isTargetUser =
    current.id === userId &&
    ['username', 'full_name', 'avatar', 'avatarUrl', 'profilePicture'].some(
      (key) => key in current,
    );

  let changed = false;
  const next: Record<string, any> = isTargetUser
    ? {
        ...current,
        relationStatus,
        relation_status: relationStatus,
        isFollowing: relationStatus === 'following',
        is_following: relationStatus === 'following',
      }
    : { ...current };

  if (isTargetUser) changed = true;

  Object.entries(current).forEach(([key, nested]) => {
    const updated = updateRelationValue(nested, userId, relationStatus);
    if (updated !== nested) {
      next[key] = updated;
      changed = true;
    }
  });

  return changed ? next : value;
};

export function useFollowAction(target?: FollowTarget) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { optimisticFollows, setOptimisticFollow } = useFollowStore();
  const postSnapshotRef = useRef<ReturnType<typeof snapshotPostSurfaces> | null>(
    null,
  );
  const suggestionSnapshotRef = useRef<Array<[unknown, unknown]> | null>(null);

  const userId = target?.id || '';
  const initialStatus = getInitialStatus(target);
  const relationStatus = userId
    ? optimisticFollows[userId] || initialStatus
    : 'none';

  const updateSuggestedUsers = (status: FollowRelationStatus) => {
    queryClient.setQueriesData(
      {
        predicate: (query) => query.queryKey[0] === '/relations/suggested',
      },
      (old: unknown) => updateRelationValue(old, userId, status),
    );
  };

  const invalidateRelationSurfaces = () => {
    queryClient.invalidateQueries({
      queryKey: ['profile', userId],
    });
    queryClient.invalidateQueries({
      queryKey: getChatRoomsControllerGetListChatRoomQueryKey(),
    });
    queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === '/relations/suggested',
      refetchType: 'none',
    });
  };

  const mutation = useMutation({
    mutationFn: (action: 'following' | 'none') =>
      orvalClient({
        url: '/relations/update',
        method: 'POST',
        data: { user_id: userId, relation: action },
      }),
    onMutate: async (action) => {
      const previousStatus = relationStatus;
      const nextStatus: FollowRelationStatus =
        action === 'following'
          ? target?.privacy === 'private'
            ? 'pending'
            : 'following'
          : 'none';

      postSnapshotRef.current = snapshotPostSurfaces(queryClient);
      suggestionSnapshotRef.current = queryClient.getQueriesData({
        predicate: (query) => query.queryKey[0] === '/relations/suggested',
      });

      setOptimisticFollow(userId, nextStatus);
      updateAuthorRelationInPostSurfaces(queryClient, userId, nextStatus);
      updateSuggestedUsers(nextStatus);

      return { previousStatus };
    },
    onSuccess: (response) => {
      const payload = getResponsePayload(response);
      const confirmedStatus: FollowRelationStatus =
        payload.relationStatus ||
        payload.user?.relationStatus ||
        (payload.isFollowing ? 'following' : 'none');

      setOptimisticFollow(userId, confirmedStatus);
      updateAuthorRelationInPostSurfaces(queryClient, userId, confirmedStatus);
      updateSuggestedUsers(confirmedStatus);
      invalidateRelationSurfaces();
    },
    onError: (_error, _action, context) => {
      const previousStatus = context?.previousStatus || initialStatus;
      setOptimisticFollow(userId, previousStatus);

      if (postSnapshotRef.current) {
        restorePostSurfaces(queryClient, postSnapshotRef.current);
      }
      if (suggestionSnapshotRef.current) {
        suggestionSnapshotRef.current.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey as any, data);
        });
      }

      toast({
        title: 'Không thể cập nhật theo dõi',
        description: 'Vui lòng thử lại sau.',
        variant: 'destructive',
      });
    },
  });

  const toggleFollow = () => {
    if (!userId || relationStatus === 'block' || mutation.isPending) return;
    mutation.mutate(relationStatus === 'none' ? 'following' : 'none');
  };

  return {
    relationStatus,
    isFollowing: relationStatus === 'following',
    isPendingFollow: relationStatus === 'pending',
    isBlocked: relationStatus === 'block',
    isMutating: mutation.isPending,
    toggleFollow,
  };
}
