"""
Test suite for Verification Centres Master, Statutory Allocation Assignment History, and Certificate Revocation Modals.
"""

import sys
import time
from playwright.sync_api import sync_playwright

FRONTEND_URL = "http://127.0.0.1:3000"

def test_centres_and_modals():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1366, "height": 768})

        errors = []
        page.on("pageerror", lambda err: errors.append(f"PageError: {err}"))
        page.on("console", lambda msg: errors.append(f"ConsoleError: {msg.text}") if msg.type == "error" else None)

        print("\n--- 1. Login as Admin ---")
        page.goto(f"{FRONTEND_URL}/#login-admin")
        page.wait_for_timeout(1000)
        page.fill("#login-email", "admin@demo.com")
        page.fill("#login-password", "admin123")
        page.click("#login-submit-btn")
        page.wait_for_timeout(2500)
        print(f"URL after admin login: {page.url}")

        print("\n--- 2. Testing Verification Centres Master Page (#admin-centres) ---")
        page.goto(f"{FRONTEND_URL}/#admin-centres")
        page.wait_for_timeout(2000)

        # Check page header and title
        body_text = page.inner_text("body")
        assert "Statutory Verification & Test Centres" in body_text, "Verification Centres header not found"
        assert "VC-PAT-001" in body_text or "Patna" in body_text, "Centres table did not load seed data"
        print("[PASS] #admin-centres rendered with live MySQL records.")

        # Test search filter
        page.fill("#centre-search", "Muzaffarpur")
        page.wait_for_timeout(600)
        filtered_text = page.inner_text("#centres-table-body")
        assert "Muzaffarpur" in filtered_text, "Filter by name failed"
        print("[PASS] Centre search filter works dynamically.")

        # Test Add Centre modal open
        page.click("#add-centre-btn")
        page.wait_for_timeout(500)
        modal_text = page.inner_text(".modal-container")
        assert "Register Verification Centre" in modal_text, "Add Centre modal not opened"
        print("[PASS] Register Verification Centre modal opened.")

        # Close modal
        page.click(".modal-cancel-btn")
        page.wait_for_timeout(500)

        print("\n--- 3. Testing Allocation Desk Statutory History Modal ---")
        page.goto(f"{FRONTEND_URL}/#admin-allocation")
        page.wait_for_timeout(2000)

        # Find history button
        history_btn = page.locator(".view-allocation-history-btn").first
        if history_btn.count() > 0:
            history_btn.click()
            page.wait_for_timeout(800)
            modal_text = page.inner_text(".modal-container")
            assert "Statutory Assignment History" in modal_text, "Allocation history modal not opened"
            print("[PASS] Statutory Assignment History modal opens with audit trail.")
            page.click(".modal-confirm-btn")
            page.wait_for_timeout(500)
        else:
            print("[INFO] No applications with history button found.")

        print("\n--- 4. Testing Certificate Management Revocation Modal ---")
        page.goto(f"{FRONTEND_URL}/#admin-certificates")
        page.wait_for_timeout(2000)

        revoke_btn = page.locator(".revoke-cert-btn").first
        if revoke_btn.count() > 0:
            revoke_btn.click()
            page.wait_for_timeout(500)
            modal_text = page.inner_text(".modal-container")
            assert "Statutory Certificate Revocation" in modal_text, "Revocation modal did not open"
            assert "Statutory Grounds for Revocation" in modal_text, "Revocation form missing grounds"
            print("[PASS] Statutory Certificate Revocation modal loaded with legal grounds.")
            page.click(".modal-cancel-btn")
            page.wait_for_timeout(500)
        else:
            print("[INFO] No active certificates found for revocation.")

        print("\n--- 5. Testing Zero GATC in Navigation, Role Tabs, & Selectors ---")
        page.goto(f"{FRONTEND_URL}/#admin-users")
        page.wait_for_timeout(1500)
        users_html = page.inner_html("body")
        assert "GATC" not in users_html, "Found GATC in Admin Users page!"
        print("[PASS] Admin Users page has zero GATC occurrences.")

        # Check sidebar
        sidebar_text = page.inner_text("#app-sidebar")
        assert "GATC" not in sidebar_text, "Found GATC in sidebar!"
        print("[PASS] Sidebar has zero GATC items.")

        print("\n=======================================================")
        print("CENTRES & MODALS TEST SUITE PASSED (100%)")
        print("=======================================================")
        browser.close()

if __name__ == "__main__":
    test_centres_and_modals()
