from pydantic import BaseModel
class ListResponse(BaseModel):
    items: list
    total: int
    limit: int | None = None
    offset: int | None = None
