import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { Search, X, Loader2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PostCard } from '@/features/home/components/post-card';
import { SearchUserItem } from '@/features/search/components/search-user-item';
import { SearchRecent } from '@/features/search/components/search-recent';
import { useSearchHistory } from '@/features/search/hooks/use-search-history';
import {
  useSearchControllerSearchAll,
  useSearchControllerSearchUsersInfinite,
  useSearchControllerSearchPostsInfinite,
  useSearchControllerSearchByHashtagInfinite,
} from '@/services/apis/gen/queries';

type TabValue = 'all' | 'users' | 'posts' | 'hashtag';
type RelationFilter = 'all' | 'friends' | 'following' | 'not_following';

const RELATION_CHIPS: { value: RelationFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'friends', label: 'Bạn bè' },
  { value: 'following', label: 'Đang theo dõi' },
  { value: 'not_following', label: 'Chưa theo dõi' },
];

/** Chuẩn hóa response orval (mọi cấp data) về một mảng. */
function extractArray(res: any): any[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.data?.data)) return res.data.data;
  return [];
}

/** Map raw post từ API sang props của PostCard. */
function mapPost(post: any) {
  return {
    id: post.id,
    user: {
      id: post.user?.id || '',
      username: post.user?.username || 'User',
      full_name: post.user?.full_name,
      avatarUrl: post.user?.avatar || post.user?.profilePicture || '',
      relationStatus: post.user?.relationStatus,
      isFollowing: post.user?.isFollowing,
    },
    createdAt: post.created_at || post.createdAt || new Date().toISOString(),
    images: post.medias || post.mediaUrls || [],
    caption: post.content || '',
    likesCount: post.likesCount || post.interactions?.likes || 0,
    commentsCount: post.commentsCount || post.interactions?.comments || 0,
    repostsCount: post.interactions?.reposts || 0,
    isLiked: post.isLiked || post.interactions?.is_liked || false,
    isSaved: post.isSaved || false,
    isReposted: post.interactions?.is_reposted || false,
    privacy: post.privacy,
    tagged_users: post.tagged_users || [],
    hashtags: post.hashtags || [],
  };
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { history, addHistory, removeHistory, clearHistory } =
    useSearchHistory();

  // ── URL là NGUỒN SỰ THẬT DUY NHẤT cho truy vấn & tab (tránh loop state↔URL) ──
  const debouncedQ = (searchParams.get('q') || '').trim();
  const tab = ((searchParams.get('tab') as TabValue) || 'all') as TabValue;

  // Ô nhập là state cục bộ (gõ mượt); phản chiếu theo URL khi URL đổi từ ngoài.
  const [inputValue, setInputValue] = useState(debouncedQ);
  const inputRef = useRef<HTMLInputElement>(null);

  // URL q đổi từ ngoài (vd: bấm hashtag khi đang ở trang Tìm kiếm) -> cập nhật ô nhập.
  useEffect(() => {
    setInputValue(debouncedQ);
  }, [debouncedQ]);

  // Debounce: gõ -> ghi q vào URL (chỉ ghi khi khác để không lặp).
  useEffect(() => {
    const handler = setTimeout(() => {
      const next = inputValue.trim();
      if (next === debouncedQ) return;
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next) p.set('q', next);
          else p.delete('q');
          return p;
        },
        { replace: true },
      );
    }, 400);
    return () => clearTimeout(handler);
  }, [inputValue, debouncedQ, setSearchParams]);

  // Đổi tab -> ghi vào URL (giữ q).
  const handleTabChange = (v: TabValue) => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (v === 'all') p.delete('tab');
        else p.set('tab', v);
        return p;
      },
      { replace: true },
    );
  };

  // Lưu lịch sử khi có truy vấn ổn định
  useEffect(() => {
    if (debouncedQ.length >= 2) {
      const t = setTimeout(() => addHistory(debouncedQ), 800);
      return () => clearTimeout(t);
    }
  }, [debouncedQ, addHistory]);

  const hasQuery = debouncedQ.length > 0;
  const [relationFilter, setRelationFilter] = useState<RelationFilter>('all');

  // getNextPageParam: search.service trả meta.total_pages -> còn trang thì +1.
  const getNextPageParam = (last: any) => {
    const m = last?.data?.meta;
    return m && m.page < m.total_pages ? m.page + 1 : undefined;
  };
  // placeholderData: giữ kết quả cũ khi đổi query key (đổi hashtag/filter) -> hết nhấp nháy.
  const infiniteOpts = (active: boolean) =>
    ({
      query: {
        enabled: hasQuery && active,
        placeholderData: keepPreviousData,
        initialPageParam: 1,
        getNextPageParam,
      },
    }) as any;

  // ── Queries (chỉ chạy khi tab tương ứng được chọn) ──
  const allQuery = useSearchControllerSearchAll(
    { q: debouncedQ },
    {
      query: {
        enabled: hasQuery && tab === 'all',
        placeholderData: keepPreviousData,
      },
    },
  );
  const usersQuery = useSearchControllerSearchUsersInfinite(
    { q: debouncedQ, relation: relationFilter, limit: 12 } as any,
    infiniteOpts(tab === 'users'),
  );
  const postsQuery = useSearchControllerSearchPostsInfinite(
    { q: debouncedQ, relation: relationFilter, limit: 12 } as any,
    infiniteOpts(tab === 'posts'),
  );
  const hashtagQuery = useSearchControllerSearchByHashtagInfinite(
    { tag: debouncedQ, limit: 12 } as any,
    infiniteOpts(tab === 'hashtag'),
  );

  // ── Sentinel cuộn vô tận cho từng tab (tab nào đang mở thì ref mới gắn vào DOM) ──
  const usersSentinel = useInView();
  const postsSentinel = useInView();
  const hashtagSentinel = useInView();
  useEffect(() => {
    if (
      usersSentinel.inView &&
      usersQuery.hasNextPage &&
      !usersQuery.isFetchingNextPage
    )
      usersQuery.fetchNextPage();
  }, [
    usersSentinel.inView,
    usersQuery.hasNextPage,
    usersQuery.isFetchingNextPage,
    usersQuery.fetchNextPage,
  ]);
  useEffect(() => {
    if (
      postsSentinel.inView &&
      postsQuery.hasNextPage &&
      !postsQuery.isFetchingNextPage
    )
      postsQuery.fetchNextPage();
  }, [
    postsSentinel.inView,
    postsQuery.hasNextPage,
    postsQuery.isFetchingNextPage,
    postsQuery.fetchNextPage,
  ]);
  useEffect(() => {
    if (
      hashtagSentinel.inView &&
      hashtagQuery.hasNextPage &&
      !hashtagQuery.isFetchingNextPage
    )
      hashtagQuery.fetchNextPage();
  }, [
    hashtagSentinel.inView,
    hashtagQuery.hasNextPage,
    hashtagQuery.isFetchingNextPage,
    hashtagQuery.fetchNextPage,
  ]);

  // ── Dữ liệu đã chuẩn hóa ──
  const allUsers = useMemo(
    () =>
      (allQuery.data as any)?.data?.users ||
      (allQuery.data as any)?.users ||
      [],
    [allQuery.data],
  );
  const allPosts = useMemo(
    () =>
      (allQuery.data as any)?.data?.posts ||
      (allQuery.data as any)?.posts ||
      [],
    [allQuery.data],
  );
  // Gộp mọi trang của infinite query thành 1 mảng.
  const users = useMemo(
    () =>
      ((usersQuery.data as any)?.pages ?? []).flatMap((p: any) =>
        extractArray(p),
      ),
    [usersQuery.data],
  );
  const posts = useMemo(
    () =>
      ((postsQuery.data as any)?.pages ?? []).flatMap((p: any) =>
        extractArray(p),
      ),
    [postsQuery.data],
  );
  const hashtagPosts = useMemo(
    () =>
      ((hashtagQuery.data as any)?.pages ?? []).flatMap((p: any) =>
        extractArray(p),
      ),
    [hashtagQuery.data],
  );

  const handleClear = () => {
    setInputValue('');
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete('q');
        return p;
      },
      { replace: true },
    );
    inputRef.current?.focus();
  };

  const handleSelectHistory = (term: string) => {
    setInputValue(term);
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('q', term);
        return p;
      },
      { replace: true },
    );
    inputRef.current?.focus();
  };

  const renderLoader = () => (
    <div className="flex justify-center py-10">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  const renderEmpty = (label: string) => (
    <div className="text-center py-12 text-sm text-muted-foreground">
      Không tìm thấy {label} nào cho &quot;{debouncedQ}&quot;
    </div>
  );

  const renderUserList = (list: any[]) => (
    <div className="flex flex-col gap-0.5 px-1">
      {list.map((u: any) => (
        <SearchUserItem key={u.id} user={u} />
      ))}
    </div>
  );

  const renderPostList = (list: any[]) => (
    <div className="flex flex-col items-center">
      {list.map((p: any) => (
        <PostCard key={p.id} post={mapPost(p)} showFollowButton />
      ))}
    </div>
  );

  // Sentinel + trạng thái cuối danh sách cho cuộn vô tận.
  const renderLoadMore = (
    sentinelRef: (node?: Element | null) => void,
    q: { isFetchingNextPage: boolean; hasNextPage: boolean },
    count: number,
  ) => (
    <div ref={sentinelRef} className="py-6 flex justify-center">
      {q.isFetchingNextPage && (
        <div className="flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-kyte-blue" />
          <span className="text-sm text-muted-foreground">
            Đang tải thêm...
          </span>
        </div>
      )}
      {!q.hasNextPage && !q.isFetchingNextPage && count > 0 && (
        <span className="text-sm text-muted-foreground">Đã hết kết quả</span>
      )}
    </div>
  );

  const renderRelationChips = () => (
    <div className="flex gap-2 flex-wrap mb-3 px-1">
      {RELATION_CHIPS.map((c) => (
        <button
          key={c.value}
          onClick={() => setRelationFilter(c.value)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
            relationFilter === c.value
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border text-muted-foreground hover:bg-secondary'
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex justify-center w-full min-h-screen">
      <div className="flex flex-col w-full max-w-[600px] mt-6 px-3 sm:px-4">
        {/* Search input */}
        <div className="relative mb-4 sticky top-0 z-10 bg-background pt-1 pb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Tìm kiếm trên KyteNet"
            className="w-full pl-10 pr-10 py-3 bg-muted/50 hover:bg-muted focus:bg-muted rounded-xl text-sm outline-none transition-colors"
          />
          {inputValue && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted-foreground/20"
              aria-label="Xóa"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Khi chưa nhập → hiển thị lịch sử */}
        {!hasQuery ? (
          <SearchRecent
            history={history}
            onSelect={handleSelectHistory}
            onRemove={removeHistory}
            onClear={clearHistory}
          />
        ) : (
          <Tabs value={tab} onValueChange={(v) => handleTabChange(v as TabValue)}>
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="all">Tất cả</TabsTrigger>
              <TabsTrigger value="users">Mọi người</TabsTrigger>
              <TabsTrigger value="posts">Bài viết</TabsTrigger>
              <TabsTrigger value="hashtag">Hashtag</TabsTrigger>
            </TabsList>

            {/* Tab Tất cả */}
            <TabsContent value="all" className="mt-4">
              {allQuery.isLoading ? (
                renderLoader()
              ) : allUsers.length === 0 && allPosts.length === 0 ? (
                renderEmpty('kết quả')
              ) : (
                <>
                  {allUsers.length > 0 && (
                    <section className="mb-6">
                      <h3 className="text-sm font-semibold px-3 mb-2">
                        Mọi người
                      </h3>
                      {renderUserList(allUsers.slice(0, 5))}
                    </section>
                  )}
                  {allPosts.length > 0 && (
                    <section>
                      <h3 className="text-sm font-semibold px-3 mb-2">
                        Bài viết
                      </h3>
                      {renderPostList(allPosts)}
                    </section>
                  )}
                </>
              )}
            </TabsContent>

            {/* Tab Mọi người */}
            <TabsContent value="users" className="mt-4">
              {renderRelationChips()}
              {usersQuery.isLoading ? (
                renderLoader()
              ) : users.length === 0 ? (
                renderEmpty('người dùng')
              ) : (
                <>
                  {renderUserList(users)}
                  {renderLoadMore(usersSentinel.ref, usersQuery, users.length)}
                </>
              )}
            </TabsContent>

            {/* Tab Bài viết */}
            <TabsContent value="posts" className="mt-4">
              {renderRelationChips()}
              {postsQuery.isLoading ? (
                renderLoader()
              ) : posts.length === 0 ? (
                renderEmpty('bài viết')
              ) : (
                <>
                  {renderPostList(posts)}
                  {renderLoadMore(postsSentinel.ref, postsQuery, posts.length)}
                </>
              )}
            </TabsContent>

            {/* Tab Hashtag */}
            <TabsContent value="hashtag" className="mt-4">
              {hashtagQuery.isLoading ? (
                renderLoader()
              ) : hashtagPosts.length === 0 ? (
                renderEmpty('bài viết với hashtag')
              ) : (
                <>
                  {renderPostList(hashtagPosts)}
                  {renderLoadMore(
                    hashtagSentinel.ref,
                    hashtagQuery,
                    hashtagPosts.length,
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
