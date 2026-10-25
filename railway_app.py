"""Railway entry point; local_app.py keeps its localhost-only behavior."""
import mimetypes
import os
from pathlib import Path
import shutil
from http.server import ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

from local_app import App, ROOT, handler_for


def cloud_handler(app, domain):
    parent = handler_for(app)

    class Handler(parent):
        def trusted(self):
            # Railway's health probe does not carry user credentials.
            if self.command == "GET" and self.path == "/health":
                return True
            host = self.headers.get("Host", "")
            if host != domain:
                self.send(403, {"error": "Địa chỉ truy cập không hợp lệ."})
                return False
            origin = self.headers.get("Origin")
            if origin and origin != f"https://{domain}":
                self.send(403, {"error": "Nguồn yêu cầu không hợp lệ."})
                return False
            # Preserve the existing explicit-origin guard for report actions.
            if origin:
                self.headers.replace_header("Origin", f"http://127.0.0.1:{self.server.server_port}")
            return True

        def do_GET(self):
            path = unquote(urlsplit(self.path).path)
            if path.startswith(("/local_ui/", "/docs/assets/")) or path == "/docs/index.html":
                if not self.trusted():
                    return
                if "\\" in path or "\x00" in path or any(part in (".", "..") for part in path.split("/")):
                    return self.send(404, {"error": "Không tìm thấy tệp."})
                target = ROOT / path.lstrip("/")
                if not App(ROOT).safe_report_path(target) or not target.is_file():
                    return self.send(404, {"error": "Không tìm thấy tệp."})
                return self.send(200, target.read_bytes(), mimetypes.guess_type(target.name)[0] or "application/octet-stream")
            return super().do_GET()

    return Handler


def initialize_data(root):
    """Seed only absent configuration files; never replace saved settings."""
    root.mkdir(parents=True, exist_ok=True)
    (root / "output").mkdir(exist_ok=True)
    for source in (ROOT / "config").rglob("*"):
        if source.is_file():
            target = root / "config" / source.relative_to(ROOT / "config")
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists():
                with target.open("xb") as destination, source.open("rb") as original:
                    shutil.copyfileobj(original, destination)


def main():
    domain = os.environ.get("RAILWAY_PUBLIC_DOMAIN", "")
    if not domain:
        raise SystemExit("Cần RAILWAY_PUBLIC_DOMAIN.")
    root = Path(os.environ.get("RAILWAY_VOLUME_MOUNT_PATH", "/data"))
    if not os.environ.get("RAILWAY_VOLUME_MOUNT_PATH"):
        raise SystemExit("Cần gắn volume Railway để giữ cấu hình và lịch sử.")
    initialize_data(root)
    os.chdir(root)
    app = App(root)
    handler = cloud_handler(app, domain)
    server = ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("PORT", "8080"))), handler)
    print("TrendRadar cloud đã sẵn sàng; truy cập không cần mật khẩu.", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
