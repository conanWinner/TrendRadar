#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
if [[ -x "$PROJECT_DIR/.venv/bin/python" ]]; then
  exec "$PROJECT_DIR/.venv/bin/python" "$PROJECT_DIR/local_app.py" "$@"
fi
if command -v uv >/dev/null 2>&1; then
  exec uv run python "$PROJECT_DIR/local_app.py" "$@"
fi
echo 'Chưa có môi trường Python. Cài uv và chạy uv sync trong thư mục dự án trước.'
read -r -p 'Nhấn Enter để đóng…'
