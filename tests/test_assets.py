import re
import urllib.request
import sys

def check_assets():
    with open('index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    urls = re.findall(r'(?:src|href)=["\']([^"\']+\.(?:css|js|svg|png|jpg|ico))["\']', html)
    print(f"Checking {len(urls)} assets referenced in index.html:")
    all_ok = True
    for u in urls:
        if u.startswith('http'):
            continue
        url = f"http://localhost:3000/{u.lstrip('/')}"
        try:
            req = urllib.request.Request(url, method='HEAD')
            with urllib.request.urlopen(req) as r:
                print(f"  [200 OK] {u}")
        except Exception as e:
            print(f"  [FAIL] {u} -> {e}")
            all_ok = False

    if all_ok:
        print("\nSUCCESS: All assets loaded with HTTP 200 OK — ZERO 404s!")
    else:
        sys.exit(1)

if __name__ == '__main__':
    check_assets()
