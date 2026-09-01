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

BACK_PORT=8000
FRONT_PORT=5173

# The port is the source of truth, not the PID file. setsid can hand back a
# PID that dies immediately, which used to leave "stop" killing nothing and
# "start" spawning a second server on a fallback port — orphans then piled up
# and Vite served stale code from whichever one still held 5173.
listeners() { lsof -ti tcp:"$1" -sTCP:LISTEN 2>/dev/null | sort -u; }

running() {
  local pid_file="$1" port="$2"
  [ -n "$(listeners "$port")" ] && return 0
  [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null
}

# Kill whole process groups so uvicorn's reloader child and vite's node worker
# go with the parent. Falls back to SIGKILL if anything is still holding on.
free_port() {
  local port="$1" label="$2" pids pgids
  pids="$(listeners "$port")"
  if [ -z "$pids" ]; then
    echo "• $label not running"
    return
  fi

  pgids="$(ps -o pgid= -p "$(echo "$pids" | tr '\n' ',' | sed 's/,$//')" 2>/dev/null | tr -d ' ' | sort -u)"
  for g in $pgids; do kill -TERM -- -"$g" 2>/dev/null; done

  for _ in 1 2 3 4 5 6 7 8 9 10; do
    [ -z "$(listeners "$port")" ] && break
    sleep 0.3
  done

  if [ -n "$(listeners "$port")" ]; then
    for g in $pgids; do kill -KILL -- -"$g" 2>/dev/null; done
    sleep 0.5
  fi

  local left
  left="$(listeners "$port")"
  if [ -n "$left" ]; then
    echo "✗ $label: port $port still held by PID(s) $(echo "$left" | tr '\n' ' ')"
  else
    echo "• Stopped $label (freed port $port)"
  fi
}

start_backend() {
  if running "$BACK_PID_FILE" "$BACK_PORT"; then
    echo "• Backend already running on :$BACK_PORT"
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
  if running "$FRONT_PID_FILE" "$FRONT_PORT"; then
    echo "• Frontend already running on :$FRONT_PORT"
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
  local pid_file="$1" label="$2" port="$3"
  free_port "$port" "$label"
  rm -f "$pid_file"
}

# Vite falls back to 5174, 5175… when 5173 is taken, so a stray instance can
# sit on another port quietly serving stale code. Freeing 5173 alone leaves it
# behind, so sweep any Vite belonging to this repo. Runs after free_port, so
# by here anything found is genuinely stray.
sweep_stray_vite() {
  local pids pgids
  pids="$(pgrep -f "$ROOT/frontend/node_modules/.bin/vite" 2>/dev/null)"
  [ -z "$pids" ] && return

  pgids="$(ps -o pgid= -p "$(echo "$pids" | tr '\n' ',' | sed 's/,$//')" 2>/dev/null | tr -d ' ' | sort -u)"
  for g in $pgids; do kill -TERM -- -"$g" 2>/dev/null; done
  sleep 0.5
  for g in $pgids; do kill -KILL -- -"$g" 2>/dev/null; done

  echo "• Cleared $(echo "$pids" | grep -c .) stray Vite instance(s) on other ports"
}

# One server can legitimately show two listeners — uvicorn's --reload parent
# and its worker both hold the socket. They share a process group, so count
# groups rather than PIDs to tell a healthy server from leftover orphans.
pgids_on_port() {
  local pids
  pids="$(listeners "$1")"
  [ -z "$pids" ] && return
  ps -o pgid= -p "$(echo "$pids" | tr '\n' ',' | sed 's/,$//')" 2>/dev/null | tr -d ' ' | sort -u
}

status_one() {
  local label="$1" port="$2" url="$3"
  local pids groups count
  pids="$(listeners "$port")"

  if [ -z "$pids" ]; then
    echo "• $label: stopped"
    return
  fi

  groups="$(pgids_on_port "$port")"
  count="$(echo "$groups" | grep -c .)"

  if [ "$count" -gt 1 ]; then
    echo "• $label: $count separate servers on :$port — run ./dev.sh restart"
    echo "    PIDs: $(echo "$pids" | tr '\n' ' ')"
  else
    echo "• $label: RUNNING (PID $(echo "$pids" | tr '\n' ' ')) → $url"
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
    stop_one "$FRONT_PID_FILE" "frontend" "$FRONT_PORT"
    sweep_stray_vite
    stop_one "$BACK_PID_FILE" "backend" "$BACK_PORT"
    ;;
  restart)
    # stop already waits for both ports to go quiet, so start can't land on a
    # fallback port and leave two servers running
    "$0" stop
    "$0" start
    ;;
  status)
    status_one "backend" "$BACK_PORT" "http://localhost:$BACK_PORT"
    status_one "frontend" "$FRONT_PORT" "http://localhost:$FRONT_PORT"
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
