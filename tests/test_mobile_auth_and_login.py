"""
Mobile & Responsive Authentication and Login Experience Verification
Tests:
1. Demo Accounts panel is removed from #login page UI.
2. Demo accounts remain 100% active and functional for authentication.
3. Login and Register buttons are present and visible on mobile, tablet, and desktop.
4. Mobile header bar contains visible, clickable [Login] and [Register] buttons.
5. Mobile bottom nav contains visible, clickable [Register] and [Login] items.
6. Mobile hamburger toggle opens navigation properly.
7. Zero horizontal scroll/overflow across 320px, 375px, 768px, 1024px, 1366px.
8. Interactive login flow on 375px mobile viewport completes seamlessly.
"""

import sys
import urllib.request
import pytest

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    pytest.skip("Playwright is not installed", allow_module_level=True)

try:
    with urllib.request.urlopen("http://127.0.0.1:3000", timeout=1):
        pass
except Exception:
    pytest.skip("Frontend server not running on http://127.0.0.1:3000", allow_module_level=True)

FRONTEND_URL = "http://127.0.0.1:3000"

def test_mobile_auth():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        
        # 1. Test across viewports
        viewports = [
            ("Mobile 320px", 320, 568),
            ("Mobile 375px", 375, 667),
            ("Mobile 414px", 414, 896),
            ("Tablet 768px", 768, 1024),
            ("Laptop 1024px", 1024, 768),
            ("Desktop 1366px", 1366, 768)
        ]

        print("\n--- Phase 1: Viewport & Login/Register Button Visibility Checks ---")
        for name, w, h in viewports:
            page = browser.new_page(viewport={"width": w, "height": h})
            page.goto(f"{FRONTEND_URL}/#landing")
            page.wait_for_timeout(600)

            # Check for horizontal overflow
            overflow = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
            assert overflow <= 1, f"Horizontal overflow {overflow}px on {name}!"
            print(f"  ✓ {name}: 0 horizontal overflow.")

            # Check header Login & Register buttons visibility
            header_login = page.locator(".header-user-section a[href='#login'], .header-user-section a.header-login-btn")
            header_register = page.locator(".header-user-section a[href='#register'], .header-user-section a.header-register-btn")
            assert header_login.is_visible(), f"Header Login button not visible on {name}!"
            assert header_register.is_visible(), f"Header Register button not visible on {name}!"
            print(f"  ✓ {name}: Header [Login] and [Register] buttons are visible and accessible.")

            # On mobile viewports (<= 768px), check bottom nav
            if w <= 768:
                bottom_nav = page.locator("#mobile-bottom-nav")
                assert bottom_nav.is_visible(), f"Mobile bottom nav not visible on {name}!"
                bottom_login = page.locator("#mobile-bottom-nav a[href='#login']")
                bottom_register = page.locator("#mobile-bottom-nav a[href='#register']")
                assert bottom_login.is_visible(), f"Bottom nav Login item not visible on {name}!"
                assert bottom_register.is_visible(), f"Bottom nav Register item not visible on {name}!"
                print(f"  ✓ {name}: Bottom nav contains both [Register] and [Login] items.")

            page.close()

        print("\n--- Phase 2: Verify #login Page UI (No Demo Accounts Panel) ---")
        page = browser.new_page(viewport={"width": 375, "height": 667})
        page.goto(f"{FRONTEND_URL}/#login")
        page.wait_for_timeout(800)

        # Check that 'Demo Accounts' panel is NOT in the DOM
        demo_panel = page.locator(".demo-quick-fill-btn")
        assert demo_panel.count() == 0, f"Found {demo_panel.count()} demo-quick-fill-btn buttons on #login!"
        
        login_text = page.inner_text("#login-card")
        assert "⚡ Demo Accounts" not in login_text, "Found '⚡ Demo Accounts' heading on #login!"
        assert "Demo credentials — for SIH presentation only" not in login_text
        print("  ✓ '⚡ Demo Accounts' panel has been completely removed from the login page UI.")

        # Check that form inputs are present and properly styled
        assert page.locator("#login-email").is_visible(), "Email input missing!"
        assert page.locator("#login-password").is_visible(), "Password input missing!"
        assert page.locator("#login-submit-btn").is_visible(), "Submit button missing!"
        print("  ✓ Login card contains clean official authentication inputs.")

        print("\n--- Phase 3: Interactive Mobile Navigation & Auth Flows ---")
        # Click Register button from mobile bottom nav
        page.click("#mobile-bottom-nav a[href='#register']")
        page.wait_for_timeout(600)
        assert "#register" in page.url
        assert "REGISTER FOR MEASUREX" in page.inner_text("body")
        print("  ✓ Mobile bottom nav [Register] clicked -> Navigated to registration page.")

        # Click Login button from mobile header
        page.click(".header-user-section a.header-login-btn")
        page.wait_for_timeout(600)
        assert "#login" in page.url
        print("  ✓ Mobile header [Login] clicked -> Navigated to login page.")

        # Test logging in on mobile with an official demo account
        print("\n--- Phase 4: Mobile Login Execution ---")
        page.fill("#login-email", "officer@demo.com")
        page.fill("#login-password", "officer123")
        page.click("#login-submit-btn")
        page.wait_for_timeout(2000)

        print(f"  Current URL after login: {page.url}")
        assert "#lmo-dashboard" in page.url or "#lmo" in page.url, f"Expected #lmo-dashboard, got {page.url}"
        print("  ✓ Mobile user successfully logged in as LMO and reached dashboard!")

        # Verify mobile drawer/menu toggle on dashboard
        page.click("#mobile-nav-toggle")
        page.wait_for_timeout(400)
        sidebar = page.locator("#app-sidebar")
        assert "sidebar-open" in sidebar.get_attribute("class"), "Mobile sidebar did not open on toggle click!"
        print("  ✓ Mobile hamburger toggle opens sidebar drawer smoothly.")

        # Click exposed backdrop area (x: 350 on 375px width screen) to close
        page.locator("#sidebar-backdrop").click(position={"x": 350, "y": 200})
        page.wait_for_timeout(400)
        assert "sidebar-open" not in sidebar.get_attribute("class"), "Mobile sidebar did not close on backdrop click!"
        print("  ✓ Clicking backdrop closes sidebar drawer cleanly.")

        page.close()
        browser.close()

        print("\n=======================================================")
        print("🎉 ALL MOBILE & AUTH VERIFICATION TESTS PASSED (100%)! 🎉")
        print("=======================================================")

if __name__ == "__main__":
    test_mobile_auth()
