import os
import json
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DOWNLOADS_DIR = ROOT.parent
VERSION_FILE = ROOT / 'VERSION.txt'

def get_version():
    if VERSION_FILE.exists():
        return VERSION_FILE.read_text(encoding='utf-8').strip()
    return '1.0.3'

VERSION = get_version()
print(f"=== Building YANZIOE VIP v{VERSION} (Full Cocos2d + CreateJS + DOM + Glassmorphism UI) ===")

MODULES = [
    'utils/utils.js',
    'functions/oneko.js',
    'functions/questionSpoof.js',
    'functions/canvasEngine.js',
    'functions/answerRevealer.js',
    'functions/autoAnswer.js',
    'visuals/mainMenu.js'
]

bundled_parts = []
for rel in MODULES:
    p = ROOT / rel
    if p.exists():
        code = p.read_text(encoding='utf-8')
        bundled_parts.append(f"/* --- {rel} --- */\n" + code)
    else:
        print(f"[WARN] Missing module: {rel}")

bundle_code = "\n\n".join(bundled_parts)

# 1. Standard YANZIOE.js
dist_js = ROOT / 'YANZIOE.js'
dist_js.write_text(bundle_code, encoding='utf-8')
print(f"[OK] Generated {dist_js.name} ({len(bundle_code)} bytes)")

# 2. Userscript header builder
def make_userscript_header(ver, is_coke=False):
    title = "YANZIOE VIP (CoKey)" if is_coke else "YANZIOE VIP"
    desc = "Tool tự giải bài và hiển thị gợi ý đáp án Olympic Tiếng Anh IOE.vn (Hỗ trợ Cocos2d-JS, CreateJS Canvas và Web DOM)"
    if is_coke:
        desc += " - Bản VIP Glassmorphism không cần nhập API Key"
    return f"""// ==UserScript==
// @name         {title} - IOE.vn Auto Answer & Revealer
// @namespace    https://yanzbn.shop/
// @version      {ver}
// @description  {desc}
// @author       YanzBn
// @match        *://ioe.vn/*
// @match        *://*.ioe.vn/*
// @match        *://*.go.vn/*
// @match        *://*.vtc.vn/*
// @match        *://api-edu.go.vn/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      api-edu.go.vn
// @connect      ioe.vn
// @connect      api.groq.com
// @connect      generativelanguage.googleapis.com
// @connect      openrouter.ai
// @noframes     false
// ==/UserScript==

"""

# 3. Standard YANZIOE.user.js
dist_user_js = ROOT / 'YANZIOE.user.js'
dist_user_js.write_text(make_userscript_header(VERSION, False) + bundle_code, encoding='utf-8')
print(f"[OK] Generated {dist_user_js.name}")

# 4. KoKey / Free Standalone files
coke_header = "/* YANZIOE VIP v" + VERSION + " CoKey (Pre-activated Local CAS & Free Tier) */\n"
dist_coke_min = ROOT / 'yanzioeKoKey.js'
dist_coke_min.write_text(coke_header + bundle_code, encoding='utf-8')

dist_coke_user = ROOT / 'YANZIOE_KoKey.user.js'
dist_coke_user.write_text(make_userscript_header(VERSION, True) + bundle_code, encoding='utf-8')
print(f"[OK] Generated {dist_coke_min.name} and {dist_coke_user.name}")

# 5. Helper to write Chrome Extension MV3 with MAIN world execution & Universal DOM Fallback
def write_extension_dir(target_dir, code, name_suffix=""):
    target_dir.mkdir(parents=True, exist_ok=True)
    manifest = {
        "manifest_version": 3,
        "name": f"YANZIOE VIP {name_suffix} - IOE.vn Tool",
        "version": VERSION,
        "description": "Tool tự giải và hiển thị đáp án Olympic Tiếng Anh IOE.vn (Cocos2d, CreateJS & DOM)",
        "content_scripts": [
            {
                "matches": [
                    "*://ioe.vn/*",
                    "*://*.ioe.vn/*",
                    "*://*.go.vn/*",
                    "*://*.vtc.vn/*",
                    "*://api-edu.go.vn/*"
                ],
                "js": ["content.js"],
                "run_at": "document_start",
                "world": "MAIN",
                "all_frames": True
            }
        ],
        "host_permissions": [
            "*://ioe.vn/*",
            "*://*.ioe.vn/*",
            "*://*.go.vn/*",
            "*://*.vtc.vn/*",
            "*://api-edu.go.vn/*",
            "https://api.groq.com/*",
            "https://generativelanguage.googleapis.com/*",
            "https://openrouter.ai/*"
        ],
        "permissions": ["activeTab", "scripting"],
        "web_accessible_resources": [
            {
                "resources": ["content.js", "YANZIOE.js"],
                "matches": ["*://ioe.vn/*", "*://*.ioe.vn/*", "*://*.go.vn/*", "*://*.vtc.vn/*", "*://api-edu.go.vn/*"]
            }
        ]
    }

    # Universal Wrapper: Tự động đưa code vào MAIN world ngay cả trên trình duyệt không hỗ trợ world: MAIN
    loader_wrapper = f"""// YANZIOE VIP Universal Main-World Loader
(function() {{
    'use strict';
    if (!document.getElementById('yanzioe-main-script')) {{
        try {{
            const s = document.createElement('script');
            s.id = 'yanzioe-main-script';
            s.textContent = {json.dumps(code)};
            (document.head || document.documentElement).appendChild(s);
        }} catch(e) {{}}
    }}
}})();

{code}
"""

    (target_dir / 'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding='utf-8')
    (target_dir / 'content.js').write_text(loader_wrapper, encoding='utf-8')
    (target_dir / 'YANZIOE.js').write_text(code, encoding='utf-8')
    print(f"[OK] Extension with MAIN world written to {target_dir.name}")

# Standard Extension in Repo
write_extension_dir(ROOT / 'YANZIOE_Extension', bundle_code, "")
write_extension_dir(ROOT / 'YANZIOE_Extension_KoKey', bundle_code, "CoKey VIP")

# 6. Export CoKey release to Downloads folder
def pack_folder_zip(src_dir, zip_dest):
    with zipfile.ZipFile(zip_dest, 'w', zipfile.ZIP_DEFLATED) as z:
        for root_p, _, files in os.walk(src_dir):
            for file in files:
                full_path = Path(root_p) / file
                rel = full_path.relative_to(src_dir)
                z.write(full_path, rel)

dist_release_dir = DOWNLOADS_DIR / f'YANZIOE_v{VERSION}_CoKey'
dist_release_dir.mkdir(parents=True, exist_ok=True)

# Copy deliverables into release folder
(dist_release_dir / 'YANZIOE_CoKey.user.js').write_text(make_userscript_header(VERSION, True) + bundle_code, encoding='utf-8')
(dist_release_dir / 'yanzioeKoKey.js').write_text(coke_header + bundle_code, encoding='utf-8')
write_extension_dir(dist_release_dir / 'YANZIOE_Extension_CoKey', bundle_code, "CoKey VIP")

guide_src = ROOT / 'HUONG_DAN_CAI_DAT_KoKey.txt'
if guide_src.exists():
    gtxt = guide_src.read_text(encoding='utf-8').replace('1.0.1', VERSION)
    (dist_release_dir / 'HUONG_DAN_CAI_DAT_CoKey.txt').write_text(gtxt, encoding='utf-8')

hd_key = ROOT / 'hd_lay_keyapi.txt'
if hd_key.exists():
    shutil.copy2(hd_key, dist_release_dir / 'hd_lay_keyapi.txt')

zip_dest = DOWNLOADS_DIR / f'YANZIOE_v{VERSION}_CoKey_VIP.zip'
pack_folder_zip(dist_release_dir, zip_dest)
print(f"[OK] Packaged ZIP release to {zip_dest}")

# Safe clean of previous version packages in Downloads (never touch the repo folder)
for old_item in list(DOWNLOADS_DIR.glob('YANZIOE_v*')):
    if old_item.is_dir() and old_item.name != f'YANZIOE_v{VERSION}_CoKey':
        shutil.rmtree(old_item, ignore_errors=True)
        print(f"[CLEAN] Removed old version folder: {old_item.name}")
    elif old_item.is_file() and old_item.name != f'YANZIOE_v{VERSION}_CoKey_VIP.zip':
        old_item.unlink(missing_ok=True)
        print(f"[CLEAN] Removed old version zip: {old_item.name}")

print(f"🎉 Build completed successfully for YANZIOE VIP v{VERSION}!")
