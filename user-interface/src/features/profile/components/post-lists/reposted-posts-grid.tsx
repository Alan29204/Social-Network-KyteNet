export function RepostedPostsGrid({ userId }: { userId: string }) {
  // TODO: Fetch posts from API: GET /posts?user_id=userId&is_repost=true
  return (
    <div className="grid grid-cols-3 gap-1 md:gap-4 py-4">
      {/* Placeholder for reposted posts */}
      <div className="aspect-square bg-muted flex flex-col items-center justify-center rounded-sm text-center p-2">
        <span className="text-muted-foreground text-xs md:text-sm line-clamp-3">Bài đăng lại 1...</span>
      </div>
      <div className="aspect-square bg-muted flex flex-col items-center justify-center rounded-sm text-center p-2">
        <span className="text-muted-foreground text-xs md:text-sm line-clamp-3">Bài đăng lại 2...</span>
      </div>
    </div>
  );
}
