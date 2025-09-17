#!/bin/bash
export PORT=${PORT:-8000}
exec python -m uvicorn server.app:app --host 0.0.0.0 --port $PORT