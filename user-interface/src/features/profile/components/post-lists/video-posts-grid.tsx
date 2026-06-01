export function VideoPostsGrid({ userId }: { userId: string }) {
  // TODO: Fetch posts from API: GET /posts?user_id=userId&media_type=video
  return (
    <div className="grid grid-cols-3 gap-1 md:gap-4 py-4">
      {/* Placeholder for video posts */}
      <div className="aspect-[9/16] bg-muted flex items-center justify-center rounded-sm">
        <span className="text-muted-foreground text-sm">Trống</span>
      </div>
      <div className="aspect-[9/16] bg-muted flex items-center justify-center rounded-sm">
        <span className="text-muted-foreground text-sm">Trống</span>
      </div>
    </div>
  );
}
