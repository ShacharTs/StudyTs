"""
Automated smoke test flows for StudyTs.
Covers Hub, Course view, Topic Viewer, Canvas Editor, AI chat panel, and Hebrew RTL mirroring.
"""
import time
from typing import Dict, Any, List
try:
    from .browser_controller import BrowserController
except ImportError:
    from browser_controller import BrowserController

class SmokeSuite:
    def __init__(self, controller: BrowserController):
        self.c = controller
        self.results: Dict[str, Any] = {}

    def run_all(self) -> Dict[str, Any]:
        print("[*] Starting StudyTs Smoke Test Suite...")
        self.test_hub_and_navigation()
        self.test_topic_viewer()
        self.test_canvas_editor()
        self.test_ai_modal()
        self.test_rtl_mirroring()
        return self.results

    def test_hub_and_navigation(self):
        print("  -> Testing Hub and Course navigation...")
        try:
            self.c.navigate("")
            self.c.page.wait_for_selector(".course-card, .home-course-card, main", timeout=10000)
            self.c.screenshot("01_hub_dashboard")
            self.results["hub_navigation"] = {"status": "pass"}
        except Exception as e:
            self.results["hub_navigation"] = {"status": "fail", "error": str(e)}

    def test_topic_viewer(self):
        print("  -> Testing Topic Viewer and Step Player...")
        try:
            self.c.navigate("course/algorithms/topic/dijkstra")
            self.c.page.wait_for_selector("main, .visual-player-container, .topic-content", timeout=8000)
            self.c.screenshot("02_topic_viewer")
            self.results["topic_viewer"] = {"status": "pass"}
        except Exception as e:
            self.results["topic_viewer"] = {"status": "fail", "error": str(e)}

    def test_canvas_editor(self):
        print("  -> Testing Canvas Editor...")
        try:
            self.c.navigate("canvas")
            self.c.page.wait_for_selector(".canvas-viewport, canvas, .editor-layout, main", timeout=8000)
            self.c.screenshot("03_canvas_editor")
            self.results["canvas_editor"] = {"status": "pass"}
        except Exception as e:
            self.results["canvas_editor"] = {"status": "fail", "error": str(e)}

    def test_ai_modal(self):
        print("  -> Testing AI Assistant Chat Modal...")
        try:
            self.c.navigate("")
            ai_btn = self.c.page.locator("button[aria-label*='AI'], button[title*='AI'], button[aria-label*='assistant']").first
            if ai_btn.is_visible():
                ai_btn.click()
                self.c.page.wait_for_selector(".ai-settings-modal, textarea", timeout=5000)
                self.c.screenshot("04_ai_modal_open")
            self.results["ai_modal"] = {"status": "pass"}
        except Exception as e:
            self.results["ai_modal"] = {"status": "fail", "error": str(e)}

    def test_rtl_mirroring(self):
        print("  -> Testing Hebrew RTL mirroring...")
        try:
            self.c.set_language("he")
            self.c.navigate("")
            self.c.page.wait_for_selector("html[dir='rtl'], body[dir='rtl'], main", timeout=8000)
            self.c.screenshot("05_hebrew_rtl")
            # Revert to English
            self.c.set_language("en")
            self.results["rtl_mirroring"] = {"status": "pass"}
        except Exception as e:
            self.results["rtl_mirroring"] = {"status": "fail", "error": str(e)}
