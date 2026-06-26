from pydantic import BaseModel


class PaginatedQuery(BaseModel):
    query: str
    page: int = 1
    page_size: int = 10
