#!/usr/bin/env python3
"""
Measure X — Admin Portal Demo Video Set
======================================
Records short, smooth, separate clips:
    1. Home (landing) page
    2. Login as admin@demo.com / admin123
    3..N. Every main feature of the State Directorate Administration console.

Simple mouse movement only — no highlight boxes.

    python scripts/record_admin_demo.py
    python scripts/record_admin_demo.py --only 03 05
    python scripts/record_admin_demo.py --list
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from demo_recorder import Recorder, probe  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "demo-videos-admin")
BASE = "http://localhost:3000"
ADMIN_EMAIL = "admin@demo.com"
ADMIN_PASS = "admin123"
ACT = "ADMINISTRATION CONSOLE"

CLIPS = []


def clip(key, title, sub):
    def deco(fn):
        CLIPS.append({"key": key, "title": title, "sub": sub, "fn": fn})
        return fn
    return deco


# ------------------------------------------------------------------ helpers
def goto(r, route, settle=1.5):
    r.goto(route, settle=settle)
    r.inject_overlay()


def scroll_to(r, top, wait=0.85):
    r.driver.execute_script(
        "window.scrollTo({top: arguments[0], behavior: 'instant'});", top)
    time.sleep(wait)


def admin_login(r, show=True):
    """Log in through the real form with admin@demo.com / admin123."""
    goto(r, "#login", settle=1.6)
    r.fill("#login-email", value=ADMIN_EMAIL, step="STEP 1",
           caption="Enter the admin e-mail", dwell=0.55)
    r.fill("#login-password", value=ADMIN_PASS, step="STEP 2",
           caption="Enter the password", dwell=0.55)
    r.click("#login-submit-btn", step="STEP 3",
            caption="Click Sign In", dwell=0.8, after=2.6)
    time.sleep(1.2)
    r.inject_overlay()
    return r.driver.execute_script("return location.hash;")


def hover(r, css, text=None, step=None, caption=None, dwell=0.8, best=True, idx=0):
    return r.act(css, text, idx=idx, best=best, step=step, caption=caption,
                 dwell=dwell)


# ==================================================================== CLIPS
@clip("01-home", "Home Page", "Public entry — Measure X landing")
def c_home(r):
    r.driver.get(f"{BASE}/#landing")
    time.sleep(1.0)
    r.inject_overlay()
    r.caption("HOME", "Welcome to Measure X — the public portal", hold=1.3)
    time.sleep(2.2)
    r.inject_overlay()
    hover(r, ".app-header .main-nav", step="NAVIGATION",
          caption="Top navigation", dwell=1.0)
    scroll_to(r, 460)
    hover(r, "#quick-cert-input", step="QUICK VERIFY",
          caption="Verify any certificate instantly — no login needed", dwell=1.0)
    r.fill("#quick-cert-input", value="MX-CERT-DEMO-0001", step="QUICK VERIFY",
           caption="Type a certificate number", dwell=0.35)
    scroll_to(r, 900)
    hover(r, "#app-body .btn", step="SERVICES",
          caption="Register, apply and track in a few clicks", dwell=1.0)
    scroll_to(r, 1500)
    hover(r, "#app-body .card, #app-body .btn", step="WORKFLOW",
          caption="How the statutory workflow runs", dwell=1.0)


@clip("02-login", "Login as Administrator",
      "admin@demo.com — role auto-detected, admin console opens")
def c_login(r):
    h = admin_login(r)
    r.caption("SIGNED IN", f"Role ADMIN detected — opened {h}", hold=2.6)


@clip("03-dashboard", "Admin Dashboard", "State-wide statutory oversight")
def c_dashboard(r):
    admin_login(r)
    r.caption("DASHBOARD", "Directorate overview of the whole state", hold=1.6)
    scroll_to(r, 0)
    hover(r, ".dashboard-metrics-grid .stat-card, #app-body .stat-card",
          step="METRICS", caption="Instrument, owner, officer and certificate totals",
          dwell=1.1)
    scroll_to(r, 520)
    hover(r, "#app-body .stat-card", step="METRICS",
          caption="Certified, expiring and failed verification counts", dwell=1.0)
    scroll_to(r, 1100)
    hover(r, "#app-body .card", step="OVERSIGHT",
          caption="District-wise and divisional breakdown", dwell=1.0)
    scroll_to(r, 1700)
    hover(r, "#export-reports-csv-btn", step="EXPORT",
          caption="Export the analytics as CSV", dwell=0.9)


@clip("04-allocation", "Allocation Desk",
      "Dispatch applications to a Legal Metrology Officer")
def c_allocation(r):
    admin_login(r)
    goto(r, "#admin-allocation", settle=2.2)
    r.caption("ALLOCATION DESK", "Statutory dispatch of verification applications",
              hold=1.6)
    hover(r, "#app-body .stat-card", step="QUEUE",
          caption="Ready for allocation, allocated and active officers", dwell=1.0)
    hover(r, "#filter-ready-btn", step="FILTER",
          caption="Filter to applications awaiting routing", dwell=0.8)
    r.click("#filter-ready-btn", step="FILTER",
            caption="Click the filter", dwell=0.6, after=1.0)
    r.click("#filter-all-btn", step="FILTER", caption="Back to all applications",
            dwell=0.5, after=0.9)
    scroll_to(r, 430)
    hover(r, "#allocation-table", step="TABLE",
          caption="Every filed application with its current allocation state",
          dwell=1.1)
    if r.click(".open-allocate-modal-btn", step="ALLOCATE",
               caption="Open the allocation modal for an application",
               dwell=0.8, after=1.9):
        r.inject_overlay()
        r.caption("ALLOCATE", "Choose the officer who will inspect on site", hold=1.3)
        r.select("#modal-select-lmo", step="OFFICER",
                 caption="Select the Legal Metrology Officer", dwell=0.9)
        r.fill("#modal-alloc-notes", step="NOTES",
               value="Allocated for statutory on-site verification.",
               caption="Add the allocation directive", dwell=0.35)
        r.click(".modal-confirm-btn", step="CONFIRM",
                caption="Confirm LMO Allocation", dwell=0.9, after=2.8)
        time.sleep(1.0)
        r.inject_overlay()
        r.caption("DONE", "Application allocated and the officer notified", hold=2.6)


@clip("05-users", "User Management",
      "All accounts, roles and pending clearances")
def c_users(r):
    admin_login(r)
    goto(r, "#admin-users", settle=2.2)
    r.caption("USER MANAGEMENT", "Every account registered on the network", hold=1.6)
    scroll_to(r, 0)
    hover(r, "#app-body .stat-card, #app-body .card", step="ACCOUNTS",
          caption="Totals by role and clearance state", dwell=1.0)
    hover(r, "#admin-user-search", step="SEARCH",
          caption="Search by name, e-mail or user ID", dwell=0.9)
    r.fill("#admin-user-search", value="patna", step="SEARCH",
           caption="Type to filter the account list", dwell=0.5)
    time.sleep(1.1)
    scroll_to(r, 520)
    hover(r, "#app-body table tbody tr", step="LIST",
          caption="User ID, role, business, district and status", dwell=1.1)
    hover(r, "#app-body .tab-btn, .tab-nav .tab-btn", step="TABS",
          caption="Switch between active accounts and pending clearances", dwell=0.9)


@clip("06-instruments", "Instrument Registry",
      "Every weighing device in the state — search, filter, export")
def c_instruments(r):
    admin_login(r)
    goto(r, "#admin-instruments", settle=2.2)
    r.caption("INSTRUMENT REGISTRY", "Central register of all commercial equipment",
              hold=1.6)
    hover(r, "#app-body .stat-card, #app-body .card", step="REGISTRY",
          caption="Certified, expiring soon and lapsed counts", dwell=1.0)
    hover(r, "#registry-search-input", step="SEARCH",
          caption="Search by instrument ID, serial number or model", dwell=0.9)
    r.fill("#registry-search-input", value="MX-INS", step="SEARCH",
           caption="Filter the register", dwell=0.5)
    time.sleep(1.0)
    scroll_to(r, 470)
    hover(r, "#app-body table tbody tr", step="REGISTRY",
          caption="Owner, category, capacity, location and last verification", dwell=1.1)
    hover(r, "#registry-filter-status", step="FILTER",
          caption="Filter by validity status", dwell=0.8)
    r.select("#registry-filter-status", step="FILTER",
             caption="Choose a status", dwell=0.7)
    time.sleep(1.0)
    hover(r, "#admin-export-registry-btn", step="EXPORT",
          caption="Export the whole registry as CSV", dwell=0.9)


@clip("07-applications", "Applications",
      "All filed verification applications across the state")
def c_applications(r):
    admin_login(r)
    goto(r, "#admin-applications", settle=2.3)
    r.caption("APPLICATIONS", "Every verification filing on record", hold=1.6)
    scroll_to(r, 0)
    hover(r, "#app-body .stat-card, #app-body .card", step="VOLUME",
          caption="Filing volume and status breakdown", dwell=1.0)
    scroll_to(r, 470)
    hover(r, "#app-body table tbody tr", step="TABLE",
          caption="Reference number, applicant, equipment and status", dwell=1.1)
    hover(r, "#app-body .tab-btn, .tab-nav .tab-btn", step="FILTER",
          caption="Filter the queue by statutory status", dwell=0.9)


@clip("08-monitoring", "Verification Monitoring",
      "Live view of officer and laboratory verification activity")
def c_monitoring(r):
    admin_login(r)
    goto(r, "#admin-monitoring", settle=2.3)
    r.caption("MONITORING", "Verification activity happening right now", hold=1.6)
    scroll_to(r, 0)
    hover(r, "#app-body .stat-card, #app-body .card", step="LIVE",
          caption="In-progress verifications and outcome split", dwell=1.0)
    scroll_to(r, 520)
    hover(r, "#app-body table tbody tr, #app-body .card", step="ACTIVITY",
          caption="Which officer is verifying which instrument", dwell=1.1)


@clip("09-certificates", "Certificate Management",
      "Issued certificates, documents and statutory revocation")
def c_certificates(r):
    admin_login(r)
    goto(r, "#admin-certificates", settle=2.3)
    r.caption("CERTIFICATE MANAGEMENT", "The state certificate register", hold=1.6)
    scroll_to(r, 0)
    hover(r, "#app-body .stat-card, #app-body .card", step="REGISTER",
          caption="Valid, expiring and revoked certificate counts", dwell=1.0)
    scroll_to(r, 470)
    hover(r, "#app-body table tbody tr", step="REGISTER",
          caption="Certificate ID, entity, instrument, officer and validity", dwell=1.1)
    r.click("a[href*='owner-certificate-details'], a[href*='#certificate-view']",
            step="DOCUMENT", caption="Open a certificate document", dwell=0.7,
            after=2.0)
    r.inject_overlay()
    hover(r, "#app-body img[src*='qr'], #app-body .cert-qr-area, #app-body canvas",
          step="QR SEAL", caption="Every certificate carries a verifiable QR seal",
          dwell=1.1)


@clip("10-reports", "Reports & Analytics",
      "Statutory analytics with filters and drill-down")
def c_reports(r):
    admin_login(r)
    goto(r, "#admin-reports", settle=2.6)
    r.caption("REPORTS & ANALYTICS", "Statutory analytics for the whole state",
              hold=1.6)
    scroll_to(r, 0)
    hover(r, "#report-summary-cards, #app-body .stat-card", step="SUMMARY",
          caption="Headline numbers for the financial year", dwell=1.0)
    hover(r, "#report-filter-district, #report-filter-type", step="FILTERS",
          caption="Filter by district, equipment type, outcome and period", dwell=1.0)
    scroll_to(r, 560)
    hover(r, "#report-chart-container, #report-outcome-container", step="CHARTS",
          caption="Outcome and district charts", dwell=1.1)
    scroll_to(r, 1150)
    hover(r, "#report-equipment-container, #report-district-container", step="DRILLDOWN",
          caption="Equipment and district drill-downs", dwell=1.1)
    scroll_to(r, 1750)
    hover(r, "#export-reports-csv-btn", step="EXPORT",
          caption="Export the report as CSV", dwell=0.9)


@clip("11-notifications", "Notifications",
      "Statutory notice dispatch to every stakeholder")
def c_notifications(r):
    admin_login(r)
    goto(r, "#admin-notifications", settle=2.2)
    r.caption("NOTIFICATIONS", "Statutory notices issued on the network", hold=1.6)
    scroll_to(r, 0)
    hover(r, "#open-send-notif-btn, #app-body .btn", step="COMPOSE",
          caption="Compose and dispatch a statutory notification", dwell=1.0)
    r.click("#open-send-notif-btn", step="COMPOSE",
            caption="Open the notification composer", dwell=0.7, after=1.6)
    r.inject_overlay()
    r.fill("#manual-notif-title", step="COMPOSE", value="Statutory Re-verification Notice",
           caption="Notice title", dwell=0.35)
    r.fill("#manual-notif-message",
           step="COMPOSE",
           value="Your weighing instrument verification is due. Please complete "
                 "re-verification within 30 days.",
           caption="Notice message", dwell=0.35)
    r.driver.execute_script(
        "document.querySelectorAll('.modal-close-btn,.modal-cancel-btn')"
        ".forEach(b=>b.click());")
    time.sleep(1.0)
    scroll_to(r, 400)
    hover(r, "#app-body .card, #app-body table tbody tr", step="INBOX",
          caption="Previously dispatched notices", dwell=1.0)


@clip("12-audit", "Audit Trail", "Tamper-evident log of every state change")
def c_audit(r):
    admin_login(r)
    goto(r, "#admin-audit", settle=2.4)
    r.caption("AUDIT TRAIL", "Every state-changing action, permanently logged",
              hold=1.6)
    scroll_to(r, 0)
    hover(r, "#stat-total-events, #audit-records-badge", step="EVENTS",
          caption="Total recorded events", dwell=1.0)
    hover(r, "#audit-search-input", step="SEARCH",
          caption="Search the audit log", dwell=0.9)
    hover(r, "#audit-role-select, #audit-category-select", step="FILTER",
          caption="Filter by role and action category", dwell=0.9)
    scroll_to(r, 520)
    hover(r, "#audit-table-body, #app-body table tbody tr", step="LOG",
          caption="Timestamp, actor, role, action and target record", dwell=1.1)
    hover(r, "#export-audit-csv-btn", step="EXPORT",
          caption="Export the audit log as CSV", dwell=0.9)


@clip("13-settings", "System Settings",
      "Statutory parameters and expiry-monitoring rules")
def c_settings(r):
    admin_login(r)
    goto(r, "#admin-config", settle=2.4)
    r.caption("SYSTEM SETTINGS", "Statutory parameters for the network", hold=1.6)
    scroll_to(r, 0)
    hover(r, "#app-body .card", step="PARAMETERS",
          caption="Issuing authority, verification intervals and tolerance settings",
          dwell=1.1)
    scroll_to(r, 560)
    hover(r, "#app-body .card", step="EXPIRY",
          caption="Automated expiry monitoring and notice lead time", dwell=1.1)
    scroll_to(r, 1100)
    hover(r, "#app-body .card, #app-body .btn", step="ACTIONS",
          caption="Run the expiry check and publish statutory notices", dwell=1.0)


@clip("14-profile-logout", "Profile & Sign Out",
      "Administrator identity and session close")
def c_profile(r):
    admin_login(r)
    goto(r, "#admin-profile", settle=1.9)
    r.caption("PROFILE", "Administrator identity and role record", hold=1.4)
    hover(r, "#app-body .card", step="PROFILE",
          caption="Name, official e-mail, department and designation", dwell=1.0)
    r.click("#user-profile-toggle-btn", step="SIGN OUT",
            caption="Open the user menu in the header", dwell=0.7, after=0.8)
    r.click("#user-dropdown-logout", step="SIGN OUT",
            caption="Click Sign Out — the session token is cleared", dwell=0.8,
            after=2.6)
    time.sleep(1.0)
    r.inject_overlay()
    r.caption("SIGNED OUT", "Back on the public portal", hold=2.2)


# ==================================================================== RUNNER
def build_index(records, out):
    rows = "\n".join(
        '<tr><td class="n">%02d</td>'
        '<td><a href="%s"><video src="%s" preload="metadata" muted loop '
        'controls playsinline></video></a></td>'
        '<td><a href="%s"><b>%s</b></a><div class="sub">%s</div>'
        '<code>%s</code></td><td class="d">%.0fs</td></tr>'
        % (n, f, f, f, v["title"], v["sub"], v["file"], v["duration"])
        for n, v in enumerate(records, 1)
        for f in [v["file"]]
    )
    total = sum(r["duration"] for r in records)
    html = f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Measure X — Administration Console Demo</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
 :root {{ --p:#0B5D4B; --g:#C9972B; --ink:#0f2a24; }}
 * {{ box-sizing:border-box; }}
 body {{ margin:0; font:15px/1.6 Inter,Segoe UI,system-ui,sans-serif;
        background:#f4f7f6; color:var(--ink); }}
 header {{ background:linear-gradient(135deg,var(--p),#084034); color:#fff;
           padding:40px 38px 30px; }}
 header h1 {{ margin:0 0 6px; font-size:29px; letter-spacing:-.6px; }}
 header h1 span {{ color:var(--g); }}
 header p {{ margin:0; color:#A4D4C8; }}
 main {{ padding:24px 38px 60px; max-width:1000px; }}
 .card {{ background:#fff; border-radius:12px; overflow:hidden;
          box-shadow:0 1px 3px rgba(11,93,75,.10); margin-bottom:14px;
          display:flex; gap:18px; padding:14px; align-items:flex-start; }}
 video {{ width:230px; border-radius:8px; background:#000; flex:none; }}
 .meta {{ padding-top:2px; }}
 td.n {{ color:var(--g); font-weight:800; width:40px; vertical-align:top;
         padding-top:26px; }}
 td.d {{ color:#7a918b; white-space:nowrap; vertical-align:top; padding-top:26px; }}
 tr {{ display:flex; align-items:flex-start; }}
 a {{ color:var(--p); text-decoration:none; }}
 a:hover b {{ text-decoration:underline; }}
 b {{ color:var(--p); font-size:15.5px; }}
 .sub {{ color:#7a918b; font-size:13px; margin:2px 0 5px; }}
 code {{ font:12px/1.4 "JetBrains Mono",ui-monospace,monospace; color:#8a9a95; }}
 h2 {{ color:var(--p); font-size:17px; margin:30px 0 12px; }}
 footer {{ padding:24px 38px; color:#7a918b; font-size:13px;
           border-top:1px solid #dbe6e2; }}
</style></head><body>
<header>
  <h1>Measure <span>X</span> — Administration Console Demo</h1>
  <p>State Directorate Admin &middot; admin@demo.com &middot; {len(records)} clips
     &middot; {total/60:.1f} min &middot; recorded
     {datetime.now().strftime('%d %b %Y %H:%M')}</p>
</header>
<main>
{rows}
</main>
<footer>Measure X &middot; Department of Legal Metrology &middot;
Legal Metrology Act, 2009 &middot; OIML R76-1:2006 (E)</footer>
</body></html>"""
    p = os.path.join(out, "index.html")
    with open(p, "w") as f:
        f.write(html)
    return p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=OUT)
    ap.add_argument("--only", action="append", default=[])
    ap.add_argument("--clip", action="append", default=[])
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--min", type=float, default=6.0)
    ap.add_argument("--headful", action="store_true")
    args = ap.parse_args()

    if args.list:
        for i, c in enumerate(CLIPS, 1):
            print(f"{i:02d}  {c['key']:<20} {c['title']}")
        print(f"\n{len(CLIPS)} clips")
        return 0

    todo = []
    for c in CLIPS:
        n = f"{CLIPS.index(c) + 1:02d}"
        if args.only and n not in args.only:
            continue
        if args.clip and c["key"] not in args.clip:
            continue
        todo.append((n, c))
    if not todo:
        print("nothing matched")
        return 1

    os.makedirs(args.out, exist_ok=True)
    r = Recorder(os.path.join(args.out, "_tmp"), headless=not args.headful)
    records, fails = [], []
    t_all = time.time()
    try:
        r.wait_splash()
        for n, c in todo:
            path = os.path.join(args.out, f"{c['key']}.mp4")
            print(f"[{n}] {c['title']}")
            t0 = time.time()
            try:
                r.driver.execute_script("window.__mxOverlayHide();")
                r.inject_overlay()
                r.start()
                r.title_card(ACT, c["title"], c["sub"], hold=1.9)
                c["fn"](r)
                time.sleep(0.6)
                out = r.stop(path, min_duration=args.min)
                if out:
                    records.append({"file": os.path.basename(out),
                                    "title": c["title"], "sub": c["sub"],
                                    "duration": probe(out), "key": c["key"]})
            except Exception as e:
                print(f"    !! FAILED: {type(e).__name__}: {str(e)[:200]}")
                fails.append((c["key"], c["title"], str(e)[:200]))
                with r.lock:
                    r.recording = False
                    r.frames = []
                try:
                    r._cap.join(timeout=3)
                except Exception:
                    pass
            print(f"    ({time.time()-t0:.0f}s wall)")
    finally:
        r.kill()

    if records:
        build_index(records, args.out)
        with open(os.path.join(args.out, "manifest.json"), "w") as f:
            json.dump({"recorded_at": datetime.now().isoformat(timespec="seconds"),
                       "admin": ADMIN_EMAIL, "clips": records,
                       "failures": fails}, f, indent=2)
    try:
        import shutil
        shutil.rmtree(os.path.join(args.out, "_tmp"), ignore_errors=True)
    except Exception:
        pass

    print(f"\n{'='*56}")
    print(f"recorded {len(records)}/{len(todo)} clips · "
          f"{sum(x['duration'] for x in records)/60:.1f} min video · "
          f"{(time.time()-t_all)/60:.1f} min wall")
    for f in fails:
        print(f"  FAILED {f[0]} {f[1]}: {f[2]}")
    print(f"index: {os.path.join(args.out, 'index.html')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
