from fastapi import APIRouter, Query
from services.post import PostService
from schemas.id_request import IDRequest
from pydantic import BaseModel, Field
from typing import List, Optional

router = APIRouter()

postService = PostService()


class EmbedPostRequest(BaseModel):
    post_id: str
    content: Optional[str] = None
    hashtags: List[str] = Field(default_factory=list)


class RecommendRequest(BaseModel):
    user_id: str
    limit: int = 20


class ReindexRequest(BaseModel):
    reset: bool = True


@router.post("/check-policy-for-post")
async def check_policy_for_post(dto: IDRequest):
    return await postService.check_policy_for_posts(dto.id)


@router.post("/embed")
async def embed_post(dto: EmbedPostRequest):
    """Receive a post_id and content, embed and store in ChromaDB."""
    return await postService.embed_post(dto.post_id, dto.content, dto.hashtags)


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


@router.post("/recommend")
async def recommend_posts(dto: RecommendRequest):
    """Gợi ý bài viết cá nhân hóa dựa trên lịch sử tương tác của người dùng."""
    return await postService.recommend_posts(dto.user_id, dto.limit)


@router.post("/reindex")
async def reindex_posts(dto: Optional[ReindexRequest] = None):
    """Embed lại toàn bộ bài viết cũ vào ChromaDB (chạy 1 lần để backfill)."""
    dto = dto or ReindexRequest()
    return await postService.reindex_all(reset=dto.reset)
