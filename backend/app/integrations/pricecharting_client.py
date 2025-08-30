import httpx
from app.core.config import settings

class PriceChartingClient:
    def __init__(self):
        self.api_key = settings.PRICECHARTING_API_KEY or ""
        self.base_url = settings.PRICECHARTING_BASE_URL or ""

    # Example sync wrapper — replace with real endpoints as you wire the API.
    def get_value_sync(self, pc_id: str, bucket: str) -> float | None:
        """
        Return the current market value for the given PriceCharting ID and bucket:
        bucket in {'Loose','CIB','New'}.
        If not configured or API fails, return None gracefully.
        """
        if not self.base_url or not self.api_key or not pc_id:
            return None
        try:
            # Example request shape; adjust to PriceCharting's real API spec.
            # resp = httpx.get(f"{self.base_url}/values", params={"id": pc_id, "bucket": bucket, "key": self.api_key}, timeout=8.0)
            # resp.raise_for_status()
            # data = resp.json()
            # return float(data["value"]) if "value" in data else None
            return None  # TODO: implement real call
        except Exception:
            return None
        
    def get_pricecharting_product_by_id(self, pc_id: str):
        if not self.base_url or not self.api_key or not pc_id:
            return None
        try:
            resp = httpx.get(f"{self.base_url}/products", params={"t": self.api_key, "id": pc_id}, timeout=8.0)
            resp.raise_for_status()
            return resp.json()
        except Exception:
            return None

    def get_pricecharting_product_by_upc(self, upc: str):
        if not self.base_url or not self.api_key or not upc:
            return None
        try:
            resp = httpx.get(f"{self.base_url}/products", params={"t": self.api_key, "upc": upc}, timeout=8.0)
            resp.raise_for_status()
            return resp.json()
        except Exception:
            return None

    def get_pricecharting_products_by_query(self, query: str):
        if not self.base_url or not self.api_key or not query:
            return None
        try:
            resp = httpx.get(f"{self.base_url}/products", params={"t": self.api_key, "q": query}, timeout=8.0)
            resp.raise_for_status()
            return resp.json()
        except Exception:
            return None