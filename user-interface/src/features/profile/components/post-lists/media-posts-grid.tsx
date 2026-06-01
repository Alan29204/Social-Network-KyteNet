export function MediaPostsGrid({ userId }: { userId: string }) {
  // TODO: Fetch posts from API: GET /posts?user_id=userId&media_type=image
  return (
    <div className="grid grid-cols-3 gap-1 md:gap-4 py-4">
      {/* Placeholder for media posts */}
      <div className="aspect-square bg-muted flex items-center justify-center rounded-sm">
        <span className="text-muted-foreground text-sm">Trống</span>
      </div>
      <div className="aspect-square bg-muted flex items-center justify-center rounded-sm">
        <span className="text-muted-foreground text-sm">Trống</span>
      </div>
      <div className="aspect-square bg-muted flex items-center justify-center rounded-sm">
        <span className="text-muted-foreground text-sm">Trống</span>
      </div>
    </div>
  );
}
