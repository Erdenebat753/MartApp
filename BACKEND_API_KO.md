# 백엔드 API 문서 (아주 쉽게 설명)

- 기본 주소(Base URL): `http://<서버_IP>:8000`
  - 같은 PC라면 `http://localhost:8000`
  - 외부/모바일에서 접속하려면 FastAPI를 `0.0.0.0:8000` 으로 실행하세요.
- 요청/응답 형식: JSON
- 인증: 없음(내부 관리자용 데모)
- Swagger: `http://<서버_IP>:8000/docs`

---

## 1) 상품/지점 아이템 API — `/api/items`
아이템은 매장 내 좌표에 있는 모든 것을 말합니다. (상품, 구역, 입구, 계산대 등)

- GET `/api/items`
  - 모든 아이템 목록을 가져옵니다.
  - 예시:
    ```bash
    curl -s http://localhost:8000/api/items
    ```

- POST `/api/items`
  - 새 아이템을 만듭니다.
  - 요청 JSON (필수: `name`, `type`, `x`, `y`):
    ```json
    {
      "name": "사과",
      "type": "product",  
      "x": 120.5,
      "y": 340.2,
      "z": 0.0,
      "image_url": "https://...",
      "note": "신선",
      "price": 2.99,
      "sale_percent": 10,
      "description": "맛있는 사과"
    }
    ```
  - 예시(curl):
    ```bash
    curl -X POST http://localhost:8000/api/items \
      -H "Content-Type: application/json" \
      -d '{"name":"사과","type":"product","x":120.5,"y":340.2}'
    ```

- PUT `/api/items/{id}`
  - 아이템 정보를 수정합니다. (본문 형식은 POST와 동일)
  - 예시:
    ```bash
    curl -X PUT http://localhost:8000/api/items/1 \
      -H "Content-Type: application/json" \
      -d '{"name":"사과(특가)","type":"product","x":120,"y":340}'
    ```

- DELETE `/api/items/{id}`
  - 아이템을 삭제합니다.
  - 예시:
    ```bash
    curl -X DELETE http://localhost:8000/api/items/1
    ```

---

## 2) 세그먼트(통로) API — `/api/segments`
세그먼트는 지도 위 통로(선)입니다. 여러 점을 이은 polyline으로 저장합니다.

- GET `/api/segments`
  - 모든 세그먼트를 가져옵니다. 응답에는 각 세그먼트의 polyline(점 목록)이 포함됩니다.

- POST `/api/segments`
  - 특정 아이템 A↔B를 연결하는 세그먼트를 저장합니다. 저장 시 자동으로 거리(Path)도 기록됩니다.
  - 요청 JSON:
    ```json
    {
      "from_item_id": 1,
      "to_item_id": 2,
      "polyline": [
        {"x": 10, "y": 10},
        {"x": 50, "y": 20},
        {"x": 90, "y": 40}
      ]
    }
    ```

- POST `/api/segments/free`
  - 자유롭게 그린 선을 저장합니다(아이템 연결 없이). 지도 편집용입니다.
  - 요청 JSON:
    ```json
    {
      "polyline": [
        {"x": 30, "y": 50},
        {"x": 60, "y": 80}
      ]
    }
    ```

---

## 3) 경로 그래프(Path) API — `/api/paths`
세그먼트에서 계산된 A↔B 간 거리 기록입니다. 보통 수동 수정은 필요 없습니다.

- GET `/api/paths`
  - 모든 경로 레코드를 가져옵니다.

- POST `/api/paths`
  - 직접 거리 레코드를 추가할 수도 있습니다. (일반적이지 않음)
  - 요청 JSON:
    ```json
    { "from_item_id": 1, "to_item_id": 2, "distance": 123.4 }
    ```

---

## 4) 길찾기(Route) API — `/api/route`
지도 위에서 최단 경로(또는 가까운 근사)를 구합니다.

- POST `/api/route`
  - 아이템 ID에서 아이템 ID로 경로를 요청합니다. (간단한 데모 용)
  - 요청 JSON:
    ```json
    { "from_item_id": 1, "to_item_id": 5 }
    ```
  - 응답: `polyline`(점들), `nodes`(거친 아이템 ID들)

- POST `/api/route/coords`
  - 자유 좌표(start, end) 사이 경로를 계산합니다.
  - 요청 JSON:
    ```json
    { "start": {"x": 10, "y": 10}, "end": {"x": 200, "y": 300} }
    ```
  - 응답: `polyline: [{x,y}, ...]`

- POST `/api/route/plan`
  - 여러 상품을 순서대로 들르는 경로를 대략 계산합니다(탐욕적 근사). 시작점은 옵션입니다.
  - 요청 JSON:
    ```json
    {
      "start": {"x": 50, "y": 50},
      "item_ids": [3, 8, 12]
    }
    ```
  - 응답: `ordered_ids`(방문 순서의 아이템 ID), `polyline`

---

## 5) 챗봇 API — `/api/chatbot`
챗봇에게 질문을 보내면 의도(intent)를 분류하고 관련 상품을 찾아줍니다.

- POST `/api/chatbot`
  - 요청 JSON:
    ```json
    {
      "text": "갈비 양념 어디 있어?",
      "device": { "x": 100, "y": 200, "z": 0.0 }
    }
    ```
    - `device`는 선택값입니다. 사용자의 현재 위치가 있을 때 같이 보낼 수 있습니다.
  - 응답 JSON:
    ```json
    {
      "intent": "product_location",
      "item_ids": [7, 15],
      "reply": "요청하신 상품을 찾았습니다: #7..."
    }
    ```
  - 참고: `.env`에 `OPENAI_API_KEY`가 있으면 LLM을 사용하고, 없으면 간단한 규칙/문자열 매칭으로 동작합니다.

---

## 빠른 체크리스트
- 서버 실행: `uvicorn main:app --host 0.0.0.0 --port 8000`
- Swagger 문서: `http://<서버_IP>:8000/docs`
- 에러가 나면:
  - CORS 설정(`config.py`)과 `.env` 값 확인
  - 세그먼트/아이템이 있는지 확인(경로 계산은 데이터가 필요)

