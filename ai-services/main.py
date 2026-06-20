from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from middlewares.auth_middleware import auth_middleware
from api.api_router import router
import uvicorn
from database.base import get_db
import asyncio
from core.settings import settings

def create_application() -> FastAPI:
    # Create the FastAPI application
    application = FastAPI(
        title='Social network SNet', docs_url="/docs", redoc_url='/re-docs',
        openapi_url=f"{settings.API_PREFIX}/openapi.json",
        description='''
        API use FastAPI docs for Social network SNet:
        - Posts.
        - Recomendations.
        - Search vector.
        - Suggest user follow.
        '''
    )

    @application.exception_handler(HTTPException)
    async def http_exception_handler(_request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )

    @application.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        print(f"[UnhandledError] {request.method} {request.url.path}: {exc}")
        return JSONResponse(
            status_code=500,
            content={"detail": str(exc) or "Internal Server Error"},
        )
    
    application.middleware("http")(auth_middleware)

    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(router, prefix=settings.API_PREFIX)
    return application

app = create_application()

def main():
    config = uvicorn.Config(
        app=app,
        host=settings.HOST_FASTAPI,
        port=int(settings.PORT_FASTAPI),
        reload=True
    )
  
    server = uvicorn.Server(config)
    asyncio.run(server.serve())

if __name__ == '__main__':
    main()


# CLI run server: uvicorn main:app --reload
