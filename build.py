import os, json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(BASE_DIR, 'VERSION.txt'), 'r', encoding='utf-8') as f:
    VERSION = f.read().strip()

print(f"Building YANZIOE v{VERSION}...")

MODULES = [
    'utils/utils.js',
    'functions/oneko.js',
    'functions/questionSpoof.js',
    'functions/answerRevealer.js',
    'functions/autoAnswer.js',
    'visuals/mainMenu.js'
]

bundled_parts = []
for rel in MODULES:
    p = os.path.join(BASE_DIR, rel)
    with open(p, 'r', encoding='utf-8') as f:
        bundled_parts.append(f"/* --- {rel} --- */\n" + f.read())

bundle_code = "\n\n".join(bundled_parts)

# 1. Write YANZIOE.js
dist_js = os.path.join(BASE_DIR, 'YANZIOE.js')
with open(dist_js, 'w', encoding='utf-8') as f:
    f.write(bundle_code)
print(f"[OK] Generated {dist_js} ({len(bundle_code)} bytes)")

# 2. Write YANZIOE.user.js (Userscript Header)
userscript_header = f"""// ==UserScript==
// @name         YANZIOE VIP - IOE.vn Auto Answer & Revealer
// @namespace    https://yanzbn.shop/
// @version      {VERSION}
// @description  Tool hỗ trợ giải bài và hiển thị đáp án Olympic tiếng Anh IOE.vn
// @author       YanzBn
// @match        *://ioe.vn/*
// @match        *://*.ioe.vn/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

"""

dist_user_js = os.path.join(BASE_DIR, 'YANZIOE.user.js')
with open(dist_user_js, 'w', encoding='utf-8') as f:
    f.write(userscript_header + bundle_code)
print(f"[OK] Generated {dist_user_js}")

# 3. Write Chrome Extension files
ext_dir = os.path.join(BASE_DIR, 'YANZIOE_Extension')
os.makedirs(ext_dir, exist_ok=True)

manifest = {
    "manifest_version": 3,
    "name": "YANZIOE VIP - IOE.vn Tool",
    "version": VERSION,
    "description": "Tool tự giải và hiển thị đáp án Olympic Tiếng Anh IOE.vn",
    "content_scripts": [
        {
            "matches": ["*://ioe.vn/*", "*://*.ioe.vn/*"],
            "js": ["content.js"],
            "run_at": "document_start"
        }
    ],
    "permissions": ["activeTab", "scripting"]
}

with open(os.path.join(ext_dir, 'manifest.json'), 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)

with open(os.path.join(ext_dir, 'content.js'), 'w', encoding='utf-8') as f:
    f.write(bundle_code)

print(f"[OK] Extension generated at {ext_dir}")
print(f"🎉 Build completed successfully for YANZIOE v{VERSION}!")
