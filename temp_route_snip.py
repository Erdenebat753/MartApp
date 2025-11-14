from pathlib import Path
lines=Path('FastApi_AI/routers/route.py').read_text(encoding='utf-8').splitlines()
for i in range(300, 380):
    print(f"{i+1}: {lines[i]}")
