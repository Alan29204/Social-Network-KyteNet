from database.chromadb import ChromaDb
from database.base import get_db
from sqlalchemy import text
from fastapi import HTTPException
from schemas.posts import PostsBase
from services.ai import AIService
from schemas.paginated_query import PaginatedQuery


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
        return {"message": "Post is'n media"}

      result = []

      # Loop medias and detect image
      for media in medias:
        detect = await self.model_ai.classify_image(media)
        result.append(detect)

      return result

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
