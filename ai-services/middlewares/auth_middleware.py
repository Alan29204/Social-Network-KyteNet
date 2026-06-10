from pydantic import BaseModel
from typing import Optional
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
import jwt  
from schemas.user_interface import IUser
from services.auth import AuthService
from core.settings import settings

# API public (so khớp chính xác)
public_routes = {"/docs", "/re-docs", "/openapi.json", "/token"}

# API backend NestJS gọi (so khớp theo prefix vì có path động)
system_route_prefixes = (
    "/posts/check-policy-for-post",
    "/posts/embed",            # POST /posts/embed, DELETE /posts/embed/{id}
    "/posts/semantic-search",
    "/posts/recommend",
    "/posts/reindex",
)


def _is_system_route(path: str) -> bool:
    return any(path == p or path.startswith(p + "/") or path.startswith(p) for p in system_route_prefixes)


# Middleware authorization
async def auth_middleware(request: Request, call_next):

  path = request.url.path
  key_auth = request.headers.get("key_auth")
  valid_key = settings.KEY_AUTH

  # Check if the request is for a public route
  if path in public_routes:
      return await call_next(request)

  # Check if the request is for a system route (NestJS -> FastAPI)
  if _is_system_route(path):
      if key_auth == valid_key:
          return await call_next(request)
      else:
          return JSONResponse(
              status_code=status.HTTP_403_FORBIDDEN,
              content={"detail": "Your request is not access"}
          )

  # Get token from header (an toàn khi thiếu header)
  auth_header = request.headers.get("authorization") or ""
  parts = auth_header.split(" ")
  token = parts[1] if len(parts) == 2 else None

  if not token:
      return JSONResponse(
          status_code=status.HTTP_401_UNAUTHORIZED,
          content={"detail": "Authorization header missing or invalid"}
      )
  
  try:
      auth_service = AuthService()
      payload: IUser = await auth_service.verify_token(token)
      
      request.state.user = payload
      
      # Continue process request
      response = await call_next(request)
      
      return response
  
  except HTTPException as e:
      return JSONResponse(
          status_code=e.status_code,
          content={"detail": e.detail}
      )