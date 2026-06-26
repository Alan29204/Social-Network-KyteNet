from fastapi import APIRouter
from api import api_posts

router = APIRouter()

router.include_router(api_posts.router, tags=["posts"], prefix="/posts")
