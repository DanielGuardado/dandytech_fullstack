def paginate(items, total, limit: int, offset: int):
    return {"items": items, "total": total, "limit": limit, "offset": offset}
