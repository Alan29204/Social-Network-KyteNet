import chromadb
from services.embeddings import Embeddings
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Union, Dict, Any
from helpers.embeddinh_type import EmbeddingType
from core.settings import settings
from schemas.paginated_query import PaginatedQuery
from schemas.embedding_search_query import EmbeddingSearchQuery


# Connect to ChromaDB
chroma_client = chromadb.HttpClient(host=settings.CHROMA_DB_HOST, port=settings.CHROMA_DB_PORT)
collection = chroma_client.get_or_create_collection(name="posts")


class ChromaDb:
    def __init__(self):
        self.collection = collection
        self.embeddings = Embeddings()

    @staticmethod
    def _normalize_type(value) -> Optional[str]:
        """Chấp nhận type là Enum, str hoặc None."""
        if value is None:
            return None
        return value.value if hasattr(value, "value") else str(value)

    @staticmethod
    def _build_metadata(metadata_type: Optional[str], extra: Optional[dict] = None) -> dict:
        meta = {}
        if metadata_type:
            meta["type"] = metadata_type
        if extra:
            meta.update({k: v for k, v in extra.items() if v is not None})
        # Chroma yêu cầu metadata không rỗng -> thêm cờ mặc định
        return meta or {"type": "post"}

    # Add data with text
    async def create_with_text(self, metadata: dict):
        try:
            embedding = self.embeddings.get_embedding_text(metadata['text'])
            metadata_type = self._normalize_type(metadata.get('type')) or "post"
            self.collection.upsert(
                ids=[metadata['id']],
                embeddings=[embedding],
                metadatas=[self._build_metadata(metadata_type, metadata.get('extra'))],
                documents=[metadata['text']],
            )
            return {"message": f"Created embedding {metadata['id']} successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error create embedding: {str(e)}")
    
    # Add data with embedding
    async def create_with_embedding(self, data: dict):
        try:
            metadata_type = data['type'].value if data.get('type') else None
            self.collection.add(
                ids=[data['id']],
                embeddings=[data['embedding']],
                metadatas=[{"type": metadata_type} if metadata_type else {}],
                documents=None 
            )
            return {"message": f"Created embedding with ID {data['id']} successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error creating embedding: {str(e)}")

    # Delete data by id
    async def delete_by_id(self, id: str):
        try:
            self.collection.delete(ids=[id])
            return {"message": f"Delete embedding has id {id} successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error deleting: {str(e)}")

    # Update with text
    async def update_with_text(self, metadata: dict):
        try:
            embedding = self.embeddings.get_embedding_text(metadata['text'])
            self.collection.update(
                ids=[metadata['id']],
                embeddings=[embedding],
                metadatas=[{"type": metadata['type']} if metadata.get('type') else {}],
                documents=None  
            )
            return {"message": f"Updated embedding {metadata['id']} successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error updating: {str(e)}")
    
    # Update with embedding 
    async def update_with_embedding(self, data: dict):
        try:
            self.collection.update(
                ids=[data['id']],
                embeddings=[data['embedding']],
                metadatas=[{"type": data['type']} if data.get('type') else {}],
                documents=None 
            )
            return {"message": f"Updated embedding {data['id']} successfully using provided embedding"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error updating with embedding: {str(e)}")

    # Suggest 
    async def suggest_posts(self, query: PaginatedQuery, max_distance: float = 1.5) -> dict:
        try:
            query_embedding = self.embeddings.get_embedding_text(query.query)

            # Add filter (chuẩn hóa Enum -> str)
            type_str = self._normalize_type(query.type)
            where_filter = {"type": type_str} if type_str else None

            # Lấy vừa đủ cho tới trang hiện tại (tránh fetch quá nhiều)
            fetch_limit = max(query.page_size * query.page, query.page_size)

            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=fetch_limit,
                where=where_filter,
                include=["metadatas", "distances"],  # Không cần documents
            )

            ids = results['ids'][0] if results.get('ids') and len(results['ids']) > 0 else []
            metadatas = results['metadatas'][0] if results.get('metadatas') and len(results['metadatas']) > 0 else []
            distances = results['distances'][0] if results.get('distances') and len(results['distances']) > 0 else []

            # Lọc bỏ kết quả ít liên quan theo ngưỡng khoảng cách
            filtered = [
                (i, m, d)
                for i, m, d in zip(ids, metadatas, distances)
                if d is None or d <= max_distance
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
            results = self.collection.get(ids=ids, include=["embeddings"])
            return results.get("embeddings", []) or []
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error getting embeddings: {str(e)}")

    # Find by embedding
    async def search_by_embedding(self, query: EmbeddingSearchQuery) -> dict:
        try:
            # Add filter if has type
            where_filter = {"type": query.type} if query.type else None
            
            fetch_limit = query.page_size * query.page * 5
            
            results = self.collection.query(
                query_embeddings=[query.embedding],
                n_results=fetch_limit,
                where=where_filter,
                include=["metadatas", "distances"]  
            )

            total_results = len(results['ids'][0]) if results['ids'] and len(results['ids']) > 0 else 0
            start_idx = (query.page - 1) * query.page_size
            end_idx = min(start_idx + query.page_size, total_results)

            paginated_results = {
                "ids": results['ids'][0][start_idx:end_idx] if total_results > 0 else [],
                "metadatas": results['metadatas'][0][start_idx:end_idx] if total_results > 0 else [],
                "distances": results['distances'][0][start_idx:end_idx] if total_results > 0 else [],
                "pagination": {
                    "current_page": query.page,
                    "page_size": query.page_size,
                    "total_results": total_results,
                    "total_pages": (total_results + query.page_size - 1) // query.page_size if total_results > 0 else 0
                }
            }
            return paginated_results
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error searching by embedding: {str(e)}")
    
    # Get embedding by id
    async def get_by_id(self, id: str) -> dict:
        try:
            results = self.collection.get(
                ids=[id],
                include=["embeddings", "metadatas"] 
            )
            
            if not results["ids"] or len(results["ids"]) == 0:
                raise HTTPException(status_code=404, detail=f"Embedding with ID {id} not found")
                
            return {
                "id": results["ids"][0],
                "embedding": results["embeddings"][0],
                "metadata": results["metadatas"][0]
            }
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=500, detail=f"Error retrieving embedding by ID: {str(e)}")