#!/bin/bash
# Background dev runner — starts/stops both dev servers so no terminal has to
# stay open. Logs and PIDs live in .dev-logs/ (gitignored).
#
#   ./dev.sh start     start backend (uvicorn :8000) + frontend (vite :5173)
#   ./dev.sh stop      stop both
#   ./dev.sh restart   stop + start
#   ./dev.sh status    what's running
#   ./dev.sh logs      follow both logs (Ctrl+C stops watching, not the servers)

set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$ROOT/.dev-logs"
mkdir -p "$LOG_DIR"
BACK_PID_FILE="$LOG_DIR/backend.pid"
FRONT_PID_FILE="$LOG_DIR/frontend.pid"

running() { [ -f "$1" ] && kill -0 "$(cat "$1")" 2>/dev/null; }

start_backend() {
  if running "$BACK_PID_FILE"; then
    echo "• Backend already running (PID $(cat "$BACK_PID_FILE"))"
    return
  fi
  if [ ! -x "$ROOT/backend/venv/bin/python" ]; then
    echo "✗ backend/venv missing. One-time setup:"
    echo "    cd backend && python3 -m venv venv && venv/bin/pip install -r requirements.txt"
    exit 1
  fi
  if [ ! -f "$ROOT/backend/.env" ]; then
    echo "✗ backend/.env missing — copy backend/.env.example and fill in your MongoDB credentials."
    exit 1
  fi
  # setsid makes it a process-group leader so stop can kill uvicorn's
  # reloader child along with it.
  (
    cd "$ROOT/backend" &&
    setsid nohup venv/bin/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 \
      >"$LOG_DIR/backend.log" 2>&1 &
    echo $! >"$BACK_PID_FILE"
  )
  echo "• Backend starting  → http://localhost:8000   (log: .dev-logs/backend.log)"
}

start_frontend() {
  if running "$FRONT_PID_FILE"; then
    echo "• Frontend already running (PID $(cat "$FRONT_PID_FILE"))"
    return
  fi
  if [ ! -d "$ROOT/frontend/node_modules" ]; then
    echo "✗ frontend/node_modules missing. One-time setup:  cd frontend && npm install"
    exit 1
  fi
  (
    cd "$ROOT/frontend" &&
    setsid nohup npm run dev >"$LOG_DIR/frontend.log" 2>&1 &
    echo $! >"$FRONT_PID_FILE"
  )
  echo "• Frontend starting → http://localhost:5173   (log: .dev-logs/frontend.log)"
}

stop_one() {
  local pid_file="$1" label="$2"
  if running "$pid_file"; then
    local pid
    pid="$(cat "$pid_file")"
    # Negative PID = kill the whole process group (uvicorn reloader / vite children)
    kill -- -"$pid" 2>/dev/null || kill "$pid" 2>/dev/null
    echo "• Stopped $label (PID $pid)"
  else
    echo "• $label not running"
  fi
  rm -f "$pid_file"
}

status_one() {
  local pid_file="$1" label="$2" url="$3"
  if running "$pid_file"; then
    echo "• $label: RUNNING (PID $(cat "$pid_file")) → $url"
  else
    echo "• $label: stopped"
  fi
}

case "${1:-}" in
  start)
    start_backend
    start_frontend
    echo ""
    echo "Both are in the background — this terminal is free."
    echo "Open http://localhost:5173/workspace/login (staff) or /admin/login (admin)."
    echo "Watch logs with ./dev.sh logs · stop with ./dev.sh stop"
    ;;
  stop)
    stop_one "$FRONT_PID_FILE" "frontend"
    stop_one "$BACK_PID_FILE" "backend"
    ;;
  restart)
    "$0" stop
    sleep 1
    "$0" start
    ;;
  status)
    status_one "$BACK_PID_FILE" "backend" "http://localhost:8000"
    status_one "$FRONT_PID_FILE" "frontend" "http://localhost:5173"
    ;;
  logs)
    echo "Following both logs — Ctrl+C stops watching (servers keep running)."
    tail -n 25 -f "$LOG_DIR/backend.log" "$LOG_DIR/frontend.log"
    ;;
  *)
    echo "Usage: ./dev.sh {start|stop|restart|status|logs}"
    exit 1
    ;;
esac
