from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
import json
from typing import List, Optional
import os


class Settings(BaseSettings):
    # OpenAI / LLM
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"

    # CORS (read as simple string to avoid JSON pre-decoding in settings source)
    CORS_ORIGINS_RAW: Optional[str] = Field(default=None, validation_alias="CORS_ORIGINS")

    @property
    def CORS_ORIGINS(self) -> List[str]:
        v = self.CORS_ORIGINS_RAW
        if v is None:
            return ["*"]
        s = v.strip()
        if s == "" or s == "*":
            return ["*"]
        # Try JSON first
        try:
            parsed = json.loads(s)
            if isinstance(parsed, list):
                return [str(x) for x in parsed]
            if isinstance(parsed, str):
                ps = parsed.strip()
                if ps == "" or ps == "*":
                    return ["*"]
                return [ps]
        except Exception:
            pass
        # Fallback: comma-separated
        return [p.strip() for p in s.split(",") if p.strip()]

    # Resolve env file: prefer .env, fall back to .env.sample (both relative to this file)
    _base_dir = os.path.dirname(os.path.abspath(__file__))
    _env_primary = os.path.join(_base_dir, ".env")
    _env_fallback = os.path.join(_base_dir, ".env.sample")
    _env_file = _env_primary if os.path.exists(_env_primary) else (_env_fallback if os.path.exists(_env_fallback) else _env_primary)

    model_config = SettingsConfigDict(
        env_file=_env_file,
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


settings = Settings()
