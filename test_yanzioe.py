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
if 'YANZIOE_E2E_PASSED' in output:
    print("✅ TEST SUCCESS: All 10/10 YANZIOE E2E tests PASSED!")
    for line in output.splitlines():
        if '[PASS]' in line or '[FAIL]' in line or 'SUMMARY:' in line:
            clean = line.replace('<span>', '').replace('</span>', '').strip()
            print(clean)
else:
    print("❌ TEST FAILED or incomplete!")
    for line in output.splitlines():
        if '[PASS]' in line or '[FAIL]' in line:
            print(line)
    exit(1)
