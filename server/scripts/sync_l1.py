"""L1 지식 사본을 만든다 — 원본(repo 의 src/data/l1/*.json)을 서버 폴더(app/data/l1/)로 복사한다.

    uv run python -m scripts.sync_l1

서버 이미지는 server/ 만으로 빌드하므로(gcloud run deploy --source .) 원본을 직접 읽을 수 없다.
그래서 사본을 둔다. 원본과 사본이 어긋나면 tests/test_l1_copy.py 가 실패하므로, L1 을 고친 뒤에는
이 명령을 한 번 돌리면 된다(task common/004 「먼저 정한 것」).
"""

import shutil
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SOURCE_DIR = SERVER_DIR.parent / "src" / "data" / "l1"
COPY_DIR = SERVER_DIR / "app" / "data" / "l1"


def source_files() -> list[Path]:
    return sorted(SOURCE_DIR.glob("*.json"))


def main() -> None:
    COPY_DIR.mkdir(parents=True, exist_ok=True)
    wanted = {p.name for p in source_files()}
    # 원본에서 사라진 파일은 사본에서도 지운다
    for stale in COPY_DIR.glob("*.json"):
        if stale.name not in wanted:
            stale.unlink()
    for src in source_files():
        shutil.copyfile(src, COPY_DIR / src.name)
    print(f"L1 사본 {len(wanted)}개 파일 → {COPY_DIR.relative_to(SERVER_DIR)}")


if __name__ == "__main__":
    main()
