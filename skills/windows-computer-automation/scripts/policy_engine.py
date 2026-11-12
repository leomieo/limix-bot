#!/usr/bin/env python3
"""Windows Computer Automation: deterministic, advisory routing & safety policy.

No OS actions occur. This does not launch MCP servers, grant permissions, or lock
an interactive desktop. Herionix backend MUST enforce access control and locks.

Usage:
    python scripts/policy_engine.py --config assets/control-policy.example.json \
        --request '{"kind":"observe","operation":"snapshot"}'
"""

from __future__ import annotations

import argparse
import json
import ntpath
import re
import sys
from typing import Any

SENSITIVE_EFFECTS = {
    "delete", "overwrite", "send", "upload", "purchase", "security_change",
    "terminate_process", "install", "uninstall", "share", "export_private_data",
}
FILE_READ_OPS = {"list", "read", "search", "inspect", "stat"}
FILE_WRITE_OPS = {"write", "create", "append", "mkdir"}
FILE_APPROVAL_OPS = {"delete", "move", "copy", "rename", "overwrite"}
UI_TOOLS_AD = {
    "click": "desktop_click", "double_click": "desktop_double_click",
    "right_click": "desktop_right_click", "type": "desktop_type",
    "set_value": "desktop_set_value", "press": "desktop_press",
    "scroll": "desktop_scroll", "select": "desktop_select",
    "toggle": "desktop_toggle", "check": "desktop_check",
}
UI_TOOLS_WIN = {
    "click": "Click", "double_click": "Click", "right_click": "Click",
    "type": "Type", "set_value": "Type", "press": "Shortcut",
    "scroll": "Scroll", "select": "Click", "toggle": "Click", "check": "Click",
}
REF_PATTERN = re.compile(r"^@s[A-Za-z0-9]+:e[0-9]+$")


def result(status: str, reason: str, **extra: Any) -> dict[str, Any]:
    data = {"status": status, "reason": reason, "executed": False}
    if status == "route":
        data["host_checks_required"] = ["live_tool_schema", "authorization", "idempotency", "concurrency_lock", "postcondition"]
    data.update(extra)
    return data


def normal_windows_path(path: Any) -> str | None:
    """Check lexical, local, absolute paths only. NOT a symlink check."""
    if not isinstance(path, str) or not path or "\x00" in path:
        return None
    if path.startswith("\\\\") or path.startswith("\\\\?\\"):
        return None  # UNC, device namespace and extended paths need explicit host review
    raw = path.replace("/", "\\")
    drive, _ = ntpath.splitdrive(raw)
    if not re.fullmatch(r"[A-Za-z]:", drive) or not ntpath.isabs(raw):
        return None
    if ":" in raw[2:]:
        return None  # reject alternate data streams
    parts = raw.split("\\")
    if any(p.endswith(" ") or p.endswith(".") for p in parts if p not in {"", ".", ".."}):
        return None
    return ntpath.normcase(ntpath.normpath(raw))


def in_roots(path: Any, roots: Any) -> bool:
    normalized = normal_windows_path(path)
    if normalized is None or not isinstance(roots, list):
        return False
    for root in roots:
        root_norm = normal_windows_path(root)
        if root_norm is None:
            continue
        try:
            if ntpath.commonpath([normalized, root_norm]) == root_norm:
                return True
        except ValueError:
            continue
    return False


def decide(request: dict[str, Any], config: dict[str, Any]) -> dict[str, Any]:
    """Return provider and tool recommendation, never execute an action."""
    if not isinstance(request, dict) or not isinstance(config, dict):
        return result("invalid_request", "request và config phải là JSON object")
    kind = request.get("kind")
    operation = str(request.get("operation", "")).lower()
    if kind not in {
        "observe", "ui", "browser", "app", "filesystem", "process",
        "shell", "registry", "clipboard",
    }:
        return result("invalid_request", "kind không hợp lệ")
    if not operation:
        return result("invalid_request", "thiếu operation")

    if request.get("step_completed") is True:
        return result("already_complete", "Bước đã được ledger của host ghi nhận; không gọi lại")
    try:
        no_progress = int(request.get("no_progress_cycles", 0))
        retry_count = int(request.get("retry_count", 0))
        limit_progress = int(config.get("max_no_progress_cycles", 2))
        limit_retry = int(config.get("max_retries_per_step", 1))
    except (TypeError, ValueError):
        return result("invalid_request", "retry_count/no_progress_cycles không hợp lệ")
    if min(no_progress, retry_count, limit_progress, limit_retry) < 0:
        return result("invalid_request", "giá trị giới hạn phải không âm")
    if no_progress >= limit_progress or retry_count > limit_retry:
        return result("halted", "Đã chạm giới hạn anti-loop; báo lỗi và yêu cầu xác minh lại")

    available = config.get("available") or {}
    if not isinstance(available, dict):
        return result("invalid_request", "available phải là object")
    has_ad = available.get("agent_desktop") is True
    has_win = available.get("windows_mcp") is True

    # The host must confirm that the request's effects, target and approval scope
    # match the user's actual task. Model-supplied values are NOT authoritative.
    effect = str(request.get("effect", "normal")).lower()
    if effect in SENSITIVE_EFFECTS:
        return result("approval_required", f"Hậu quả '{effect}' cần host xác nhận và token một lần")
    if kind in {"shell", "registry"}:
        if not config.get("system_tools_enabled", False):
            return result("blocked", "PowerShell và Registry bị tắt trong cấu hình")
        return result("approval_required", "Tool hệ thống yêu cầu approval của host, không do model tự cấp")

    if kind == "filesystem":
        if not has_win:
            return result("unavailable", "Windows-MCP chưa kết nối")
        if operation not in FILE_READ_OPS | FILE_WRITE_OPS | FILE_APPROVAL_OPS:
            return result("invalid_request", "filesystem operation chưa được policy hỗ trợ")
        path = request.get("path")
        if normal_windows_path(path) is None:
            return result("blocked", "Cần đường dẫn local tuyệt đối, không dùng UNC/ADS")
        if operation in FILE_READ_OPS:
            if not in_roots(path, config.get("allowed_read_roots", [])):
                return result("approval_required", "Đọc file ngoài allowed_read_roots cần host xác nhận")
            return result("route", "Đọc file trong phạm vi cho phép", provider="windows_mcp", tool="FileSystem", verification="read_result")
        if operation in FILE_WRITE_OPS:
            if not in_roots(path, config.get("allowed_write_roots", [])):
                return result("blocked", "Ghi file nằm ngoài allowed_write_roots")
            if request.get("target_exists") is not False:
                return result("approval_required", "Chưa chứng minh file đích không tồn tại; tránh ghi đè")
            return result("route", "Ghi file mới trong phạm vi cho phép", provider="windows_mcp", tool="FileSystem", verification="file_exists_and_content")
        # delete/move/copy/etc. may have side effects even for allowlisted paths
        return result("approval_required", "Thao tác file có tác dụng phụ cần host xác nhận")

    if kind == "process":
        if not has_win:
            return result("unavailable", "Windows-MCP chưa kết nối")
        if operation in {"list", "inspect"}:
            return result("route", "Chỉ đọc danh sách tiến trình", provider="windows_mcp", tool="Process", verification="process_list")
        return result("approval_required", "Dừng hoặc sửa tiến trình cần xác nhận")

    if kind == "app":
        if operation in {"launch_executable", "install", "uninstall"}:
            return result("approval_required", "Không chạy executable/tác vụ cài đặt tùy ý")
        if operation not in {"launch", "switch", "resize", "list"}:
            return result("invalid_request", "app operation chưa được hỗ trợ")
        if operation == "list":
            if has_ad:
                return result("route", "Liệt kê app bằng Agent Desktop", provider="agent_desktop", tool="desktop_list_apps", verification="window_state")
            if has_win:
                return result("route", "Chỉ liệt kê tiến trình đang chạy qua Windows-MCP", provider="windows_mcp", tool="Process", verification="process_list")
        if has_win:
            return result("route", "Thao tác ứng dụng qua Windows-MCP", provider="windows_mcp", tool="App", verification="window_state")
        if has_ad and operation == "launch":
            return result("route", "Mở app bằng Agent Desktop", provider="agent_desktop", tool="desktop_launch", verification="window_state")
        return result("unavailable", "Không có adapter cho thao tác ứng dụng này")

    if kind == "observe":
        if request.get("scope") == "system" and has_win:
            return result("route", "Quan sát màn hình Windows-MCP", provider="windows_mcp", tool="Snapshot", verification="fresh_observation")
        if has_ad:
            return result("route", "Đọc accessibility tree", provider="agent_desktop", tool="desktop_snapshot", verification="fresh_observation")
        if has_win:
            return result("route", "Đọc UI tree", provider="windows_mcp", tool="Snapshot", verification="fresh_observation")
        return result("unavailable", "Chưa có MCP Server điều khiển máy")

    if kind == "browser":
        if operation not in {"inspect_dom", "observe"}:
            return result("invalid_request", "browser operation chưa được policy hỗ trợ")
        if has_win:
            return result("route", "Lấy DOM qua Windows-MCP nếu hỗ trợ use_dom", provider="windows_mcp", tool="Snapshot", verification="dom_observed")
        return result("unavailable", "Cần Windows-MCP cho DOM trong profile này")

    if kind == "clipboard":
        if not has_win:
            return result("unavailable", "Windows-MCP chưa kết nối")
        return result("approval_required", "Clipboard có thể chứa dữ liệu nhạy cảm; host phải xác nhận phạm vi")

    if kind == "ui":
        if operation not in UI_TOOLS_AD:
            return result("invalid_request", "UI operation chưa được policy hỗ trợ")
        if not request.get("observed"):
            return result("observe_first", "Chưa có snapshot mới để xác định mục tiêu")
        target = request.get("target") or {}
        if not isinstance(target, dict):
            return result("invalid_request", "target phải là object")
        ref = target.get("ref_id")
        if ref is not None and not REF_PATTERN.fullmatch(str(ref)):
            return result("observe_first", "ref_id không đầy đủ/hợp lệ; cần snapshot mới")
        if ref and has_ad:
            return result("route", "Dùng accessibility ref đã quan sát", provider="agent_desktop", tool=UI_TOOLS_AD[operation], verification="ui_postcondition")
        if has_win and (target.get("coordinates") or target.get("label")):
            return result("route", "Dùng phần tử/vị trí từ snapshot Windows-MCP mới", provider="windows_mcp", tool=UI_TOOLS_WIN[operation], verification="ui_postcondition")
        if has_ad:
            return result("observe_first", "Chụp snapshot và xác định ref hiện tại bằng Agent Desktop", provider="agent_desktop", tool="desktop_snapshot")
        if has_win:
            return result("observe_first", "Cần chụp lại Snapshot Windows-MCP", provider="windows_mcp", tool="Snapshot")
        return result("unavailable", "Không có MCP Server điều khiển giao diện")

    return result("invalid_request", "Không có quy tắc tương ứng")


def main() -> int:
    parser = argparse.ArgumentParser(description="Policy-only Herionix computer control router")
    parser.add_argument("--config", required=True, help="Path to JSON policy")
    parser.add_argument("--request", help="Inline JSON request (or read stdin)")
    args = parser.parse_args()
    try:
        with open(args.config, "r", encoding="utf-8") as file:
            config = json.load(file)
        request = json.loads(args.request if args.request is not None else sys.stdin.read())
        output = decide(request, config)
    except (OSError, json.JSONDecodeError) as exc:
        output = result("invalid_request", f"Không thể đọc JSON: {exc}")
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0 if output["status"] not in {"invalid_request"} else 2


if __name__ == "__main__":
    raise SystemExit(main())
