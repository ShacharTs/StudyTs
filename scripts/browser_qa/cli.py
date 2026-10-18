"""
CLI Entrypoint for StudyTs Browser QA & Live Browser session.
"""
import sys
import argparse
import time
from browser_controller import BrowserController
from smoke_suite import SmokeSuite

def parse_args():
    parser = argparse.ArgumentParser(description="StudyTs Browser QA & Live Controller")
    parser.add_argument("--url", default="http://localhost:7301", help="Target URL")
    parser.add_argument("--open", action="store_true", help="Launch live browser")
    parser.add_argument("--headed", action="store_true", help="Visible UI")
    parser.add_argument("--no-low-cpu", action="store_true", help="Disable low-CPU optimizations")
    parser.add_argument("--browser", default="chromium", choices=["chromium", "msedge", "edge", "chrome", "firefox", "webkit"])
    parser.add_argument("--locale", default="en", choices=["en", "he"])
    return parser.parse_args()

def main():
    args = parse_args()
    is_open = args.open or args.headed

    controller = BrowserController(
        base_url=args.url,
        headless=not is_open,
        low_cpu=not args.no_low_cpu if not args.open else False,
        locale=args.locale,
        browser_type=args.browser,
    )

    try:
        controller.start()

        if is_open:
            try:
                controller.navigate("")
            except Exception:
                pass

            print("\x1b[2m[Press Enter or close window to stop]\x1b[0m")
            try:
                input()
            except (KeyboardInterrupt, EOFError):
                pass
            return

        suite = SmokeSuite(controller)
        results = suite.run_all()

        all_passed = True
        for name, res in results.items():
            status = res.get("status", "unknown")
            color = "\x1b[32m✓\x1b[0m" if status == "pass" else "\x1b[31m✗\x1b[0m"
            print(f" {color} {name}")
            if status != "pass":
                all_passed = False
                if "error" in res:
                    print(f"     {res['error']}")

        if not all_passed:
            sys.exit(1)
    finally:
        try:
            controller.stop()
        except Exception:
            pass

if __name__ == "__main__":
    main()