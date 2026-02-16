#!/usr/bin/env python3
"""
Service simulator for ServiceBox interview.
Each service is a lightweight HTTP server with a /health endpoint
and configurable startup delay to simulate real-world readiness behavior.

Usage: python3 service.py --name auth-service --port 8081 --startup-delay 2
"""

import argparse
import json
import os
import signal
import sys
import time
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler

ready = False
start_time = None
request_count = 0


class ServiceHandler(BaseHTTPRequestHandler):
    service_name = "unknown"
    service_routes = {}

    def log_message(self, format, *args):
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        print(f"[{timestamp}] [{self.service_name}] {format % args}", flush=True)

    def do_GET(self):
        global request_count
        request_count += 1

        if self.path == "/health":
            self._handle_health()
        elif self.path in self.service_routes:
            self._respond(200, self.service_routes[self.path])
        else:
            self._respond(404, {"error": "not found", "path": self.path})

    def do_POST(self):
        global request_count
        request_count += 1

        if self.path in self.service_routes:
            self._respond(200, self.service_routes[self.path])
        else:
            self._respond(404, {"error": "not found", "path": self.path})

    def _handle_health(self):
        if ready:
            uptime = int(time.time() - start_time) if start_time else 0
            self._respond(200, {
                "status": "healthy",
                "service": self.service_name,
                "uptime_seconds": uptime,
                "requests_served": request_count,
                "pid": os.getpid()
            })
        else:
            self._respond(503, {
                "status": "starting",
                "service": self.service_name
            })

    def _respond(self, code, body):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode())


# --- Service definitions ---
# Each service has different routes and a different startup delay

SERVICES = {
    "auth-service": {
        "startup_delay": 2,
        "routes": {
            "/auth/login": {"action": "login", "status": "mock_token_issued"},
            "/auth/validate": {"action": "validate", "status": "token_valid"},
            "/auth/revoke": {"action": "revoke", "status": "token_revoked"},
        }
    },
    "payment-service": {
        "startup_delay": 3,
        "routes": {
            "/payment/charge": {"action": "charge", "status": "payment_processed"},
            "/payment/refund": {"action": "refund", "status": "refund_issued"},
            "/payment/balance": {"balance": 10000, "currency": "USD"},
        }
    },
    "notification-service": {
        "startup_delay": 1,
        "routes": {
            "/notify/email": {"action": "email", "status": "queued"},
            "/notify/sms": {"action": "sms", "status": "queued"},
            "/notify/push": {"action": "push", "status": "queued"},
        }
    }
}


def main():
    global ready, start_time

    parser = argparse.ArgumentParser(description="ServiceBox service simulator")
    parser.add_argument("--name", required=True, help="Service name")
    parser.add_argument("--port", type=int, required=True, help="Port to listen on")
    parser.add_argument("--startup-delay", type=int, default=None,
                        help="Override startup delay in seconds")
    args = parser.parse_args()

    service_config = SERVICES.get(args.name)
    if not service_config:
        print(f"Unknown service: {args.name}", file=sys.stderr)
        print(f"Available: {', '.join(SERVICES.keys())}", file=sys.stderr)
        sys.exit(1)

    startup_delay = args.startup_delay if args.startup_delay is not None else service_config["startup_delay"]

    # Set up handler with service-specific config
    ServiceHandler.service_name = args.name
    ServiceHandler.service_routes = service_config["routes"]

    def shutdown(sig, frame):
        print(f"[{args.name}] Received signal {sig}, shutting down...", flush=True)
        sys.exit(0)

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    print(f"[{args.name}] Starting on port {args.port} (PID: {os.getpid()})...", flush=True)
    print(f"[{args.name}] Initializing... (takes ~{startup_delay}s)", flush=True)

    # Simulate startup time
    time.sleep(startup_delay)

    ready = True
    start_time = time.time()
    print(f"[{args.name}] Ready. Listening on http://localhost:{args.port}", flush=True)

    server = HTTPServer(("0.0.0.0", args.port), ServiceHandler)
    server.serve_forever()


if __name__ == "__main__":
    main()
