"""Ứng dụng TrendRadar cục bộ. Chạy bằng .venv/bin/python local_app.py."""
import argparse
import copy
import ctypes
import errno
import hashlib
import json
import mimetypes
import os
import re
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit
from urllib.request import urlopen
import webbrowser
from datetime import datetime, timezone

import yaml

ROOT = Path(__file__).resolve().parent
FILES = {"config": "config.yaml", "frequency": "frequency_words.txt", "timeline": "timeline.yaml"}


def worker_python():
    """Bộ thu thập cần đủ thư viện dự án, dù UI được mở từ Python hệ thống."""
    executable = ROOT / ".venv" / "bin" / "python"
    return str(executable) if executable.is_file() and os.access(executable, os.X_OK) else sys.executable


class ConfigurationValidationError(ValueError):
    """Lỗi biểu mẫu an toàn, không đưa nội dung cấu hình vào thông báo."""


class ConfigurationWriteError(ValueError):
    """Thông báo lỗi ghi được kiểm soát, không chứa nội dung cấu hình."""


class ReportHistoryError(ValueError):
    """Lỗi lịch sử được kiểm soát, không chứa nội dung báo cáo."""


def move_report_without_overwrite(source, target):
    """Di chuyển nguyên tử, không ghi đè; không có fallback copy/xóa."""
    libc = ctypes.CDLL(None, use_errno=True)
    rename = getattr(libc, "renameat2", None)
    if rename is None:
        raise ReportHistoryError("Máy này chưa hỗ trợ di chuyển an toàn. Báo cáo vẫn được giữ nguyên.")
    rename.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
    rename.restype = ctypes.c_int
    if rename(-100, os.fsencode(source), -100, os.fsencode(target), 1) != 0:
        code = ctypes.get_errno()
        if code == errno.EEXIST:
            raise ReportHistoryError("Đường dẫn đã có báo cáo khác. Không ghi đè; bản trong thùng vẫn được giữ.")
        raise ReportHistoryError("Không di chuyển được báo cáo. Các tệp vẫn được giữ; hãy tải lại Lịch sử để kiểm tra.")


def preview_setting(data):
    """Chỉnh một trường trong văn bản gửi lên, không ghi tệp hay gọi dịch vụ."""
    text, path = data.get("text"), data.get("path")
    operation = data.get("operation", "set")
    if not isinstance(text, str) or not isinstance(path, list) or not path or len(path) > 20:
        raise ValueError("Trường thiết lập không hợp lệ.")
    if any(type(key) not in (str, int) for key in path):
        raise ValueError("Đường dẫn thiết lập không hợp lệ.")
    if any(str(key) in ("retention_days",) for key in path):
        raise ValueError("Giữ nguyên thời hạn lưu trữ để bảo vệ dữ liệu đã có.")
    try:
        original = yaml.safe_load(text)
        tree = yaml.compose(text, Loader=yaml.SafeLoader)
        expected = copy.deepcopy(original)
        target, node = expected, tree
        containers = [tree]
        for key in path[:-1]:
            if isinstance(target, list) and type(key) is int and 0 <= key < len(target):
                target, node = target[key], node.value[key]
            elif isinstance(target, dict) and key in target:
                pair = next((pair for pair in node.value if yaml.safe_load(yaml.serialize(pair[0])) == key), None)
                if pair is None:
                    raise ValueError("Không tìm thấy trường.")
                target, node = target[key], pair[1]
            else:
                raise ValueError("Không tìm thấy trường.")
            containers.append(node)
        key, value = path[-1], data.get("value")
        value_text = json.dumps(value, ensure_ascii=False, allow_nan=False)
        if isinstance(target, dict):
            if type(key) not in (str, int):
                raise ValueError("Trường không hợp lệ.")
            pair = next((pair for pair in node.value if yaml.safe_load(yaml.serialize(pair[0])) == key), None)
            current_node = pair[1] if pair else None
        elif isinstance(target, list) and type(key) is int and 0 <= key < len(target):
            current_node = node.value[key]
        else:
            raise ValueError("Không tìm thấy trường.")
        # safe_load/deepcopy giữ chung alias: so sánh expected không phát hiện thay đổi
        # lan sang phần khác. Chặn mọi thao tác có đích hoặc tổ tiên dùng chung.
        seen, shared = set(), set()
        def visit(candidate):
            if id(candidate) in seen:
                shared.add(id(candidate))
                return
            seen.add(id(candidate))
            if isinstance(candidate, yaml.MappingNode):
                for k, v in candidate.value:
                    visit(k)
                    visit(v)
            elif isinstance(candidate, yaml.SequenceNode):
                for v in candidate.value:
                    visit(v)
        visit(tree)
        if any(id(candidate) in shared for candidate in [*containers, current_node] if candidate is not None):
            raise ConfigurationValidationError("Mục này dùng chung liên kết YAML với phần khác. Không thể chỉnh riêng an toàn; hãy tách cấu hình dùng chung trước.")
        if operation == "delete":
            # Chỉ bỏ các mục quản lý được trên giao diện; không bỏ nhóm cấu hình hệ thống.
            source_item = len(path) == 3 and path[:2] in (["rss", "feeds"], ["platforms", "sources"]) and type(key) is int
            offset = 1 if path[0] == "custom" else 2 if path[0] == "presets" else None
            schedule_item = offset is not None and len(path) == offset + 2 and path[offset] in ("periods", "day_plans")
            schedule_ref = offset is not None and len(path) == offset + 4 and path[offset] == "day_plans" and path[-2] == "periods" and type(key) is int
            if not (source_item or schedule_item or schedule_ref) or current_node is None:
                raise ConfigurationValidationError("Chỉ có thể xóa nguồn tin, khung giờ, kế hoạch ngày hoặc liên kết khung giờ.")
            if schedule_item:
                plan = original
                for part in path[:offset]:
                    plan = plan[part]
                if path[offset] == "periods" and any(key in day.get("periods", []) for day in plan.get("day_plans", {}).values()):
                    raise ConfigurationValidationError("Khung giờ đang được dùng. Hãy bỏ liên kết khỏi kế hoạch ngày trước khi xóa.")
                if path[offset] == "day_plans" and key in plan.get("week_map", {}).values():
                    raise ConfigurationValidationError("Kế hoạch ngày đang được dùng. Hãy chọn kế hoạch khác trong lịch tuần trước khi xóa.")
            result = delete_yaml_item(text, node, key)
            del target[key]
        elif operation == "append":
            if current_node is None or not isinstance(target[key], list):
                raise ValueError("Chỉ thêm được vào danh sách.")
            target[key].append(value)
            if current_node.flow_style:
                # Chỉ chèn phần tử trước ], giữ nguyên các phần tử và chú thích cũ.
                end = current_node.end_mark.index - 1
                insertion = (", " if current_node.value else "") + value_text
                result = text[:end] + insertion + text[end:]
            else:
                end = text.rfind("\n", 0, current_node.end_mark.index) + 1
                if current_node.end_mark.index == len(text) and not text.endswith("\n"):
                    end = len(text)
                indent = current_node.start_mark.column
                insertion = ("" if end == 0 or text[end - 1:end] == "\n" else "\n") + " " * indent + "- " + value_text + "\n"
                result = text[:end] + insertion + text[end:]
        elif (operation == "set" and not isinstance(value, (dict, list))) or (operation == "add" and isinstance(target, dict) and current_node is None):
            if current_node is not None:
                if not isinstance(current_node, yaml.ScalarNode):
                    raise ValueError("Hãy chỉnh từng trường trong nhóm hoặc danh sách.")
                old = text[current_node.start_mark.index:current_node.end_mark.index]
                replacement = value_text + ("\n" if old.endswith("\n") else "")
                if current_node.style in ("|", ">"):
                    header = old.split("\n", 1)[0]
                    if "#" in header:
                        replacement = value_text + " " + header[header.index("#"):] + "\n"
                result = text[:current_node.start_mark.index] + replacement + text[current_node.end_mark.index:]
            elif isinstance(target, dict):
                if node.flow_style:
                    end = node.end_mark.index - 1
                    insertion = (", " if node.value else "") + json.dumps(key, ensure_ascii=False) + ": " + value_text
                else:
                    end = text.rfind("\n", 0, node.end_mark.index) + 1
                    if node.end_mark.index == len(text) and not text.endswith("\n"):
                        end = len(text)
                    indent = node.value[0][0].start_mark.column if node.value else node.start_mark.column
                    insertion = ("" if end == 0 or text[end - 1:end] == "\n" else "\n") + " " * indent + json.dumps(key, ensure_ascii=False) + ": " + value_text + "\n"
                result = text[:end] + insertion + text[end:]
            else:
                raise ValueError("Không tìm thấy trường.")
            target[key] = value
        else:
            raise ValueError("Thao tác thiết lập không hợp lệ.")
        if yaml.safe_load(result) != expected:
            raise ValueError("Không thể chỉnh an toàn cấu trúc này. Nội dung cũ được giữ nguyên.")
        return {"text": result}
    except (yaml.YAMLError, StopIteration, TypeError, KeyError, IndexError, RecursionError):
        raise ValueError("Không thể đọc hoặc chỉnh an toàn cấu trúc thiết lập.") from None


def delete_yaml_item(text, parent, key):
    """Bỏ đúng một mục YAML, giữ các mục khác và kiểm tra ngữ nghĩa ở bước gọi."""
    mapping = isinstance(parent, yaml.MappingNode)
    items = [(k, v) for k, v in parent.value] if mapping else [(v, v) for v in parent.value]
    index = next(i for i, (k, _) in enumerate(items) if yaml.safe_load(yaml.serialize(k)) == key) if mapping else key
    first, last = items[index]
    if len(items) == 1:
        start, end = parent.start_mark.index, parent.end_mark.index
        line_start = text.rfind("\n", 0, end) + 1
        if not parent.flow_style and line_start < end and not text[line_start:end].strip():
            end = line_start
        removed = text[start:end]
        comments = [line for line in removed.splitlines() if line.lstrip().startswith("#")]
        replacement = "{}" if mapping else "[]"
        header_comment = re.match(r"^[\[{]\s*(#[^\n]*)", removed) if parent.flow_style else None
        if header_comment:
            replacement += " " + header_comment.group(1)
        if not mapping and not parent.flow_style:
            # YAML cho phép dấu - ngang cấp khóa; [] phải thụt sâu hơn khóa đó.
            replacement = "  " + replacement
        if comments or header_comment or removed.endswith("\n"):
            replacement += "\n" + "".join(line + "\n" for line in comments)
        return text[:start] + replacement + text[end:]
    if parent.flow_style:
        if index < len(items) - 1:
            start, end = first.start_mark.index, items[index + 1][0].start_mark.index
        else:
            start, end = items[index - 1][1].end_mark.index, last.end_mark.index
        # Giữ chú thích nằm giữa dấu phân cách và mục còn lại.
        removed = text[start:end]
        comments = []
        for line in removed.splitlines():
            match = re.match(r"^[\s,]*(#.*)$", line)
            if match:
                comments.append(match.group(1))
        suffix = ""
        if index < len(items) - 1:
            between = text[last.end_mark.index:end]
            match = re.search(r",\s*(#[^\n]*)", between)
            if match and match.group(1) not in comments:
                comments.insert(0, match.group(1))
        elif comments:
            suffix = ", "
        preserved = ("\n" + "\n".join(comments) + "\n" + suffix) if comments else ""
        return text[:start] + preserved + text[end:]
    start = text.rfind("\n", 0, first.start_mark.index) + 1
    if index < len(items) - 1:
        end = text.rfind("\n", 0, items[index + 1][0].start_mark.index) + 1
    else:
        end = last.end_mark.index
        line_start = text.rfind("\n", 0, end) + 1
        if not text[line_start:end].strip():
            end = line_start
        elif end < len(text) and text[end - 1:end] != "\n":
            next_line = text.find("\n", end)
            end = len(text) if next_line < 0 else next_line + 1
    comments = "".join(line + "\n" for line in text[start:end].splitlines() if line.lstrip().startswith("#"))
    return text[:start] + comments + text[end:]


def validate_schedule_choices(choices):
    for plan in choices.values():
        periods = plan.get("periods", {})
        days = plan.get("day_plans", {})
        week = plan.get("week_map", {})
        if not all(isinstance(value, dict) for value in (periods, days, week)):
            raise ConfigurationValidationError("Khung giờ, kế hoạch ngày và lịch tuần phải là nhóm thiết lập.")
        for period in periods.values():
            if not isinstance(period, dict):
                raise ConfigurationValidationError("Khung giờ không hợp lệ.")
            for key in ("start", "end"):
                value = period.get(key)
                if not isinstance(value, str) or not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", value):
                    raise ConfigurationValidationError("Giờ bắt đầu và kết thúc phải có dạng HH:MM.")
            if period["start"] == period["end"]:
                raise ConfigurationValidationError("Giờ bắt đầu và kết thúc không được trùng nhau.")
            for task in ("collect", "analyze", "push"):
                if task in period and not isinstance(period[task], bool):
                    raise ConfigurationValidationError("Tác vụ trong khung giờ phải là công tắc bật hoặc tắt.")
        for day in days.values():
            refs = day.get("periods", []) if isinstance(day, dict) else None
            if not isinstance(refs, list) or any(not isinstance(ref, str) or ref not in periods for ref in refs):
                raise ConfigurationValidationError("Kế hoạch ngày phải chọn những khung giờ đã có.")
        if week and (set(week) != set(range(1, 8)) or any(not isinstance(ref, str) or ref not in days for ref in week.values())):
            raise ConfigurationValidationError("Lịch tuần phải chọn kế hoạch hợp lệ cho đủ bảy ngày.")
        overlap = plan.get("overlap", {})
        if not isinstance(overlap, dict) or overlap.get("policy", "error_on_overlap") not in ("error_on_overlap", "last_wins"):
            raise ConfigurationValidationError("Cách xử lý khung giờ chồng nhau không hợp lệ.")
        if overlap.get("policy", "error_on_overlap") == "error_on_overlap":
            def ranges(period):
                start, end = (int(hour) * 60 + int(minute) for hour, minute in (period["start"].split(":"), period["end"].split(":")))
                return [(start, end)] if start < end else [(start, 1440), (0, end)]
            for day in days.values():
                refs = day.get("periods", [])
                for i, first in enumerate(refs):
                    for second in refs[i + 1:]:
                        a, b = periods[first], periods[second]
                        if any(max(x[0], y[0]) < min(x[1], y[1]) for x in ranges(a) for y in ranges(b)):
                            raise ConfigurationValidationError("Có khung giờ chồng nhau trong một kế hoạch ngày. Hãy chỉnh giờ hoặc chọn ưu tiên khung giờ sau.")


class App:
    def __init__(self, root=ROOT):
        self.root = Path(root)
        self.token = secrets.token_urlsafe(32)
        self.lock = threading.RLock()
        self.status = {"running": False, "phase": "Sẵn sàng lấy tin", "warnings": [], "finished": None}

    def configuration(self):
        with self.lock:
            data = {key: (self.root / "config" / name).read_text(encoding="utf-8") for key, name in FILES.items()}
            data["revision"] = self.revision(data)
            return data

    @staticmethod
    def revision(data):
        return hashlib.sha256(json.dumps({k: data[k] for k in FILES}, sort_keys=True).encode()).hexdigest()

    @staticmethod
    def validate_configuration(data):
        if any(not isinstance(data.get(key), str) for key in FILES):
            raise ConfigurationValidationError("Thiếu nội dung cấu hình.")
        try:
            config = yaml.safe_load(data["config"])
            timeline = yaml.safe_load(data["timeline"])
            if not isinstance(config, dict) or not isinstance(timeline, dict):
                raise ValueError("Cấu hình và lịch chạy phải là cấu trúc YAML hợp lệ.")
            # Kiểm tra cấu trúc các phần mà bộ chạy sẽ đọc.
            for key in ("app", "platforms", "rss", "report", "filter", "notification", "ai", "ai_analysis", "ai_translation", "schedule", "storage", "advanced"):
                if key in config and not isinstance(config[key], dict):
                    raise ValueError(f"Phần {key} phải là một nhóm cấu hình.")
                if key in config and "enabled" in config[key] and not isinstance(config[key]["enabled"], bool):
                    raise ValueError("Giá trị enabled phải là true hoặc false.")
            feeds = config.get("rss", {}).get("feeds", [])
            if not isinstance(feeds, list) or any(
                not isinstance(feed, dict)
                or ("enabled" in feed and not isinstance(feed["enabled"], bool))
                for feed in feeds
            ):
                raise ValueError("Danh sách nguồn tin không hợp lệ.")
            presets = timeline.get("presets", {})
            custom = timeline.get("custom")
            if not isinstance(presets, dict) or (custom is not None and not isinstance(custom, dict)):
                raise ValueError("Danh sách chế độ xử lý không hợp lệ.")
            choices = {**presets, **({"custom": custom} if custom is not None else {})}
            if any(
                not isinstance(preset, dict)
                or any(key in preset and not isinstance(preset[key], str) for key in ("name", "description"))
                for preset in choices.values()
            ):
                raise ValueError("Nội dung chế độ xử lý không hợp lệ.")
            validate_schedule_choices(choices)
            schedule = config.get("schedule", {})
            preset = schedule.get("preset")
            if "preset" in schedule and not isinstance(preset, str):
                raise ValueError("Mã chế độ xử lý phải là văn bản.")
            if schedule.get("enabled") and preset not in choices:
                raise ValueError("Chế độ xử lý đang bật nhưng không có trong tệp khung giờ.")
        except yaml.YAMLError:
            raise ValueError("YAML không hợp lệ. Hãy kiểm tra thụt lề và dấu ngoặc.") from None

    def save(self, data):
        with self.lock:
            if self.status["running"]:
                raise ValueError("Đang lấy tin. Hãy chờ hoàn tất rồi lưu cấu hình.")
            current = self.configuration()
            if data.get("revision") != current["revision"]:
                raise ValueError("Cấu hình đã thay đổi bên ngoài ứng dụng. Hãy tải lại trước khi lưu.")
            for key in FILES:
                if not isinstance(data.get(key), str):
                    raise ValueError("Thiếu nội dung cấu hình.")
            self.validate_configuration(data)
            self.create_version(current, "Trước khi chỉnh sửa", validate=False, reuse=True)
            self.create_version(data, data.get("version_name") or "Cấu hình đã lưu", reuse=True)
            backup = self.root / "output" / "config_backups" / (time.strftime("%Y%m%d-%H%M%S") + "-" + secrets.token_hex(4))
            backup.mkdir(parents=True, mode=0o700)
            # Lưu tất cả bản cũ trước khi ghi bất kỳ tệp nào.
            for key, name in FILES.items():
                path = backup / name
                with path.open("x", encoding="utf-8") as stream:
                    stream.write(current[key])
                path.chmod(0o600)
            attempted = []
            try:
                for key, name in FILES.items():
                    attempted.append((key, name))
                    (self.root / "config" / name).write_text(data[key], encoding="utf-8")
            except OSError:
                failed = []
                # Kể cả tệp ghi lỗi có thể đã bị ghi một phần: phục hồi mọi tệp đã thử ghi.
                for key, name in attempted:
                    try:
                        (self.root / "config" / name).write_text(current[key], encoding="utf-8")
                    except OSError:
                        failed.append(name)
                if failed:
                    raise ConfigurationWriteError(
                        "Không lưu được và chưa khôi phục được tệp: " + ", ".join(failed)
                        + ". Bản cũ được giữ tại " + str(backup) + "."
                    ) from None
                raise ConfigurationWriteError("Không lưu được cấu hình. Đã khôi phục các tệp về bản trước khi lưu.") from None
            return {"revision": self.revision(data), "message": "Đã lưu vào dự án và giữ bản sao cấu hình cũ."}

    def versions(self):
        with self.lock:
            directory = self.root / "output" / "config_versions"
            result = []
            for path in sorted(directory.glob("*.json")):
                try:
                    item = json.loads(path.read_text(encoding="utf-8"))
                    result.append({key: item[key] for key in ("id", "name", "created_at", "revision")})
                except (OSError, ValueError, KeyError, TypeError):
                    raise ConfigurationValidationError("Có phiên bản không đọc được. Các tệp phiên bản vẫn được giữ nguyên.") from None
            return sorted(result, key=lambda item: item["created_at"], reverse=True)

    def create_version(self, data, name, validate=True, reuse=False):
        with self.lock:
            if not isinstance(name, str) or not name.strip() or len(name.strip()) > 80:
                raise ConfigurationValidationError("Tên phiên bản cần từ 1 đến 80 ký tự.")
            if validate:
                self.validate_configuration(data)
            elif any(not isinstance(data.get(key), str) for key in FILES):
                raise ConfigurationValidationError("Thiếu nội dung cấu hình để sao lưu.")
            revision = self.revision(data)
            directory = self.root / "output" / "config_versions"
            directory.mkdir(parents=True, exist_ok=True, mode=0o700)
            directory.chmod(0o700)
            for item in self.versions():
                if reuse and item["revision"] == revision:
                    return item
            identifier = time.strftime("%Y%m%d-%H%M%S") + "-" + secrets.token_hex(8)
            record = {"id": identifier, "name": name.strip(), "created_at": datetime.now(timezone.utc).isoformat(), "revision": revision,
                      "contents": {key: data[key] for key in FILES}}
            pending = directory / (identifier + ".pending")
            descriptor = os.open(pending, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
                json.dump(record, stream, ensure_ascii=False)
                stream.flush()
                os.fsync(stream.fileno())
            # Chỉ công bố bản ghi hoàn chỉnh; không ghi đè hoặc bỏ tệp ghi dở.
            os.link(pending, directory / (identifier + ".json"))
            return {key: record[key] for key in ("id", "name", "created_at", "revision")}

    def version(self, identifier):
        with self.lock:
            if not isinstance(identifier, str) or not re.fullmatch(r"[0-9]{8}-[0-9]{6}-[a-f0-9]{16}", identifier):
                raise ConfigurationValidationError("Mã phiên bản không hợp lệ.")
            try:
                item = json.loads((self.root / "output" / "config_versions" / (identifier + ".json")).read_text(encoding="utf-8"))
                data = item["contents"]
                self.validate_configuration(data)
                if self.revision(data) != item["revision"]:
                    raise ValueError()
            except (OSError, ValueError, KeyError, TypeError):
                raise ConfigurationValidationError("Không đọc được phiên bản cấu hình. Bản đang dùng vẫn được giữ.") from None
            return {**data, "version": {key: item[key] for key in ("id", "name", "created_at", "revision")}}

    def start(self, options):
        with self.lock:
            if self.status["running"]:
                raise ValueError("Một lượt lấy tin đang chạy.")
            if options.get("revision") != self.configuration()["revision"]:
                raise ValueError("Cấu hình đã đổi. Hãy tải lại trước khi lấy tin.")
            self.status = {"running": True, "phase": "Đang khởi động bộ thu thập…", "warnings": [], "finished": None}
            thread = threading.Thread(target=self.collect, args=(options,), daemon=True)
            thread.start()
        return self.status.copy()

    def collect(self, options):
        try:
            # Báo cáo "mới nhất" sẽ được cập nhật; giữ bản trước đó để có thể xem lại.
            backup = self.root / "output" / "report_backups" / (time.strftime("%Y%m%d-%H%M%S") + "-" + secrets.token_hex(4))
            paths = [self.root / "index.html", self.root / "output" / "index.html"]
            paths += list((self.root / "output" / "html").rglob("*.html"))
            paths += list((self.root / "output" / "txt").rglob("*.txt"))
            for path in paths:
                if path.is_file():
                    target = backup / path.relative_to(self.root)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(path, target)
            env = os.environ.copy()
            env["PYTHONUNBUFFERED"] = "1"
            env["TRENDRADAR_LOCAL_AI"] = "1" if options.get("allow_ai") is True else "0"
            env["TRENDRADAR_LOCAL_NOTIFY"] = "1" if options.get("allow_notification") is True else "0"
            # Dùng đúng cấu hình của dự án, không lấy đường dẫn từ môi trường terminal.
            env["CONFIG_PATH"] = str(self.root / "config" / "config.yaml")
            env["FREQUENCY_WORDS_PATH"] = str(self.root / "config" / "frequency_words.txt")
            process = subprocess.Popen([worker_python(), str(ROOT / "local_app.py"), "--worker"], cwd=self.root, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            generated = False
            missing_module = None
            for line in process.stdout:
                # Chỉ đưa trạng thái đã nhận diện lên UI, không lưu log thô có thể chứa bí mật.
                with self.lock:
                    missing = re.search(r"ModuleNotFoundError: No module named ['\"]([a-zA-Z_][a-zA-Z0-9_]*)['\"]", line)
                    if missing:
                        missing_module = missing.group(1)
                    if re.search(r"HTML\s*报告已生成", line):
                        generated = True
                        self.status["phase"] = "Đã tạo báo cáo, đang hoàn tất…"
                    elif "开始爬取" in line:
                        self.status["phase"] = "Đang lấy bảng tin từ các nền tảng…"
                    elif "[RSS]" in line:
                        self.status["phase"] = "Đang lấy và lọc tin RSS…"
                    if "请求失败" in line or "获取失败" in line:
                        warning = "Có nguồn tin không truy cập được. Các nguồn còn lại vẫn được xử lý."
                        if warning not in self.status["warnings"]:
                            self.status["warnings"].append(warning)
            code = process.wait()
            with self.lock:
                self.status["phase"] = "Đã lấy tin và cập nhật báo cáo" if code == 0 and generated else "Lượt chạy chưa tạo được báo cáo. Hãy kiểm tra nguồn tin và cấu hình."
                if code != 0 and missing_module:
                    self.status["phase"] = "Môi trường Python thiếu thư viện: " + missing_module + ". Hãy mở ứng dụng bằng start-local-app.sh."
                self.status["success"] = code == 0 and generated
        except Exception:
            with self.lock:
                self.status["phase"] = "Không khởi động được bộ thu thập. Hãy kiểm tra môi trường Python."
                self.status["success"] = False
        finally:
            with self.lock:
                self.status["running"] = False
                self.status["finished"] = time.time()

    def reports(self):
        with self.lock:
            reports = []
            for path in (self.root / "output" / "html").glob("????-??-??/*.html"):
                if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", path.parent.name) or not self.safe_report_path(path) or not path.is_file():
                    continue
                try:
                    reports.append(self.report_record(path))
                except FileNotFoundError:
                    continue
            return sorted(reports, key=lambda report: report["generated_at"], reverse=True)

    def safe_report_path(self, path):
        """Không đi qua liên kết tượng trưng hoặc ra ngoài dự án."""
        try:
            relative = path.relative_to(self.root)
        except ValueError:
            return False
        return all(not (self.root / Path(*relative.parts[:i])).is_symlink() for i in range(1, len(relative.parts) + 1))

    @staticmethod
    def report_revision(path):
        stat = path.stat()
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        return hashlib.sha256(f"{stat.st_size}:{stat.st_mtime_ns}:{digest}".encode()).hexdigest()

    def report_record(self, path):
        relative = path.relative_to(self.root).as_posix()
        return {
            "id": hashlib.sha256(relative.encode()).hexdigest(),
            "revision": self.report_revision(path),
            "name": f"{path.parent.name} · {path.stem}",
            "url": "/" + relative,
            "path": relative,
            "generated_at": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(),
            "timestamp_label": "Tạo/cập nhật lúc",
            "can_remove": path.stem not in ("current", "latest"),
        }

    def report_trash(self):
        with self.lock:
            result = []
            directory = self.root / "output" / "report_trash"
            for metadata in directory.glob("*/metadata.json"):
                if not self.safe_report_path(metadata):
                    continue
                try:
                    record = self.read_trashed_report(metadata.parent.name)
                    payload = metadata.parent / "report.html"
                    if payload.exists() and self.safe_report_path(payload) and payload.is_file():
                        record["revision"] = self.report_revision(payload)
                        result.append(record)
                except (ReportHistoryError, OSError):
                    # Cô lập mục lỗi, không sửa/di chuyển/xóa tệp hoặc chặn mục còn lại.
                    continue
            return sorted(result, key=lambda record: record["removed_at"], reverse=True)

    def read_trashed_report(self, identifier):
        if not isinstance(identifier, str) or not re.fullmatch(r"[a-f0-9]{32}", identifier):
            raise ReportHistoryError("Mã báo cáo trong thùng không hợp lệ. Hãy tải lại Lịch sử.")
        metadata = self.root / "output" / "report_trash" / identifier / "metadata.json"
        if not self.safe_report_path(metadata):
            raise ReportHistoryError("Không thể đọc mục trong thùng qua liên kết tượng trưng.")
        try:
            record = json.loads(metadata.read_text(encoding="utf-8"))
            relative = Path(record["path"])
            if (record["id"] != identifier or len(relative.parts) != 4 or relative.parts[:2] != ("output", "html")
                    or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", relative.parts[2]) or relative.suffix != ".html"
                    or relative.stem in ("current", "latest")
                    or any(not isinstance(record[key], str) for key in ("name", "generated_at", "removed_at", "revision"))):
                raise ValueError()
        except (OSError, ValueError, KeyError, TypeError):
            raise ReportHistoryError("Không đọc được thông tin mục trong thùng. Các tệp vẫn được giữ nguyên.") from None
        return record

    def trash_report(self, data):
        with self.lock:
            if self.status["running"]:
                raise ReportHistoryError("Đang lấy tin. Hãy chờ hoàn tất trước khi bỏ báo cáo.")
            if data.get("confirmed") is not True:
                raise ReportHistoryError("Cần xác nhận chính xác báo cáo trước khi bỏ vào thùng.")
            identifier = data.get("request_id")
            if not isinstance(identifier, str) or not re.fullmatch(r"[a-f0-9]{32}", identifier):
                raise ReportHistoryError("Mã thao tác không hợp lệ. Hãy chọn lại báo cáo.")
            directory = self.root / "output" / "report_trash" / identifier
            if not self.safe_report_path(directory):
                raise ReportHistoryError("Thư mục thùng không an toàn. Báo cáo được giữ nguyên.")
            previous = None
            if directory.exists():
                previous = self.read_trashed_report(identifier)
                if hashlib.sha256(previous["path"].encode()).hexdigest() != data.get("id") or previous["revision"] != data.get("revision"):
                    raise ReportHistoryError("Mã thao tác đã được dùng cho báo cáo khác. Hãy chọn lại.")
                payload = directory / "report.html"
                if payload.is_file() and self.safe_report_path(payload) and self.report_revision(payload) == data.get("revision"):
                    return {"message": "Báo cáo đã ở trong thùng; không bỏ thêm báo cáo nào.", "id": identifier}
                if (directory / "restored.json").exists():
                    raise ReportHistoryError("Thao tác này đã hoàn tất và báo cáo đã được khôi phục. Hãy tải lại Lịch sử.")
            report = next((record for record in self.reports() if record["id"] == data.get("id")), None)
            if report is None or report["revision"] != data.get("revision"):
                raise ReportHistoryError("Báo cáo đã đổi hoặc không còn trong Lịch sử. Hãy tải lại rồi chọn lại.")
            if not report["can_remove"]:
                raise ReportHistoryError("Đây là bản hiện tại. Hãy chọn bản có thời điểm cụ thể trong Lịch sử.")
            if previous is None:
                directory.mkdir(parents=True, mode=0o700)
                record = {key: report[key] for key in ("name", "path", "generated_at", "revision")}
                record.update(id=identifier, removed_at=datetime.now(timezone.utc).isoformat())
                with (directory / "metadata.json").open("x", encoding="utf-8") as stream:
                    json.dump(record, stream, ensure_ascii=False)
                    stream.flush()
                    os.fsync(stream.fileno())
            source = self.root / report["path"]
            if not self.safe_report_path(source) or self.report_revision(source) != report["revision"]:
                raise ReportHistoryError("Báo cáo đã đổi trong lúc xác nhận. Tệp hiện có được giữ nguyên.")
            move_report_without_overwrite(source, directory / "report.html")
            return {"message": "Đã bỏ một báo cáo vào thùng. Bạn có thể khôi phục trong Lịch sử.", "id": identifier}

    def restore_report(self, data):
        with self.lock:
            if self.status["running"]:
                raise ReportHistoryError("Đang lấy tin. Hãy chờ hoàn tất trước khi khôi phục báo cáo.")
            if data.get("confirmed") is not True:
                raise ReportHistoryError("Cần xác nhận báo cáo và đường dẫn trước khi khôi phục.")
            record = self.read_trashed_report(data.get("id"))
            source = self.root / "output" / "report_trash" / record["id"] / "report.html"
            target = self.root / record["path"]
            if not self.safe_report_path(source) or not self.safe_report_path(target):
                raise ReportHistoryError("Đường dẫn không an toàn. Báo cáo trong thùng được giữ nguyên.")
            if not source.exists() and target.is_file() and self.report_revision(target) == data.get("revision"):
                return {"message": "Báo cáo đã được khôi phục; không ghi đè tệp nào.", "id": hashlib.sha256(record["path"].encode()).hexdigest()}
            if not source.is_file() or self.report_revision(source) != data.get("revision"):
                raise ReportHistoryError("Báo cáo trong thùng đã đổi hoặc đã được khôi phục. Hãy tải lại Lịch sử.")
            target.parent.mkdir(parents=True, exist_ok=True)
            # Ghi ý định trước khi di chuyển: retry yêu cầu bỏ cũ không bỏ lại bản đã khôi phục,
            # kể cả khi tiến trình dừng ngay sau rename. Không thay thế bản ghi đã có.
            marker = source.parent / "restored.json"
            if not marker.exists():
                with marker.open("x", encoding="utf-8") as stream:
                    json.dump({"restore_requested_at": datetime.now(timezone.utc).isoformat()}, stream)
                    stream.flush()
                    os.fsync(stream.fileno())
            move_report_without_overwrite(source, target)
            return {"message": "Đã khôi phục báo cáo về Lịch sử.", "id": hashlib.sha256(record["path"].encode()).hexdigest()}


def handler_for(app):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def send(self, code, content, kind="application/json; charset=utf-8"):
            if isinstance(content, (dict, list)):
                content = json.dumps(content, ensure_ascii=False).encode()
            elif isinstance(content, str):
                content = content.encode()
            self.send_response(code)
            self.send_header("Content-Type", kind)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            self.end_headers()
            self.wfile.write(content)

        def trusted(self):
            expected = f"127.0.0.1:{self.server.server_port}"
            if self.headers.get("Host") != expected:
                self.send(403, {"error": "Chỉ cho phép truy cập từ địa chỉ cục bộ của ứng dụng."})
                return False
            origin = self.headers.get("Origin")
            if origin and origin != "http://" + expected:
                self.send(403, {"error": "Nguồn yêu cầu không hợp lệ."})
                return False
            return True

        def do_GET(self):
            if not self.trusted():
                return
            path = unquote(urlsplit(self.path).path)
            if path == "/health":
                return self.send(200, {"application": "trendradar-local-app"})
            if path.startswith("/api/"):
                if self.headers.get("X-App-Token") != app.token:
                    return self.send(403, {"error": "Phiên truy cập không hợp lệ."})
                if path == "/api/versions":
                    try:
                        return self.send(200, app.versions())
                    except ConfigurationValidationError as error:
                        return self.send(400, {"error": str(error)})
                if path == "/api/config":
                    return self.send(200, app.configuration())
                if path == "/api/status":
                    with app.lock:
                        return self.send(200, dict(app.status))
                if path == "/api/reports":
                    return self.send(200, app.reports())
                if path == "/api/report-trash":
                    try:
                        return self.send(200, app.report_trash())
                    except ReportHistoryError as error:
                        return self.send(400, {"error": str(error)})
                return self.send(404, {"error": "Không tìm thấy."})
            if path == "/":
                html = (ROOT / "local_ui" / "index.html").read_text(encoding="utf-8").replace("__APP_TOKEN__", app.token)
                return self.send(200, html, "text/html; charset=utf-8")
            # Kiểm tra đường dẫn đã giải mã trước khi resolve; mỗi nhóm tệp chỉ được
            # đọc trong chính thư mục công khai của nó, không chỉ trong project root.
            if "\\" in path or "\x00" in path or any(part in (".", "..") for part in path.split("/")):
                return self.send(404, {"error": "Không tìm thấy tệp."})
            subtree = next((prefix for prefix in ("/docs/assets/", "/local_ui/", "/output/html/") if path.startswith(prefix)), None)
            if subtree is None and path != "/docs/index.html":
                return self.send(404, {"error": "Không tìm thấy tệp."})
            raw_target = app.root / path.lstrip("/")
            if not app.safe_report_path(raw_target):
                return self.send(404, {"error": "Không tìm thấy tệp."})
            target = raw_target.resolve()
            allowed_root = (app.root / subtree.strip("/")).resolve() if subtree else (app.root / "docs").resolve()
            if not target.is_relative_to(allowed_root) or not target.is_file():
                return self.send(404, {"error": "Không tìm thấy tệp."})
            self.send(200, target.read_bytes(), mimetypes.guess_type(target.name)[0] or "application/octet-stream")

        def do_POST(self):
            if not self.trusted():
                return
            if self.headers.get("X-App-Token") != app.token:
                return self.send(403, {"error": "Phiên truy cập không hợp lệ."})
            if self.path in ("/api/reports/trash", "/api/reports/restore") and self.headers.get("Origin") != f"http://127.0.0.1:{self.server.server_port}":
                return self.send(403, {"error": "Cần thao tác từ giao diện cục bộ của ứng dụng."})
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= 2_000_000:
                    raise ValueError("Nội dung quá lớn hoặc trống.")
                data = json.loads(self.rfile.read(length))
                if not isinstance(data, dict):
                    raise ValueError("Yêu cầu không hợp lệ.")
                if self.path == "/api/preview-setting":
                    result = preview_setting(data)
                elif self.path == "/api/version":
                    result = app.version(data.get("id"))
                elif self.path == "/api/versions":
                    result = app.create_version(data, data.get("name"))
                elif self.path == "/api/config":
                    result = app.save(data)
                elif self.path == "/api/run":
                    result = app.start(data)
                elif self.path == "/api/reports/trash":
                    result = app.trash_report(data)
                elif self.path == "/api/reports/restore":
                    result = app.restore_report(data)
                else:
                    return self.send(404, {"error": "Không tìm thấy."})
                self.send(200, result)
            except ConfigurationValidationError as error:
                self.send(400, {"error": str(error)})
            except ReportHistoryError as error:
                self.send(409, {"error": str(error)})
            except ConfigurationWriteError as error:
                self.send(500, {"error": str(error)})
            except (ValueError, TypeError):
                # Các lỗi xác thực ở trên không chứa nội dung cấu hình.
                self.send(400, {"error": "Không thể thực hiện. Kiểm tra YAML, tải lại cấu hình nếu tệp đã đổi, hoặc chờ lượt chạy hoàn tất."})
            except OSError:
                self.send(500, {"error": "Không đọc/ghi được tệp. Kiểm tra quyền truy cập thư mục dự án."})
    return Handler


def configure_local_run(config, allow_ai=False, allow_notification=False):
    """Giới hạn lượt chạy, không sửa các tệp cấu hình gốc."""
    if not allow_ai:
        config["AI_ANALYSIS"]["ENABLED"] = False
        config["AI_TRANSLATION"]["ENABLED"] = False
        config["FILTER"]["METHOD"] = "keyword"
    if not allow_notification:
        config["ENABLE_NOTIFICATION"] = False
    # Không cho bộ thu thập tự xóa dữ liệu hết hạn trong ứng dụng cục bộ.
    for section in ("LOCAL", "REMOTE"):
        config.setdefault("STORAGE", {}).setdefault(section, {})["RETENTION_DAYS"] = 0
    config["DEBUG"] = True
    return config


def worker():
    from trendradar.core.loader import load_config
    from trendradar.__main__ import NewsAnalyzer
    config = configure_local_run(load_config(), os.environ.get("TRENDRADAR_LOCAL_AI") == "1", os.environ.get("TRENDRADAR_LOCAL_NOTIFY") == "1")
    analyzer = NewsAnalyzer(config=config)
    analyzer._should_open_browser = lambda: False
    analyzer.run()


def main():
    parser = argparse.ArgumentParser(description="Mở ứng dụng TrendRadar trên máy")
    parser.add_argument("--port", type=int, default=8766)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--worker", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.worker:
        worker()
        return
    os.chdir(ROOT)
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), handler_for(App()))
    except OSError:
        # Bấm biểu tượng lần nữa sẽ mở cửa sổ ứng dụng đang chạy.
        try:
            with urlopen(f"http://127.0.0.1:{args.port}/health", timeout=2) as response:
                if json.load(response).get("application") == "trendradar-local-app":
                    url = f"http://127.0.0.1:{args.port}"
                    print(f"TrendRadar đang chạy tại {url}")
                    if not args.no_browser:
                        webbrowser.open(url)
                    return
        except Exception:
            pass
        print(f"Không mở được cổng {args.port}. Chọn cổng khác bằng --port.")
        raise SystemExit(1)
    url = f"http://127.0.0.1:{server.server_port}"
    print(f"TrendRadar đang mở tại {url}\nGiữ cửa sổ này mở khi sử dụng. Ctrl+C để dừng giao diện.")
    if not args.no_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Đã dừng giao diện.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
