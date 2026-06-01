export function AllPostsList({ userId }: { userId: string }) {
  // TODO: Fetch posts from API: GET /posts?user_id=userId
  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto py-4">
      {/* Placeholder for posts */}
      <div className="text-center text-muted-foreground p-8 border rounded-lg">
        Chưa có bài viết nào
      </div>
    </div>
  );
}
