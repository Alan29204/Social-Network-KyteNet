import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X, Loader2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PostCard } from '@/features/home/components/post-card';
import { SearchUserItem } from '@/features/search/components/search-user-item';
import { SearchRecent } from '@/features/search/components/search-recent';
import { useSearchHistory } from '@/features/search/hooks/use-search-history';
import {
  useSearchControllerSearchAll,
  useSearchControllerSearchUsers,
  useSearchControllerSearchPosts,
  useSearchControllerSearchByHashtag,
  useSearchControllerSemanticSearch,
} from '@/services/apis/gen/queries';

type TabValue = 'all' | 'users' | 'posts' | 'hashtag' | 'semantic';

/** Chuẩn hóa response orval (mọi cấp data) về một mảng. */
function extractArray(res: any): any[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.data?.data)) return res.data.data;
  return [];
}

function extractSource(res: any): string | undefined {
  return (
    res?.source ||
    res?.meta?.source ||
    res?.data?.source ||
    res?.data?.meta?.source ||
    res?.data?.data?.source ||
    res?.data?.data?.meta?.source
  );
}

/** Map raw post từ API sang props của PostCard. */
function mapPost(post: any) {
  return {
    id: post.id,
    user: {
      id: post.user?.id || '',
      username: post.user?.username || 'User',
      avatarUrl: post.user?.avatar || post.user?.profilePicture || '',
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

  const initialQ = searchParams.get('q') || '';
  const [inputValue, setInputValue] = useState(initialQ);
  const [debouncedQ, setDebouncedQ] = useState(initialQ);
  const [tab, setTab] = useState<TabValue>(
    (searchParams.get('tab') as TabValue) || 'all',
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce input -> debouncedQ
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQ(inputValue.trim());
    }, 400);
    return () => clearTimeout(handler);
  }, [inputValue]);

  // Sync URL params
  useEffect(() => {
    const params: Record<string, string> = {};
    if (debouncedQ) params.q = debouncedQ;
    if (tab !== 'all') params.tab = tab;
    setSearchParams(params, { replace: true });
  }, [debouncedQ, tab, setSearchParams]);

  // Lưu lịch sử khi có truy vấn ổn định
  useEffect(() => {
    if (debouncedQ.length >= 2) {
      const t = setTimeout(() => addHistory(debouncedQ), 800);
      return () => clearTimeout(t);
    }
  }, [debouncedQ, addHistory]);

  const hasQuery = debouncedQ.length > 0;
  const enabled = (active: boolean) => ({
    query: { enabled: hasQuery && active },
  });

  // ── Queries (chỉ chạy khi tab tương ứng được chọn) ──
  const allQuery = useSearchControllerSearchAll(
    { q: debouncedQ },
    enabled(tab === 'all'),
  );
  const usersQuery = useSearchControllerSearchUsers(
    { q: debouncedQ },
    enabled(tab === 'users'),
  );
  const postsQuery = useSearchControllerSearchPosts(
    { q: debouncedQ },
    enabled(tab === 'posts'),
  );
  const hashtagQuery = useSearchControllerSearchByHashtag(
    { tag: debouncedQ },
    enabled(tab === 'hashtag'),
  );
  const semanticQuery = useSearchControllerSemanticSearch(
    { q: debouncedQ },
    enabled(tab === 'semantic'),
  );

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
  const users = useMemo(() => extractArray(usersQuery.data), [usersQuery.data]);
  const posts = useMemo(() => extractArray(postsQuery.data), [postsQuery.data]);
  const hashtagPosts = useMemo(
    () => extractArray(hashtagQuery.data),
    [hashtagQuery.data],
  );
  const semanticPosts = useMemo(
    () => extractArray(semanticQuery.data),
    [semanticQuery.data],
  );
  const semanticSource = useMemo(
    () => extractSource(semanticQuery.data),
    [semanticQuery.data],
  );

  const handleClear = () => {
    setInputValue('');
    setDebouncedQ('');
    inputRef.current?.focus();
  };

  const handleSelectHistory = (term: string) => {
    setInputValue(term);
    setDebouncedQ(term);
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
        <PostCard key={p.id} post={mapPost(p)} />
      ))}
    </div>
  );

  return (
    <div className="flex justify-center w-full min-h-screen pb-20 sm:pb-0">
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
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="all">Tất cả</TabsTrigger>
              <TabsTrigger value="users">Mọi người</TabsTrigger>
              <TabsTrigger value="posts">Bài viết</TabsTrigger>
              <TabsTrigger value="hashtag">Hashtag</TabsTrigger>
              <TabsTrigger value="semantic">AI</TabsTrigger>
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
              {usersQuery.isLoading
                ? renderLoader()
                : users.length === 0
                  ? renderEmpty('người dùng')
                  : renderUserList(users)}
            </TabsContent>

            {/* Tab Bài viết */}
            <TabsContent value="posts" className="mt-4">
              {postsQuery.isLoading
                ? renderLoader()
                : posts.length === 0
                  ? renderEmpty('bài viết')
                  : renderPostList(posts)}
            </TabsContent>

            {/* Tab Hashtag */}
            <TabsContent value="hashtag" className="mt-4">
              {hashtagQuery.isLoading
                ? renderLoader()
                : hashtagPosts.length === 0
                  ? renderEmpty('bài viết với hashtag')
                  : renderPostList(hashtagPosts)}
            </TabsContent>

            {/* Tab AI Semantic */}
            <TabsContent value="semantic" className="mt-4">
              <div className="flex items-center gap-2 px-3 mb-3 text-xs text-muted-foreground">
                {semanticSource === 'keyword_fallback'
                  ? 'Đang dùng tìm kiếm từ khóa dự phòng'
                  : 'Tìm kiếm theo ngữ nghĩa bằng AI'}
              </div>
              {semanticQuery.isLoading
                ? renderLoader()
                : semanticPosts.length === 0
                  ? renderEmpty('kết quả ngữ nghĩa')
                  : renderPostList(semanticPosts)}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
