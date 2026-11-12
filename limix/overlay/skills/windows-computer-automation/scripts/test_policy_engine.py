#!/usr/bin/env python3
"""Offline unit tests. These do not connect to a Windows machine."""
import unittest

from policy_engine import decide, in_roots, normal_windows_path


CONFIG = {
    "available": {"agent_desktop": True, "windows_mcp": True},
    "allowed_read_roots": [r"C:\Users\Public\Documents\Herionix-Exports"],
    "allowed_write_roots": [r"C:\Users\Public\Documents\Herionix-Exports"],
    "system_tools_enabled": False,
    "max_retries_per_step": 1,
    "max_no_progress_cycles": 2,
}


class TestPolicyEngine(unittest.TestCase):
    def route(self, kind, operation, **kwargs):
        return decide({"kind": kind, "operation": operation, **kwargs}, CONFIG)

    def test_agent_desktop_ui_ref(self):
        ans = self.route("ui", "click", observed=True, target={"ref_id": "@s123:e8"})
        self.assertEqual((ans["status"], ans["tool"]), ("route", "desktop_click"))
        self.assertFalse(ans["executed"])

    def test_ui_must_observe(self):
        self.assertEqual(self.route("ui", "click", target={"label": "Save"})["status"], "observe_first")

    def test_windows_mcp_ui_fallback(self):
        cfg = {**CONFIG, "available": {"agent_desktop": False, "windows_mcp": True}}
        ans = decide({"kind": "ui", "operation": "click", "observed": True, "target": {"label": "Save"}}, cfg)
        self.assertEqual((ans["provider"], ans["tool"]), ("windows_mcp", "Click"))

    def test_stale_ref_pattern_rejected(self):
        self.assertEqual(self.route("ui", "click", observed=True, target={"ref_id": "@e8"})["status"], "observe_first")

    def test_no_approval_bypass(self):
        self.assertEqual(self.route("ui", "click", observed=True, effect="send", approved=True, target={"ref_id": "@s1:e2"})["status"], "approval_required")

    def test_powershell_blocked(self):
        self.assertEqual(self.route("shell", "run")["status"], "blocked")

    def test_registry_needs_approval_when_enabled(self):
        cfg = {**CONFIG, "system_tools_enabled": True}
        self.assertEqual(decide({"kind": "registry", "operation": "write"}, cfg)["status"], "approval_required")

    def test_read_in_root(self):
        ans = self.route("filesystem", "read", path=r"C:\Users\Public\Documents\Herionix-Exports\a.txt")
        self.assertEqual(ans["tool"], "FileSystem")

    def test_read_outside_root_needs_approval(self):
        self.assertEqual(self.route("filesystem", "read", path=r"C:\Users\Me\secret.txt")["status"], "approval_required")

    def test_write_allowed_only_new_inside_root(self):
        req = {"path": r"C:\Users\Public\Documents\Herionix-Exports\new.csv", "target_exists": False}
        self.assertEqual(self.route("filesystem", "write", **req)["status"], "route")
        req["target_exists"] = True
        self.assertEqual(self.route("filesystem", "write", **req)["status"], "approval_required")

    def test_path_traversal_block(self):
        attack = r"C:\Users\Public\Documents\Herionix-Exports\..\secret.txt"
        self.assertFalse(in_roots(attack, CONFIG["allowed_write_roots"]))
        self.assertEqual(self.route("filesystem", "write", path=attack, target_exists=False)["status"], "blocked")

    def test_root_prefix_confusion(self):
        attack = r"C:\Users\Public\Documents\Herionix-Exports-OTHER\x.txt"
        self.assertFalse(in_roots(attack, CONFIG["allowed_write_roots"]))

    def test_unc_and_ads_denied(self):
        self.assertIsNone(normal_windows_path(r"\\server\share\x.txt"))
        self.assertIsNone(normal_windows_path(r"C:\data\file.txt:stream"))

    def test_delete_requires_approval(self):
        self.assertEqual(self.route("filesystem", "delete", path=r"C:\Users\Public\Documents\Herionix-Exports\x.txt")["status"], "approval_required")

    def test_max_no_progress_stops(self):
        self.assertEqual(self.route("ui", "click", no_progress_cycles=2)["status"], "halted")

    def test_duplicate_completed_stops(self):
        self.assertEqual(self.route("ui", "click", step_completed=True)["status"], "already_complete")

    def test_observe_prefers_accessibility(self):
        ans = self.route("observe", "snapshot")
        self.assertEqual(ans["tool"], "desktop_snapshot")

    def test_system_observe_prefers_windows(self):
        ans = self.route("observe", "snapshot", scope="system")
        self.assertEqual(ans["provider"], "windows_mcp")

    def test_both_unavailable(self):
        cfg = {**CONFIG, "available": {"agent_desktop": False, "windows_mcp": False}}
        ans = decide({"kind": "observe", "operation": "snapshot"}, cfg)
        self.assertEqual(ans["status"], "unavailable")

    def test_app_system(self):
        self.assertEqual(self.route("app", "launch")["tool"], "App")

    def test_process_kill_requires_approval(self):
        self.assertEqual(self.route("process", "kill")["status"], "approval_required")

    def test_missing_operation(self):
        self.assertEqual(decide({"kind": "ui"}, CONFIG)["status"], "invalid_request")


if __name__ == "__main__":
    unittest.main()
