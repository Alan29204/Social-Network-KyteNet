from database.chromadb import ChromaDb
from database.base import get_db
from sqlalchemy import text
from fastapi import HTTPException
from schemas.posts import PostsBase
from services.ai import AIService
from schemas.paginated_query import PaginatedQuery
from typing import List


class PostService:
    def __init__(self):
        self.chromadb = ChromaDb()
        self.model_ai = AIService()

    async def find_post_by_id(self, posts_id: str):
      async for db in get_db():
        try:
          query = text(
              "SELECT * FROM post WHERE id = :post_id"
          )
          result = await db.execute(query, {"post_id": posts_id})
          post = result.mappings().first()

          if not post:
            raise HTTPException(
              status_code=404,
              detail="Post not found"
            )

          return post

        except HTTPException as http_exc:
          raise http_exc
        except Exception as e:
            raise HTTPException(
              status_code=500,
              detail=f"Database error: {str(e)}"
            )

    # Check policy for post
    async def check_policy_for_posts(self, posts_id: str):
      posts: PostsBase = await self.find_post_by_id(posts_id)
      # Get medias
      medias = posts["medias"]
      # Check medias empty
      if not medias:
        return {"decision": "allow", "message": "Post is'n media", "details": []}

      details = []
      overall_decision = "allow"
      overall_reason = []

      # Loop medias and detect image
      for media in medias:
        detect = await self.model_ai.classify_image(media)
        details.append(detect)
        
        if detect.get('decision') == 'block':
            overall_decision = 'block'
            if detect.get('reason'):
                overall_reason.append(detect.get('reason'))

      return {
          "decision": overall_decision,
          "reason": " | ".join(overall_reason) if overall_reason else "No violations found",
          "details": details
      }

    async def embed_post(self, post_id: str, content: str):
        """Embed post content and store in ChromaDB."""
        try:
            return await self.chromadb.create_with_text({
                "id": post_id,
                "text": content,
            })
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error embedding post: {str(e)}")

    async def semantic_search(self, query: str, page: int = 1, page_size: int = 10):
        """Search posts semantically using ChromaDB."""
        try:
            paginated_query = PaginatedQuery(query=query, page=page, page_size=page_size)
            results = await self.chromadb.suggest_posts(paginated_query)
            return {
                "post_ids": results.get("ids", []),
                "pagination": results.get("pagination", {}),
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error in semantic search: {str(e)}")

    async def delete_embedding(self, post_id: str):
        """Delete a post embedding from ChromaDB."""
        return await self.chromadb.delete_by_id(post_id)

    async def _fetch_interacted_post_ids(self, user_id: str, limit: int = 50) -> List[str]:
        """Lấy id các bài user đã tương tác (like/lưu) hoặc tự đăng - làm tín hiệu sở thích."""
        async for db in get_db():
            try:
                query = text(
                    """
                    SELECT post_id FROM (
                        SELECT post_id, created_at FROM reaction
                        WHERE user_id = :uid AND post_id IS NOT NULL
                        UNION ALL
                        SELECT sp.post_id, sp.created_at
                        FROM save_post sp
                        JOIN save_list sl ON sl.id = sp.save_list_id
                        WHERE sl.user_id = :uid
                        UNION ALL
                        SELECT id AS post_id, created_at FROM post WHERE user_id = :uid
                    ) t
                    ORDER BY created_at DESC
                    LIMIT :lim
                    """
                )
                result = await db.execute(query, {"uid": user_id, "lim": limit})
                rows = result.mappings().all()
                # Khử trùng lặp nhưng giữ thứ tự
                seen = set()
                ids = []
                for r in rows:
                    pid = r["post_id"]
                    if pid and pid not in seen:
                        seen.add(pid)
                        ids.append(pid)
                return ids
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"DB error (interactions): {str(e)}")

    async def recommend_posts(self, user_id: str, limit: int = 20):
        """Gợi ý bài viết dựa trên embedding trung bình các bài user đã tương tác."""
        interacted_ids = await self._fetch_interacted_post_ids(user_id, limit=50)

        # Người dùng mới chưa có tương tác -> trả rỗng để core-api fallback feed mặc định
        if not interacted_ids:
            return {"post_ids": [], "source": "cold_start"}

        embeddings = await self.chromadb.get_embeddings_by_ids(interacted_ids)
        if not embeddings:
            return {"post_ids": [], "source": "no_embeddings"}

        # Tính vector trung bình (mean pooling) không phụ thuộc numpy
        dim = len(embeddings[0])
        mean_vec = [0.0] * dim
        for vec in embeddings:
            for i in range(dim):
                mean_vec[i] += vec[i]
        n = len(embeddings)
        mean_vec = [v / n for v in mean_vec]

        result = await self.chromadb.recommend_by_embedding(
            embedding=mean_vec,
            limit=limit,
            exclude_ids=interacted_ids,
        )
        return {"post_ids": result.get("ids", []), "source": "personalized"}

    async def reindex_all(self, batch_size: int = 200):
        """Embed lại toàn bộ post public vào ChromaDB (backfill dữ liệu cũ)."""
        async for db in get_db():
            try:
                query = text(
                    "SELECT id, content FROM post WHERE content IS NOT NULL AND content <> ''"
                )
                result = await db.execute(query)
                rows = result.mappings().all()

                count = 0
                for r in rows:
                    try:
                        await self.chromadb.create_with_text(
                            {"id": r["id"], "text": r["content"]}
                        )
                        count += 1
                    except Exception:
                        # Bỏ qua bài lỗi, tiếp tục
                        continue

                return {"message": "Reindex completed", "total": len(rows), "indexed": count}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Reindex error: {str(e)}")
