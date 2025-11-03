from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
import json
from typing import List, Optional


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

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)


settings = Settings()
