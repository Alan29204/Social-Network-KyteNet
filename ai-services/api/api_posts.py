from fastapi import APIRouter, Query
from services.post import PostService
from schemas.id_request import IDRequest
from pydantic import BaseModel

router = APIRouter()

postService = PostService()


class EmbedPostRequest(BaseModel):
    post_id: str
    content: str


@router.post("/check-policy-for-post")
async def check_policy_for_post(dto: IDRequest):
    return await postService.check_policy_for_posts(dto.id)


@router.post("/embed")
async def embed_post(dto: EmbedPostRequest):
    """Receive a post_id and content, embed and store in ChromaDB."""
    return await postService.embed_post(dto.post_id, dto.content)


@router.get("/semantic-search")
async def semantic_search(
    q: str = Query(..., description="Search query text"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
):
    """Semantic search posts using ChromaDB vector similarity."""
    return await postService.semantic_search(q, page, page_size)


@router.delete("/embed/{post_id}")
async def delete_post_embedding(post_id: str):
    """Remove a post embedding from ChromaDB (e.g., when post is deleted)."""
    return await postService.delete_embedding(post_id)
