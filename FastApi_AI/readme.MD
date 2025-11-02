# FastAPI 서버 실행 가이드 (venv 필수)

이 문서는 새로 클론한 사용자가 가상환경(venv)에서 의존성을 설치하고 FastAPI 서버를 `0.0.0.0:8000`에서 구동하는 전체 절차를 설명합니다.

## 0. 사전 준비
- Python 3.10+ 설치
- Git 설치

## 1. 저장소 클론 및 디렉터리 이동
```bash
git clone <REPO_URL>
cd <REPO_폴더>/FastApi_AI
```

## 2. 가상환경(venv) 생성 및 활성화
항상 가상환경 안에서 작업하세요. 권장 이름은 `.venv` 입니다.

### Windows (PowerShell)
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### macOS / Linux (bash/zsh)
```bash
python3 -m venv .venv
source .venv/bin/activate
```

활성화 확인:
```bash
python -V
pip -V
```

PowerShell에서 활성화 정책 오류가 발생하면:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
터미널을 재시작 후 다시 활성화하세요.

## 3. pip 업데이트 및 의존성 설치
```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## 4. 환경 변수 파일(.env) 설정
프로젝트에는 예시 파일 `.env.sample` 이 있습니다. 복사 후 값을 채워주세요.

```bash
# Windows (PowerShell)
Copy-Item .env.sample .env

# macOS / Linux
cp .env.sample .env
```

필요 시 다음 값을 설정합니다(예: OpenAI 키 등):
- `OPENAI_API_KEY`
- 기타 설정은 `config.py`와 `.env.sample` 참고

## 5. 서버 실행 (0.0.0.0:8000)
반드시 가상환경이 활성화된 상태에서 실행하세요.

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

접속 확인:
- 로컬: http://127.0.0.1:8000/docs
- 같은 네트워크의 다른 기기: `http://<서버-IP>:8000/docs`

## 6. 문제 해결(FAQ)
- 포트가 사용 중: `--port 8001` 등 다른 포트로 변경해 실행
- 모듈을 찾을 수 없음: 현재 디렉터리가 `FastApi_AI`인지, 그리고 venv가 활성화되었는지 확인
- pip가 전역을 가리킴: `which pip`(macOS/Linux) 또는 `Get-Command pip`(Windows)로 경로 확인

## 참고
- 애플리케이션 엔트리포인트: `main.py` (앱 객체: `main:app`)
- CORS/환경설정: `config.py`, `.env.sample`
- 데이터베이스/모델: `database.py`, `models.py`
