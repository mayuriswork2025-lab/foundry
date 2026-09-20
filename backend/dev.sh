#!/usr/bin/env bash
# Runs the dev server with the env file and port hardcoded here, so you don't
# have to retype --env-file/--port every time. Edit PORT below if 8000 is taken.
set -euo pipefail
cd "$(dirname "$0")"

PORT=8000

exec uv run --env-file .env python -m uvicorn app.main:app --app-dir src --reload --port 8000