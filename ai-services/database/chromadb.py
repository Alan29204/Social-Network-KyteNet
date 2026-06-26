import chromadb
from services.embeddings import Embeddings
from fastapi import HTTPException
from typing import List, Optional
from core.settings import settings
from schemas.paginated_query import PaginatedQuery


# Connect to ChromaDB
COLLECTION_NAME = "posts"
chroma_client = chromadb.HttpClient(host=settings.CHROMA_DB_HOST, port=settings.CHROMA_DB_PORT)


def _get_posts_collection():
    return chroma_client.get_or_create_collection(name=COLLECTION_NAME)


collection = _get_posts_collection()


class ChromaDb:
    def __init__(self):
        self.collection = collection
        self.embeddings = Embeddings()

    def reset_collection(self):
        global collection
        try:
            chroma_client.delete_collection(name=COLLECTION_NAME)
        except Exception:
            pass
        collection = _get_posts_collection()
        self.collection = collection

    @staticmethod
    def _build_metadata(extra: Optional[dict] = None) -> dict:
        meta = {"type": "post"}
        if extra:
            meta.update({k: v for k, v in extra.items() if v is not None})
        return meta

    # Add data with text
    async def create_with_text(self, metadata: dict):
        try:
            item_id = str(metadata['id'])
            embedding = self.embeddings.get_embedding_text(metadata['text'])
            self.collection.upsert(
                ids=[item_id],
                embeddings=[embedding],
                metadatas=[self._build_metadata(metadata.get('extra'))],
                documents=[metadata['text']],
            )
            return {"message": f"Created embedding {item_id} successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error create embedding: {str(e)}")

    # Delete data by id
    async def delete_by_id(self, id: str):
        try:
            item_id = str(id)
            self.collection.delete(ids=[item_id])
            return {"message": f"Delete embedding has id {item_id} successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error deleting: {str(e)}")

    # Suggest 
    async def suggest_posts(self, query: PaginatedQuery, max_distance: Optional[float] = None) -> dict:
        try:
            query_embedding = self.embeddings.get_embedding_text(query.query)

            # Lấy vừa đủ cho tới trang hiện tại (tránh fetch quá nhiều)
            fetch_limit = max(query.page_size * query.page, query.page_size)
            collection_count = self.collection.count()
            if collection_count == 0:
                return {
                    "ids": [],
                    "metadatas": [],
                    "distances": [],
                    "pagination": {
                        "current_page": query.page,
                        "page_size": query.page_size,
                        "total_results": 0,
                        "total_pages": 0,
                    },
                }
            fetch_limit = min(fetch_limit, collection_count)

            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=fetch_limit,
                where={"type": "post"},
                include=["metadatas", "distances"],  # Không cần documents
            )

            ids = results['ids'][0] if results.get('ids') and len(results['ids']) > 0 else []
            metadatas = results['metadatas'][0] if results.get('metadatas') and len(results['metadatas']) > 0 else []
            distances = results['distances'][0] if results.get('distances') and len(results['distances']) > 0 else []

            # Lọc bỏ kết quả ít liên quan theo ngưỡng khoảng cách
            filtered = [
                (i, m, d)
                for i, m, d in zip(ids, metadatas, distances)
                if max_distance is None or d is None or d <= max_distance
            ]

            total_results = len(filtered)
            start_idx = (query.page - 1) * query.page_size
            end_idx = min(start_idx + query.page_size, total_results)
            page_slice = filtered[start_idx:end_idx] if total_results > 0 else []

            return {
                "ids": [x[0] for x in page_slice],
                "metadatas": [x[1] for x in page_slice],
                "distances": [x[2] for x in page_slice],
                "pagination": {
                    "current_page": query.page,
                    "page_size": query.page_size,
                    "total_results": total_results,
                    "total_pages": (total_results + query.page_size - 1) // query.page_size if total_results > 0 else 0,
                },
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error querying: {str(e)}")

    async def recommend_by_embedding(
        self,
        embedding: list,
        limit: int = 20,
        exclude_ids: Optional[List[str]] = None,
    ) -> dict:
        """Gợi ý bài viết tương tự một vector (trung bình sở thích người dùng)."""
        try:
            exclude_ids = exclude_ids or []
            # Lấy dư để bù số bài bị loại (đã xem / của chính user)
            fetch_limit = limit + len(exclude_ids) + 10
            collection_count = self.collection.count()
            if collection_count == 0:
                return {"ids": [], "distances": []}
            fetch_limit = min(fetch_limit, collection_count)

            results = self.collection.query(
                query_embeddings=[embedding],
                n_results=fetch_limit,
                where={"type": "post"},
                include=["metadatas", "distances"],
            )

            ids = results['ids'][0] if results.get('ids') and len(results['ids']) > 0 else []
            distances = results['distances'][0] if results.get('distances') and len(results['distances']) > 0 else []

            exclude_set = set(exclude_ids)
            ranked = [
                (i, d) for i, d in zip(ids, distances) if i not in exclude_set
            ][:limit]

            return {
                "ids": [x[0] for x in ranked],
                "distances": [x[1] for x in ranked],
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error recommending: {str(e)}")

    async def get_embeddings_by_ids(self, ids: List[str]) -> list:
        """Lấy danh sách vector theo nhiều id (để tính trung bình sở thích)."""
        if not ids:
            return []
        try:
            results = self.collection.get(
                ids=[str(item_id) for item_id in ids],
                include=["embeddings"],
            )
            embeddings = results.get("embeddings")
            if embeddings is None:
                return []
            if hasattr(embeddings, "tolist"):
                embeddings = embeddings.tolist()
            return embeddings
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error getting embeddings: {str(e)}")
