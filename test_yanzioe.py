import os, time, subprocess

html_path = r'C:\Users\BaoNam\Downloads\YanzIOE\test_yanzioe_e2e.html'
file_url = f'file:///{html_path.replace("\\", "/")}'

chrome_paths = [
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    os.path.expandvars(r'%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe')
]

chrome = None
for p in chrome_paths:
    if os.path.isfile(p):
        chrome = p
        break

if not chrome:
    print("[ERROR] Chrome binary not found!")
    exit(1)

out_dump = os.path.join(os.path.dirname(html_path), 'test_out.html')

print(f"Running YANZIOE E2E Suite (Dev + Obfuscated Release) via headless Chrome...")

def run_suite(target_url, label):
    cmd = [
        chrome,
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--virtual-time-budget=9000',
        '--dump-dom',
        target_url
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=20, encoding='utf-8', errors='ignore')
    output = res.stdout
    if '<title>YANZIOE_E2E_PASSED</title>' in output and '<span class="fail">[FAIL]' not in output:
        print(f"✅ TEST SUCCESS [{label}]: YANZIOE E2E suite PASSED!")
        for line in output.splitlines():
            if '<span class="pass">[PASS]' in line or 'STATUS: YANZIOE_E2E' in line:
                clean = line.replace('<div id="log">', '').replace('<span class="pass">', '').replace('</span>', '').replace('</div>', '').strip()
                print(clean)
        return True
    print(f"❌ TEST FAILED [{label}] or incomplete!")
    for line in output.splitlines():
        if '<span class="pass">[PASS]' in line or '<span class="fail">[FAIL]' in line or 'STATUS: YANZIOE_E2E' in line:
            clean = line.replace('<span class="pass">', '').replace('<span class="fail">', '').replace('</span>', '').strip()
            print(clean)
    return False

if not run_suite(file_url, 'YANZIOE.js'):
    exit(1)

ver = open(r'C:\Users\BaoNam\Downloads\YanzIOE\VERSION.txt', encoding='utf-8').read().strip()
obf_js = rf'C:\Users\BaoNam\Downloads\YANZIOE_v{ver}_CoKey\yanzioeCoKey.js'
if os.path.isfile(obf_js):
    obf_html = os.path.join(os.path.dirname(html_path), '_tmp_obf_e2e.html')
    try:
        raw_html = open(html_path, encoding='utf-8').read()
        obf_url = f'file:///{obf_js.replace(chr(92), "/")}'
        open(obf_html, 'w', encoding='utf-8').write(raw_html.replace('src="YANZIOE.js"', f'src="{obf_url}"'))
        ok_obf = run_suite(f'file:///{obf_html.replace(chr(92), "/")}', f'Obfuscated yanzioeCoKey.js v{ver}')
        if not ok_obf:
            exit(1)
    finally:
        if os.path.exists(obf_html):
            os.remove(obf_html)
