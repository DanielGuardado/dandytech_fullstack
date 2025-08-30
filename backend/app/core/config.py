from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    PRICECHARTING_API_KEY: str | None = None
    PRICECHARTING_BASE_URL: str | None = None
    ENV: str = "dev"

    class Config:
        env_file = ".env"

settings = Settings()
