import { QueryClient, QueryKey } from '@tanstack/react-query';

type QuerySnapshot = Array<[QueryKey, unknown]>;

const POST_LIST_KEYS = new Set([
  '/posts',
  '/feed/following',
  '/feed/foryou',
  '/feed/recommended',
  '/search/posts',
  '/search/all',
  '/search/semantic',
]);

const isObject = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isPostLike = (value: unknown): value is Record<string, any> => {
  if (!isObject(value) || typeof value.id !== 'string') return false;
  return [
    'content',
    'caption',
    'medias',
    'images',
    'user',
    'user_id',
    'shared_post',
    'interactions',
    'hashtags',
    'created_at',
    'privacy',
  ].some((key) => key in value);
};

const getQueryFirst = (queryKey: QueryKey) => queryKey[0];
const getQuerySecond = (queryKey: QueryKey) => queryKey[1];

const isPostSurfaceKey = (queryKey: QueryKey) => {
  const first = getQueryFirst(queryKey);
  const second = getQuerySecond(queryKey);

  if (
    first === 'profile-posts' ||
    first === 'profile-reposts' ||
    first === 'postDetail' ||
    first === 'postsControllerFindAll'
  ) {
    return true;
  }

  if (first === 'feed' && second === 'recommended') return true;
  if (first === 'infinite' && typeof second === 'string') {
    return POST_LIST_KEYS.has(second) || second.startsWith('/search');
  }

  if (typeof first === 'string') {
    return POST_LIST_KEYS.has(first) || first.startsWith('/search');
  }

  return false;
};

export const getMutationPost = (response: any) =>
  response?.data?.post ||
  response?.data?.data?.post ||
  response?.post ||
  response?.data?.data ||
  null;

export const getMutationPostId = (response: any, fallback?: string) =>
  response?.data?.post_id ||
  response?.data?.data?.post_id ||
  response?.post_id ||
  response?.id ||
  fallback;

export const getPostAuthorId = (post: any) =>
  post?.user_id || post?.user?.id || post?.author_id;

export const getApiErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message ||
  error?.response?.data?.data?.message ||
  error?.message ||
  fallback;

export const invalidatePostSurfaces = (
  queryClient: QueryClient,
  options: { userId?: string; postId?: string; includeSearch?: boolean } = {},
) => {
  const invalidations = [
    options.userId
      ? queryClient.invalidateQueries({
          queryKey: ['profile-posts', options.userId],
        })
      : queryClient.invalidateQueries({ queryKey: ['profile-posts'] }),
    options.userId
      ? queryClient.invalidateQueries({
          queryKey: ['profile-reposts', options.userId],
        })
      : queryClient.invalidateQueries({ queryKey: ['profile-reposts'] }),
    options.userId
      ? queryClient.invalidateQueries({
          queryKey: ['profile', options.userId],
        })
      : queryClient.invalidateQueries({ queryKey: ['profile'] }),
    queryClient.invalidateQueries({
      queryKey: ['infinite', '/feed/following'],
    }),
    queryClient.invalidateQueries({ queryKey: ['infinite', '/feed/foryou'] }),
    queryClient.invalidateQueries({ queryKey: ['feed', 'recommended'] }),
    queryClient.invalidateQueries({ queryKey: ['/feed/recommended'] }),
    queryClient.invalidateQueries({
      queryKey: ['infinite', '/feed/recommended'],
    }),
  ];

  if (options.postId) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: ['postDetail', options.postId],
      }),
    );
  } else {
    invalidations.push(queryClient.invalidateQueries({ queryKey: ['postDetail'] }));
  }

  if (options.includeSearch) {
    invalidations.push(
      queryClient.invalidateQueries({
        predicate: (query) => {
          const first = query.queryKey[0];
          const second = query.queryKey[1];
          return (
            (typeof first === 'string' && first.startsWith('/search')) ||
            (first === 'infinite' &&
              typeof second === 'string' &&
              second.startsWith('/search'))
          );
        },
      }),
    );
  }

  return Promise.all(invalidations);
};

const replacePostValue = (value: unknown, post: any): unknown => {
  if (!post?.id) return value;

  if (Array.isArray(value)) {
    return value.map((item) => replacePostValue(item, post));
  }

  if (!isObject(value)) return value;

  const base =
    isPostLike(value) && value.id === post.id ? { ...value, ...post } : value;

  let changed = base !== value;
  const next: Record<string, any> = changed ? { ...base } : { ...value };

  Object.entries(base).forEach(([key, nested]) => {
    const replaced = replacePostValue(nested, post);
    if (replaced !== nested) {
      next[key] = replaced;
      changed = true;
    }
  });

  return changed ? next : value;
};

const shouldRemovePost = (value: unknown, postId: string) =>
  isPostLike(value) &&
  (value.id === postId || value.shared_post?.id === postId);

const removePostValue = (value: unknown, postId: string): unknown => {
  if (!postId) return value;

  if (Array.isArray(value)) {
    return value
      .filter((item) => !shouldRemovePost(item, postId))
      .map((item) => removePostValue(item, postId));
  }

  if (!isObject(value)) return value;

  if (shouldRemovePost(value, postId)) return undefined;

  let changed = false;
  const next: Record<string, any> = { ...value };

  Object.entries(value).forEach(([key, nested]) => {
    const removed = removePostValue(nested, postId);
    if (removed !== nested) {
      next[key] = removed === undefined ? null : removed;
      changed = true;
    }
  });

  return changed ? next : value;
};

const addPostToResponseList = (value: unknown, post: any): unknown => {
  if (!post?.id) return value;

  if (Array.isArray(value)) {
    if (value.some((item) => isPostLike(item) && item.id === post.id)) {
      return value;
    }
    if (value.every((item) => isPostLike(item))) {
      return [post, ...value];
    }
    return value;
  }

  if (!isObject(value)) return value;

  if (Array.isArray(value.pages)) {
    if (value.pages.length === 0) return value;
    const nextPages = [...value.pages];
    nextPages[0] = addPostToResponseList(nextPages[0], post);
    return nextPages[0] === value.pages[0]
      ? value
      : { ...value, pages: nextPages };
  }

  if (Array.isArray(value.data?.data)) {
    const nextData = addPostToResponseList(value.data.data, post);
    return nextData === value.data.data
      ? value
      : { ...value, data: { ...value.data, data: nextData } };
  }

  if (Array.isArray(value.data)) {
    const nextData = addPostToResponseList(value.data, post);
    return nextData === value.data ? value : { ...value, data: nextData };
  }

  return value;
};

export const upsertPostInLists = (
  queryClient: QueryClient,
  post: any,
  options: { userId?: string } = {},
) => {
  const authorId = options.userId || getPostAuthorId(post);
  if (!authorId) return;

  queryClient.setQueryData(['profile-posts', authorId], (old: unknown) =>
    addPostToResponseList(old, post),
  );
};

export const replacePostInLists = (queryClient: QueryClient, post: any) => {
  if (!post?.id) return;

  queryClient.setQueriesData(
    { predicate: (query) => isPostSurfaceKey(query.queryKey) },
    (old: unknown) => replacePostValue(old, post),
  );
};

export const removePostFromLists = (
  queryClient: QueryClient,
  postId: string,
) => {
  if (!postId) return;

  queryClient.setQueriesData(
    { predicate: (query) => isPostSurfaceKey(query.queryKey) },
    (old: unknown) => {
      const next = removePostValue(old, postId);
      return next === undefined ? null : next;
    },
  );
};

type RelationStatus = 'none' | 'following' | 'pending' | 'block';

const isUserLike = (value: unknown, userId: string) =>
  isObject(value) &&
  value.id === userId &&
  ['username', 'full_name', 'avatar', 'avatarUrl', 'profilePicture'].some(
    (key) => key in value,
  );

const updateAuthorRelationValue = (
  value: unknown,
  userId: string,
  relationStatus: RelationStatus,
): unknown => {
  if (!userId) return value;

  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const updated = updateAuthorRelationValue(item, userId, relationStatus);
      if (updated !== item) changed = true;
      return updated;
    });
    return changed ? next : value;
  }

  if (!isObject(value)) return value;

  const base = isUserLike(value, userId)
    ? {
        ...value,
        relationStatus,
        isFollowing: relationStatus === 'following',
      }
    : value;

  let changed = base !== value;
  const next: Record<string, any> = changed ? { ...base } : { ...value };

  Object.entries(base).forEach(([key, nested]) => {
    const updated = updateAuthorRelationValue(
      nested,
      userId,
      relationStatus,
    );
    if (updated !== nested) {
      next[key] = updated;
      changed = true;
    }
  });

  return changed ? next : value;
};

export const updateAuthorRelationInPostSurfaces = (
  queryClient: QueryClient,
  userId: string,
  relationStatus: RelationStatus,
) => {
  queryClient.setQueriesData(
    { predicate: (query) => isPostSurfaceKey(query.queryKey) },
    (old: unknown) => updateAuthorRelationValue(old, userId, relationStatus),
  );
};

export const snapshotPostSurfaces = (queryClient: QueryClient): QuerySnapshot =>
  queryClient.getQueriesData({
    predicate: (query) => isPostSurfaceKey(query.queryKey),
  });

export const restorePostSurfaces = (
  queryClient: QueryClient,
  snapshots: QuerySnapshot,
) => {
  snapshots.forEach(([queryKey, data]) => {
    queryClient.setQueryData(queryKey, data);
  });
};
