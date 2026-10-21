"""Local bill splitter server. No third-party dependencies required."""
import json
import os
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parent


class Handler(BaseHTTPRequestHandler):
    def send_json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        # Explicit allowlist prevents serving secrets, source, or .git files.
        files = {"/": ("index.html", "text/html"), "/index.html": ("index.html", "text/html"),
                 "/script.js": ("script.js", "text/javascript"), "/style.css": ("style.css", "text/css"),
                 "/manifest.webmanifest": ("manifest.webmanifest", "application/manifest+json"),
                 **{f"/icons/{name}.png": (f"icons/{name}.png", "image/png")
                    for name in ("apple-touch-icon", "icon-192", "icon-512")}}
        if path not in files:
            return self.send_json(404, {"error": "Not found"})
        name, mime = files[path]
        body = (ROOT / name).read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime + "; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        self.send_json(405, {"error": "Receipt scanning runs in your browser. No uploads are accepted."})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8001"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Bill Splitter: http://127.0.0.1:{port}", flush=True)
    server.serve_forever()
