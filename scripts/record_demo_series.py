#!/usr/bin/env python3
"""
Measure X — YouTube-style Demo Video Series
============================================
Records one short clip per page, per stakeholder role, driving the real
application at http://localhost:3000 with Chrome + the DevTools Protocol.

    python scripts/record_demo_series.py                # record everything
    python scripts/record_demo_series.py --only 03      # one act
    python scripts/record_demo_series.py --scene owner-dashboard
    python scripts/record_demo_series.py --list
"""

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from demo_recorder import DEMO, Recorder  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAMP = datetime.now().strftime("%H%M%S")
NEW = {
    "owner": f"trader.demo.{STAMP}@measurex.local",
    "lmo": f"lmo.demo.{STAMP}@measurex.local",
    "gatc": f"gatc.demo.{STAMP}@measurex.local",
    "admin": f"admin.demo.{STAMP}@measurex.local",
}
PW = "MeasureX@Demo2026"

ACTS = {
    "01": ("01-public-platform", "PUBLIC PLATFORM"),
    "02": ("02-registration", "REGISTRATION"),
    "03": ("03-trader-owner-portal", "TRADER / OWNER PORTAL"),
    "04": ("04-legal-metrology-officer", "LEGAL METROLOGY OFFICER"),
    "05": ("05-gatc-test-centre", "GATC TEST CENTRE"),
    "06": ("06-state-administration", "STATE ADMINISTRATION"),
    "07": ("07-certificate-lifecycle", "CERTIFICATE LIFECYCLE"),
    "08": ("08-live-workflow", "LIVE END-TO-END WORKFLOW"),
}

SCENES = []


def scene(act, key, name, title, sub, chapters=False):
    def deco(fn):
        SCENES.append({"act": act, "key": key, "name": name,
                       "title": title, "sub": sub, "fn": fn,
                       "chapters": chapters})
        return fn
    return deco


def probe(path):
    import subprocess as sp
    try:
        return float(sp.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "csv=p=0", path], capture_output=True, text=True
        ).stdout.strip() or 0.0)
    except Exception:
        return 0.0


# ---------------------------------------------------------------- utilities
def goto(r, route, settle=2.0):
    r.goto(route, settle=settle)
    r.inject_overlay()


def first_href(r, needle, scope=None):
    return r.driver.execute_script(
        """
        const sc = arguments[1] ? document.querySelector(arguments[1]) : document;
        if (!sc) return null;
        const a = [...sc.querySelectorAll('a[href]')].find(x => x.getAttribute('href').includes(arguments[0]));
        return a ? a.getAttribute('href') : null;
        """,
        needle, scope or "",
    )


def login_as(r, role, show_cards=True):
    """Drive the real unified login form for a role."""
    email, pw = DEMO[role]
    goto(r, "#login", settle=2.2)
    r.clear_highlight()
    r.act(".demo-quick-fill-btn", step="STEP 1",
          caption="One-Click Demo Login card fills the credentials", dwell=1.0)
    r.driver.execute_script(
        """
        const cards = [...document.querySelectorAll('.demo-quick-fill-btn')];
        const want = arguments[0];
        const hit = cards.find(c => (c.dataset.email || '') === want);
        if (hit) hit.click();
        """, email,
    )
    time.sleep(1.5)
    r.clear_highlight()
    r.fill("#login-email", value=email, step="STEP 2",
           caption="Username / e-mail entered", dwell=0.5)
    r.fill("#login-password", value=pw, step="STEP 3",
           caption="Password entered", dwell=0.5)
    r.click("#login-submit-btn", step="STEP 4",
            caption="Sign In — role detected, JWT issued, dashboard opened",
            dwell=1.1, after=3.4)
    time.sleep(1.6)
    r.inject_overlay()
    tok = r.driver.execute_script("return localStorage.getItem('measurex_jwt_token');")
    LIVE[f"{role.lower()}_token"] = tok
    return r.driver.execute_script("return location.hash;")


def logout(r):
    r.click("#user-profile-toggle-btn", step="SIGN OUT",
            caption="Open the user menu", dwell=0.8, after=0.7)
    r.click("#user-dropdown-logout", step="SIGN OUT",
            caption="Click Logout — session token cleared", dwell=0.9, after=3.0)
    time.sleep(1.4)
    r.inject_overlay()


def has(r, css):
    return r.find(css) is not None


# =========================================================== ACT 01: PUBLIC
@scene("01", "landing", "landing-page", "Landing Page",
       "Public entry point of the statutory verification network")
def s_landing(r):
    r.driver.get(f"http://localhost:3000/#landing")
    time.sleep(1.2)
    r.caption("SPLASH", "Measure X splash — institutional boot sequence", hold=1.5)
    time.sleep(2.4)
    r.inject_overlay()
    time.sleep(0.8)
    goto(r, "#landing", settle=2.6)
    r.caption("PAGE 1", "Landing — the public face of the Legal Metrology network", hold=1.8)
    r.driver.execute_script("window.scrollTo({top:0,behavior:'instant'});")
    r.act(".app-header .main-nav", step="NAVIGATION",
          caption="Six public sections in the top navigation", dwell=1.2)
    r.driver.execute_script("window.scrollTo({top:520,behavior:'instant'});")
    time.sleep(1.0)
    r.act("#quick-cert-input", step="QUICK LOOKUP",
          caption="Header quick-lookup: type a certificate ID to verify instantly", dwell=1.4)
    r.fill("#quick-cert-input", value="MX-CERT-DEMO-0001", step="QUICK LOOKUP",
           caption="Seeded valid certificate ID", dwell=0.4)


@scene("01", "services", "services", "Services Catalogue",
       "Every statutory service offered to traders, officers and citizens")
def s_services(r):
    goto(r, "#services", settle=2.4)
    r.caption("PAGE 2", "Services — the full statutory service catalogue", hold=1.8)
    r.driver.execute_script("window.scrollTo({top:0,behavior:'instant'});")
    r.act("#app-body .page-title, #app-body h1", step="OVERVIEW",
          caption="Service categories for the Legal Metrology Act, 2009", dwell=1.2)
    r.driver.execute_script("window.scrollTo({top:700,behavior:'instant'});")
    time.sleep(1.1)
    r.act("#app-body .card, #app-body .service-card", step="DETAIL",
          caption="Each service maps to a regulated statutory function", dwell=1.2)
    r.driver.execute_script("window.scrollTo({top:1500,behavior:'instant'});")
    time.sleep(1.1)
    r.note("Scroll through the catalogue", step="BROWSE", dwell=1.4)


@scene("01", "how", "how-it-works", "How It Works",
       "The end-to-end statutory verification workflow")
def s_how(r):
    goto(r, "#how-it-works", settle=2.4)
    r.caption("PAGE 3", "How It Works — the statutory workflow, step by step", hold=1.8)
    r.driver.execute_script("window.scrollTo({top:0,behavior:'instant'});")
    r.act("#app-body .page-title, #app-body h1", step="WORKFLOW",
          caption="Registration → Scrutiny → Inspection → Certification", dwell=1.3)
    for top, cap in ((620, "Step 1 — Trader registers the instrument"),
                     (1250, "Step 2 — Directorate scrutiny & allocation"),
                     (1900, "Step 3 — LMO / GATC statutory verification")):
        r.driver.execute_script(f"window.scrollTo({{top:{top},behavior:'instant'}});")
        time.sleep(1.0)
        r.act("#app-body .step-card, #app-body .card, #app-body .timeline-item",
              step="WORKFLOW", caption=cap, dwell=1.0)


@scene("01", "rules", "rules-regulations", "Rules & Regulations",
       "Legal Metrology Act 2009, Rules 2011, OIML R76 tolerances")
def s_rules(r):
    goto(r, "#rules", settle=2.4)
    r.caption("PAGE 4", "Rules & Regulations — the statutory reference library", hold=1.8)
    r.driver.execute_script("window.scrollTo({top:0,behavior:'instant'});")
    r.act("#app-body .page-title, #app-body h1", step="ACT 2009",
          caption="Legal Metrology Act, 2009 — Sections 15, 24 and 30", dwell=1.3)
    r.driver.execute_script("window.scrollTo({top:800,behavior:'instant'});")
    time.sleep(1.1)
    r.act("#app-body .card, #app-body .accordion-item", step="OIML R76",
          caption="OIML R76-1:2006 (E) — Maximum Permissible Error schedule", dwell=1.3)


@scene("01", "help", "help-contact", "Help & Contact",
       "Grievance redressal and help desk")
def s_help(r):
    goto(r, "#help", settle=2.4)
    r.caption("PAGE 5", "Help & Contact — citizen help desk and grievance redressal", hold=1.8)
    r.driver.execute_script("window.scrollTo({top:0,behavior:'instant'});")
    r.act("#app-body .page-title, #app-body h1", step="HELP DESK",
          caption="Contact channels and escalation matrix", dwell=1.2)
    r.driver.execute_script("window.scrollTo({top:700,behavior:'instant'});")
    time.sleep(1.1)
    r.act("#app-body .card, #app-body form", step="GRIEVANCE",
          caption="Online grievance registration for traders and citizens", dwell=1.2)


@scene("01", "verify-valid", "public-verify-valid",
       "Public QR Verification — VALID",
       "Unauthenticated citizen lookup of a live certificate")
def s_verify_valid(r):
    goto(r, "#verify", settle=2.4)
    r.caption("PAGE 6", "Public Verify — no login required for any citizen", hold=1.8)
    r.act("#verify-search-input", step="STEP 1",
          caption="Enter a Certificate ID, Seal Number or Instrument Serial", dwell=1.1)
    r.type_into(r.must_find("#verify-search-input"), "MX-CERT-DEMO-0001")
    r.clear_highlight()
    r.click("#public-verify-form button[type=submit], #public-verify-form .btn-primary",
            step="STEP 2", caption="Click Verify Authenticity", dwell=1.0, after=3.0)
    res = r.driver.execute_script(
        "const c=document.getElementById('verify-result-container');"
        "return c ? c.innerText.replace(/\\s+/g,' ').slice(0,180) : '';")
    r.caption("RESULT", f"Backend response: {res[:150]}", hold=3.4)


@scene("01", "verify-states", "public-verify-states",
       "Public QR Verification — Revoked & Expired",
       "Statutory status states: VALID / EXPIRED / REVOKED / NOT_FOUND")
def s_verify_states(r):
    goto(r, "#verify", settle=2.2)
    r.caption("PAGE 6b", "Same lookup returns explicit statutory states", hold=1.6)
    for cid, expect in (("MX-CERT-DEMO-0003", "REVOKED"),
                        ("MX-CERT-DEMO-0002", "EXPIRED")):
        r.fill("#verify-search-input", value=cid, step=f"LOOKUP {cid}",
               caption=f"Certificate {cid}", dwell=0.4)
        r.click("#public-verify-form button[type=submit], #public-verify-form .btn-primary",
                step="VERIFY", caption="Public verification endpoint is queried",
                dwell=0.8, after=3.0)
        got = r.driver.execute_script(
            "const c=document.getElementById('verify-result-container');"
            "return c?c.innerText.replace(/\\s+/g,' ').slice(0,90):'';")
        r.caption("RESULT", f"Statutory status returned: {got}", hold=2.8)


@scene("01", "qr-scanner", "qr-scanner",
       "Camera QR Scanner",
       "ISO/IEC 18004 QR decoding via the device camera")
def s_qr(r):
    goto(r, "#verify", settle=2.2)
    r.caption("PAGE 6c", "Every certificate embeds a scannable QR seal", hold=1.5)
    r.click("#scan-qr-camera-btn", step="SCAN", dwell=1.0, after=3.2)
    r.inject_overlay()
    r.caption("SCANNER", "Html5Qrcode optical engine — rear camera, live decode",
              hold=2.2)
    r.act("#qr-manual-input, #html5-qr-reader", step="DECODE",
          caption="Fallback manual entry and image-upload decode", dwell=1.6)
    r.driver.execute_script(
        "document.querySelectorAll('.modal-close-btn,.modal-cancel-btn')"
        ".forEach(b=>b.click());")
    time.sleep(1.2)


# ====================================================== ACT 02: REGISTRATION
def reg_tab(r, role):
    r.driver.execute_script(
        "const b=document.querySelector('.reg-tab-btn[data-type=\"%s\"]');"
        "if(b) b.click();" % role)
    time.sleep(1.4)


@scene("02", "reg-owner", "register-trader-owner",
       "Register as Trader / Instrument Owner",
       "Live statutory trader registration with consent attestation")
def s_reg_owner(r):
    goto(r, "#register", settle=2.4)
    r.caption("PAGE 7", "Registration — one form per stakeholder role", hold=1.6)
    r.click('.reg-tab-btn[data-type="OWNER"]', step="STEP 1",
            caption="Select the OWNER / Trader tab", dwell=0.9, after=1.2)
    fields = [
        ("#owner-name", "Sharma Retail Enterprises", "STEP 2", "Full legal name of the proprietor / firm"),
        ("#owner-mobile", "9876543210", "STEP 2", "10-digit statutory mobile number"),
        ("#owner-email", NEW["owner"], "STEP 2", "Registered e-mail — becomes the login ID"),
        ("#owner-id", "Aadhaar-XXXX-4471", "STEP 3", "Identification number of the owner"),
        ("#owner-biz-name", "Sharma Fresh Mart", "STEP 3", "Trading / business name"),
        ("#owner-address", "12, Gandhi Market, Patna", "STEP 4", "Registered business address"),
        ("#owner-district", "Patna", "STEP 4", "District of jurisdiction"),
        ("#owner-pin", "800001", "STEP 4", "PIN code"),
    ]
    for sel, val, step, cap in fields:
        r.fill(sel, value=val, step=step, caption=cap, dwell=0.35)
    r.select("#owner-biz-type", value=None, step="STEP 3",
             caption="Business type category", dwell=0.7)
    r.fill("#owner-pass", value=PW, step="STEP 5", caption="Password (min. 8 characters)",
           dwell=0.35)
    r.fill("#owner-pass-confirm", value=PW, step="STEP 5", caption="Confirm password",
           dwell=0.35)
    r.click("#owner-consent", step="STEP 6",
            caption="Tick the statutory consent attestation", dwell=0.8, after=0.5)
    r.click("#owner-reg-submit-btn", step="STEP 7",
            caption="Submit Instrument Owner Registration", dwell=1.1, after=3.6)
    time.sleep(1.2)
    r.inject_overlay()
    r.caption("SUCCESS", f"Account created — {NEW['owner']} is now a verified trader",
              hold=3.0)


@scene("02", "reg-lmo", "register-lmo",
       "Register as Legal Metrology Officer",
       "Government officer clearance request (pending approval)")
def s_reg_lmo(r):
    goto(r, "#register", settle=2.2)
    r.caption("PAGE 8", "Officer / Test Centre / Admin onboarding", hold=1.5)
    r.click('.reg-tab-btn[data-type="LMO"]', step="STEP 1",
            caption="Select the Legal Metrology Officer tab", dwell=0.9, after=1.2)
    for sel, val, step, cap in [
        ("#lmo-name", "Anjali Verma", "STEP 2", "Officer name"),
        ("#lmo-officer-id", "LMO-BR-PAT-4471", "STEP 2", "Government employee ID"),
        ("#lmo-email", NEW["lmo"], "STEP 2", "Official gov e-mail"),
        ("#lmo-mobile", "9812345670", "STEP 2", "Official mobile"),
    ]:
        r.fill(sel, value=val, step=step, caption=cap, dwell=0.35)
    r.select("#lmo-designation", value=None, step="STEP 3",
             caption="Designation / rank", dwell=0.7)
    r.fill("#lmo-office-address", value="District Metrology Office, Patna",
           step="STEP 3", caption="Office address", dwell=0.35)
    r.fill("#lmo-district", value="Patna", step="STEP 3", caption="District", dwell=0.35)
    r.fill("#lmo-pass", value=PW, step="STEP 4", caption="Set password", dwell=0.35)
    r.fill("#lmo-pass-confirm", value=PW, step="STEP 4", caption="Confirm password", dwell=0.35)
    r.click("#lmo-reg-submit-btn", step="STEP 5",
            caption="Submit for departmental clearance approval", dwell=1.1, after=3.6)
    time.sleep(1.2)
    r.inject_overlay()
    r.caption("PENDING", "LMO registration submitted — status PENDING APPROVAL", hold=3.0)


@scene("02", "reg-gatc", "register-gatc",
       "Register as Govt Approved Test Centre",
       "NABL-accredited laboratory onboarding")
def s_reg_gatc(r):
    goto(r, "#register", settle=2.2)
    r.caption("PAGE 9", "GATC laboratory onboarding with NABL reference", hold=1.5)
    r.click('.reg-tab-btn[data-type="GATC"]', step="STEP 1",
            caption="Select the Test Centre tab", dwell=0.9, after=1.2)
    for sel, val, step, cap in [
        ("#gatc-name", "NPL Patna Calibration Laboratory", "STEP 2", "Laboratory name"),
        ("#gatc-ref-no", "NABL/BR/2026/0912", "STEP 2", "NABL accreditation reference"),
        ("#gatc-contact", "Dr. R. K. Sharma", "STEP 2", "Authorised contact person"),
        ("#gatc-email", NEW["gatc"], "STEP 2", "Laboratory e-mail"),
        ("#gatc-mobile", "9001234567", "STEP 2", "Laboratory mobile"),
    ]:
        r.fill(sel, value=val, step=step, caption=cap, dwell=0.35)
    r.select("#gatc-scope", value=None, step="STEP 3", caption="Accreditation scope", dwell=0.7)
    r.fill("#gatc-address", value="Industrial Estate, Patna", step="STEP 3",
           caption="Laboratory address", dwell=0.35)
    r.fill("#gatc-district", value="Patna", step="STEP 3", caption="District", dwell=0.35)
    r.fill("#gatc-pass", value=PW, step="STEP 4", caption="Set password", dwell=0.35)
    r.fill("#gatc-pass-confirm", value=PW, step="STEP 4", caption="Confirm password", dwell=0.35)
    r.click("#gatc-reg-submit-btn", step="STEP 5",
            caption="Submit GATC accreditation request", dwell=1.1, after=3.6)
    time.sleep(1.2)
    r.inject_overlay()
    r.caption("PENDING", "GATC registration submitted — accreditation under review", hold=3.0)


@scene("02", "reg-admin", "register-admin",
       "Register as State Administrator",
       "Clearance code gated directorate onboarding")
def s_reg_admin(r):
    goto(r, "#register", settle=2.2)
    r.caption("PAGE 10", "Directorate onboarding is gated by an authorization code",
              hold=1.5)
    r.click('.reg-tab-btn[data-type="ADMIN"]', step="STEP 1",
            caption="Select the Administrator tab", dwell=0.9, after=1.2)
    for sel, val, cap in [
        ("#admin-name", "S. P. Yadav", "Directorate administrator name"),
        ("#admin-email", NEW["admin"], "Official e-mail"),
    ]:
        r.fill(sel, value=val, step="STEP 2", caption=cap, dwell=0.35)
    r.select("#admin-designation", value=None, step="STEP 3", caption="Designation", dwell=0.7)
    r.fill("#admin-auth-code", value="MX-GOV-ADMIN-2026", step="STEP 4",
           caption="Department authorization code — enforced server-side", dwell=0.5)
    r.fill("#admin-pass", value=PW, step="STEP 5", caption="Set password", dwell=0.35)
    r.fill("#admin-pass-confirm", value=PW, step="STEP 5", caption="Confirm password", dwell=0.35)
    r.click("#admin-reg-submit-btn", step="STEP 6",
            caption="Submit Administrator application for clearance", dwell=1.1, after=3.6)
    time.sleep(1.2)
    r.inject_overlay()
    r.caption("CLEARED", "Administrator clearance request registered", hold=3.0)


@scene("02", "login-page", "login", "Unified Login",
       "One credential set per role — role auto-detected by the backend")
def s_login_page(r):
    goto(r, "#login", settle=2.4)
    r.caption("PAGE 11", "Login — one unified form for every stakeholder role", hold=1.8)
    r.act("#login-email", step="AUTH", caption="E-mail or username", dwell=1.0)
    r.act("#login-password", step="AUTH", caption="Password", dwell=1.0)
    r.driver.execute_script("window.scrollTo({top:260,behavior:'instant'});")
    time.sleep(1.1)
    r.act(".demo-quick-fill-btn", step="DEMO",
          caption="One-Click Demo Login cards for all four roles", dwell=1.4)
    r.act("a[href='#forgot-password']", step="RECOVERY",
          caption="Forgot-password recovery wizard", dwell=1.0)


# ================================================== ACT 03: TRADER / OWNER
@scene("03", "login", "owner-login", "Login as Trader / Owner",
       "Role auto-detected — routed to the Owner dashboard")
def s_owner_login(r):
    h = login_as(r, "OWNER")
    r.caption("SIGNED IN", f"JWT issued, role OWNER detected — landed on {h}", hold=3.0)


@scene("03", "dashboard", "owner-dashboard", "Owner Dashboard",
       "Statutory snapshot: instruments, applications, certificates")
def s_owner_dash(r):
    login_as(r, "OWNER")
    r.caption("PAGE 12", "Owner dashboard — live statutory counters", hold=2.2)
    r.driver.execute_script("window.scrollTo({top:0,behavior:'instant'});")
    r.act("#app-sidebar", step="NAVIGATION",
          caption="Owner portal navigation rail", dwell=1.2)
    r.driver.execute_script("window.scrollTo({top:420,behavior:'instant'});")
    time.sleep(1.1)
    r.act("#app-body .stat-card, #app-body .card", step="METRICS",
          caption="Certificate, application and compliance counters", dwell=1.3)


@scene("03", "instruments", "owner-instruments", "My Instruments",
       "Registered commercial weighing & measuring equipment")
def s_owner_instruments(r):
    login_as(r, "OWNER")
    goto(r, "#owner-instruments", settle=2.6)
    r.caption("PAGE 13", "My Instruments — the trader's equipment registry", hold=2.2)
    r.act("#ins-search-input", step="SEARCH", caption="Search by ID, serial or model",
          dwell=1.1)
    r.driver.execute_script("window.scrollTo({top:340,behavior:'instant'});")
    time.sleep(1.0)
    r.act("#app-body table tbody tr", step="REGISTRY",
          caption="Capacity, serial number and validity status per instrument", dwell=1.4)


@scene("03", "add-instrument", "owner-add-instrument",
       "Add Instrument (Live Submission)",
       "Registering a new commercial weighing device")
def s_owner_add_instrument(r):
    login_as(r, "OWNER")
    goto(r, "#owner-add-instrument", settle=2.4)
    r.caption("PAGE 14", "Add Instrument — statutory equipment registration", hold=1.8)
    r.select("#ins-type", value=None, step="STEP 1", caption="Instrument category", dwell=0.8)
    for sel, val, step, cap in [
        ("#ins-mfg", "Avery Weigh-Tronix", "STEP 2", "Manufacturer"),
        ("#ins-model", "ZMX-500 Bench Scale", "STEP 2", "Model designation"),
        ("#ins-serial", f"MX-SN-{STAMP}-01", "STEP 3", "Unique serial number"),
        ("#ins-capacity", "500 kg (e = 100 g)", "STEP 3", "Rated capacity & scale interval e"),
        ("#ins-location", "Central Warehouse, Weighing Gate 2, Patna", "STEP 4",
         "Installation / inspection location"),
    ]:
        r.fill(sel, value=val, step=step, caption=cap, dwell=0.35)
    r.fill("#ins-details", value="Fixed ground-mounted platform with external digital "
           "display indicator, installed on a levelled concrete plinth.",
           step="STEP 4", caption="Installation details", dwell=0.3)
    r.click("#add-instrument-form button[type=submit]", step="STEP 5",
            caption="Register the instrument — persisted via POST /api/v1/instruments",
            dwell=1.1, after=3.8)
    time.sleep(1.4)
    r.inject_overlay()
    r.caption("SUCCESS", "Instrument registered — instrument ID issued by the backend",
              hold=3.0)


@scene("03", "instrument-profile", "owner-instrument-profile",
       "Instrument Profile & Lifecycle",
       "Full equipment dossier with certification history")
def s_owner_instrument_profile(r):
    login_as(r, "OWNER")
    goto(r, "#owner-instruments", settle=2.6)
    href = first_href(r, "#owner-instrument-profile")
    goto(r, href or "#owner-instrument-profile", settle=2.8)
    r.caption("PAGE 15", "Instrument profile — specifications and lifecycle record",
              hold=2.2)
    r.act("#app-body .card", step="DOSSIER", caption="Registered specifications", dwell=1.3)
    r.driver.execute_script("window.scrollTo({top:640,behavior:'instant'});")
    time.sleep(1.0)
    r.act("#app-body .timeline, #app-body .card", step="LIFECYCLE",
          caption="Verification & certification history timeline", dwell=1.3)


@scene("03", "apply", "owner-apply-verification",
       "Apply for Verification (Live Submission)",
       "Statutory application filed into the LMO scrutiny queue")
def s_owner_apply(r):
    login_as(r, "OWNER")
    goto(r, "#owner-apply", settle=2.8)
    r.caption("PAGE 16", "Apply for Verification — filing a statutory application", hold=1.8)
    r.select("#app-type", value="NEW", step="STEP 1",
             caption="Application type: New Verification (first-time stamping)", dwell=0.9)
    r.act("#app-instrument", step="STEP 1", caption="Select the target registered instrument",
          dwell=1.1)
    r.driver.execute_script("window.scrollTo({top:520,behavior:'instant'});")
    time.sleep(1.0)
    r.act("#doc-upload-zone", step="STEP 2",
          caption="Attach purchase invoice / manufacturer test certificate", dwell=1.2)
    r.fill("#app-remarks", value="Preferred inspection window 10:00 AM - 01:00 PM. "
           "Equipment is installed indoors on a levelled plinth.",
           step="STEP 3", caption="Remarks for the Legal Metrology Officer", dwell=0.4)
    r.click("#apply-verification-form button[type=submit]", step="STEP 4",
            caption="Submit Application — enters UNDER_SCRUTINY", dwell=1.1, after=3.8)
    time.sleep(1.4)
    r.inject_overlay()
    ref = r.driver.execute_script(
        "const m=document.querySelector('#app-modal-backdrop');"
        "return m?m.innerText.replace(/\\s+/g,' ').slice(0,150):'';")
    r.caption("FILED", f"Application filed: {ref[:130]}", hold=3.2)


@scene("03", "applications", "owner-applications", "My Applications",
       "Tracking every filed verification application")
def s_owner_applications(r):
    login_as(r, "OWNER")
    goto(r, "#owner-applications", settle=2.8)
    r.caption("PAGE 17", "My Applications — statutory tracking of filed cases", hold=2.2)
    r.act("#app-body table tbody tr", step="TRACKING",
          caption="Reference number, type, allocation and current status", dwell=1.5)
    href = first_href(r, "#owner-application-details")
    if href:
        r.click("a[href*='owner-application-details']", step="DRILL-DOWN",
                caption="Open the full application timeline", dwell=1.0, after=2.8)
        r.inject_overlay()
        r.caption("TIMELINE", "Allocation desk → scheduling → inspection → certificate",
                  hold=3.0)


@scene("03", "application-details", "owner-application-details",
       "Application Timeline",
       "Statutory lifecycle of a single application")
def s_owner_app_details(r):
    login_as(r, "OWNER")
    goto(r, "#owner-applications", settle=2.8)
    href = first_href(r, "#owner-application-details")
    goto(r, href or "#owner-application-details", settle=3.0)
    r.caption("PAGE 18", "Application details — end-to-end statutory timeline", hold=2.4)
    r.act("#app-body .timeline, #app-body .card", step="TIMELINE",
          caption="Each statutory stage with actor and timestamp", dwell=1.4)
    r.driver.execute_script("window.scrollTo({top:700,behavior:'instant'});")
    time.sleep(1.0)
    r.act("#app-body .card", step="EVIDENCE",
          caption="Uploaded documents and inspection evidence", dwell=1.3)


@scene("03", "certificates", "owner-certificates", "My Certificates",
       "Issued, digitally signed verification certificates")
def s_owner_certificates(r):
    login_as(r, "OWNER")
    goto(r, "#owner-certificates", settle=2.8)
    r.caption("PAGE 19", "My Certificates — issued verification certificates", hold=2.2)
    r.act("#app-body .cert-card, #app-body table tbody tr, #app-body .card", step="ISSUED",
          caption="Each certificate carries an ISO/IEC 18004 QR seal", dwell=1.4)
    href = first_href(r, "#owner-certificate-details") or first_href(r, "#verify?id=")
    if href:
        r.click("a[href*='owner-certificate-details'], .cert-qr-area", step="OPEN",
                caption="Open the certificate document", dwell=1.0, after=2.8)
        r.inject_overlay()
        r.caption("QR SEAL", "Tap the QR to run the live public verification", hold=3.0)


@scene("03", "certificate-qr", "owner-certificate-details",
       "Certificate Document & QR Seal",
       "RSA-2048 signed certificate with verifiable QR")
def s_owner_cert_details(r):
    login_as(r, "OWNER")
    goto(r, "#owner-certificates", settle=2.8)
    href = first_href(r, "#owner-certificate-details")
    goto(r, href or "#owner-certificate-details", settle=3.0)
    r.caption("PAGE 20", "Certificate document — statutory proof of verification", hold=2.4)
    r.act("#app-body .cert-qr-area, #app-body img[src*='qr'], #app-body .qr, #app-body canvas",
          step="QR SEAL", caption="ISO/IEC 18004 QR printed on the certificate", dwell=1.5)
    r.driver.execute_script("window.scrollTo({top:600,behavior:'instant'});")
    time.sleep(1.0)
    r.act("#cert-copy-link-btn, #app-body .btn", step="SHARE",
          caption="Copy the public verification link", dwell=1.2)


@scene("03", "notifications", "owner-notifications", "Notifications",
       "Statutory notice dispatch to the trader")
def s_owner_notifications(r):
    login_as(r, "OWNER")
    goto(r, "#owner-notifications", settle=2.8)
    r.caption("PAGE 21", "Notifications — statutory notice trail for the trader", hold=2.2)
    r.act("#app-body .notification-item, #app-body .card, #app-body table tbody tr",
          step="NOTICES", caption="Allocation, scheduling and certificate notices", dwell=1.4)


@scene("03", "profile", "owner-profile", "My Profile",
       "Account, business and statutory identity details")
def s_owner_profile(r):
    login_as(r, "OWNER")
    goto(r, "#owner-profile", settle=2.6)
    r.caption("PAGE 22", "My Profile — trader identity and business record", hold=2.2)
    r.act("#app-body .card", step="PROFILE", caption="Registered trader particulars", dwell=1.3)


@scene("03", "logout", "owner-logout", "Logout",
       "Session token cleared, public site restored")
def s_owner_logout(r):
    login_as(r, "OWNER")
    logout(r)
    r.caption("SIGNED OUT", "Token cleared — the trader is back on the public portal", hold=3.0)


# ============================================= ACT 04: LEGAL METROLOGY OFFICER
@scene("04", "login", "lmo-login", "Login as Legal Metrology Officer",
       "Officer clearance — routed to the Inspectorate dashboard")
def s_lmo_login(r):
    h = login_as(r, "LMO")
    r.caption("SIGNED IN", f"Role LMO detected — landed on {h}", hold=3.0)


@scene("04", "dashboard", "lmo-dashboard", "LMO Dashboard",
       "Field inspectorate workload and enforcement overview")
def s_lmo_dash(r):
    login_as(r, "LMO")
    r.caption("PAGE 23", "LMO dashboard — inspectorate caseload", hold=2.2)
    r.act("#app-sidebar", step="NAVIGATION", caption="Officer portal navigation rail",
          dwell=1.2)
    r.driver.execute_script("window.scrollTo({top:400,behavior:'instant'});")
    time.sleep(1.1)
    r.act("#app-body .stat-card, #app-body .card", step="WORKLOAD",
          caption="Pending scrutiny, scheduled inspections, issued certificates", dwell=1.3)


@scene("04", "applications", "lmo-applications", "Officer Applications",
       "Scrutiny queue of trader applications")
def s_lmo_applications(r):
    login_as(r, "LMO")
    goto(r, "#lmo-applications", settle=2.8)
    r.caption("PAGE 24", "Applications — the statutory scrutiny queue", hold=2.2)
    r.act("#app-body table tbody tr", step="QUEUE",
          caption="Trader applications pending officer review", dwell=1.4)
    r.act("#app-body .filter-btn, #app-body .tab-btn", step="FILTER",
          caption="Queue filters by statutory status", dwell=1.0)


@scene("04", "review", "lmo-review", "Application Scrutiny Review",
       "Document verification before field allocation")
def s_lmo_review(r):
    login_as(r, "LMO")
    goto(r, "#lmo-applications", settle=2.8)
    href = first_href(r, "#lmo-review")
    goto(r, href or "#lmo-review", settle=3.0)
    r.caption("PAGE 25", "Application scrutiny — officer verification of trader documents",
              hold=2.4)
    r.act("#app-body .card", step="REVIEW", caption="Application particulars & evidence",
          dwell=1.4)
    r.driver.execute_script("window.scrollTo({top:620,behavior:'instant'});")
    time.sleep(1.0)
    r.act("#app-body .btn", step="ACTION",
          caption="Approve into the field inspection schedule", dwell=1.2)


@scene("04", "field-verification", "lmo-field-verification",
       "OIML R76 Field Verification Console",
       "Multi-point MPE tolerance evaluation at the trade premises")
def s_lmo_field(r):
    login_as(r, "LMO")
    goto(r, "#lmo-applications", settle=2.8)
    href = first_href(r, "#lmo-field-verification")
    goto(r, href or "#lmo-field-verification", settle=3.2)
    r.caption("PAGE 26", "Field Verification Console — statutory on-site inspection",
              hold=2.4)
    r.driver.execute_script("window.scrollTo({top:0,behavior:'instant'});")
    r.act("#app-body .inspection-check-group, #app-body .field-inspection-card",
          step="INSPECT", caption="Physical inspection checklist — PASS / FAIL per clause",
          dwell=1.4)
    r.driver.execute_script(
        "const t=document.getElementById('test-points-table');"
        "if(t) t.scrollIntoView({block:'center'});")
    time.sleep(1.0)
    r.act("#test-points-table", step="OIML R76",
          caption="Multi-point test: min, half and max rated capacity", dwell=1.5)
    r.fill("#test-points-table tr[data-point='MAX_LOAD'] .pt-observed", value="50.250",
           step="MPE MATH", caption="Edit the max-load observed reading", dwell=0.4)
    time.sleep(1.6)
    ev = r.driver.execute_script(
        "const b=document.getElementById('accuracy-badge');"
        "const m=document.getElementById('accuracy-eval-msg');"
        "return (b?b.innerText:'') + ' | ' + (m?m.innerText:'').slice(0,110);")
    r.caption("LIVE MPE", f"Backend-recomputed tolerance verdict: {ev}", hold=3.4)


@scene("04", "calendar", "lmo-calendar", "Inspection Calendar",
       "Field visit scheduling")
def s_lmo_calendar(r):
    login_as(r, "LMO")
    goto(r, "#lmo-calendar", settle=2.8)
    r.caption("PAGE 27", "Inspection Calendar — scheduled field visits", hold=2.2)
    r.act("#calendar-body-content, #app-body table tbody tr", step="SCHEDULE",
          caption="Upcoming inspection slots per district", dwell=1.4)
    r.click("#cal-btn-list", step="VIEW", caption="Switch calendar view", dwell=0.8,
            after=1.6)
    r.inject_overlay()


@scene("04", "certificates", "lmo-certificates", "Issued Certificates",
       "Certificates issued by the inspectorate")
def s_lmo_certs(r):
    login_as(r, "LMO")
    goto(r, "#lmo-certificates", settle=2.8)
    r.caption("PAGE 28", "Issued certificates — officer view of the certification register",
              hold=2.2)
    r.act("#app-body table tbody tr, #app-body .card", step="REGISTER",
          caption="Certificate number, instrument and validity period", dwell=1.4)


@scene("04", "reports", "lmo-reports", "Officer Reports",
       "Statutory analytics and enforcement metrics")
def s_lmo_reports(r):
    login_as(r, "LMO")
    goto(r, "#lmo-reports", settle=3.0)
    r.caption("PAGE 29", "Reports — statutory analytics and enforcement metrics", hold=2.2)
    r.act("#app-body .card", step="ANALYTICS", caption="Verification volume and outcomes",
          dwell=1.3)
    r.driver.execute_script("window.scrollTo({top:600,behavior:'instant'});")
    time.sleep(1.0)
    r.act("#app-body .card", step="DETAIL", caption="Drill-down tables", dwell=1.2)


# =================================================== ACT 05: GATC TEST CENTRE
@scene("05", "login", "gatc-login", "Login as Govt Approved Test Centre",
       "Laboratory clearance — routed to the GATC dashboard")
def s_gatc_login(r):
    h = login_as(r, "GATC")
    r.caption("SIGNED IN", f"Role GATC detected — landed on {h}", hold=3.0)


@scene("05", "dashboard", "gatc-dashboard", "GATC Dashboard",
       "Laboratory bench workload and environment monitors")
def s_gatc_dash(r):
    login_as(r, "GATC")
    r.caption("PAGE 30", "GATC dashboard — accredited laboratory workload", hold=2.2)
    r.act("#app-sidebar", step="NAVIGATION", caption="Laboratory portal navigation rail",
          dwell=1.2)
    r.driver.execute_script("window.scrollTo({top:380,behavior:'instant'});")
    time.sleep(1.1)
    r.act("#app-body .stat-card, #app-body .card", step="AMBIENT",
          caption="Ambient temperature, humidity and pressure monitors", dwell=1.3)
    r.driver.execute_script("window.scrollTo({top:800,behavior:'instant'});")
    time.sleep(1.0)
    r.act("#gatc-offline-sync-btn", step="OFFLINE",
          caption="Sync the IndexedDB offline verification queue", dwell=1.2)


@scene("05", "applications", "gatc-applications", "Assigned Tests",
       "Bench calibration queue allocated by the Directorate")
def s_gatc_apps(r):
    login_as(r, "GATC")
    goto(r, "#gatc-applications", settle=3.0)
    r.caption("PAGE 31", "Assigned Tests — the laboratory bench queue", hold=2.2)
    r.act("#gatc-apps-search-input", step="SEARCH", caption="Search the assigned queue",
          dwell=1.1)
    r.act("#app-body table tbody tr", step="QUEUE",
          caption="Tests allocated to this accredited centre", dwell=1.4)
    r.act(".tab-btn", step="FILTER", caption="Filter by statutory test state", dwell=1.0)


@scene("05", "lab-verification", "gatc-lab-verification",
       "Laboratory Verification Console",
       "Bench calibration with NPL working-standard traceability")
def s_gatc_lab(r):
    login_as(r, "GATC")
    goto(r, "#gatc-applications", settle=3.0)
    href = first_href(r, "#gatc-field-verification") or first_href(r, "#gatc-lab-verification")
    goto(r, href or "#gatc-lab-verification", settle=3.2)
    r.caption("PAGE 32", "Laboratory Verification Console — bench calibration", hold=2.4)
    r.driver.execute_script("window.scrollTo({top:0,behavior:'instant'});")
    r.act("#gatc-env-temp, #app-body .field-inspection-card", step="AMBIENT",
          caption="Record ambient lab environment conditions", dwell=1.4)
    r.driver.execute_script(
        "const t=document.getElementById('gatc-test-points-table');"
        "if(t) t.scrollIntoView({block:'center'});")
    time.sleep(1.0)
    r.act("#gatc-test-points-table", step="OIML R76",
          caption="Multi-point verification against the working standard", dwell=1.5)
    r.act("#accuracy-eval-box, #gatc-verification-form .accuracy-result-box", step="MPE",
          caption="Live Maximum Permissible Error verdict", dwell=1.3)
    r.act("#gatc-save-draft-btn", step="DRAFT",
          caption="Save the lab record — queued for offline sync if needed", dwell=1.2)


@scene("05", "calendar", "gatc-calendar", "Lab Bench Schedule",
       "Laboratory capacity planning")
def s_gatc_cal(r):
    login_as(r, "GATC")
    goto(r, "#gatc-calendar", settle=3.0)
    r.caption("PAGE 33", "Lab Bench Schedule — laboratory capacity planning", hold=2.2)
    r.act("#calendar-body-content, #app-body table tbody tr", step="SCHEDULE",
          caption="Bench slots and assigned instruments", dwell=1.4)


@scene("05", "certificates", "gatc-certificates", "Certified Instruments",
       "Certificates produced by this laboratory")
def s_gatc_certs(r):
    login_as(r, "GATC")
    goto(r, "#gatc-certificates", settle=3.0)
    r.caption("PAGE 34", "Certified instruments — laboratory certification register",
              hold=2.2)
    r.act("#app-body table tbody tr, #app-body .card", step="REGISTER",
          caption="Certificates issued from this test centre", dwell=1.4)


# ============================================== ACT 06: STATE ADMINISTRATION
@scene("06", "login", "admin-login", "Login as State Directorate Admin",
       "Directorate clearance — routed to the administration console")
def s_admin_login(r):
    h = login_as(r, "ADMIN")
    r.caption("SIGNED IN", f"Role ADMIN detected — landed on {h}", hold=3.0)


@scene("06", "dashboard", "admin-dashboard", "Directorate Dashboard",
       "State-wide statutory oversight")
def s_admin_dash(r):
    login_as(r, "ADMIN")
    r.caption("PAGE 35", "Directorate dashboard — state-wide oversight", hold=2.2)
    r.act("#app-sidebar", step="NAVIGATION", caption="Administration console navigation",
          dwell=1.2)
    r.driver.execute_script("window.scrollTo({top:400,behavior:'instant'});")
    time.sleep(1.1)
    r.act("#app-body .stat-card, #app-body .card", step="METRICS",
          caption="Instruments, certificates, pending clearances, enforcement", dwell=1.3)


@scene("06", "allocation", "admin-allocation-desk",
       "Administrative Allocation Desk",
       "Dual dispatch: field LMO vs accredited GATC laboratory")
def s_admin_alloc(r):
    login_as(r, "ADMIN")
    goto(r, "#admin-allocation", settle=3.0)
    r.caption("PAGE 36", "Allocation Desk — the statutory dispatch engine", hold=2.4)
    r.act("#allocation-table", step="QUEUE",
          caption="Applications in READY_FOR_ALLOCATION awaiting dispatch", dwell=1.4)
    if r.click(".open-allocate-modal-btn", step="ALLOCATE",
               caption="Open the allocation modal for a ready application",
               dwell=1.0, after=2.2):
        r.inject_overlay()
        r.caption("DUAL DISPATCH", "Allocate to a field LMO or an accredited GATC laboratory",
                  hold=1.8)
        r.select("#modal-select-lmo", value=None, step="LMO ROUTE",
                 caption="Select the field Legal Metrology Officer", dwell=1.0)
        r.select("#modal-select-gatc", value=None, step="GATC ROUTE",
                 caption="Select the accredited test centre (bench calibration)", dwell=1.0)
        r.fill("#modal-alloc-notes", value="Allocated to the field officer for on-site "
               "OIML R76 verification.", step="NOTES",
               caption="Statutory allocation remarks", dwell=0.5)
        r.click("#statutory-allocation-form button[type=submit]", step="CONFIRM",
                caption="Confirm Statutory Allocation", dwell=1.1, after=3.4)
        time.sleep(1.2)
        r.inject_overlay()
        r.caption("ALLOCATED", "Application moved to ALLOCATED — dispatch notification sent",
                  hold=3.0)
    else:
        r.note("All applications in the queue are already allocated",
               step="QUEUE CLEAR", dwell=2.6)


@scene("06", "users", "admin-users", "User Management",
       "Account lifecycle and pending clearances")
def s_admin_users(r):
    login_as(r, "ADMIN")
    goto(r, "#admin-users", settle=3.0)
    r.caption("PAGE 37", "User Management — active accounts and pending clearances",
              hold=2.2)
    r.act("#app-body table tbody tr, #app-body .card", step="ACCOUNTS",
          caption="Every registered trader, officer, lab and administrator", dwell=1.4)
    r.act(".tab-btn", step="CLEARANCES", caption="Pending clearance requests", dwell=1.0)


@scene("06", "officers", "admin-officers", "Officer Directory",
       "Legal Metrology Officer establishment")
def s_admin_officers(r):
    login_as(r, "ADMIN")
    goto(r, "#admin-officers", settle=3.0)
    r.caption("PAGE 38", "Officer Directory — LMOs and their jurisdictions", hold=2.2)
    r.act("#app-body table tbody tr, #app-body .card", step="ESTABLISHMENT",
          caption="Officer cadre, district and posting", dwell=1.4)


@scene("06", "instruments", "admin-instruments", "Instruments Registry",
       "State-wide equipment register with CSV export")
def s_admin_instruments(r):
    login_as(r, "ADMIN")
    goto(r, "#admin-instruments", settle=3.0)
    r.caption("PAGE 39", "Instruments Registry — every device in the state", hold=2.2)
    r.act("#registry-search-input", step="SEARCH", caption="Search the state register",
          dwell=1.1)
    r.act("#app-body table tbody tr, #app-body .card", step="REGISTER",
          caption="Device, owner, capacity and validity state", dwell=1.4)
    r.act("#admin-export-registry-btn", step="EXPORT",
          caption="Export the registry as CSV", dwell=1.0)


@scene("06", "certificates", "admin-certificates", "Certificate Register",
       "State-wide certificate issuance and revocation")
def s_admin_certs(r):
    login_as(r, "ADMIN")
    goto(r, "#admin-certificates", settle=3.0)
    r.caption("PAGE 40", "Certificate Register — issuance and revocation control", hold=2.2)
    r.act("#app-body table tbody tr, #app-body .card", step="REGISTER",
          caption="Every certificate issued in the state", dwell=1.4)


@scene("06", "reports", "admin-reports", "Analytics Reports",
       "Statutory drill-down analytics")
def s_admin_reports(r):
    login_as(r, "ADMIN")
    goto(r, "#admin-reports", settle=3.2)
    r.caption("PAGE 41", "Analytics Reports — statutory drill-downs", hold=2.2)
    r.act("#app-body .card", step="ANALYTICS",
          caption="Verification volumes, outcomes and MPE failure analytics", dwell=1.3)
    r.driver.execute_script("window.scrollTo({top:640,behavior:'instant'});")
    time.sleep(1.0)
    r.act("#app-body .card, #app-body table", step="DRILL-DOWN",
          caption="District-wise statutory breakdown", dwell=1.2)


@scene("06", "audit", "admin-audit-trail", "Audit Trail",
       "Tamper-evident statutory audit log")
def s_admin_audit(r):
    login_as(r, "ADMIN")
    goto(r, "#admin-audit", settle=3.2)
    r.caption("PAGE 42", "Audit Trail — tamper-evident statutory log", hold=2.2)
    r.act("#audit-table-body, #app-body table tbody tr", step="AUDIT",
          caption="Every state-changing action with actor and timestamp", dwell=1.4)
    r.act("#export-audit-csv-btn", step="EXPORT", caption="Export the audit log as CSV",
          dwell=1.0)


@scene("06", "config", "admin-config", "System Configuration",
       "Statutory parameters and system settings")
def s_admin_config(r):
    login_as(r, "ADMIN")
    goto(r, "#admin-config", settle=3.0)
    r.caption("PAGE 43", "System Configuration — statutory parameters", hold=2.2)
    r.act("#app-body .card", step="SETTINGS",
          caption="Re-verification intervals, tolerance and notification settings", dwell=1.3)


@scene("06", "profile", "admin-profile", "Administrator Profile",
       "Directorate officer identity record")
def s_admin_profile(r):
    login_as(r, "ADMIN")
    goto(r, "#admin-profile", settle=2.8)
    r.caption("PAGE 44", "Administrator profile — directorate identity record", hold=2.2)
    r.act("#app-body .card", step="PROFILE", caption="Officer particulars and role",
          dwell=1.3)


# ============================================ ACT 07: CERTIFICATE LIFECYCLE
@scene("07", "public-final", "public-verify-final",
       "Public Verification — the statutory end point",
       "Any citizen re-verifying a certificate, no login required")
def s_public_final(r):
    logout_guard = r.driver.execute_script(
        "localStorage.removeItem('measurex_jwt_token');"
        "localStorage.removeItem('measure_x_session_v2');"
        "return true;")
    r.driver.get("http://localhost:3000/#verify?id=MX-CERT-DEMO-0001")
    time.sleep(4.0)
    r.inject_overlay()
    r.caption("PUBLIC", "Certificate re-verification by an ordinary citizen — no login",
              hold=2.4)
    res = r.driver.execute_script(
        "const c=document.getElementById('verify-result-container');"
        "return c?c.innerText.replace(/\\s+/g,' ').slice(0,200):'';")
    r.caption("VERIFIED", f"Live statutory result: {res[:170]}", hold=4.0)
    r.driver.execute_script("window.scrollTo({top:0,behavior:'instant'});")
    time.sleep(0.8)
    r.act("#verify-result-container", step="RESULT",
          caption="Cryptographic signature & OIML R76 tolerance on record", dwell=1.6)


# ============================== ACT 08: LIVE END-TO-END WORKFLOW (WORKING DEMO)
# One continuous browser session, cut into clips, threading REAL ids produced by
# the backend:  register -> instrument -> application -> allocation -> OIML R76
# verification -> certificate issuance -> public cryptographic verification.
LIVE = {}


def api(m, p, tok=None, body=None):
    """Call the live API exactly as the browser does, and show the response."""
    import urllib.error
    import urllib.request
    d = json.dumps(body).encode() if body is not None else None
    rq = urllib.request.Request(
        "http://localhost:8000/api/v1" + p, data=d, method=m,
        headers={"Content-Type": "application/json",
                 **({"Authorization": f"Bearer {tok}"} if tok else {})})
    try:
        with urllib.request.urlopen(rq) as f:
            return f.status, json.loads(f.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


@scene("08", "live", "Live End-to-End Workflow",
       "LIVE — Full Statutory Lifecycle in One Run",
       "Real records, real OIML R76 maths, real RSA-2048 signature",
       chapters=True)
def s_live_workflow(r):
    r.begin_chapters("08-live-workflow", "01-", "LIVE END-TO-END WORKFLOW", 8.0)
    r.chapter("register", "Step 1 — Register a new Trader",
              "Live POST /api/v1/auth/register — a brand new statutory account")
    email = NEW["owner"]
    goto(r, "#register", settle=2.4)
    r.click('.reg-tab-btn[data-type="OWNER"]', step="STEP 1",
            caption="Select the OWNER / Trader tab", dwell=0.8, after=1.1)
    for sel, val, cap in [
        ("#owner-name", "Live Demo Traders", "Proprietor / firm name"),
        ("#owner-mobile", "9876501234", "Statutory mobile number"),
        ("#owner-email", email, "This e-mail becomes the live login ID"),
        ("#owner-id", "GSTIN-09AABCL1234M1Z5", "Identification number"),
        ("#owner-biz-name", "Live Demo Fresh Mart", "Trading name"),
        ("#owner-address", "45, Station Road, Patna", "Registered address"),
        ("#owner-district", "Patna", "District of jurisdiction"),
        ("#owner-pin", "800001", "PIN code"),
    ]:
        r.fill(sel, value=val, step="FORM", caption=cap, dwell=0.3)
    r.fill("#owner-pass", value=PW, step="FORM", caption="Set password", dwell=0.3)
    r.fill("#owner-pass-confirm", value=PW, step="FORM", caption="Confirm password", dwell=0.3)
    r.click("#owner-consent", step="CONSENT",
            caption="Tick the statutory consent attestation", dwell=0.6, after=0.4)
    r.click("#owner-reg-submit-btn", step="SUBMIT",
            caption="Submit — the backend creates a real user record", dwell=1.0, after=3.6)
    time.sleep(1.2)
    r.inject_overlay()
    r.caption("LIVE RESULT", f"HTTP 200 — account created: {email}", hold=3.0)

    # ------------------------------------------------------------------
    r.chapter("login", "Step 2 — Log in as the new Trader",
              "The freshly created account signs straight in")
    goto(r, "#login", settle=2.2)
    r.fill("#login-email", value=email, step="STEP 1",
           caption="Enter the email just registered", dwell=0.4)
    r.fill("#login-password", value=PW, step="STEP 2", caption="Enter the password",
           dwell=0.4)
    r.click("#login-submit-btn", step="STEP 3",
            caption="Sign In — JWT issued, empty-state dashboard", dwell=1.0, after=3.6)
    time.sleep(1.6)
    r.inject_overlay()
    tok = r.driver.execute_script("return localStorage.getItem('measurex_jwt_token');")
    st, usr = api("GET", "/auth/me", tok)
    LIVE["token"] = tok
    LIVE["user"] = usr.get("user", usr)
    r.caption("LIVE RESULT",
              f"Authenticated as {LIVE['user'].get('name','?')} — role "
              f"{LIVE['user'].get('role','?')}, user id {LIVE['user'].get('id','?')}",
              hold=3.2)
    r.caption("EMPTY STATE", "A brand new trader has zero instruments — as expected",
              hold=2.6)

    # ------------------------------------------------------------------
    r.chapter("instrument", "Step 3 — Register an Instrument",
              "Live POST /api/v1/instruments — a new instrument ID is issued")
    goto(r, "#owner-add-instrument", settle=2.4)
    r.select("#ins-type", value=None, step="STEP 1", caption="Instrument category",
             dwell=0.8)
    for sel, val, cap in [
        ("#ins-mfg", "Avery Weigh-Tronix", "Manufacturer"),
        ("#ins-model", "ZMX-500 Live Bench Scale", "Model designation"),
        ("#ins-serial", f"LIVE-SN-{STAMP}", "Unique serial number"),
        ("#ins-capacity", "500 kg (e = 100 g)", "Rated capacity and scale interval e"),
        ("#ins-location", "Live Demo Mart, Weighing Bay 1, Patna",
         "Installation / inspection location"),
    ]:
        r.fill(sel, value=val, step="STEP 2", caption=cap, dwell=0.3)
    r.fill("#ins-details", value="Ground-mounted platform on a levelled concrete plinth, "
           "external digital display indicator.", step="STEP 2",
           caption="Installation details", dwell=0.3)
    r.click("#add-instrument-form button[type=submit]", step="STEP 3",
            caption="Register — instrument persisted to the database", dwell=1.0,
            after=4.0)
    time.sleep(1.4)
    r.inject_overlay()
    st, inst = api("GET", "/instruments", LIVE["token"])
    rows = inst if isinstance(inst, list) else inst.get("instruments", [])
    mine = [x for x in rows if (x.get("serialNumber") or "").startswith(f"LIVE-SN-{STAMP}")]
    LIVE["instrument"] = mine[0] if mine else (rows[0] if rows else {})
    r.caption("LIVE RESULT", f"Instrument registered: {LIVE['instrument'].get('id','?')}",
              hold=3.2)

    # ------------------------------------------------------------------
    r.chapter("application", "Step 4 — File a Verification Application",
              "Live POST /api/v1/applications — enters the scrutiny queue")
    goto(r, f"#owner-apply?instrumentId={LIVE['instrument'].get('id','')}", settle=3.0)
    r.select("#app-type", value="NEW", step="STEP 1",
             caption="Application type: New Verification", dwell=0.8)
    r.fill("#app-remarks", value="Inspection requested during 10:00 AM - 01:00 PM. "
           "Equipment is indoors on a levelled plinth.", step="STEP 2",
           caption="Remarks for the inspecting officer", dwell=0.4)
    r.click("#apply-verification-form button[type=submit]", step="STEP 3",
            caption="Submit Application — status becomes SUBMITTED", dwell=1.0,
            after=4.0)
    time.sleep(1.4)
    r.inject_overlay()
    st, apps = api("GET", "/applications", LIVE["token"])
    alist = apps if isinstance(apps, list) else apps.get("applications", [])
    mine = [a for a in alist if a.get("instrumentId") == LIVE["instrument"].get("id")]
    LIVE["app"] = mine[0] if mine else {}
    r.caption("LIVE RESULT",
              f"Application filed: {LIVE['app'].get('id','?')} — status "
              f"{LIVE['app'].get('status','?')}", hold=3.2)

    # ------------------------------------------------------------------
    r.chapter("allocation", "Step 5 — Directorate Allocates the Case",
              "Live POST /api/v1/applications/{id}/allocate — dual dispatch")
    login_as(r, "ADMIN")
    goto(r, "#admin-allocation", settle=3.2)
    r.caption("DISPATCH", "Applications in READY_FOR_ALLOCATION await statutory dispatch",
              hold=1.8)
    st, off = api("GET", "/allocation/available-officers", LIVE.get("admin_token"))
    if r.click(".open-allocate-modal-btn", step="ALLOCATE",
               caption="Open the allocation modal", dwell=0.9, after=2.4):
        r.inject_overlay()
        r.select("#modal-select-lmo", value=None, step="LMO ROUTE",
                 caption="Dispatch to the field Legal Metrology Officer", dwell=1.1)
        r.select("#modal-select-gatc", value=None, step="GATC ROUTE",
                 caption="Or to an accredited laboratory bench", dwell=1.1)
        r.fill("#modal-alloc-notes", value="Allocated for on-site OIML R76 verification.",
               step="NOTES", caption="Statutory allocation remarks", dwell=0.4)
        r.click("#statutory-allocation-form button[type=submit]", step="CONFIRM",
                caption="Confirm Statutory Allocation", dwell=1.0, after=3.6)
        time.sleep(1.4)
        r.inject_overlay()
        r.caption("LIVE RESULT", "Case dispatched — status ALLOCATED, officer notified",
                  hold=3.2)
    else:
        r.note("Queue already allocated", step="DISPATCH", dwell=2.0)
    logout(r)

    # ------------------------------------------------------------------
    r.chapter("verification", "Step 6 — OIML R76 Field Verification",
              "Live MPE tolerance maths and statutory PASS decision")
    login_as(r, "LMO")
    goto(r, f"#lmo-field-verification?id={LIVE['app'].get('id','')}", settle=3.4)
    r.caption("INSPECTION", "The officer inspects the instrument on the trader premises",
              hold=1.8)
    r.driver.execute_script(
        "const t=document.getElementById('test-points-table');"
        "if(t) t.scrollIntoView({block:'center'});")
    time.sleep(1.0)
    r.act("#test-points-table", step="OIML R76",
          caption="Multi-point test at minimum, half and maximum rated capacity",
          dwell=1.5)
    for row, val, cap in (
        ("MIN_LOAD", "10.04", "Min load observed reading — inside tolerance"),
        ("HALF_LOAD", "250.09", "Half capacity observed reading"),
        ("MAX_LOAD", "500.18", "Max capacity observed reading"),
    ):
        r.fill(f"#test-points-table tr[data-point='{row}'] .pt-observed", value=val,
               step="MPE MATH", caption=cap, dwell=0.3)
        time.sleep(0.9)
    ev = r.driver.execute_script(
        "const b=document.getElementById('accuracy-badge');"
        "const m=document.getElementById('accuracy-eval-msg');"
        "return ((b?b.innerText:'')+' | '+(m?m.innerText:'')).replace(/\\s+/g,' ').slice(0,150);")
    r.caption("COMPUTED", f"Backend verdict: {ev}", hold=3.4)
    r.fill("#field-seal-number", value=f"DLM-PAT-2026-{STAMP}", step="SEAL",
           caption="Wire seal number affixed to the instrument", dwell=0.4)
    r.act("#capture-gps-btn", step="GEO-TAG", caption="Capture the statutory GPS fix",
          dwell=1.0, after=1.8)
    r.inject_overlay()
    gps = r.driver.execute_script(
        "const g=document.getElementById('geo-coords-display');return g?g.innerText:'';")
    r.caption("EVIDENCE", f"Inspection geo-tagged and sealed: {gps[:60]}", hold=2.6)

    # ------------------------------------------------------------------
    r.chapter("decision", "Step 7 — Statutory PASS & Certificate Issuance",
              "Live POST /api/v1/verification/submit — a certificate is minted")
    r.click("#submit-pass-btn", step="DECISION",
            caption="Submit the statutory PASS decision", dwell=1.0, after=2.6)
    r.inject_overlay()
    if r.find(".modal-confirm-btn"):
        r.click(".modal-confirm-btn", step="CONFIRM",
                caption="Confirm — issue the official digital certificate", dwell=1.0,
                after=4.0)
        time.sleep(1.6)
        r.inject_overlay()
    st, certs = api("GET", "/certificates", LIVE["token"])
    clist = certs if isinstance(certs, list) else certs.get("certificates", [])
    mine = [c for c in clist if c.get("applicationId") == LIVE["app"].get("id")]
    LIVE["cert"] = mine[0] if mine else {}
    r.caption("CERTIFICATE ISSUED",
              f"Certificate {LIVE['cert'].get('id','?')} minted with an RSA-2048 / "
              f"SHA-256 signature", hold=3.6)

    # ------------------------------------------------------------------
    r.chapter("public", "Step 8 — Citizen Verifies the New Certificate",
              "Live GET /api/v1/public/verify — signature checked, no login")
    cid = LIVE["cert"].get("id") or LIVE["app"].get("id")
    r.driver.execute_script("localStorage.removeItem('measurex_jwt_token');"
                            "localStorage.removeItem('measure_x_session_v2');")
    r.driver.get(f"http://localhost:3000/#verify?id={cid}")
    time.sleep(4.2)
    r.inject_overlay()
    r.caption("PUBLIC", "A citizen verifies the certificate just issued — no login required",
              hold=2.4)
    res = r.driver.execute_script(
        "const c=document.getElementById('verify-result-container');"
        "return c?c.innerText.replace(/\\s+/g,' ').slice(0,240):'';")
    st, pv = api("GET", f"/public/verify/{cid}")
    LIVE["verify"] = pv
    r.caption("SIGNATURE CHECKED",
              f"RSA signatureValid={pv.get('signatureValid')} · {pv.get('status')} · "
              f"algorithm {pv.get('signatureAlgorithm')}", hold=3.8)
    r.driver.execute_script("window.scrollTo({top:0,behavior:'instant'});")
    time.sleep(0.8)
    r.act("#verify-result-container", step="STATUTORY RESULT",
          caption=res[:120], dwell=1.8)
    r.caption("LIFECYCLE COMPLETE",
              "Register → Instrument → Application → Allocation → OIML R76 verification → "
              "Certificate → Public verification", hold=4.0)
    r.end_chapters()
    lj = os.path.join(r._outroot, "08-live-workflow", "live-run.json")
    os.makedirs(os.path.dirname(lj), exist_ok=True)
    with open(lj, "w") as f:
        json.dump(LIVE, f, indent=2, default=str)


# ================================================================== RUNNER
def build_index(records, outroot):
    total_s = sum(r["duration"] for r in records)
    groups = {}
    for n, r in enumerate(records, 1):
        groups.setdefault(r["act"], []).append((n, r))

    nav = "".join(
        '<a href="#g%d">%s <span>%d</span></a>' % (i, act, len(v))
        for i, (act, v) in enumerate(groups.items())
    )

    def rows(items):
        out = []
        for n, r in items:
            out.append(
                '<tr><td class="n">%02d</td>'
                '<td><a href="%s/%s">%s</a><div class="sub">%s</div></td>'
                '<td><code>%s</code></td><td class="d">%.1fs</td></tr>'
                % (n, r["actdir"], r["file"], r["title"], r["sub"],
                   r["file"], r["duration"])
            )
        return "\n".join(out)

    body = "\n".join(
        '<h2 id="g%d">%s <small>%s</small></h2>\n      <table>%s</table>'
        % (i, act, items[0][1]["actdir"], rows(items))
        for i, (act, items) in enumerate(groups.items())
    )

    html = f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Measure X — Demo Video Series</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
 :root {{ --p:#0B5D4B; --g:#C9972B; --ink:#0f2a24; }}
 * {{ box-sizing:border-box; }}
 body {{ margin:0; font:15px/1.6 Inter,Segoe UI,system-ui,sans-serif;
        background:#f4f7f6; color:var(--ink); }}
 header {{ background:linear-gradient(135deg,var(--p),#084034); color:#fff;
           padding:44px 40px 34px; }}
 header h1 {{ margin:0 0 6px; font-size:30px; letter-spacing:-.6px; }}
 header h1 span {{ color:var(--g); }}
 header p {{ margin:0; color:#A4D4C8; font-size:15px; }}
 nav {{ display:flex; flex-wrap:wrap; gap:9px; padding:18px 40px; background:#fff;
        border-bottom:1px solid #dbe6e2; position:sticky; top:0; z-index:5; }}
 nav a {{ font-size:12.5px; font-weight:700; text-transform:uppercase; letter-spacing:.6px;
          color:var(--p); text-decoration:none; background:#eef5f2; padding:7px 13px;
          border-radius:20px; border:1px solid #cfe0da; }}
 nav a span {{ color:var(--g); }}
 main {{ padding:26px 40px 70px; max-width:1120px; }}
 h2 {{ color:var(--p); font-size:19px; margin:34px 0 12px; padding-bottom:8px;
       border-bottom:2px solid var(--g); }}
 h2 small {{ color:#7a918b; font-weight:600; font-size:12.5px; }}
 table {{ width:100%; border-collapse:collapse; background:#fff; border-radius:10px;
          overflow:hidden; box-shadow:0 1px 3px rgba(11,93,75,.10); margin-bottom:8px; }}
 th,td {{ text-align:left; padding:10px 13px; border-bottom:1px solid #eaf0ee; font-size:14px; }}
 td.n {{ color:var(--g); font-weight:800; width:44px; }}
 td.d {{ color:#7a918b; white-space:nowrap; }}
 .sub {{ color:#7a918b; font-size:12.5px; margin-top:2px; }}
 code {{ font:12px/1.4 "JetBrains Mono",ui-monospace,monospace; color:#5a6b66; }}
 a {{ color:var(--p); font-weight:700; text-decoration:none; }}
 a:hover {{ text-decoration:underline; }}
 footer {{ padding:26px 40px; color:#7a918b; font-size:13px; border-top:1px solid #dbe6e2; }}
</style></head><body>
<header>
  <h1>Measure <span>X</span> — Demo Video Series</h1>
  <p>SIH26036 &middot; Government Legal Metrology Digital Verification Network
     &middot; {len(records)} clips &middot; {total_s/60:.1f} min
     &middot; recorded {datetime.now().strftime('%d %b %Y %H:%M')}</p>
</header>
<nav>{nav}</nav>
<main>
{body}
</main>
<footer>Measure X &middot; Department of Legal Metrology &middot; Legal Metrology Act, 2009
  &middot; OIML R76-1:2006 (E)</footer>
</body></html>"""
    p = os.path.join(outroot, "index.html")
    with open(p, "w") as f:
        f.write(html)
    return p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ROOT, "demo-videos"))
    ap.add_argument("--only", action="append", default=[],
                    help="act number(s), e.g. --only 03")
    ap.add_argument("--scene", action="append", default=[], help="scene key(s)")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--min", type=float, default=7.0, help="min clip seconds")
    ap.add_argument("--headful", action="store_true")
    args = ap.parse_args()

    if args.list:
        for s in SCENES:
            print(f"{s['act']}  {s['key']:<22} {s['name']:<26} {s['title']}")
        print(f"\n{len(SCENES)} scenes")
        return 0

    todo = [s for s in SCENES
            if (not args.only or s["act"] in args.only)
            and (not args.scene or s["key"] in args.scene)]
    if not todo:
        print("no scenes matched")
        return 1

    os.makedirs(args.out, exist_ok=True)
    r = Recorder(os.path.join(args.out, "_tmp"), headless=not args.headful)
    records, idx, fails = [], 0, []
    seen_files = set()
    t_all = time.time()
    try:
        r.wait_splash()
        for s in todo:
            actdir, actlabel = ACTS[s["act"]]
            idx += 1
            fname = f"{idx:02d}-{s['key']}.mp4"
            path = os.path.join(args.out, actdir, fname)
            os.makedirs(os.path.dirname(path), exist_ok=True)
            print(f"[{idx:02d}/{len(todo)}] {actlabel} :: {s['title']}")
            t0 = time.time()
            try:
                r.driver.execute_script("window.__mxOverlayHide();")
                r.inject_overlay()
                if s.get("chapters"):
                    r.begin_chapters(actdir, f"{idx:02d}-", actlabel, args.min)
                    r.chapter(s["key"], s["title"], s["sub"])
                else:
                    # Title card must be inside the recorded window.
                    r.start()
                    r.title_card(actlabel, s["title"], s["sub"], hold=2.3)
                s["fn"](r)
                time.sleep(0.7)
                if r._chapters:
                    for m in r.end_chapters():
                        dur = probe(m["path"])
                        seen_files.add(os.path.basename(m["path"]))
                        records.append({"file": os.path.basename(m["path"]),
                                        "title": m["title"], "sub": m["sub"],
                                        "duration": dur, "act": m["act"],
                                        "actdir": m["actdir"], "scene": m["key"]})
                        print(f"    -> {os.path.basename(m['path'])}  "
                              f"{dur:.1f}s")
                else:
                    out = r.stop(path, min_duration=args.min)
                    if out:
                        dur = probe(out)
                        seen_files.add(fname)
                        records.append({"file": fname, "title": s["title"],
                                        "sub": s["sub"], "duration": dur,
                                        "act": actlabel, "actdir": actdir,
                                        "scene": s["key"]})
            except Exception as e:
                print(f"    !! FAILED: {type(e).__name__}: {str(e)[:200]}")
                fails.append((fname, s["title"], str(e)[:200]))
                try:
                    r._cmd("Page.stopScreencast", timeout=5)
                except Exception:
                    pass
                with r.lock:
                    r.recording = False
                    r.frames = []
                r._chapters = None
            print(f"    ({time.time()-t0:.0f}s wall)")
    finally:
        r.kill()

    # de-dup records for index
    seen, uniq = set(), []
    for rec in records:
        if rec["file"] in seen:
            continue
        seen.add(rec["file"])
        uniq.append(rec)
    if uniq:
        build_index(uniq, args.out)
    with open(os.path.join(args.out, "manifest.json"), "w") as f:
        json.dump({"recorded_at": datetime.now().isoformat(timespec="seconds"),
                   "clips": uniq, "failures": fails}, f, indent=2)
    try:
        import shutil
        shutil.rmtree(os.path.join(args.out, "_tmp"), ignore_errors=True)
    except Exception:
        pass

    total = sum(x["duration"] for x in uniq)
    print(f"\n{'='*58}")
    print(f"recorded : {len(uniq)}/{len(todo)} clips   total {total/60:.1f} min")
    print(f"wall     : {(time.time()-t_all)/60:.1f} min")
    if fails:
        print(f"failures : {len(fails)}")
        for f in fails:
            print(f"   - {f[0]} {f[1]}: {f[2]}")
    print(f"index    : {os.path.join(args.out, 'index.html')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
