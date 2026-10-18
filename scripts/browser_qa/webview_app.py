"""
Ultra-low CPU native desktop window for StudyTs using OS-native WebView2 / WebKit.
Provides interactive terminal Enter shutdown and native JS-bridge Close button.
"""
import sys
import threading
import webview

class StudyTsWindow:
    def __init__(self, url: str = "http://localhost:7301"):
        self.url = url
        self.window = None

    def _terminal_listener(self):
        try:
            input()
            if getattr(self, 'window', None) and hasattr(self.window, 'destroy'):
                try:
                    self.window.destroy()
                except Exception:
                    pass
        except Exception:
            if getattr(self, 'window', None) and hasattr(self.window, 'destroy'):
                try:
                    self.window.destroy()
                except Exception:
                    pass

    def _on_loaded(self):
        if not self.window:
            return
        js = """
        (function() {
            try {
                localStorage.setItem('lang', 'en');
                localStorage.setItem('themeMode', 'dark');
            } catch (e) {}

            if (document.getElementById('studyts-shutdown-btn')) return;
            var btn = document.createElement('button');
            btn.id = 'studyts-shutdown-btn';
            btn.innerText = 'Close App';
            btn.title = 'Close StudyTs Desktop Window';
            btn.style.cssText = 'position:fixed;bottom:14px;right:14px;z-index:9000;'
                + 'padding:6px 14px;background:rgba(20,20,24,0.85);color:#E0A04A;'
                + 'border:1px solid rgba(224,160,74,0.35);border-radius:999px;'
                + 'font-family:system-ui,sans-serif;font-weight:600;'
                + 'font-size:12px;cursor:pointer;backdrop-filter:blur(10px);'
                + 'box-shadow:0 4px 12px rgba(0,0,0,0.5);transition:all 0.2s ease;'
                + 'opacity:0.7;user-select:none;';
            btn.onclick = function() {
                try { pywebview.api.shutdown(); } catch(e) { window.close(); }
            };
            btn.onmouseenter = function() {
                btn.style.opacity = '1'; btn.style.background = '#E0A04A'; btn.style.color = '#0b0f19';
            };
            btn.onmouseleave = function() {
                btn.style.opacity = '0.7'; btn.style.background = 'rgba(20,20,24,0.85)'; btn.style.color = '#E0A04A';
            };
            document.body.appendChild(btn);
        })();
        """
        try:
            self.window.evaluate_js(js)
        except Exception:
            pass

    def shutdown(self):
        if getattr(self, 'window', None) and hasattr(self.window, 'destroy'):
            try:
                self.window.destroy()
            except Exception:
                pass

    def start(self):
        self.window = webview.create_window(
            title="StudyTs",
            url=self.url,
            width=1440,
            height=900,
            min_size=(1024, 700),
            background_color="#0b0f19",
            text_select=True,
            js_api=self,
        )
        try:
            self.window.events.loaded += lambda: self._on_loaded()
        except Exception:
            pass
        listener_thread = threading.Thread(target=self._terminal_listener, daemon=True)
        listener_thread.start()
        print("[Press Enter in terminal or click Close App to stop]")
        webview.start(private_mode=False)

def main():
    target_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:7301"
    StudyTsWindow(url=target_url).start()

if __name__ == "__main__":
    main()