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

cmd = [
    chrome,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--virtual-time-budget=8000',
    f'--dump-dom',
    file_url
]

print(f"Running YANZIOE E2E Suite via headless Chrome...")
res = subprocess.run(cmd, capture_output=True, text=True, timeout=15, encoding='utf-8', errors='ignore')

output = res.stdout
if '<title>YANZIOE_E2E_PASSED</title>' in output and '<span class="fail">[FAIL]' not in output:
    print("✅ TEST SUCCESS: YANZIOE E2E suite PASSED!")
    for line in output.splitlines():
        if '<span class="pass">[PASS]' in line or 'STATUS: YANZIOE_E2E' in line:
            clean = line.replace('<div id="log">', '').replace('<span class="pass">', '').replace('</span>', '').replace('</div>', '').strip()
            print(clean)
else:
    print("❌ TEST FAILED or incomplete!")
    for line in output.splitlines():
        if '<span class="pass">[PASS]' in line or '<span class="fail">[FAIL]' in line or 'STATUS: YANZIOE_E2E' in line:
            clean = line.replace('<span class="pass">', '').replace('<span class="fail">', '').replace('</span>', '').strip()
            print(clean)
    exit(1)
