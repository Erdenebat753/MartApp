from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional, Dict, Any
import os, json
from pathlib import Path
import pickle

from database import get_db
from models import Item
from schemas import ChatbotRequest, ChatbotResponse
from config import settings


router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])


INTENT_PRODUCT_LOCATION = "product_location"
INTENT_RECOMMENDATION = "recommendation"
INTENT_PRICE_SALE = "price_sale"


_clf = None
_vec = None
_trained_from_file = False
_model_dir = Path(__file__).resolve().parent.parent / "models_cache"
_model_vec_path = _model_dir / "intent_vec.pkl"
_model_clf_path = _model_dir / "intent_clf.pkl"
_prompts_cache: Optional[Dict[str, Any]] = None


def _train_classifier_from_pairs(pairs: list[tuple[str, str]]) -> bool:
    global _clf, _vec
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.svm import LinearSVC
    except Exception:
        return False
    if not pairs:
        return False
    X = [t for t, _ in pairs]
    y = [lbl for _, lbl in pairs]
    _vec = TfidfVectorizer(ngram_range=(1, 2), min_df=1)
    Xv = _vec.fit_transform(X)
    _clf = LinearSVC()
    _clf.fit(Xv, y)
    return True


# No built-in default seed; relies on JSON training data.


def _save_model():
    try:
        _model_dir.mkdir(parents=True, exist_ok=True)
        with open(_model_vec_path, "wb") as f:
            pickle.dump(_vec, f)
        with open(_model_clf_path, "wb") as f:
            pickle.dump(_clf, f)
    except Exception:
        pass


def _load_model() -> bool:
    global _vec, _clf
    try:
        if _model_vec_path.exists() and _model_clf_path.exists():
            with open(_model_vec_path, "rb") as f:
                _vec = pickle.load(f)
            with open(_model_clf_path, "rb") as f:
                _clf = pickle.load(f)
            return True
    except Exception:
        pass
    return False


def init_intent_model(path: str = "data/trainingdata.json") -> bool:
    """trainingdata.json-оос (text, intent) жагсаалтыг ачаалж 1 удаа сургасан model-г бэлдэнэ.
    Хэрэв pickle model (models_cache/*.pkl) байвал түүнийг шууд уншина."""
    # 1) Try load cached model
    if _load_model():
        return True

    global _trained_from_file
    # 2) Else, train from JSON
    try:
        p = Path(__file__).resolve().parent.parent / path
        if p.exists():
            data = json.loads(p.read_text(encoding="utf-8"))
            pairs: list[tuple[str, str]] = []
            for row in data:
                text = (row.get("text") or "").strip()
                intent = (row.get("intent") or "").strip()
                if text and intent:
                    pairs.append((text, intent))
            ok = _train_classifier_from_pairs(pairs)
            if ok:
                _trained_from_file = True
                _save_model()
                return True
    except Exception:
        pass
    # 3) No fallback seeds — зөвхөн JSON өгөгдлөөс сургалт хийнэ
    return False


def _load_prompts(path: str = "data/prompt.json") -> Dict[str, Any]:
    global _prompts_cache
    if _prompts_cache is not None:
        return _prompts_cache
    try:
        p = Path(__file__).resolve().parent.parent / path
        if p.exists():
            _prompts_cache = json.loads(p.read_text(encoding="utf-8"))
            return _prompts_cache
    except Exception:
        pass
    # Минимум систем prompt (중복 제거 목적) — JSON байхгүй үед
    _prompts_cache = {
        "system": "당신은 매장 내비게이션 도우미입니다. 항상 JSON 객체(intent, item_ids, reply)로만 한국어로 응답하세요.",
        "intents": {}
    }
    return _prompts_cache


def classify_intent(text: str) -> str:
    t = (text or "").lower()
    # ML classifier (sklearn) — амжилттай байвал түүнийг ашиглана (startup үед init_intent_model дуудагдана)
    global _clf, _vec
    if _clf is None or _vec is None:
        ok = init_intent_model()
        if not ok:
            _clf = None
            _vec = None
    if _clf is not None and _vec is not None:
        try:
            Xv = _vec.transform([t])
            pred = _clf.predict(Xv)[0]
            return str(pred)
        except Exception:
            pass
    # Нөөц дүрэмт ангилал (한국어 키워드)
    if any(k in t for k in ["어디", "위치", "찾아", "where", "location"]):
        return INTENT_PRODUCT_LOCATION
    if any(k in t for k in ["추천", "레시피", "뭐 먹지", "먹을까", "recommend"]):
        return INTENT_RECOMMENDATION
    if any(k in t for k in ["가격", "세일", "할인", "price", "sale"]):
        return INTENT_PRICE_SALE
    return INTENT_PRODUCT_LOCATION


def _items_to_minimal_dict(items: List[Item]) -> List[Dict[str, Any]]:
    out = []
    for it in items:
        out.append({
            "id": it.id,
            "name": it.name,
            "type": it.type,
            "x": float(it.x),
            "y": float(it.y),
            "z": float(it.z) if getattr(it, 'z', None) is not None else None,
            "price": float(it.price) if it.price is not None else None,
            "sale_percent": int(it.sale_percent) if it.sale_percent is not None else None,
            "description": it.description or None,
        })
    return out


def _use_gpt() -> bool:
    return bool(settings.OPENAI_API_KEY)


async def _call_gpt(intent: str, user_text: str, device: Optional[Dict[str, float]], items_payload: List[Dict[str, Any]]) -> Dict[str, Any]:
    try:
        from openai import OpenAI
    except Exception:
        return {
            "intent": intent,
            "item_ids": [],
            "reply": "LLM을 사용할 수 없습니다. OPENAI_API_KEY를 설정해 주세요.",
        }

    try:
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
    except Exception:
        return {
            "intent": intent,
            "item_ids": [],
            "reply": "LLM 클라이언트 초기화 오류(httpx/프록시). 간단 매칭으로 대체합니다.",
        }

    prm = _load_prompts()
    sys = prm.get("system")
    per_intent = prm.get("intents", {}).get(intent, "")
    user_payload = {
        "intent": intent,
        "user_text": user_text,
        "device": device,
        "items": items_payload,
        "instructions": per_intent,
    }

    try:
        resp = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": sys},
                {"role": "user", "content": str(user_payload)},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
    except Exception:
        return {
            "intent": intent,
            "item_ids": [],
            "reply": "LLM 호출 중 오류가 발생했습니다. 나중에 다시 시도해 주세요.",
        }

    try:
        content = resp.choices[0].message.content
    except Exception:
        content = None
    import json
    try:
        data = json.loads(content) if content else {}
        if not isinstance(data, dict):
            data = {}
    except Exception:
        data = {}
    # enforce fields
    out_intent = data.get("intent", intent)
    out_ids = data.get("item_ids", []) or []
    out_reply = data.get("reply") or "응답을 생성하지 못했습니다. 다시 시도해 주세요."
    return {"intent": out_intent, "item_ids": out_ids, "reply": out_reply}


def _simple_match_ids(user_text: str, items: List[Item]) -> List[int]:
    t = (user_text or "").lower()
    scored = []
    for it in items:
        name = (it.name or "").lower()
        score = 0
        if name in t or any(w in name for w in t.split()):
            score += 2
        # prefer products over zones
        if it.type == "product":
            score += 1
        if score > 0:
            scored.append((score, it.id))
    scored.sort(reverse=True)
    return [id for _, id in scored[:5]]


@router.post("", response_model=ChatbotResponse)
async def chatbot(req: ChatbotRequest, db: AsyncSession = Depends(get_db)):
    # 1) classify intent
    intent = classify_intent(req.text)

    # 2) load items
    res = await db.execute(select(Item))
    items: List[Item] = res.scalars().all()
    items_payload = _items_to_minimal_dict(items)

    # 3) route by intent
    use_llm = _use_gpt()
    if use_llm:
        data = await _call_gpt(intent, req.text, req.device, items_payload)
        item_ids = [int(i) for i in data.get("item_ids", []) if isinstance(i, (int, float))]
        reply = data.get("reply") or "응답을 생성하지 못했습니다. 다시 시도해 주세요."
    else:
        # fallback simple match (한국어 응답)
        item_ids = _simple_match_ids(req.text, items)
        if intent == INTENT_PRODUCT_LOCATION and item_ids:
            reply = f"요청하신 상품을 찾았습니다: #{item_ids[0]}. 아래 '길안내' 버튼을 눌러 이동하세요."
        elif intent == INTENT_RECOMMENDATION and item_ids:
            reply = f"다음 상품을 추천합니다: {', '.join('#'+str(i) for i in item_ids)}"
        elif intent == INTENT_PRICE_SALE and item_ids:
            found = [it for it in items if it.id in item_ids]
            parts = []
            for it in found:
                price_txt = (str(it.price) if it.price is not None else '정보 없음')
                sale_txt = (f"할인 {it.sale_percent}%" if it.sale_percent is not None else '할인 정보 없음')
                parts.append(f"{it.name}: 가격 {price_txt}, {sale_txt}")
            reply = "; ".join(parts) if parts else "관련 정보를 찾을 수 없습니다."
        else:
            reply = "알겠습니다."

    # 4) shape response
    if not reply or not reply.strip():
        reply = "요청을 처리하지 못했습니다. 다시 시도해 주세요."
    return ChatbotResponse(intent=intent, item_ids=item_ids, reply=reply)
