"""
Measure X — Demo Video Recorder Core
-------------------------------------
CDP (Chrome DevTools Protocol) based screen recorder for the Measure X SPA.

Produces YouTube-style demo clips: real-time-accurate MP4s with an on-screen
step caption bar and an animated highlight ring around the element being
interacted with.
"""

import base64
import itertools
import json
import os
import queue
import shutil
import socket
import subprocess
import threading
import time
import urllib.request

from selenium import webdriver
from selenium.webdriver.chrome.service import Service

BASE_URL = "http://localhost:3000"
FPS = 30
WIDTH = 1600
HEIGHT = 1000
CHROME_BIN = os.path.expanduser(
    "~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome"
)
DEMO_PASSWORD = "MeasureX@Demo2026"
DEMO = {
    "ADMIN": ("admin.demo@measurex.local", DEMO_PASSWORD),
    "LMO": ("lmo.demo@measurex.local", DEMO_PASSWORD),
    "GATC": ("gatc.demo@measurex.local", DEMO_PASSWORD),
    "OWNER": ("owner.demo@measurex.local", DEMO_PASSWORD),
}


# --------------------------------------------------------------------------
# Overlay: a plain mouse cursor + a slim caption bar. No highlight boxes.
# --------------------------------------------------------------------------
OVERLAY_JS = r"""
(() => {
  if (window.__mxOverlay) return;
  window.__mxOverlay = true;

  // --- caption bar -------------------------------------------------------
  const bar = document.createElement('div');
  bar.id = '__mx_caption';
  bar.style.cssText = [
    'position:fixed','left:50%','transform:translateX(-50%) translateY(160%)',
    'bottom:18px','z-index:2147483646','max-width:72vw',
    'background:rgba(8,22,19,0.9)','color:#fff','border-radius:8px',
    'padding:8px 16px 9px','font:600 14px/1.35 Inter,Segoe UI,system-ui,sans-serif',
    'box-shadow:0 6px 20px rgba(0,0,0,0.4)','opacity:0',
    'transition:transform .3s cubic-bezier(.22,1,.36,1),opacity .3s ease',
    'pointer-events:none','text-align:center'
  ].join(';');
  bar.innerHTML =
    '<span style="color:#C9972B;font-weight:800;font-size:10.5px;text-transform:uppercase;' +
    'letter-spacing:1.2px;margin-right:8px" id="__mx_cap_step"></span>' +
    '<span id="__mx_cap_text"></span>';
  document.documentElement.appendChild(bar);

  // --- plain mouse cursor ------------------------------------------------
  const cur = document.createElement('div');
  cur.id = '__mx_cursor';
  cur.style.cssText = [
    'position:fixed','left:0','top:0','width:20px','height:20px','margin:-2px 0 0 -2px',
    'z-index:2147483647','pointer-events:none','opacity:0',
    'transition:opacity .2s ease','will-change:left,top',
    'filter:drop-shadow(0 1px 2px rgba(0,0,0,0.55))'
  ].join(';');
  cur.innerHTML =
    '<svg width="20" height="20" viewBox="0 0 20 20" fill="none">' +
      '<path d="M3 2 L3 16.2 L6.9 12.6 L9.5 18.4 L12.2 17.1 L9.7 11.5 L14.7 11.3 Z" ' +
      'fill="#ffffff" stroke="#0b3a30" stroke-width="1.3" stroke-linejoin="round"/>' +
    '</svg>';
  document.documentElement.appendChild(cur);

  const S = window.__mxState = {
    x: window.innerWidth * 0.5, y: window.innerHeight * 0.55,
    tx: null, ty: null, on: false
  };

  window.__mxOverlaySet = (step, text) => {
    document.getElementById('__mx_cap_step').textContent = step || '';
    document.getElementById('__mx_cap_text').textContent = text || '';
    if (!S.on) {
      S.on = true;
      bar.style.transform = 'translateX(-50%) translateY(0)';
      bar.style.opacity = '1';
    }
  };

  window.__mxOverlayHide = () => {
    S.on = false;
    bar.style.opacity = '0';
    bar.style.transform = 'translateX(-50%) translateY(160%)';
  };

  // Aim the cursor at an element (no box, no outline).
  window.__mxHighlight = (el) => {
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    S.tx = Math.min(Math.max(r.left + Math.min(r.width / 2, 40), 6), window.innerWidth - 26);
    S.ty = Math.min(Math.max(r.top + Math.min(r.height / 2, 14), 6), window.innerHeight - 26);
  };

  // Glide the cursor to its target, then a small click pulse.
  let anim = null;
  window.__mxAnimateCursor = (dur) => {
    if (S.tx === null) return;
    const to = S.tx, toY = S.ty;
    cur.style.opacity = '1';
    if (anim) cancelAnimationFrame(anim);
    const t0 = performance.now(), ms = dur || 380;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      S.x += (to - S.x) * e;
      S.y += (toY - S.y) * e;
      cur.style.left = S.x + 'px';
      cur.style.top = S.y + 'px';
      if (k < 1) { anim = requestAnimationFrame(step); return; }
      S.tx = null;
    };
    anim = requestAnimationFrame(step);
  };

  window.__mxClickPulse = () => {
    cur.style.transform = 'scale(0.72)';
    setTimeout(() => { cur.style.transform = 'scale(1)'; }, 110);
  };

  window.__mxRingGone = () => {};
  window.__mxMoveCursor = () => {};

  // --- title card --------------------------------------------------------
  const card = document.createElement('div');
  card.id = '__mx_card';
  card.style.cssText = [
    'position:fixed','inset:0','z-index:2147483644','display:flex','align-items:center',
    'justify-content:center','pointer-events:none','opacity:0','transition:opacity .4s ease',
    'background:rgba(8,26,22,0.9)'
  ].join(';');
  card.innerHTML =
    '<div style="text-align:center;max-width:900px;padding:0 40px">' +
      '<div id="__mx_card_act" style="color:#C9972B;font:800 12px/1 Inter,sans-serif;' +
      'letter-spacing:4px;text-transform:uppercase;margin-bottom:12px"></div>' +
      '<div id="__mx_card_title" style="color:#fff;font:900 50px/1.1 Inter,sans-serif;' +
      'letter-spacing:-1.4px;margin-bottom:14px"></div>' +
      '<div id="__mx_card_sub" style="color:#A4D4C8;font:600 20px/1.4 Inter,sans-serif"></div>' +
      '<div style="width:84px;height:4px;background:#C9972B;margin:22px auto 0;border-radius:2px"></div>' +
    '</div>';
  document.documentElement.appendChild(card);

  window.__mxTitle = (act, title, sub) => {
    document.getElementById('__mx_card_act').textContent = act || '';
    document.getElementById('__mx_card_title').textContent = title || '';
    document.getElementById('__mx_card_sub').textContent = sub || '';
    card.style.opacity = '1';
  };
  window.__mxTitleHide = () => { card.style.opacity = '0'; };
})();
"""


# --------------------------------------------------------------------------
def probe(path):
    """Duration (seconds) of a media file, via ffprobe."""
    exe = shutil.which("ffprobe")
    if not exe:
        return 0.0
    try:
        out = subprocess.run(
            [exe, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", path],
            capture_output=True, timeout=30,
        )
        return round(float(out.stdout.decode().strip()), 1)
    except Exception:
        return 0.0


class Recorder:
    def __init__(self, outdir, headless=True, width=WIDTH, height=HEIGHT):
        self.outdir = outdir
        self._outroot = os.path.dirname(os.path.abspath(outdir.rstrip("/")))
        self.width = width
        self.height = height
        os.makedirs(outdir, exist_ok=True)
        self.ffmpeg = shutil.which("ffmpeg")
        if not self.ffmpeg:
            raise RuntimeError("ffmpeg not found on PATH")
        self._make_chrome(headless)
        self.frames = []
        self.lock = threading.Lock()
        self.recording = False
        self.t0 = 0.0
        self._chapters = None
        self._ch_no = 0
        self._ch_meta = []
        self._ch_current = None
        self._cap = None

    # ---------------------------------------------------------------- chrome
    def _make_chrome(self, headless):
        o = webdriver.ChromeOptions()
        if os.path.exists(CHROME_BIN):
            o.binary_location = CHROME_BIN
        args = [
            f"--window-size={self.width},{self.height}",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--hide-scrollbars",
            "--force-device-scale-factor=1",
            "--disable-features=Translate,AcceptCHFrame",
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            "--mute-audio",
            "--no-first-run",
            "--disable-background-timer-throttling",
            "--disable-renderer-backgrounding",
            "--disable-backgrounding-occluded-windows",
            "--password-store=basic",
            "--lang=en-US",
            "--remote-allow-origins=*",
        ]
        if headless:
            args.insert(0, "--headless=new")
        for a in args:
            o.add_argument(a)
        o.set_capability("goog:loggingPrefs", {"browser": "ALL"})
        self.driver = webdriver.Chrome(options=o)
        try:
            self.driver.execute_cdp_cmd(
                "Emulation.setDeviceMetricsOverride",
                {"width": self.width, "height": self.height,
                 "deviceScaleFactor": 1, "mobile": False},
            )
        except Exception:
            pass
        self.driver.set_window_size(self.width, self.height)
        dbg = self.driver.capabilities["goog:chromeOptions"]["debuggerAddress"]
        self._attach_cdp(dbg)

    def _attach_cdp(self, dbg_addr):
        import websocket

        host, port = dbg_addr.split(":")
        targets = json.load(urllib.request.urlopen(f"http://{host}:{port}/json"))
        page = next(t for t in targets if t["type"] == "page")
        self.ws = websocket.create_connection(
            page["webSocketDebuggerUrl"],
            max_size=64 * 1024 * 1024, timeout=2, suppress_origin=True,
        )
        self._msg_id = 0
        self._pending = {}
        self._ack_ids = itertools.count(1_000_000)
        self._pump = threading.Thread(target=self._read_loop, daemon=True)
        self._pump.start()

    def _cmd(self, method, timeout=15, **params):
        self._msg_id += 1
        mid = self._msg_id
        resp_q = queue.Queue(maxsize=1)
        with self.lock:
            self._pending[mid] = resp_q
        self.ws.send(json.dumps({"id": mid, "method": method, "params": params}))
        try:
            res = resp_q.get(timeout=timeout)
        except queue.Empty:
            raise RuntimeError(f"{method}: CDP timeout")
        if "error" in res:
            raise RuntimeError(f"{method}: {res['error']}")
        return res.get("result", {})

    def _read_loop(self):
        while True:
            try:
                raw = self.ws.recv()
            except socket.timeout:
                continue
            except Exception:
                time.sleep(0.1)
                continue
            try:
                msg = json.loads(raw)
            except Exception:
                continue
            if "id" in msg:
                with self.lock:
                    q = self._pending.pop(msg["id"], None)
                if q is not None:
                    try:
                        q.put_nowait(msg)
                    except queue.Full:
                        pass
                continue
            if msg.get("method") == "Page.screencastFrame":
                # legacy path (unused: this Chrome build emits no frames)
                p = msg["params"]
                with self.lock:
                    if self.recording:
                        self.frames.append(
                            (p.get("metadata", {}).get("timestamp", time.time()),
                             base64.b64decode(p["data"]))
                        )

    # ------------------------------------------------------------ recording
    #
    # This Chrome build (Chrome for Testing 1243) emits ~1 screencast frame per
    # 5s regardless of flags, so Page.startScreencast is unusable. Instead a
    # background thread polls Page.captureScreenshot, which forces a real
    # raster of the page every round trip and yields a steady ~20 fps at
    # 1600x1000. Frames are stamped with wall-clock time and later resampled
    # onto a 30 fps grid, so the motion you see is real-time motion.
    SHOT_QUALITY = 82

    def _capture_loop(self):
        while self.recording:
            t = time.time()
            try:
                res = self._cmd(
                    "Page.captureScreenshot",
                    timeout=20,
                    format="jpeg",
                    quality=self.SHOT_QUALITY,
                    fromSurface=True,
                    captureBeyondViewport=False,
                )
                data = res.get("data")
                if data:
                    with self.lock:
                        if self.recording:
                            self.frames.append((t, base64.b64decode(data)))
                    continue
            except Exception:
                if not self.recording:
                    break
            time.sleep(0.005)

    def start(self):
        with self.lock:
            self.frames = []
            self.recording = True
        self.t0 = time.time()
        self._cap = threading.Thread(target=self._capture_loop, daemon=True)
        self._cap.start()
        # Prime one frame so the clip never opens on an empty buffer.
        time.sleep(0.12)

    def stop(self, path, min_duration=0.0):
        with self.lock:
            self.recording = False
        try:
            self._cap.join(timeout=5)
        except Exception:
            pass
        time.sleep(0.15)
        with self.lock:
            frames = self.frames
            self.frames = []
        wall = time.time() - self.t0
        if len(frames) < 2:
            print(f"    !! only {len(frames)} frame(s) captured for {path}")
            return None

        # Resample real wall-clock timestamps onto a 30 fps grid. Gaps get the
        # previous frame repeated, so timing is honest and playback is smooth.
        first = frames[0][0]
        span = max(frames[-1][0] - first, wall - 0.15)
        grid = []
        for ts, data in frames:
            n = max(1, int(round((ts - first) * FPS)))
            n = max(n, len(grid))
            while len(grid) < n:
                grid.append(data)
        want = int(round(span * FPS))
        while len(grid) < want:
            grid.append(grid[-1])
        if min_duration and len(grid) < min_duration * FPS:
            grid.extend([grid[-1]] * (int(min_duration * FPS) - len(grid)))

        cmd = [
            self.ffmpeg, "-y", "-loglevel", "error",
            "-f", "image2pipe", "-vcodec", "mjpeg", "-r", str(FPS), "-i", "-",
            "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", path,
        ]
        p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            for f in grid:
                p.stdin.write(f)
        except BrokenPipeError:
            pass
        p.stdin.close()
        err = p.stderr.read().decode(errors="ignore")
        p.wait()
        size = os.path.getsize(path) if os.path.exists(path) else 0
        dur = len(grid) / FPS
        if size < 1000:
            print(f"    !! encode failed for {path}: {err[:200]}")
            return None
        print(f"    -> {os.path.basename(path)}  {dur:.1f}s  {size/1024:.0f} KB")
        return path

    # ---------------------------------------------------------------- utils
    def js(self, script, *args):
        if args:
            script = script.replace("__A0__", json.dumps(args[0]))
            for i, a in enumerate(args[1:]):
                script = script.replace(f"__A{i+1}__", json.dumps(a))
        return self.driver.execute_script(script)

    def inject_overlay(self):
        self.driver.execute_script(OVERLAY_JS)

    def caption(self, step, text, hold=1.6):
        """Set the on-screen caption; `hold` is dwell time in seconds."""
        self.driver.execute_script("window.__mxOverlaySet(arguments[0], arguments[1]);", step, text)
        time.sleep(hold)

    def title_card(self, act, title, sub, hold=2.2):
        self.driver.execute_script(
            "window.__mxTitle(arguments[0], arguments[1], arguments[2]);", act, title, sub
        )
        time.sleep(hold)
        self.driver.execute_script("window.__mxTitleHide();")

    # ------------------------------------------------------- element finding
    FIND_JS = r"""
    const css = arguments[0], txt = (arguments[1] || '').toLowerCase();
    const scope = arguments[2] ? document.querySelector(arguments[2]) : document;
    if (!scope) return null;
    let els = css ? [...scope.querySelectorAll(css)] : [...scope.querySelectorAll('a,button,input,select,textarea,td,th,div,span,label,h1,h2,h3')];
    if (txt) {
      const hit = els.filter(e => ((e.innerText||e.value||e.placeholder||e.textContent||'')
        .replace(/\s+/g,' ').trim().toLowerCase().includes(txt)));
      if (hit.length) els = hit;
    }
    els = els.filter(e => {
      const s = getComputedStyle(e), b = e.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && b.width > 2 && b.height > 2;
    });
    if (!els.length) return null;
    const idx = arguments[3] | 0;
    const el = els[Math.min(idx, els.length - 1)];
    if (!txt && els.length > 1 && arguments[4] === 'best') {
      // pick the largest visible match: most likely the intended target
      els.sort((a,b) => (b.getBoundingClientRect().width*b.getBoundingClientRect().height)
                     - (a.getBoundingClientRect().width*a.getBoundingClientRect().height));
    }
    return el;
    """

    def find(self, css="", text=None, scope=None, idx=0, best=False):
        """Locate a visible element by CSS, optional text, scope, index."""
        return self.driver.execute_script(
            self.FIND_JS, css, text or "", scope or "", idx, "best" if best else ""
        )

    def must_find(self, css="", text=None, scope=None, idx=0, best=False, label=""):
        el = self.find(css, text, scope, idx, best)
        if el is None:
            raise LookupError(f"element not found: css={css!r} text={text!r} {label}")
        return el

    def scroll_to(self, el, block="center"):
        self.driver.execute_script(
            "arguments[0].scrollIntoView({block: arguments[1], behavior: 'instant'});", el, block
        )
        time.sleep(0.45)

    def focus_el(self, el):
        self.driver.execute_script(
            "arguments[0].scrollIntoView({block:'center', behavior:'instant'});"
            "setTimeout(()=>arguments[0].focus({preventScroll:true}), 40);", el
        )
        time.sleep(0.3)

    def act(self, css="", text=None, scope=None, idx=0, best=False,
            step=None, caption=None, dwell=0.8, scroll=True, note=None):
        """Move the mouse onto an element and let the caption land."""
        el = self.find(css, text, scope, idx, best)
        if el is None:
            return None
        if scroll:
            self.scroll_to(el)
        if step or caption:
            self.caption(step or "STEP", caption or note or "", hold=0.45)
        self.driver.execute_script("window.__mxHighlight(arguments[0]);", el)
        self.driver.execute_script("window.__mxAnimateCursor();")
        time.sleep(dwell)
        return el

    def click(self, css="", text=None, scope=None, idx=0, best=False,
              step=None, caption=None, dwell=0.75, after=0.8, scroll=True):
        el = self.act(css, text, scope, idx, best, step, caption, dwell, scroll)
        if el is None:
            return None
        self.driver.execute_script("window.__mxClickPulse();")
        try:
            el.click()
        except Exception:
            self.driver.execute_script("arguments[0].click();", el)
        time.sleep(after)
        return el

    def type_into(self, el, value, per_char=0.03):
        """Realistic keystroke typing so the screencast shows character flow."""
        self.focus_el(el)
        try:
            el.clear()
        except Exception:
            self.driver.execute_script("arguments[0].value='';", el)
        time.sleep(0.14)
        for ch in str(value):
            try:
                el.send_keys(ch)
            except Exception:
                break
            time.sleep(per_char)
        time.sleep(0.22)

    def fill(self, css="", text=None, scope=None, idx=0, value="", best=False,
             step=None, caption=None, dwell=0.7):
        el = self.act(css, text, scope, idx, best, step, caption, dwell)
        if el is None:
            return None
        self.type_into(el, value)
        self.clear_highlight()
        return el

    def select(self, css="", value=None, idx=0, step=None, caption=None, dwell=0.7):
        el = self.act(css, idx=idx, step=step, caption=caption, dwell=dwell)
        if el is None:
            return None
        if value is not None:
            self.driver.execute_script(
                "const s=arguments[0],v=arguments[1];s.value=v;"
                "s.dispatchEvent(new Event('change',{bubbles:true}));", el, value
            )
            time.sleep(0.4)
        return el

    def note(self, text, step="NOTE", dwell=2.0):
        self.caption(step, text, hold=dwell)
        self.clear_highlight()

    def readout(self, sel, attr="innerText"):
        el = self.find(sel)
        if el is None:
            return ""
        return (el.get_attribute(attr) or "").strip()

    def highlight(self, selector_or_el, by_js=False):
        self.driver.execute_script("window.__mxHighlight(arguments[0]);", selector_or_el)

    def point_at(self, selector="", el=None, by_js=False):
        """Highlight + animate the fake cursor onto an element."""
        if el is None and selector and not by_js:
            el = self.driver.execute_script(
                "return document.querySelector(arguments[0]);", selector
            )
        self.driver.execute_script("window.__mxHighlight(arguments[0]);", el)
        self.driver.execute_script("window.__mxAnimateCursor();")

    def clear_highlight(self):
        """No-op: the simplified overlay draws no highlight box."""
        return

    def goto(self, route, settle=1.9, fresh=False):
        """Navigate to a hash route (SPA) or full page (fresh=True)."""
        if fresh:
            self.driver.get(f"{BASE_URL}/{route}")
        else:
            self.driver.execute_script(
                "window.location.hash = arguments[0];", route.lstrip("#").join(["#", ""])
            )
        time.sleep(settle)
        self.inject_overlay()
        time.sleep(0.25)

    def wait_splash(self):
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support import expected_conditions as EC

        self.driver.get(f"{BASE_URL}/#landing")
        try:
            btn = WebDriverWait(self.driver, 6).until(
                EC.element_to_be_clickable((By.ID, "splash-skip-btn"))
            )
            btn.click()
        except Exception:
            pass
        WebDriverWait(self.driver, 8).until(
            EC.invisibility_of_element_located((By.ID, "splash-screen"))
        )
        time.sleep(0.7)
        self.inject_overlay()

    # ------------------------------------------------------------ chapters
    def begin_chapters(self, actdir, prefix, actlabel, min_duration=7.0):
        """Switch the recorder into multi-clip mode: one scene -> many clips."""
        os.makedirs(os.path.join(self._outroot, actdir), exist_ok=True)
        self._chapters = {"dir": actdir, "prefix": prefix, "act": actlabel,
                          "min": min_duration}
        self._ch_no = 0
        self._ch_meta = []
        self._ch_current = None

    def _ch_path(self, n, key):
        meta = self._chapters
        return os.path.join(self._outroot, meta["dir"],
                            f"{meta['prefix']}{n:02d}-{key}.mp4")

    def chapter(self, key, title, sub, dwell=2.3):
        """Cut the clip in progress and open a new one (page state is kept)."""
        meta = self._chapters
        # 1. close the clip currently being recorded, under its OWN name
        if self.recording and self._ch_current:
            out = self.stop(self._ch_current["path"], min_duration=meta["min"])
            if out:
                self._ch_meta.append(dict(self._ch_current, path=out))
        # 2. open the new clip
        self._ch_no += 1
        self._ch_current = {"path": self._ch_path(self._ch_no, key),
                            "title": title, "sub": sub, "key": key,
                            "actdir": meta["dir"], "act": meta["act"]}
        self.driver.execute_script("window.__mxOverlayHide();")
        self.inject_overlay()
        self.start()
        self.title_card(meta["act"], title, sub, hold=dwell)
        return self._ch_current["path"]

    def end_chapters(self):
        """Close the final clip of a multi-clip scene."""
        if self._chapters and self.recording and self._ch_current:
            out = self.stop(self._ch_current["path"], min_duration=self._chapters["min"])
            if out:
                self._ch_meta.append(dict(self._ch_current, path=out))
        meta, self._ch_meta = self._ch_meta, []
        self._chapters = None
        self._ch_current = None
        return meta

    def kill(self):
        try:
            self.driver.quit()
        except Exception:
            pass
