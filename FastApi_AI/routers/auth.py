from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone
import base64
import hashlib
import hmac
import json

from config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    pad = '=' * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def _jwt_encode(payload: dict, secret: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    h = _b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    p = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{h}.{p}".encode("utf-8")
    sig = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    s = _b64url(sig)
    return f"{h}.{p}.{s}"


def _jwt_decode(token: str, secret: str) -> dict:
    try:
        h_b64, p_b64, s_b64 = token.split(".")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token")
    signing_input = f"{h_b64}.{p_b64}".encode("utf-8")
    expected = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    actual = _b64url_decode(s_b64)
    if not hmac.compare_digest(expected, actual):
        raise HTTPException(status_code=401, detail="Invalid signature")
    payload = json.loads(_b64url_decode(p_b64).decode("utf-8"))
    # exp check
    exp = payload.get("exp")
    if exp is not None:
        now = int(datetime.now(timezone.utc).timestamp())
        if now >= int(exp):
            raise HTTPException(status_code=401, detail="Token expired")
    return payload


@router.post("/login")
def login(req: LoginRequest):
    admin_user = (settings.ADMIN_USERNAME or "admin").strip()
    admin_pass = (settings.ADMIN_PASSWORD or "").strip()
    if not admin_pass:
        # If password is not set, refuse login for safety
        raise HTTPException(status_code=400, detail="ADMIN_PASSWORD not configured on server")
    if req.username != admin_user or req.password != admin_pass:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    exp = int((datetime.now(timezone.utc) + expires_delta).timestamp())
    token = _jwt_encode({"sub": req.username, "role": "admin", "exp": exp}, settings.JWT_SECRET or "change-me-secret")
    return {"access_token": token, "token_type": "bearer", "expires_in": int(expires_delta.total_seconds())}


def get_current_user(authorization: Optional[str] = Header(default=None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    try:
        scheme, token = authorization.split(" ", 1)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Authorization header")
    if scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid auth scheme")
    payload = _jwt_decode(token, settings.JWT_SECRET or "change-me-secret")
    return payload


@router.get("/me")
def me(user=Depends(get_current_user)):
    return {"user": user}

