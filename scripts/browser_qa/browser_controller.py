"""
Core browser controller for StudyTs UI automation and smoke testing.
Optimized for low CPU usage, swiftshader WebGL/Canvas rendering, KaTeX font preservation, and RTL testing.
"""
from typing import Optional, List, Dict, Any, Callable
from pathlib import Path
from playwright.sync_api import sync_playwright, Browser, BrowserContext, Page, Route, Request

SCREENSHOTS_DIR = Path(__file__).resolve().parents[2] / "docs" / "qa" / "screenshots"

class BrowserController:
    def __init__(
        self,
        base_url: str = "http://localhost:7301",
        headless: bool = True,
        low_cpu: bool = True,
        locale: str = "en",
        browser_type: str = "chromium",
    ):
        self.base_url = base_url.rstrip("/")
        self.headless = headless
        self.low_cpu = low_cpu
        self.locale = locale
        self.browser_type = browser_type.lower()
        self._playwright = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.console_errors: List[str] = []

    def start(self):
        SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
        self._playwright = sync_playwright().start()

        launch_args = [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-extensions",
            "--disable-background-networking",
            "--disable-sync",
        ]

        if not self.headless:
            launch_args.append("--start-maximized")

        if self.low_cpu and self.headless:
            # Pair --disable-gpu with swiftshader for accurate 2D/WebGL Canvas rendering in headless
            launch_args.extend([
                "--disable-gpu",
                "--use-gl=swiftshader",
                "--disable-software-rasterizer",
            ])

        launch_kwargs: Dict[str, Any] = {
            "headless": self.headless,
            "args": launch_args,
        }

        if self.browser_type in ("msedge", "edge"):
            launch_kwargs["channel"] = "msedge"
            browser_engine = self._playwright.chromium
        elif self.browser_type == "chrome":
            launch_kwargs["channel"] = "chrome"
            browser_engine = self._playwright.chromium
        elif self.browser_type == "firefox":
            browser_engine = self._playwright.firefox
        elif self.browser_type == "webkit":
            browser_engine = self._playwright.webkit
        else:
            browser_engine = self._playwright.chromium

        self.browser = browser_engine.launch(**launch_kwargs)

        context_kwargs: Dict[str, Any] = {
            "locale": "he-IL" if self.locale == "he" else "en-US",
            "color_scheme": "dark",
        }

        if self.headless:
            context_kwargs["viewport"] = {"width": 1920, "height": 1080}
            context_kwargs["reduced_motion"] = "reduce"
        else:
            context_kwargs["no_viewport"] = True

        self.context = self.browser.new_context(**context_kwargs)
        self.page = self.context.new_page()

        # Ensure English and dark mode are pre-set
        self.page.add_init_script(f"""
            try {{
                localStorage.setItem('lang', '{self.locale}');
                localStorage.setItem('themeMode', 'dark');
            }} catch (e) {{}}
        """)

        # Listen for console errors
        self.page.on("console", lambda msg: self._handle_console(msg))
        self.page.on("pageerror", lambda err: self.console_errors.append(str(err)))

        if self.low_cpu and self.headless:
            self._setup_font_safe_route_filtering()

    def _handle_console(self, msg):
        if msg.type == "error":
            self.console_errors.append(msg.text)

    def _setup_font_safe_route_filtering(self):
        """
        Intercepts network requests to save CPU on heavy non-critical media,
        while strictly whitelisting fonts to prevent KaTeX or Hebrew glyph corruption.
        """
        def route_handler(route: Route, request: Request):
            url = request.url.lower()
            resource_type = request.resource_type

            # Whitelist all fonts (KaTeX, Hebrew web fonts, icons)
            if resource_type == "font" or url.endswith((".woff", ".woff2", ".ttf", ".eot", ".otf")):
                route.continue_()
                return

            # Whitelist core documents, scripts, styles, APIs
            if resource_type in ("document", "script", "stylesheet", "fetch", "xhr"):
                route.continue_()
                return

            # Block heavy media in low-CPU functional mode
            if resource_type in ("image", "media") and not url.endswith((".svg", ".ico")):
                route.abort()
                return

            route.continue_()

        self.page.route("**/*", route_handler)

    def navigate(self, path: str = "") -> None:
        if not self.page or self.page.is_closed():
            return
        url = f"{self.base_url}/{path.lstrip('/')}"
        try:
            self.page.goto(url, wait_until="domcontentloaded", timeout=10000)
        except Exception:
            pass

    def set_language(self, lang: str):
        self.locale = lang
        self.page.evaluate(f"localStorage.setItem('studyts_language', '{lang}')")
        self.page.reload(wait_until="domcontentloaded")

    def screenshot(self, name: str) -> Path:
        target = SCREENSHOTS_DIR / f"{name}.png"
        self.page.screenshot(path=str(target), full_page=False)
        return target

    def stop(self):
        if self.context:
            self.context.close()
        if self.browser:
            self.browser.close()
        if self._playwright:
            self._playwright.stop()
