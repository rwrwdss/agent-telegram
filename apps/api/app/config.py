from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+asyncpg://agent:agent@localhost:5432/agent"
    redis_url: str = "redis://localhost:6379/0"
    service_token: str = "dev-service-token-change-me"
    session_encryption_key: str = ""
    telegram_api_id: int = 0
    telegram_api_hash: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    default_llm_provider: str = "openai"
    default_llm_model: str = "gpt-4o-mini"
    payload_secret: str = "change-me-to-a-long-random-string"
    cors_origins: str = "http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    return Settings()
