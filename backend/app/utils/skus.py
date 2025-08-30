def build_sku(po_number: str, seq3: int, po_item_id: int) -> str:
    return f"{po_number}{seq3:03d}{po_item_id:04d}"
