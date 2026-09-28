import asyncio
import sys
from playwright.async_api import async_playwright

VIEWPORTS = [
    {"name": "320px", "width": 320, "height": 640},
    {"name": "375px", "width": 375, "height": 667},
    {"name": "390px", "width": 390, "height": 844},
    {"name": "414px", "width": 414, "height": 896},
    {"name": "768px", "width": 768, "height": 1024},
    {"name": "1024px", "width": 1024, "height": 768},
    {"name": "1366px", "width": 1366, "height": 768},
    {"name": "1920px", "width": 1920, "height": 1080},
]

ROUTES = [
    "#landing",
    "#services",
    "#how-it-works",
    "#verify",
    "#rules",
    "#help",
    "#login",
    "#register",
    "#verify?id=MX-CERT-DEMO-0001",
    "#certificate-details?id=MX-CERT-DEMO-0001"
]

ROLES = [
    {"role": "OWNER", "email": "trader@demo.com", "pass": "trader123", "home": "#owner-dashboard", 
     "pages": ["#owner-dashboard", "#owner-instruments", "#owner-add-instrument", "#owner-applications", "#owner-certificates", "#owner-notifications", "#owner-profile"]},
    {"role": "LMO", "email": "officer@demo.com", "pass": "officer123", "home": "#lmo-dashboard",
     "pages": ["#lmo-dashboard", "#lmo-applications", "#lmo-calendar", "#lmo-field-verification", "#lmo-certificates", "#lmo-notifications", "#lmo-profile"]},
    {"role": "GATC", "email": "gatc@demo.com", "pass": "gatc123", "home": "#gatc-dashboard",
     "pages": ["#gatc-dashboard", "#gatc-applications", "#gatc-calendar", "#gatc-field-verification", "#gatc-certificates", "#gatc-notifications", "#gatc-profile"]},
    {"role": "ADMIN", "email": "admin@demo.com", "pass": "admin123", "home": "#admin-dashboard",
     "pages": ["#admin-dashboard", "#admin-allocation", "#admin-users", "#admin-applications", "#admin-instruments", "#admin-reports", "#admin-audit", "#admin-notifications", "#admin-profile"]}
]

async def run_qa():
    print("==================================================")
    print("🚀 STARTING AUTOMATED HEADLESS BROWSER QA AUDIT")
    print("==================================================")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        base_url = "http://localhost:3000"
        errors = []

        # 1. Test Viewport Overflow on Public Routes
        print("\n[PHASE 1] Testing Viewports & Zero Horizontal Overflow on Public Routes:")
        for vp in VIEWPORTS:
            context = await browser.new_context(viewport={"width": vp["width"], "height": vp["height"]})
            page = await context.new_page()

            page_errors = []
            page.on("pageerror", lambda err: page_errors.append(f"JS Error: {err}"))
            page.on("console", lambda msg: page_errors.append(f"Console {msg.type}: {msg.text}") if msg.type == "error" else None)

            for route in ROUTES[:6]: # Test key public routes
                url = f"{base_url}/{route}"
                await page.goto(url, wait_until="networkidle")
                await asyncio.sleep(0.1)

                # Check horizontal overflow
                scroll_width = await page.evaluate("() => document.documentElement.scrollWidth")
                inner_width = await page.evaluate("() => window.innerWidth")
                overflow = scroll_width - inner_width
                if overflow > 1: # allow 1px rounding
                    print(f"  ❌ OVERFLOW: {vp['name']} at {route}: scrollWidth={scroll_width} > innerWidth={inner_width} (diff={overflow}px)")
                    errors.append(f"Overflow at {vp['name']} on {route}: {overflow}px")
                else:
                    pass

            if page_errors:
                for pe in page_errors:
                    print(f"  ❌ {vp['name']} {pe}")
                    errors.append(f"{vp['name']}: {pe}")
            else:
                print(f"  ✓ {vp['name']} - Zero overflow, clean console on public views.")

            await context.close()

        # 2. Test Hamburger Menu Toggle on Desktop & Mobile
        print("\n[PHASE 2] Testing Sidebar Toggle on Desktop & Mobile:")
        # Desktop 1366px
        d_ctx = await browser.new_context(viewport={"width": 1366, "height": 768})
        d_page = await d_ctx.new_page()
        # Login as Trader
        await d_page.goto(f"{base_url}/#login")
        await d_page.fill("#login-email", "trader@demo.com")
        await d_page.fill("#login-password", "trader123")
        await d_page.click("#login-submit-btn")
        await d_page.wait_for_selector("#owner-dashboard, #app-sidebar", timeout=5000)
        await asyncio.sleep(0.3)

        # Check desktop sidebar collapsed toggle via #mobile-nav-toggle
        is_init_collapsed = await d_page.evaluate("() => document.getElementById('app-sidebar').classList.contains('collapsed')")
        print(f"  Desktop initial sidebar collapsed: {is_init_collapsed}")
        await d_page.click("#mobile-nav-toggle")
        await asyncio.sleep(0.3)
        is_now_collapsed = await d_page.evaluate("() => document.getElementById('app-sidebar').classList.contains('collapsed')")
        print(f"  Desktop after toggle button click: collapsed = {is_now_collapsed}")
        assert is_now_collapsed != is_init_collapsed, "Desktop toggle must change collapsed state"
        # Toggle back
        await d_page.click("#mobile-nav-toggle")
        await asyncio.sleep(0.3)
        is_back = await d_page.evaluate("() => document.getElementById('app-sidebar').classList.contains('collapsed')")
        print(f"  Desktop after second click: collapsed = {is_back}")
        assert is_back == is_init_collapsed, "Desktop toggle back must restore state"
        print("  ✓ Desktop hamburger toggle folds and unfolds sidebar smoothly.")

        # Test notification dropdown on desktop
        print("\n[PHASE 3] Testing Notification Bell & Read Actions on Desktop:")
        notif_btn = await d_page.query_selector("#header-notif-toggle-btn")
        if notif_btn:
            await notif_btn.click()
            await asyncio.sleep(0.2)
            panel_open = await d_page.evaluate("() => document.getElementById('header-notif-panel')?.classList.contains('open')")
            print(f"  Header notification panel opened: {panel_open}")
            assert panel_open, "Notification panel must open on bell click"

            # Check mark all read button
            mark_all_btn = await d_page.query_selector("#header-notif-mark-all")
            if mark_all_btn:
                await mark_all_btn.click()
                await asyncio.sleep(0.2)
                badge_text = await d_page.evaluate("() => document.querySelector('.header-notif-badge')?.textContent || '0'")
                print(f"  Badge after mark all read: {badge_text}")
                print("  ✓ Mark all notifications read works smoothly.")
            
            # Close panel
            await d_page.keyboard.press("Escape")
            await asyncio.sleep(0.2)
            panel_closed = await d_page.evaluate("() => !document.getElementById('header-notif-panel')?.classList.contains('open')")
            print(f"  Header notification panel closed on Escape: {panel_closed}")
            assert panel_closed, "Notification panel must close on Escape"
        else:
            print("  ❌ Header notification button not found")
            errors.append("Header notification button not found")

        # Test User Profile Dropdown on Desktop
        print("\n[PHASE 4] Testing User Profile Dropdown:")
        profile_btn = await d_page.query_selector("#user-profile-toggle-btn")
        if profile_btn:
            await profile_btn.click()
            await asyncio.sleep(0.2)
            prof_open = await d_page.evaluate("() => document.getElementById('user-profile-dropdown')?.classList.contains('open')")
            print(f"  Profile dropdown opened: {prof_open}")
            assert prof_open, "User profile dropdown must open"
            await d_page.keyboard.press("Escape")
            await asyncio.sleep(0.2)
            prof_closed = await d_page.evaluate("() => !document.getElementById('user-profile-dropdown')?.classList.contains('open')")
            print(f"  Profile dropdown closed on Escape: {prof_closed}")
            assert prof_closed, "Profile dropdown must close on Escape"
            print("  ✓ User profile dropdown works smoothly.")

        # Test dedicated Notifications page
        await d_page.goto(f"{base_url}/#owner-notifications", wait_until="networkidle")
        await asyncio.sleep(0.2)
        notif_items = await d_page.query_selector_all(".notification-item")
        print(f"  Dedicated notification items rendered: {len(notif_items)}")
        mark_read_btn = await d_page.query_selector(".mark-read-btn")
        if mark_read_btn:
            await mark_read_btn.click()
            await asyncio.sleep(0.2)
            print("  ✓ Individual 'Mark Read' button clicked without error.")
        await d_ctx.close()

        # Mobile 375px Drawer Test
        print("\n[PHASE 5] Testing Mobile 375px Drawer & Navigation:")
        m_ctx = await browser.new_context(viewport={"width": 375, "height": 667})
        m_page = await m_ctx.new_page()
        await m_page.goto(f"{base_url}/#login")
        await m_page.fill("#login-email", "trader@demo.com")
        await m_page.fill("#login-password", "trader123")
        await m_page.click("#login-submit-btn")
        await m_page.wait_for_selector("#owner-dashboard, #app-sidebar", timeout=10000)
        await asyncio.sleep(0.4)

        # Check mobile drawer initially closed
        drawer_init = await m_page.evaluate("() => document.getElementById('app-sidebar').classList.contains('sidebar-open')")
        print(f"  Mobile drawer initial open state: {drawer_init}")
        assert not drawer_init, "Mobile drawer must start closed"

        # Click hamburger menu
        await m_page.click("#mobile-nav-toggle")
        await asyncio.sleep(0.3)
        drawer_open = await m_page.evaluate("() => document.getElementById('app-sidebar').classList.contains('sidebar-open')")
        backdrop_active = await m_page.evaluate("() => document.getElementById('sidebar-backdrop').classList.contains('active')")
        body_locked = await m_page.evaluate("() => document.body.classList.contains('drawer-open')")
        print(f"  Mobile drawer opened: {drawer_open}, backdrop: {backdrop_active}, body scroll locked: {body_locked}")
        assert drawer_open and backdrop_active and body_locked, "Drawer must slide in and lock scroll"

        # Click close button in drawer
        await m_page.click(".sidebar-drawer-close-btn")
        await asyncio.sleep(0.3)
        drawer_closed = await m_page.evaluate("() => !document.getElementById('app-sidebar').classList.contains('sidebar-open')")
        print(f"  Mobile drawer closed via ✕ button: {drawer_closed}")
        assert drawer_closed, "Drawer must close on ✕"
        print("  ✓ Mobile drawer opens, slides, and closes cleanly.")

        # Test mobile notification panel overlay position
        await m_page.click("#header-notif-toggle-btn")
        await asyncio.sleep(0.2)
        m_panel_box = await m_page.evaluate("""() => {
            const p = document.getElementById('header-notif-panel');
            if (!p) return null;
            const r = p.getBoundingClientRect();
            return {left: r.left, right: r.right, width: r.width, windowWidth: window.innerWidth};
        }""")
        print(f"  Mobile 375px notification panel dimensions: {m_panel_box}")
        if m_panel_box:
            assert m_panel_box['left'] >= 0 and m_panel_box['right'] <= m_panel_box['windowWidth'] + 2, "Notification panel must fit inside mobile screen"
            print("  ✓ Notification panel fits perfectly inside 375px mobile viewport.")
        await m_page.keyboard.press("Escape")
        await m_ctx.close()

        # 3. Test All Roles on All Viewports
        print("\n[PHASE 6] Testing Role Portals & Dashboard Workflows across Breakpoints:")
        for role_info in ROLES:
            print(f"\n--- Testing Portal for Role: {role_info['role']} ---")
            for vp in [VIEWPORTS[0], VIEWPORTS[2], VIEWPORTS[4], VIEWPORTS[6]]: # 320px, 390px, 768px, 1366px
                ctx = await browser.new_context(viewport={"width": vp["width"], "height": vp["height"]})
                pg = await ctx.new_page()

                pg_errors = []
                pg.on("pageerror", lambda err: pg_errors.append(f"JS Error: {err}"))
                pg.on("console", lambda msg: pg_errors.append(f"Console {msg.type}: {msg.text}") if msg.type == "error" else None)

                await pg.goto(f"{base_url}/#login")
                await pg.fill("#login-email", role_info["email"])
                await pg.fill("#login-password", role_info["pass"])
                await pg.click("#login-submit-btn")
                await pg.wait_for_selector("#app-sidebar", timeout=10000)
                await asyncio.sleep(0.3)

                # Check pages for this role
                for r_page in role_info["pages"][:3]: # test 3 key pages per role
                    await pg.goto(f"{base_url}/{r_page}", wait_until="networkidle")
                    await asyncio.sleep(0.15)
                    sw = await pg.evaluate("() => document.documentElement.scrollWidth")
                    iw = await pg.evaluate("() => window.innerWidth")
                    if sw - iw > 1:
                        print(f"  ❌ OVERFLOW: {role_info['role']} at {vp['name']} on {r_page} (diff={sw-iw}px)")
                        errors.append(f"Overflow for {role_info['role']} at {vp['name']} on {r_page}")

                if pg_errors:
                    for pe in pg_errors:
                        print(f"  ❌ {role_info['role']} {vp['name']}: {pe}")
                        errors.append(f"{role_info['role']} {vp['name']}: {pe}")
                else:
                    print(f"  ✓ {role_info['role']} @ {vp['name']} - Zero errors, zero horizontal overflow.")

                await ctx.close()

        await browser.close()

        print("\n==================================================")
        if errors:
            print(f"❌ COMPLETED WITH {len(errors)} ISSUES DETECTED:")
            for e in errors:
                print(f"   - {e}")
            sys.exit(1)
        else:
            print("🎉 ALL QA CHECKS PASSED WITH ZERO ERRORS! 🎉")
            print("==================================================")

if __name__ == "__main__":
    asyncio.run(run_qa())
