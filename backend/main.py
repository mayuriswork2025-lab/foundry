"""
Vercel entrypoint shim. Vercel's Python runtime looks for app.py, index.py,
server.py, main.py, wsgi.py, or asgi.py at the project root (or one level
under src/ or app/) exposing a top-level `app`. Our actual app lives at
src/app/main.py — this just adds src/ to the path and re-exports it, the
same thing `--app-dir src` does for local uvicorn (see dev.sh).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

from app.main import app  # noqa: E402

__all__ = ["app"]
