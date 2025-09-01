from fastapi import FastAPI
from app.routers import lookups, catalog, purchase_orders, receiving, inventory, health, catalog_pricecharting as pc_router, attributes as attributes_router, inventory_attributes as inventory_attributes_router, purchase_calculator
from app.core.errors import AppError, app_error_handler


app = FastAPI(title="Resale Core API", version="1.0")

# Register error handlers
app.add_exception_handler(AppError, app_error_handler)

app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(lookups.router, prefix="/api/v1/lookups", tags=["lookups"])
app.include_router(catalog.router, prefix="/api/v1/catalog", tags=["catalog"])
app.include_router(purchase_orders.router, prefix="/api/v1/purchase-orders", tags=["purchase_orders"])
app.include_router(receiving.router, prefix="/api/v1/receiving", tags=["receiving"])
app.include_router(inventory.router, prefix="/api/v1/inventory", tags=["inventory"])
app.include_router(pc_router.router, prefix="/api/v1", tags=["pricecharting"])
app.include_router(attributes_router.router, prefix="/api/v1", tags=["attributes"])
app.include_router(inventory_attributes_router.router, prefix="/api/v1", tags=["inventory_attributes"])
app.include_router(purchase_calculator.router, prefix="/api/v1", tags=["purchase_calculator"])

@app.get("/health")
def health():
    return {"ok": True}


