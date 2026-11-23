import os
import json
import shutil
import subprocess
import tempfile
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
    'functions/licenseGate.js',
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

raw_bundle = "\n\n".join(bundled_parts).replace(
    "})(typeof window !== 'undefined' ? window : globalThis);",
    "})(__yanz_scope);"
)
bundle_code = f"""/* YANZIOE VIP v{VERSION} */
(function() {{
    const _w = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const _sym = Symbol.for('yanz.ioe.core');
    if (_w[_sym]) return;
    _w[_sym] = 1;
    const __yanz_scope = (typeof location === 'undefined' || !/^https?:$/i.test(location.protocol || ''))
        ? (typeof window !== 'undefined' ? window : globalThis) : {{}};
{raw_bundle}
}})();
"""

def obfuscate_js(code_str, mode="main"):
    helper = ROOT / "obfuscate_helper.js"
    if not helper.exists():
        raise RuntimeError(f"Missing obfuscate_helper.js at {helper}")
    with tempfile.TemporaryDirectory() as td:
        inp = Path(td) / "in.js"
        out = Path(td) / "out.js"
        inp.write_text(code_str, encoding="utf-8")
        subprocess.run(["node", str(helper), mode, str(inp), str(out)], check=True)
        return out.read_text(encoding="utf-8")

# 1. Standard YANZIOE.js (local verification harness)
dist_js = ROOT / 'YANZIOE.js'
dist_js.write_text(bundle_code, encoding='utf-8')
print(f"[OK] Generated {dist_js.name} ({len(bundle_code)} bytes)")

print("[...] Obfuscating release bundle + MV3 workers (RC4 + CFF + Self-Defending + Anti-Debug)...")
protected_code = obfuscate_js(bundle_code, "main")
print(f"[OK] Protected bundle ready ({len(protected_code)} bytes)")

# 2. Userscript header builder
def make_userscript_header(ver, is_coke=False):
    title = "YANZIOE VIP (CoKey)" if is_coke else "YANZIOE VIP"
    desc = "Tool tự giải bài và hiển thị đáp án Olympic Tiếng Anh IOE.vn (Cocos2d, CreateJS & DOM) - Có License Key YanzBn"
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
// @match        *://*.vtconline.vn/*
// @match        *://vtconline.vn/*
// @match        *://*.goplay.vn/*
// @match        *://api-edu.go.vn/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      yanzbnshop.onrender.com
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
dist_user_js.write_text(make_userscript_header(VERSION, True) + protected_code, encoding='utf-8')
print(f"[OK] Generated {dist_user_js.name}")

# 4. CoKey Standalone files (protected)
coke_header = "/* YANZIOE VIP v" + VERSION + " CoKey (YanzBn License + Anti-Tamper Protected) */\n"
dist_coke_min = ROOT / 'yanzioeKoKey.js'
dist_coke_min.write_text(coke_header + protected_code, encoding='utf-8')

dist_coke_user = ROOT / 'YANZIOE_KoKey.user.js'
dist_coke_user.write_text(make_userscript_header(VERSION, True) + protected_code, encoding='utf-8')
print(f"[OK] Generated {dist_coke_min.name} and {dist_coke_user.name}")

# 5. Helper to write Chrome Extension MV3 with MAIN world execution, Bridge & Background Service Worker (Zero CSP/CORS)
BRIDGE_JS = """/* YANZIOE Extension Bridge (ISOLATED World) */
(function () {
    'use strict';
    document.documentElement.dataset.ioeBridge = '1';

    window.addEventListener('message', function (ev) {
        if (ev.source !== window || !ev.data) return;
        const d = ev.data;
        if (d.type === 'IOE_BRIDGE_FETCH_REQ') {
            chrome.runtime.sendMessage({ type: 'IOE_FETCH', payload: d.payload }, function (res) {
                const err = chrome.runtime.lastError ? chrome.runtime.lastError.message : null;
                window.postMessage({
                    type: 'IOE_BRIDGE_FETCH_RES',
                    id: d.id,
                    payload: err ? { ok: false, status: 0, error: err } : (res || { ok: false, status: 0, error: 'Empty bridge reply' })
                }, '*');
            });
        } else if (d.type === 'IOE_BRIDGE_STORAGE_GET') {
            chrome.runtime.sendMessage({ type: 'IOE_STORAGE_GET', key: d.key }, function (res) {
                window.postMessage({
                    type: 'IOE_BRIDGE_STORAGE_RES',
                    id: d.id,
                    value: res?.value ?? ''
                }, '*');
            });
        } else if (d.type === 'IOE_BRIDGE_STORAGE_SET') {
            chrome.runtime.sendMessage({ type: 'IOE_STORAGE_SET', key: d.key, value: d.value });
        }
    });

    /* Fallback injector only for legacy browsers ignoring world: MAIN */
    setTimeout(function () {
        if (document.documentElement.dataset.ioeMainLoaded !== '1') {
            try {
                const sc = document.createElement('script');
                sc.src = chrome.runtime.getURL('YANZIOE.js');
                (document.head || document.documentElement).appendChild(sc);
            } catch (e) {}
        }
    }, 80);
})();
"""

BACKGROUND_JS = """/* YANZIOE Extension Background Service Worker (CSP-Free Proxy + Cross-Domain Storage) */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'IOE_STORAGE_GET' && msg.key) {
        chrome.storage.local.get([msg.key], (items) => {
            sendResponse({ value: items?.[msg.key] || '' });
        });
        return true;
    }
    if (msg?.type === 'IOE_STORAGE_SET' && msg.key) {
        if (msg.value) chrome.storage.local.set({ [msg.key]: String(msg.value) });
        else chrome.storage.local.remove([msg.key]);
        return false;
    }
    if (msg?.type !== 'IOE_FETCH' || !msg.payload?.url) return false;

    const { url, method = 'GET', headers = {}, body, responseType = 'text', multipartAudioBase64 = '', whisperModel = 'whisper-large-v3-turbo' } = msg.payload;
    (async () => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 28000);
        try {
            const cleanHeaders = { ...headers };
            const init = { method, headers: cleanHeaders, signal: ctrl.signal };
            if (multipartAudioBase64) {
                const binStr = atob(multipartAudioBase64);
                const bytes = new Uint8Array(binStr.length);
                for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
                const fd = new FormData();
                fd.append('file', new Blob([bytes], { type: 'audio/mpeg' }), 'question.mp3');
                fd.append('model', whisperModel || 'whisper-large-v3-turbo');
                init.method = 'POST';
                init.body = fd;
                delete cleanHeaders['Content-Type'];
            } else if (body !== undefined && method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD') {
                init.body = body;
            }
            const resp = await fetch(url, init);
            const contentType = resp.headers.get('content-type') || '';
            if (responseType === 'base64') {
                const buf = await resp.arrayBuffer();
                const bytes = new Uint8Array(buf);
                let bin = '';
                for (let i = 0; i < bytes.length; i += 8192) {
                    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
                }
                sendResponse({ ok: resp.ok, status: resp.status, text: '', base64: btoa(bin), contentType });
            } else {
                const text = await resp.text();
                sendResponse({ ok: resp.ok, status: resp.status, text, base64: '', contentType });
            }
        } catch (err) {
            sendResponse({ ok: false, status: 0, error: err?.message || String(err) });
        } finally {
            clearTimeout(timer);
        }
    })();
    return true;
});
"""

def write_extension_dir(target_dir, code, name_suffix=""):
    target_dir.mkdir(parents=True, exist_ok=True)
    manifest = {
        "manifest_version": 3,
        "name": f"YANZIOE VIP {name_suffix} - IOE.vn Tool",
        "version": VERSION,
        "description": "Tool tự giải và hiển thị đáp án Olympic Tiếng Anh IOE.vn (Cocos2d, CreateJS & DOM)",
        "background": {
            "service_worker": "background.js"
        },
        "content_scripts": [
            {
                "matches": [
                    "*://ioe.vn/*",
                    "*://*.ioe.vn/*",
                    "*://*.go.vn/*",
                    "*://*.vtc.vn/*",
                    "*://*.vtconline.vn/*",
                    "*://vtconline.vn/*",
                    "*://*.goplay.vn/*",
                    "*://api-edu.go.vn/*"
                ],
                "js": ["bridge.js"],
                "run_at": "document_start",
                "world": "ISOLATED",
                "all_frames": True
            },
            {
                "matches": [
                    "*://ioe.vn/*",
                    "*://*.ioe.vn/*",
                    "*://*.go.vn/*",
                    "*://*.vtc.vn/*",
                    "*://*.vtconline.vn/*",
                    "*://vtconline.vn/*",
                    "*://*.goplay.vn/*",
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
            "*://*.vtconline.vn/*",
            "*://vtconline.vn/*",
            "*://*.goplay.vn/*",
            "*://api-edu.go.vn/*",
            "https://yanzbnshop.onrender.com/*",
            "https://api.groq.com/*",
            "https://generativelanguage.googleapis.com/*",
            "https://aiplatform.googleapis.com/*",
            "https://openrouter.ai/*",
            "https://*/*"
        ],
        "permissions": ["activeTab", "scripting", "storage"],
        "web_accessible_resources": [
            {
                "resources": ["YANZIOE.js", "bridge.js"],
                "matches": ["*://ioe.vn/*", "*://*.ioe.vn/*", "*://*.go.vn/*", "*://*.vtc.vn/*", "*://*.vtconline.vn/*", "*://vtconline.vn/*", "*://*.goplay.vn/*", "*://api-edu.go.vn/*"]
            }
        ]
    }

    (target_dir / 'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding='utf-8')
    (target_dir / 'bridge.js').write_text(PROTECTED_BRIDGE_JS, encoding='utf-8')
    (target_dir / 'background.js').write_text(PROTECTED_BACKGROUND_JS, encoding='utf-8')
    (target_dir / 'content.js').write_text(code, encoding='utf-8')
    (target_dir / 'YANZIOE.js').write_text(code, encoding='utf-8')
    print(f"[OK] Extension (Protected MAIN world & Storage Bridge) written to {target_dir.name}")

PROTECTED_BRIDGE_JS = obfuscate_js(BRIDGE_JS, "worker")
PROTECTED_BACKGROUND_JS = obfuscate_js(BACKGROUND_JS, "worker")

# Standard Extension in Repo (Protected)
write_extension_dir(ROOT / 'YANZIOE_Extension', protected_code, "")
write_extension_dir(ROOT / 'YANZIOE_Extension_KoKey', protected_code, "CoKey VIP")

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

# Copy deliverables into release folder (Protected)
(dist_release_dir / 'YANZIOE_CoKey.user.js').write_text(make_userscript_header(VERSION, True) + protected_code, encoding='utf-8')
(dist_release_dir / 'yanzioeCoKey.js').write_text(coke_header + protected_code, encoding='utf-8')
(dist_release_dir / 'yanzioeKoKey.js').write_text(coke_header + protected_code, encoding='utf-8')
write_extension_dir(dist_release_dir / 'YANZIOE_Extension_CoKey', protected_code, "CoKey VIP")

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
