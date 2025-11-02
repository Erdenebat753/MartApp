# 클라이언트(Expo) 실행 가이드

이 문서는 React Native + Expo 기반 클라이언트를 설치하고 실행하는 방법을 설명합니다. 백엔드(FastAPI)는 `0.0.0.0:8000`로 열어두고, 클라이언트 `.env`의 `EXPO_PUBLIC_API_BASE` 를 해당 서버 주소로 맞춰주세요.

## 0. 요구사항
- Node.js LTS (v18+ 권장)
- npm (또는 pnpm/yarn) 및 Expo CLI
- Android Studio(에뮬레이터) 또는 Xcode(iOS 시뮬레이터) — 선택
- 실제 기기 테스트 시 동일 네트워크 연결 필요

## 1. 설치
```bash
cd Client
npm install
```

## 2. 환경 변수 설정 (.env)
예시 키: `EXPO_PUBLIC_API_BASE` (앱에서 API 기본 URL로 사용)

```env
EXPO_PUBLIC_API_BASE=http://<서버_IP>:8000
```

- PC에서 FastAPI를 `uvicorn main:app --host 0.0.0.0 --port 8000` 로 실행해야 모바일/다른 장치에서 접근 가능합니다.
- 실제 기기에서 테스트 시 PC의 로컬 IP를 사용: 예) `http://192.168.0.10:8000`
- Android 에뮬레이터(AVD): `http://10.0.2.2:8000`
- iOS 시뮬레이터: `http://localhost:8000`

변경 후 dev client를 재빌드해야 하는 경우(네이티브 코드 의존 시):
```bash
npx expo run:android    # 또는
npx expo run:ios
```

## 3. 실행
개발 서버(메트로 번들러) 시작:
```bash
npm run start
```

플랫폼별 실행(선택):
```bash
npm run android   # Android 에뮬레이터/디바이스
npm run ios       # iOS 시뮬레이터/디바이스 (macOS)
npm run web       # Web
```

Expo Go 앱 사용 시, 터미널/브라우저에서 표시되는 QR 코드를 스캔하세요(같은 네트워크 필요).

## 4. 백엔드와 연동 확인
- FastAPI 스웨거: `http://<서버_IP>:8000/docs`
- 클라이언트에서 요청 실패 시, `.env`의 `EXPO_PUBLIC_API_BASE` 주소, PC 방화벽, 같은 네트워크 여부를 확인하세요.

## 5. 스크립트 요약
- `npm run start`: Expo 개발 서버 시작
- `npm run android`: Android 빌드/실행
- `npm run ios`: iOS 빌드/실행
- `npm run web`: 웹 실행

## 6. 문제 해결(FAQ)
- 127.0.0.1로는 기기에서 접속 불가: 실제 기기에서는 PC의 로컬 IP를 사용해야 합니다.
- CORS/네트워크 에러: FastAPI가 `0.0.0.0:8000`로 열려 있고, CORS가 허용되어 있는지 확인하세요.
- 포트 충돌: FastAPI 또는 Expo 포트를 다른 값으로 일시 변경해 테스트해보세요.
