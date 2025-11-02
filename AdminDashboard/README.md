# Admin Dashboard (React + Vite)

이 프로젝트는 매장 실내 내비게이션을 관리(세그먼트 그리기, 아이템 CRUD, 경로 안내, 챗봇 테스트)하는 관리자 대시보드입니다. FastAPI 백엔드와 통신하며, API 기본 주소는 환경 변수로 설정합니다.

## 0. 요구사항
- Node.js LTS (v18 이상 권장)
- npm (또는 pnpm/yarn)
- FastAPI 백엔드가 `0.0.0.0:8000`에서 실행 중

## 1. 설치
```bash
cd AdminDashboard
npm install
```

## 2. 환경 변수 설정 (.env)
Vite는 `VITE_` 접두사를 가진 변수를 클라이언트에 노출합니다. API 주소를 설정하세요.

```env
VITE_API_BASE=http://<서버_IP>:8000
```

- 로컬 PC에서 FastAPI를 `uvicorn main:app --host 0.0.0.0 --port 8000` 로 실행해야 외부(모바일/다른 PC)에서 접근 가능합니다.
- 같은 PC에서 대시보드를 실행한다면 `http://localhost:8000` 도 사용 가능.
- 같은 네트워크의 다른 기기에서 접근 시 PC의 로컬 IP를 사용: 예) `http://192.168.0.10:8000`

## 3. 개발 서버 실행
```bash
npm run dev
```

브라우저에서 다음 주소로 접속:
- Vite 기본 포트: `http://localhost:5173`

## 4. 주요 기능
- 세그먼트 그리기: Draw 모드에서 지점 클릭→Save Segment 로 통로를 추가
- 경로 안내: Route 모드에서 시작/도착 클릭→Compute Route
- 아이템 CRUD: Create/Edit 모드에서 지도 클릭으로 좌표 지정 후 저장/수정/삭제
- 사이드바: Items 리스트 열람/검색 및 항목 선택 후 편집
- 챗봇: 질의→추천된 아이템으로 네비게이션(단일/다중 목적지)

## 5. 트러블슈팅
- CORS/네트워크 에러: FastAPI CORS 설정, `VITE_API_BASE` 주소, 방화벽, 같은 네트워크 여부 확인
- 요청 실패: 백엔드가 동작 중인지, 엔드포인트(/api/items, /api/segments 등) 정상인지 확인
- 좌표 스냅: 근처 포인트로 스냅되도록 되어 있으니 세밀한 배치가 필요하면 확대/축소 비율을 `src/config.js` 에서 조절

## 6. 구성 참고
- API 베이스: `src/config.js` (`VITE_API_BASE` 사용)
- API 호출: `src/api.js`, `src/chatApi.js`
- 지도/편집 UI: `src/MapView.jsx`
- 진입점: `src/main.jsx`, `src/App.jsx`

프로덕션 빌드는 `npm run build`로 생성되며, 정적 파일을 어떤 서버로든 배포할 수 있습니다.
