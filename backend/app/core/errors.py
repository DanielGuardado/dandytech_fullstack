from fastapi import Request
from fastapi.responses import JSONResponse

class AppError(Exception):
    def __init__(self, message: str, status_code: int = 400, details: dict | None = None):
        self.message = message
        self.status_code = status_code
        self.details = details or {}

async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(status_code=exc.status_code, content={"error": {"message": exc.message, "details": exc.details}})
