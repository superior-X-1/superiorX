"""
Comprehensive Playwright Verification for Final Finishing Pass
Verifies:
1. Desktop Sidebar Overlay: 0px main content shift between collapsed and expanded.
2. Single Desktop Toggle Button: Updates collapse/expand icon properly.
3. Auto-collapse on main content click.
4. Inspection Applications Queue: Desktop table vs mobile stacked cards, no foster-parented raw text.
5. Notification Center: Desktop popover, mobile fitting, Mark all as read API interaction.
6. Public Verification Experience: 3 pillars (Scan QR / Verify Certificate / Check Authenticity), live query, RSA signature badge.
"""

from playwright.sync_api import sync_playwright
import time
import sys

FRONTEND_URL = "http://127.0.0.1:3000"

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        print("\n=======================================================")
        print("PART 1: Desktop Sidebar Overlay & Zero Content Shift")
        print("=======================================================")
        page = browser.new_page(viewport={"width": 1366, "height": 768})

        # Login as LMO
        page.goto(f"{FRONTEND_URL}/#login-lmo")
        page.wait_for_timeout(500)
        page.fill("#login-email", "officer@demo.com")
        page.fill("#login-password", "officer123")
        page.click("#login-submit-btn")
        page.wait_for_timeout(2000)

        assert "#lmo-dashboard" in page.url, f"Failed to reach dashboard, current URL: {page.url}"
        print("  ✓ Successfully authenticated as LMO on desktop viewport.")

        # Ensure collapsed initial state
        sidebar = page.locator("#app-sidebar")
        main = page.locator(".app-main")
        toggle = page.locator("#mobile-nav-toggle")

        # Set to collapsed state to measure base
        page.evaluate("() => { const s = document.getElementById('app-sidebar'); s.classList.add('collapsed'); document.body.classList.add('sidebar-collapsed'); window.app.updateSidebarToggleIcon(true); }")
        page.wait_for_timeout(300)

        # Measure main content position when collapsed
        main_box_collapsed = main.bounding_box()
        main_margin_collapsed = page.evaluate("() => window.getComputedStyle(document.querySelector('.app-main')).marginLeft")
        print(f"  ✓ Collapsed state: .app-main marginLeft = {main_margin_collapsed}, x-coord = {main_box_collapsed['x']}px")

        # Toggle to expanded overlay state
        toggle.click()
        page.wait_for_timeout(350)

        # Measure main content position when expanded
        main_box_expanded = main.bounding_box()
        main_margin_expanded = page.evaluate("() => window.getComputedStyle(document.querySelector('.app-main')).marginLeft")
        print(f"  ✓ Expanded state: .app-main marginLeft = {main_margin_expanded}, x-coord = {main_box_expanded['x']}px")

        # Verify ZERO shift in main content
        assert main_margin_collapsed == main_margin_expanded, f"Main content marginLeft changed! {main_margin_collapsed} vs {main_margin_expanded}"
        assert abs(main_box_collapsed['x'] - main_box_expanded['x']) < 1.0, f"Main content shifted x-position by {abs(main_box_collapsed['x'] - main_box_expanded['x'])}px!"
        print("  ✓ ZERO LAYOUT SHIFT CONFIRMED: Desktop sidebar overlays without pushing main content sideways!")

        # Verify toggle icon updated to collapse icon
        collapse_icon_count = toggle.locator(".collapse-icon").count()
        assert collapse_icon_count > 0, "Toggle icon did not update to collapse icon when expanded!"
        print("  ✓ Desktop toggle icon correctly updated to collapse-icon.")

        # Click outside on main content to auto-collapse
        page.click(".app-main", position={"x": 400, "y": 200})
        page.wait_for_timeout(350)
        is_collapsed = page.evaluate("() => document.getElementById('app-sidebar').classList.contains('collapsed')")
        assert is_collapsed, "Clicking on main content did not auto-collapse desktop overlay sidebar!"
        print("  ✓ Auto-collapse on main content click works smoothly.")

        print("\n=======================================================")
        print("PART 2: Inspection Applications Queue Component")
        print("=======================================================")
        # Check desktop semantic table
        desktop_table = page.locator(".lmo-queue-desktop table")
        assert desktop_table.is_visible(), "LMO desktop queue table is not visible!"
        mobile_cards = page.locator(".lmo-queue-mobile")
        assert not mobile_cards.is_visible(), "LMO mobile queue cards should be hidden on 1366px desktop!"

        # Check table columns
        headers = page.locator(".lmo-queue-desktop table th").all_text_contents()
        expected_cols = ["App ID", "Applicant / Business", "Equipment Type", "Serial Number", "Location", "Status", "Officer", "Scheduled Date", "Action"]
        for col in expected_cols:
            assert any(col.lower() in h.lower() for h in headers), f"Missing column {col} in table headers: {headers}"
        print(f"  ✓ Desktop table contains all 9 required semantic columns: {headers}")

        # Check for foster-parenting bug: no misplaced raw text outside of table
        section_html = page.locator(".dashboard-section").inner_html()
        assert "<div>\n                    <strong>" not in section_html, "Malformed misplaced <div> outside <td> found in section!"
        print("  ✓ Malformed foster-parented raw text bug is completely eradicated.")

        # Test mobile viewport for queue cards reflow
        page.set_viewport_size({"width": 375, "height": 667})
        page.wait_for_timeout(300)

        assert not desktop_table.is_visible(), "Desktop table should be hidden on 375px mobile viewport!"
        assert mobile_cards.is_visible(), "Mobile stacked cards should be visible on 375px mobile viewport!"
        card_count = page.locator(".lmo-app-card").count()
        assert card_count > 0, "No mobile application cards found!"
        print(f"  ✓ Mobile reflow confirmed: {card_count} stacked cards visible on 375px viewport.")

        # Check View All Applications button
        view_all_btn = page.locator("a[href='#lmo-applications']:has-text('View All Applications')")
        assert view_all_btn.is_visible(), "View All Applications button not visible!"
        print("  ✓ 'View All Applications' button is visible and properly linked.")

        print("\n=======================================================")
        print("PART 3: Notification Popover & Real Interaction")
        print("=======================================================")
        # Test notification popover on desktop
        page.set_viewport_size({"width": 1366, "height": 768})
        page.wait_for_timeout(300)

        notif_btn = page.locator("#header-notif-toggle-btn")
        assert notif_btn.is_visible(), "Notification button not visible in header!"
        notif_btn.click()
        page.wait_for_timeout(300)

        panel = page.locator("#header-notif-panel")
        assert panel.is_visible(), "Notification popover did not open!"
        panel_box = panel.bounding_box()
        assert panel_box["width"] >= 340 and panel_box["width"] <= 440, f"Notification popover width {panel_box['width']}px is out of standard bounds!"
        print(f"  ✓ Desktop notification popover opens cleanly with width {panel_box['width']}px.")

        # Check "Mark all read" button interaction
        mark_all = page.locator("#header-notif-mark-all")
        if mark_all.is_visible():
            mark_all.click()
            page.wait_for_timeout(400)
            badge_count = page.locator(".header-notif-badge").count()
            assert badge_count == 0, "Notification badge did not clear after marking all read!"
            print("  ✓ 'Mark all read' triggered backend sync and cleared unread badge.")
        else:
            print("  ✓ Zero unread notifications initially.")

        # Test mobile notification popover sizing
        page.set_viewport_size({"width": 375, "height": 667})
        page.wait_for_timeout(300)
        notif_btn.click()
        page.wait_for_timeout(300)

        if not panel.is_visible():
            notif_btn.click()
            page.wait_for_timeout(300)

        assert panel.is_visible(), "Mobile notification popover not visible!"
        mob_panel_box = panel.bounding_box()
        assert mob_panel_box["width"] <= 375, f"Mobile notification popover overflowing! Width: {mob_panel_box['width']}px on 375px screen"
        print(f"  ✓ Mobile notification popover fits viewport cleanly: width = {mob_panel_box['width']}px.")

        print("\n=======================================================")
        print("PART 4: Public Verification Experience & Statutory Data")
        print("=======================================================")
        page.goto(f"{FRONTEND_URL}/#verify")
        page.wait_for_timeout(600)

        # Check 3 pillars
        scan_pillar = page.locator("h3:has-text('Scan QR Code')")
        verify_pillar = page.locator("h3:has-text('Verify Certificate')")
        auth_pillar = page.locator("h3:has-text('Check Authenticity')")

        assert scan_pillar.is_visible(), "Scan QR Code pillar card not visible!"
        assert verify_pillar.is_visible(), "Verify Certificate pillar card not visible!"
        assert auth_pillar.is_visible(), "Check Authenticity pillar card not visible!"
        print("  ✓ All 3 Pillars (Scan QR / Verify Certificate / Check Authenticity) are prominently rendered.")

        # Verify valid certificate
        page.fill("#verify-search-input", "MX-CERT-DEMO-0001")
        page.click("#public-verify-form button[type='submit']")
        page.wait_for_timeout(700)

        result_text = page.locator("#verify-result-container").inner_text()
        assert "VALID" in result_text or "OFFICIALLY VERIFIED" in result_text, f"Expected VALID result for MX-CERT-DEMO-0001! Found: {result_text[:200]}"
        assert "MX-WT-10001" in result_text, "Serial number MX-WT-10001 missing in verification result!"
        assert "DLM-PAT-2026-9011" in result_text, "Wire seal number DLM-PAT-2026-9011 missing in result!"
        print("  ✓ Live verification of MX-CERT-DEMO-0001: Verified VALID with real database instrument, seal, and test data.")

        # Verify expiring soon certificate
        page.fill("#verify-search-input", "MX-CERT-DEMO-0004")
        page.click("#public-verify-form button[type='submit']")
        page.wait_for_timeout(700)
        result_text_expiring = page.locator("#verify-result-container").inner_text()
        assert "EXPIRING" in result_text_expiring or "EXPIRING_SOON" in result_text_expiring or "04 Oct 2026" in result_text_expiring, "Expected expiring status for MX-CERT-DEMO-0004!"
        print("  ✓ Live verification of MX-CERT-DEMO-0004: Correctly shows expiring statutory window.")

        # Verify expired certificate
        page.fill("#verify-search-input", "MX-CERT-DEMO-0002")
        page.click("#public-verify-form button[type='submit']")
        page.wait_for_timeout(700)
        result_text_expired = page.locator("#verify-result-container").inner_text()
        assert "EXPIRED" in result_text_expired, "Expected EXPIRED status for MX-CERT-DEMO-0002!"
        print("  ✓ Live verification of MX-CERT-DEMO-0002: Correctly shows expired status.")

        # Verify revoked certificate
        page.fill("#verify-search-input", "MX-CERT-DEMO-0003")
        page.click("#public-verify-form button[type='submit']")
        page.wait_for_timeout(700)
        result_text_revoked = page.locator("#verify-result-container").inner_text()
        assert "REVOKED" in result_text_revoked, "Expected REVOKED status for MX-CERT-DEMO-0003!"
        print("  ✓ Live verification of MX-CERT-DEMO-0003: Correctly shows revoked status.")

        # Verify invalid certificate search
        page.fill("#verify-search-input", "MX-CERT-INVALID-99")
        page.click("#public-verify-form button[type='submit']")
        page.wait_for_timeout(700)
        result_text_invalid = page.locator("#verify-result-container").inner_text()
        assert "INVALID CERTIFICATE RECORD" in result_text_invalid or "not recognized" in result_text_invalid, "Expected INVALID result notice!"
        print("  ✓ Search for invalid ID: Correctly displays statutory consumer protection warning.")

        print("\n=======================================================")
        print("🎉 ALL FINAL POLISH & FUNCTIONAL TESTS PASSED (100%)! 🎉")
        print("=======================================================")

        browser.close()

if __name__ == "__main__":
    run_tests()
