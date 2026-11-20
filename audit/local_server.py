"""Plain Python harness for contract tests and local acceptance runs."""

import json
import os
from urllib.parse import unquote
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from .app import handle_request, health


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path == "/health":
            self._respond(200, health())
        elif self.path.startswith("/pdf/"):
            name = Path(unquote(self.path[5:])).name
            path = Path(os.getenv("AUDIT_PDF_DIR", "/tmp/kynetic-audit-pdfs")) / name
            if not path.is_file(): self._respond(404, {"error": "not found"})
            else:
                data = path.read_bytes()
                self.send_response(200); self.send_header("Content-Type", "application/pdf")
                self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data)
        else:
            self._respond(404, {"error": "not found"})

    def do_POST(self) -> None:
        if self.path != "/audit":
            self._respond(404, {"error": "not found"})
            return
        length = int(self.headers.get("content-length", "0"))
        payload = json.loads(self.rfile.read(length))
        status, body = handle_request(payload, self.headers.get("X-Audit-Key"), os.getenv("AUDIT_PDF_DIR", "/tmp/kynetic-audit-pdfs"), self.headers.get("X-Operator-Key"))
        self._respond(status, body)

    def _respond(self, status: int, body: dict) -> None:
        encoded = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


def serve(host: str = "127.0.0.1", port: int = 8787) -> None:
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__": serve()

