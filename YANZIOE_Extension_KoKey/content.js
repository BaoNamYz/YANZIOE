/* YANZIOE VIP v1.2.4 */
(function() {
    const _w = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (_w.__YANZIOE_BOOTED__) return;
    _w.__YANZIOE_BOOTED__ = true;
/* --- utils/utils.js --- */
(function (global) {
    'use strict';
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    /* Capture pristine native timers before Freeze Timer or page scripts alter them */
    const nativeSetInterval = win.setInterval.bind(win);
    const nativeClearInterval = win.clearInterval.bind(win);
    const nativeSetTimeout = win.setTimeout.bind(win);
    const nativeClearTimeout = win.clearTimeout.bind(win);

    class EventEmitter {
        constructor() { this._events = {}; }
        on(e, fn) { (this._events[e] = this._events[e] || []).push(fn); return () => this.off(e, fn); }
        off(e, fn) { if (!this._events[e]) return; this._events[e] = this._events[e].filter(f => f !== fn); }
        emit(e, ...args) { (this._events[e] || []).forEach(fn => { try { fn(...args); } catch (err) { console.error(err); } }); }
    }

    const events = new EventEmitter();

    function onBodyReady(fn) {
        if (document.body) { fn(); return; }
        const obs = new MutationObserver(() => {
            if (document.body) {
                obs.disconnect();
                fn();
            }
        });
        obs.observe(document.documentElement || document, { childList: true, subtree: true });
    }

    let lastToastMsg = '';
    let lastToastTime = 0;

    function toast(msg, duration = 2200) {
        const now = Date.now();
        if (msg === lastToastMsg && (now - lastToastTime) < 2500) {
            return;
        }
        lastToastMsg = msg;
        lastToastTime = now;

        onBodyReady(() => {
            let box = document.getElementById('ioe-toast-box');
            if (!box) {
                box = document.createElement('div');
                box.id = 'ioe-toast-box';
                box.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
                document.body.appendChild(box);
            }
            const el = document.createElement('div');
            el.style.cssText = 'background:rgba(15,23,42,0.94);backdrop-filter:blur(8px);border:1px solid #38bdf8;color:#f8fafc;padding:8px 14px;border-radius:8px;font-size:12.5px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,0.45);transition:opacity 0.25s ease;';
            el.innerText = msg;
            box.appendChild(el);
            nativeSetTimeout(() => {
                el.style.opacity = '0';
                nativeSetTimeout(() => el.remove(), 260);
            }, duration);
        });
    }

    function delay(ms) {
        return new Promise(r => nativeSetTimeout(r, ms));
    }

    function escHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    async function requestExternal(url, options = {}) {
        const { method = 'GET', headers = {}, body = undefined, timeoutMs = 15000, responseType = 'text' } = options;

        // Channel 1: Extension MV3 Background Bridge (zero CSP/CORS restrictions)
        if (document.documentElement?.dataset?.ioeBridge === '1') {
            const bridgeRes = await new Promise((resolve) => {
                const id = 'ioeb_' + Math.random().toString(36).slice(2) + Date.now();
                const timer = nativeSetTimeout(() => {
                    window.removeEventListener('message', onMsg);
                    resolve(null);
                }, timeoutMs);
                function onMsg(ev) {
                    if (ev.source !== window || ev.data?.type !== 'IOE_BRIDGE_FETCH_RES' || ev.data?.id !== id) return;
                    nativeClearTimeout(timer);
                    window.removeEventListener('message', onMsg);
                    resolve(ev.data.payload);
                }
                window.addEventListener('message', onMsg);
                window.postMessage({
                    type: 'IOE_BRIDGE_FETCH_REQ',
                    id,
                    payload: { url, method, headers, body, responseType }
                }, '*');
            });
            if (bridgeRes) {
                return bridgeRes;
            }
        }

        // Channel 2: Tampermonkey GM_xmlhttpRequest (zero CSP/CORS restrictions)
        const gmXhr = typeof global.GM_xmlhttpRequest === 'function'
            ? global.GM_xmlhttpRequest
            : (typeof win.GM_xmlhttpRequest === 'function' ? win.GM_xmlhttpRequest : null);
        if (gmXhr) {
            return await new Promise((resolve) => {
                gmXhr({
                    method,
                    url,
                    headers,
                    data: body,
                    timeout: timeoutMs,
                    responseType: responseType === 'base64' ? 'arraybuffer' : 'text',
                    onload(r) {
                        resolve({ ok: r.status >= 200 && r.status < 300, status: r.status, text: r.responseText || '' });
                    },
                    onerror(e) { resolve({ ok: false, status: 0, error: e?.statusText || 'GM_xhr error' }); },
                    ontimeout() { resolve({ ok: false, status: 0, error: 'GM_xhr timeout' }); }
                });
            });
        }

        // Channel 3: Native fetch fallback
        const ctrl = new AbortController();
        const tm = nativeSetTimeout(() => ctrl.abort(), timeoutMs);
        try {
            const r = await fetch(url, { method, headers, body, signal: ctrl.signal });
            let text = '';
            if (typeof r.text === 'function') text = await r.text();
            else if (typeof r.json === 'function') text = JSON.stringify(await r.json());
            return { ok: r.ok, status: r.status, text };
        } catch (err) {
            return { ok: false, status: 0, error: err?.message || String(err) };
        } finally {
            nativeClearTimeout(tm);
        }
    }

    if (document.documentElement) {
        document.documentElement.dataset.ioeMainLoaded = '1';
    }

    const ioeState = {
        version: '1.2.4',
        events,
        toast,
        delay,
        escHtml,
        onBodyReady,
        timers: {
            setInterval: nativeSetInterval,
            clearInterval: nativeClearInterval,
            setTimeout: nativeSetTimeout,
            clearTimeout: nativeClearTimeout
        },
        net: { requestExternal },
        state: {
            licensed: false,
            isSolving: false,
            currentQuestionId: null,
            packetHits: 0,
            lastEngine: 'Đang quét...',
            questions: new Map(),
            solvedMeta: new Map(),
            correctAnswers: new Map(),
            clozeAnswers: {}
        },
        features: {
            autoAnswer: true,
            showAnswers: true,
            canvasMode: true,
            streamMode: false,
            oneko: false,
            rgbLogo: true,
            freezeTimer: true
        },
        featureConfigs: {
            apiKey: (function () {
                try {
                    if (typeof localStorage !== 'undefined') {
                        return localStorage.getItem('IOE_API_KEY') || localStorage.getItem('YANZIOE_API_KEY') || '';
                    }
                } catch (e) {}
                return '';
            })(),
            aiProvider: 'gemini',
            autoDelay: 1400,
            questionMode: 'stealth'
        }
    };

    global.IOE = ioeState;
    win.IOE = ioeState;
})(typeof window !== 'undefined' ? window : globalThis);


/* --- functions/licenseGate.js --- */
(function (global) {
    'use strict';
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const IOE = global.IOE || win.IOE;
    if (!IOE) return;

    const VERIFY_API = 'https://yanzbnshop.onrender.com/api/v1/keys/verify';
    const SHOP_URL = 'https://yanzbnshop.onrender.com/#shop-keys';
    const RESET_URL = 'https://yanzbnshop.onrender.com/#reset-hwid';
    const PK_HEX = '231c8e6a0dd5641a14153b363208e261b95367178f8154cdadeed73bd2a3ec2b';
    const KEY_STORAGE_KEY = 'YANZIOE_VIP_LICENSE_KEY';
    const SESSION_CACHE_KEY = 'YANZIOE_VIP_LICENSE_CACHE';
    const HWID_STORAGE_KEY = 'YANZIOE_VIP_HWID_FP';

    /* ================= 1. COMPACT SHA-512 + ED25519 (RFC 8032) ================= */
    const K512 = [
        0x428a2f98d728ae22n, 0x7137449123ef65cdn, 0xb5c0fbcfec4d3b2fn, 0xe9b5dba58189dbbcn,
        0x3956c25bf348b538n, 0x59f111f1b605d019n, 0x923f82a4af194f9bn, 0xab1c5ed5da6d8118n,
        0xd807aa98a3030242n, 0x12835b0145706fben, 0x243185be4ee4b28cn, 0x550c7dc3d5ffb4e2n,
        0x72be5d74f27b896fn, 0x80deb1fe3b1696b1n, 0x9bdc06a725c71235n, 0xc19bf174cf692694n,
        0xe49b69c19ef14ad2n, 0xefbe4786384f25e3n, 0x0fc19dc68b8cd5b5n, 0x240ca1cc77ac9c65n,
        0x2de92c6f592b0275n, 0x4a7484aa6ea6e483n, 0x5cb0a9dcbd41fbd4n, 0x76f988da831153b5n,
        0x983e5152ee66dfabn, 0xa831c66d2db43210n, 0xb00327c898fb213fn, 0xbf597fc7beef0ee4n,
        0xc6e00bf33da88fc2n, 0xd5a79147930aa725n, 0x06ca6351e003826fn, 0x142929670a0e6e70n,
        0x27b70a8546d22ffcn, 0x2e1b21385c26c926n, 0x4d2c6dfc5ac42aedn, 0x53380d139d95b3dfn,
        0x650a73548baf63den, 0x766a0abb3c77b2a8n, 0x81c2c92e47edaee6n, 0x92722c851482353bn,
        0xa2bfe8a14cf10364n, 0xa81a664bbc423001n, 0xc24b8b70d0f89791n, 0xc76c51a30654be30n,
        0xd192e819d6ef5218n, 0xd69906245565a910n, 0xf40e35855771202an, 0x106aa07032bbd1b8n,
        0x19a4c116b8d2d0c8n, 0x1e376c085141ab53n, 0x2748774cdf8eeb99n, 0x34b0bcb5e19b48a8n,
        0x391c0cb3c5c95a63n, 0x4ed8aa4ae3418acbn, 0x5b9cca4f7763e373n, 0x682e6ff3d6b2b8a3n,
        0x748f82ee5defb2fcn, 0x78a5636f43172f60n, 0x84c87814a1f0ab72n, 0x8cc702081a6439ecn,
        0x90befffa23631e28n, 0xa4506cebde82bde9n, 0xbef9a3f7b2c67915n, 0xc67178f2e372532bn,
        0xca273eceea26619cn, 0xd186b8c721c0c207n, 0xeada7dd6cde0eb1en, 0xf57d4f7fee6ed178n,
        0x06f067aa72176fban, 0x0a637dc5a2c898a6n, 0x113f9804bef90daen, 0x1b710b35131c471bn,
        0x28db77f523047d84n, 0x32caab7b40c72493n, 0x3c9ebe0a15c9bebcn, 0x431d67c49c100d4cn,
        0x4cc5d4becb3e42b6n, 0x597f299cfc657e2an, 0x5fcb6fab3ad6faecn, 0x6c44198c4a475817n
    ];
    const M64 = 0xffffffffffffffffn;
    const rotr64 = (x, n) => ((x >> BigInt(n)) | (x << BigInt(64 - n))) & M64;

    function sha512Bytes(inputBytes) {
        const len = inputBytes.length;
        const bitLen = BigInt(len) * 8n;
        const rem = (len + 1 + 16) % 128;
        const padZero = rem === 0 ? 0 : 128 - rem;
        const buf = new Uint8Array(len + 1 + padZero + 16);
        buf.set(inputBytes, 0);
        buf[len] = 0x80;
        let b = bitLen;
        for (let i = 0; i < 8; i++) {
            buf[buf.length - 1 - i] = Number(b & 0xffn);
            b >>= 8n;
        }
        let h0 = 0x6a09e667f3bcc908n, h1 = 0xbb67ae8584caa73bn, h2 = 0x3c6ef372fe94f82bn, h3 = 0xa54ff53a5f1d36f1n;
        let h4 = 0x510e527fade682d1n, h5 = 0x9b05688c2b3e6c1fn, h6 = 0x1f83d9abfb41bd6bn, h7 = 0x5be0cd19137e2179n;
        const W = new Array(80);
        for (let off = 0; off < buf.length; off += 128) {
            for (let i = 0; i < 16; i++) {
                let v = 0n;
                for (let j = 0; j < 8; j++) v = (v << 8n) | BigInt(buf[off + i * 8 + j]);
                W[i] = v;
            }
            for (let i = 16; i < 80; i++) {
                const s0 = rotr64(W[i - 15], 1) ^ rotr64(W[i - 15], 8) ^ (W[i - 15] >> 7n);
                const s1 = rotr64(W[i - 2], 19) ^ rotr64(W[i - 2], 61) ^ (W[i - 2] >> 6n);
                W[i] = (W[i - 16] + s0 + W[i - 7] + s1) & M64;
            }
            let a = h0, b0 = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
            for (let i = 0; i < 80; i++) {
                const S1 = rotr64(e, 14) ^ rotr64(e, 18) ^ rotr64(e, 41);
                const ch = (e & f) ^ ((~e & M64) & g);
                const t1 = (h + S1 + ch + K512[i] + W[i]) & M64;
                const S0 = rotr64(a, 28) ^ rotr64(a, 34) ^ rotr64(a, 39);
                const maj = (a & b0) ^ (a & c) ^ (b0 & c);
                const t2 = (S0 + maj) & M64;
                h = g; g = f; f = e; e = (d + t1) & M64;
                d = c; c = b0; b0 = a; a = (t1 + t2) & M64;
            }
            h0 = (h0 + a) & M64; h1 = (h1 + b0) & M64; h2 = (h2 + c) & M64; h3 = (h3 + d) & M64;
            h4 = (h4 + e) & M64; h5 = (h5 + f) & M64; h6 = (h6 + g) & M64; h7 = (h7 + h) & M64;
        }
        const out = new Uint8Array(64);
        const hs = [h0, h1, h2, h3, h4, h5, h6, h7];
        for (let i = 0; i < 8; i++) {
            let v = hs[i];
            for (let j = 7; j >= 0; j--) { out[i * 8 + j] = Number(v & 0xffn); v >>= 8n; }
        }
        return out;
    }

    const ED_Q = (1n << 255n) - 19n;
    const ED_L = (1n << 252n) + 27742317777372353535851937790883648493n;
    function modQ(a) { const r = a % ED_Q; return r >= 0n ? r : r + ED_Q; }
    function powMod(b, e, m) {
        let r = 1n;
        b = b % m;
        if (b < 0n) b += m;
        while (e > 0n) {
            if (e & 1n) r = (r * b) % m;
            b = (b * b) % m;
            e >>= 1n;
        }
        return r;
    }
    const ED_D = modQ(-121665n * powMod(121666n, ED_Q - 2n, ED_Q));
    const ED_I = powMod(2n, (ED_Q - 1n) >> 2n, ED_Q);
    function edRecoverX(y) {
        const y2 = modQ(y * y);
        const xx = modQ((y2 - 1n) * powMod(modQ(ED_D * y2 + 1n), ED_Q - 2n, ED_Q));
        let x = powMod(xx, (ED_Q + 3n) >> 3n, ED_Q);
        if (modQ(x * x - xx) !== 0n) x = modQ(x * ED_I);
        return (x & 1n) ? (ED_Q - x) : x;
    }
    const ED_By = modQ(4n * powMod(5n, ED_Q - 2n, ED_Q));
    const ED_G = [edRecoverX(ED_By), ED_By];

    function edAdd(P, Q) {
        const [x1, y1] = P, [x2, y2] = Q;
        const d = modQ(ED_D * x1 * x2 * y1 * y2);
        return [
            modQ((x1 * y2 + x2 * y1) * powMod(modQ(1n + d), ED_Q - 2n, ED_Q)),
            modQ((y1 * y2 + x1 * x2) * powMod(modQ(1n - d), ED_Q - 2n, ED_Q))
        ];
    }
    function edMul(P, e) {
        let R = [0n, 1n], T = P, k = e;
        while (k > 0n) {
            if (k & 1n) R = edAdd(R, T);
            T = edAdd(T, T);
            k >>= 1n;
        }
        return R;
    }
    function leBytesToBigInt(arr) {
        let r = 0n;
        for (let i = arr.length - 1; i >= 0; i--) r = (r << 8n) | BigInt(arr[i]);
        return r;
    }
    function decodeEdPoint(b32) {
        const xSign = (b32[31] >> 7) & 1;
        const cp = new Uint8Array(b32);
        cp[31] &= 0x7f;
        const y = leBytesToBigInt(cp);
        if (y >= ED_Q) return null;
        const y2 = modQ(y * y);
        const u = modQ(y2 - 1n);
        const v = modQ(ED_D * y2 + 1n);
        const xx = modQ(u * powMod(v, ED_Q - 2n, ED_Q));
        let x = powMod(xx, (ED_Q + 3n) >> 3n, ED_Q);
        if (modQ(x * x - xx) !== 0n) x = modQ(x * ED_I);
        if (modQ(x * x - xx) !== 0n) return null;
        if (x === 0n && xSign === 1) return null;
        if (Number(x & 1n) !== xSign) x = ED_Q - x;
        return [x, y];
    }
    function hexToBytes(hex) {
        if (!hex || typeof hex !== 'string' || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) return null;
        const u = new Uint8Array(hex.length / 2);
        for (let i = 0; i < u.length; i++) u[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
        return u;
    }
    function verifyEd25519(sigHex, msgStr, pkHex = PK_HEX) {
        try {
            const sig = hexToBytes(sigHex);
            const pk = hexToBytes(pkHex);
            if (!sig || sig.length !== 64 || !pk || pk.length !== 32) return false;
            const R = decodeEdPoint(sig.subarray(0, 32));
            const A = decodeEdPoint(pk);
            const S = leBytesToBigInt(sig.subarray(32, 64));
            if (!R || !A || S >= ED_L) return false;
            const msgBytes = new TextEncoder().encode(String(msgStr));
            const inp = new Uint8Array(32 + 32 + msgBytes.length);
            inp.set(sig.subarray(0, 32), 0);
            inp.set(pk, 32);
            inp.set(msgBytes, 64);
            const h = leBytesToBigInt(sha512Bytes(inp)) % ED_L;
            const left = edMul(ED_G, S);
            const right = edAdd(R, edMul(A, h));
            return left[0] === right[0] && left[1] === right[1];
        } catch (e) {
            return false;
        }
    }

    /* ================= 2. CROSS-ORIGIN STORAGE & HARDWARE HWID ================= */
    async function kvGet(key) {
        try {
            if (document.documentElement?.dataset?.ioeBridge === '1') {
                const res = await new Promise((resolve) => {
                    const id = 'ioesg_' + Math.random().toString(36).slice(2);
                    const tm = setTimeout(() => { window.removeEventListener('message', onMsg); resolve(null); }, 1200);
                    function onMsg(ev) {
                        if (ev.source !== window || ev.data?.type !== 'IOE_BRIDGE_STORAGE_RES' || ev.data?.id !== id) return;
                        clearTimeout(tm); window.removeEventListener('message', onMsg); resolve(ev.data.value ?? null);
                    }
                    window.addEventListener('message', onMsg);
                    window.postMessage({ type: 'IOE_BRIDGE_STORAGE_GET', id, key }, '*');
                });
                if (res) return res;
            }
        } catch (e) {}
        try {
            if (typeof GM_getValue === 'function') {
                const gmVal = GM_getValue(key, '');
                if (gmVal) return gmVal;
            }
        } catch (e) {}
        try { const ls = localStorage.getItem(key); if (ls) return ls; } catch (e) {}
        try { const ss = sessionStorage.getItem(key); if (ss) return ss; } catch (e) {}
        try {
            const wn = JSON.parse(window.name || '{}');
            if (wn && wn[key]) return wn[key];
        } catch (e) {}
        try {
            const m = new RegExp('(?:^|;\\s*)' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]+)').exec(document.cookie || '');
            if (m) return decodeURIComponent(m[1]);
        } catch (e) {}
        return '';
    }

    async function kvSet(key, val) {
        const v = String(val || '');
        try {
            if (document.documentElement?.dataset?.ioeBridge === '1') {
                window.postMessage({ type: 'IOE_BRIDGE_STORAGE_SET', key, value: v }, '*');
            }
        } catch (e) {}
        try { if (typeof GM_setValue === 'function') GM_setValue(key, v); } catch (e) {}
        try {
            if (v) localStorage.setItem(key, v);
            else localStorage.removeItem(key);
        } catch (e) {}
        try {
            if (v) sessionStorage.setItem(key, v);
            else sessionStorage.removeItem(key);
        } catch (e) {}
        try {
            let wn = {};
            try { wn = JSON.parse(window.name || '{}'); } catch (e) {}
            if (v) wn[key] = v; else delete wn[key];
            window.name = JSON.stringify(wn);
        } catch (e) {}
        try {
            const hostParts = (location.hostname || '').split('.');
            const rootDom = hostParts.length >= 2 ? `; domain=.${hostParts.slice(-2).join('.')}` : '';
            if (v) document.cookie = `${key}=${encodeURIComponent(v)}; path=/${rootDom}; max-age=315360000; SameSite=Lax`;
            else document.cookie = `${key}=; path=/${rootDom}; max-age=0; SameSite=Lax`;
        } catch (e) {}
    }

    let cachedHwid = '';
    async function getHardwareHwid() {
        if (cachedHwid) return cachedHwid;
        let stored = await kvGet(HWID_STORAGE_KEY);
        if (stored && /^IOE-[0-9A-F]{20,32}$/.test(stored)) {
            cachedHwid = stored;
            return cachedHwid;
        }
        const parts = [
            navigator.platform || '',
            String(navigator.hardwareConcurrency || 0),
            String(navigator.deviceMemory || 0),
            `${screen?.width || 0}x${screen?.height || 0}x${screen?.colorDepth || 0}`,
            (Intl.DateTimeFormat().resolvedOptions().timeZone || '')
        ];
        try {
            const glC = document.createElement('canvas');
            const gl = glC.getContext('webgl') || glC.getContext('experimental-webgl');
            if (gl) {
                const dbg = gl.getExtension('WEBGL_debug_renderer_info');
                if (dbg) {
                    parts.push(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || '');
                    parts.push(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '');
                }
            }
        } catch (e) {}
        try {
            const c = document.createElement('canvas');
            c.width = 180; c.height = 30;
            const ctx = c.getContext('2d');
            if (ctx) {
                ctx.font = '14px sans-serif';
                ctx.fillText('YanzIOE_HW_v1.2', 4, 20);
                parts.push(c.toDataURL().slice(-48));
            }
        } catch (e) {}
        const digest = sha512Bytes(new TextEncoder().encode('IOEHW2|' + parts.join('|')));
        let hx = '';
        for (let i = 0; i < 14; i++) hx += digest[i].toString(16).padStart(2, '0').toUpperCase();
        cachedHwid = 'IOE-' + hx;
        await kvSet(HWID_STORAGE_KEY, cachedHwid);
        return cachedHwid;
    }

    function randomHex(byteLen = 16) {
        const u = new Uint8Array(byteLen);
        if (global.crypto?.getRandomValues) global.crypto.getRandomValues(u);
        else for (let i = 0; i < byteLen; i++) u[i] = Math.floor(Math.random() * 256);
        return Array.from(u, b => b.toString(16).padStart(2, '0')).join('');
    }

    /* ================= 3. LICENSE STATE & VERIFICATION ================= */
    const licenseState = {
        licensed: false,
        key: '',
        hwid: '',
        expiresAt: '',
        duration: '',
        daysLeft: 0,
        lastError: ''
    };

    async function verifyKeyRemote(rawKey) {
        const keyCode = String(rawKey || '').trim().toUpperCase();
        if (!keyCode) {
            licenseState.lastError = 'Vui lòng nhập mã Key YANZ-IOE-...';
            return { ok: false, error: licenseState.lastError };
        }
        const hwid = await getHardwareHwid();
        const nonce = randomHex(16);
        const body = JSON.stringify({ key: keyCode, hwid, game: 'yanz-ioe-vip', nonce });
        try {
            let res;
            if (IOE.net?.requestExternal) {
                res = await IOE.net.requestExternal(VERIFY_API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body,
                    timeoutMs: 15000
                });
            } else {
                const fr = await fetch(VERIFY_API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body
                });
                res = { ok: fr.ok, status: fr.status, text: await fr.text() };
            }
            if (!res || !res.text) {
                licenseState.lastError = 'Không kết nối được server bản quyền. Vui lòng thử lại!';
                return { ok: false, error: licenseState.lastError };
            }
            let j;
            try { j = JSON.parse(res.text); } catch (e) {
                licenseState.lastError = 'Server đang khởi động (Cold Start), vui lòng bấm Kích Hoạt lại sau vài giây!';
                return { ok: false, error: licenseState.lastError };
            }
            if (!j || !j.valid) {
                licenseState.licensed = false;
                licenseState.lastError = j?.error || 'Key không hợp lệ hoặc sai HWID!';
                if (j?.expired || j?.banned || res.status === 404 || res.status === 403) {
                    await kvSet(SESSION_CACHE_KEY, '');
                }
                return { ok: false, error: licenseState.lastError, hwidLocked: !!j?.hwid_locked };
            }

            const respKey = String(j.key || keyCode).trim().toUpperCase();
            const respHwid = String(j.hwid || hwid);
            const respExp = String(j.expires_at || 'Vĩnh Viễn (Lifetime)');
            const edSig = String(j.ed_sig || '');
            const edTs = String(j.ed_ts || '');
            const canonMsg = `YIOE1|${respKey}|${respHwid}|${nonce}|${edTs}|${respExp}`;
            if (!verifyEd25519(edSig, canonMsg)) {
                licenseState.licensed = false;
                licenseState.lastError = 'Chữ ký bảo mật Ed25519 từ server không khớp! Từ chối kích hoạt.';
                return { ok: false, error: licenseState.lastError };
            }

            licenseState.licensed = true;
            licenseState.key = respKey;
            licenseState.hwid = hwid;
            licenseState.expiresAt = respExp;
            licenseState.duration = String(j.duration || '');
            licenseState.daysLeft = Number(j.days_left ?? 0);
            licenseState.lastError = '';
            IOE.state.licensed = true;

            await kvSet(KEY_STORAGE_KEY, respKey);
            await kvSet(SESSION_CACHE_KEY, JSON.stringify({
                key: respKey,
                hwid,
                nonce,
                ed_ts: edTs,
                ed_sig: edSig,
                expires_at: respExp,
                duration: licenseState.duration,
                days_left: licenseState.daysLeft,
                cachedAt: Date.now()
            }));
            IOE.events.emit('licenseVerified', { ...licenseState });
            return { ok: true, state: { ...licenseState } };
        } catch (err) {
            licenseState.lastError = 'Lỗi kết nối: ' + (err?.message || String(err));
            return { ok: false, error: licenseState.lastError };
        }
    }

    async function clearKey() {
        licenseState.licensed = false;
        licenseState.key = '';
        IOE.state.licensed = false;
        await kvSet(KEY_STORAGE_KEY, '');
        await kvSet(SESSION_CACHE_KEY, '');
        showLicenseModal('Đã xóa Key cũ. Vui lòng nhập Key mới!');
    }

    /* ================= 4. ACTIVATION GLASSMORPHISM MODAL ================= */
    const MODAL_ID = 'yanzioe-license-modal';

    function removeLicenseModal() {
        document.getElementById(MODAL_ID)?.remove();
    }

    async function showLicenseModal(statusText = '') {
        if (licenseState.licensed || win !== win.top) return;
        const hwid = await getHardwareHwid();
        IOE.onBodyReady(() => {
            if (licenseState.licensed) return;
            let wrap = document.getElementById(MODAL_ID);
            if (!wrap) {
                wrap = document.createElement('div');
                wrap.id = MODAL_ID;
                wrap.style.cssText = 'position:fixed;top:18px;right:18px;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;width:335px;max-width:94vw;';
                wrap.innerHTML = `
                    <div style="background:rgba(15,23,42,0.97);backdrop-filter:blur(18px);border:1px solid rgba(56,189,248,0.55);border-radius:14px;box-shadow:0 16px 48px rgba(0,0,0,0.7);color:#f8fafc;overflow:hidden;">
                        <div style="padding:12px 15px;background:linear-gradient(135deg,rgba(2,132,199,0.28),rgba(99,102,241,0.22));border-bottom:1px solid rgba(56,189,248,0.28);display:flex;align-items:center;justify-content:space-between;">
                            <div style="display:flex;align-items:center;gap:8px;">
                                <span style="font-size:17px;">🔐</span>
                                <strong style="font-size:13.5px;color:#38bdf8;letter-spacing:0.4px;">YANZIOE VIP • BẢN QUYỀN</strong>
                            </div>
                            <span style="background:#0284c7;color:#fff;font-size:10px;padding:2px 6px;border-radius:5px;font-weight:800;">v${IOE.escHtml ? IOE.escHtml(IOE.version || '1.2.2') : (IOE.version || '1.2.2')}</span>
                        </div>
                        <div style="padding:14px 15px;">
                            <div style="font-size:11.5px;color:#cbd5e1;margin-bottom:8px;line-height:1.45;">
                                Nhập mã Key <strong style="color:#38bdf8;">YANZ-IOE-...</strong> đã mua tại <strong>YanzBn Shop</strong> để mở khóa công cụ tự giải đề &amp; Canvas trên IOE.vn.
                            </div>
                            <input id="yanzioe-lic-inp" type="text" placeholder="YANZ-IOE-XXXX-XXXX-XXXX" autocomplete="off" style="width:100%;box-sizing:border-box;background:rgba(2,6,23,0.75);border:1px solid rgba(56,189,248,0.45);border-radius:8px;color:#f8fafc;padding:9px 10px;font-size:12.5px;font-weight:700;letter-spacing:0.6px;outline:none;text-transform:uppercase;">
                            <div id="yanzioe-lic-status" style="display:none;margin-top:8px;padding:7px 9px;border-radius:6px;font-size:11px;line-height:1.4;word-break:break-word;"></div>
                            <div style="display:flex;gap:7px;margin-top:10px;">
                                <button id="yanzioe-lic-btn" type="button" style="flex:2;background:linear-gradient(135deg,#0284c7,#2563eb);color:#fff;border:none;border-radius:8px;padding:9px 10px;font-size:12px;font-weight:800;cursor:pointer;">🔓 Kích Hoạt Ngay</button>
                                <button id="yanzioe-lic-paste" type="button" style="flex:1;background:#1e293b;color:#cbd5e1;border:1px solid rgba(148,163,184,0.35);border-radius:8px;padding:9px 8px;font-size:11.5px;font-weight:700;cursor:pointer;">📋 Dán</button>
                            </div>
                            <div style="margin-top:10px;padding:7px 9px;background:rgba(30,41,59,0.75);border-radius:7px;display:flex;align-items:center;justify-content:space-between;gap:6px;">
                                <span style="font-size:10.5px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">HWID: <strong id="yanzioe-lic-hwid" style="color:#e2e8f0;font-family:monospace;"></strong></span>
                                <button id="yanzioe-lic-cphwid" type="button" style="background:rgba(56,189,248,0.16);border:1px solid rgba(56,189,248,0.35);color:#38bdf8;border-radius:5px;padding:2px 7px;font-size:10px;font-weight:700;cursor:pointer;">Copy</button>
                            </div>
                            <div style="margin-top:9px;display:flex;justify-content:space-between;font-size:11px;">
                                <a href="${SHOP_URL}" target="_blank" rel="noopener" style="color:#38bdf8;text-decoration:none;font-weight:700;">🛒 Mua Key YanzBn</a>
                                <a href="${RESET_URL}" target="_blank" rel="noopener" style="color:#fbbf24;text-decoration:none;font-weight:700;">🔄 Đổi Máy (Reset HWID)</a>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(wrap);

                const inp = document.getElementById('yanzioe-lic-inp');
                const btn = document.getElementById('yanzioe-lic-btn');
                const pst = document.getElementById('yanzioe-lic-paste');
                const cpBtn = document.getElementById('yanzioe-lic-cphwid');
                const setSt = (msg, isErr) => {
                    const stEl = document.getElementById('yanzioe-lic-status');
                    if (!stEl) return;
                    if (!msg) { stEl.style.display = 'none'; return; }
                    stEl.style.display = 'block';
                    stEl.style.background = isErr ? 'rgba(239,68,68,0.16)' : 'rgba(16,185,129,0.16)';
                    stEl.style.border = isErr ? '1px solid rgba(239,68,68,0.45)' : '1px solid rgba(16,185,129,0.45)';
                    stEl.style.color = isErr ? '#fca5a5' : '#6ee7b7';
                    stEl.textContent = msg;
                };

                const doActivate = async () => {
                    const k = (inp?.value || '').trim().toUpperCase();
                    if (!k) { setSt('Vui lòng nhập mã Key trước!', true); return; }
                    btn.disabled = true;
                    btn.textContent = '⏳ Đang xác thực...';
                    setSt('Đang kiểm tra bản quyền & HWID với YanzBn Shop...', false);
                    const r = await verifyKeyRemote(k);
                    btn.disabled = false;
                    btn.textContent = '🔓 Kích Hoạt Ngay';
                    if (r.ok) {
                        setSt(`✓ Kích hoạt thành công! Hạn: ${licenseState.expiresAt}`, false);
                        setTimeout(() => removeLicenseModal(), 550);
                    } else {
                        setSt(r.error || 'Kích hoạt thất bại!', true);
                    }
                };
                btn?.addEventListener('click', doActivate);
                inp?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doActivate(); });
                pst?.addEventListener('click', async () => {
                    try {
                        const txt = await navigator.clipboard.readText();
                        if (txt && inp) inp.value = txt.trim().toUpperCase();
                    } catch (e) { setSt('Trình duyệt chặn đọc Clipboard, hãy bấm Ctrl+V vào ô nhập!', true); }
                });
                cpBtn?.addEventListener('click', async () => {
                    try { await navigator.clipboard.writeText(hwid); } catch (e) {}
                    IOE.toast('✓ Đã copy HWID: ' + hwid, 1500);
                });
            }

            const hwidEl = document.getElementById('yanzioe-lic-hwid');
            if (hwidEl) hwidEl.textContent = hwid;
            const stEl = document.getElementById('yanzioe-lic-status');
            if (stEl && statusText) {
                stEl.style.display = 'block';
                stEl.style.background = 'rgba(245,158,11,0.16)';
                stEl.style.border = '1px solid rgba(245,158,11,0.45)';
                stEl.style.color = '#fde68a';
                stEl.textContent = statusText;
            }
        });
    }

    async function bootstrapLicenseGate() {
        if (document.documentElement?.dataset?.ioeBridge !== '1' && typeof location !== 'undefined' && location.protocol.startsWith('http')) {
            await new Promise(r => setTimeout(r, 85));
        }
        const hwid = await getHardwareHwid();
        licenseState.hwid = hwid;

        // 1. Validate short offline grace cache if signature YIOE1 intact (max 30 min)
        try {
            const rawCache = await kvGet(SESSION_CACHE_KEY);
            if (rawCache) {
                const c = JSON.parse(rawCache);
                const ageMs = Date.now() - Number(c.cachedAt || 0);
                const msg = `YIOE1|${c.key}|${c.hwid}|${c.nonce}|${c.ed_ts}|${c.expires_at}`;
                if (c.key && c.hwid === hwid && ageMs >= 0 && ageMs < 1800000 && verifyEd25519(c.ed_sig, msg)) {
                    licenseState.licensed = true;
                    licenseState.key = c.key;
                    licenseState.expiresAt = c.expires_at;
                    licenseState.duration = c.duration || '';
                    licenseState.daysLeft = Number(c.days_left ?? 0);
                    IOE.state.licensed = true;
                    IOE.events.emit('licenseVerified', { ...licenseState });
                    // Background silent re-check to catch revocations/expirations
                    verifyKeyRemote(c.key).then(res => {
                        if (!res.ok) showLicenseModal(res.error);
                    });
                    return true;
                }
            }
        } catch (e) {}

        // 2. Try saved key from storage
        const savedKey = (await kvGet(KEY_STORAGE_KEY)).trim().toUpperCase();
        if (savedKey) {
            const res = await verifyKeyRemote(savedKey);
            if (res.ok) return true;
            await showLicenseModal(res.error);
            return false;
        }

        // 3. Prompt user cleanly
        await showLicenseModal();
        return false;
    }

    IOE.kv = {
        get: kvGet,
        set: kvSet
    };
    IOE.license = {
        getState: () => ({ ...licenseState }),
        isLicensed: () => !!licenseState.licensed,
        getHardwareHwid,
        verifyKeyRemote,
        verifyEd25519,
        clearKey,
        showLicenseModal,
        bootstrap: bootstrapLicenseGate
    };
    win.YanzIOELicense = IOE.license;

    bootstrapLicenseGate();
})(typeof window !== 'undefined' ? window : globalThis);


/* --- functions/oneko.js --- */
(function (global) {
    'use strict';
    let nekoEl = null;
    let nekoX = 32, nekoY = 32, mouseX = 0, mouseY = 0, frameCount = 0;

    function initOneko() {
        if (nekoEl) return;
        nekoEl = document.createElement('div');
        nekoEl.id = 'yanz-oneko';
        nekoEl.style.cssText = 'width:32px;height:32px;position:fixed;pointer-events:none;z-index:9999998;image-rendering:pixelated;display:none;';
        nekoEl.innerHTML = '<span style="font-size:24px;">🐱</span>';
        document.body.appendChild(nekoEl);

        window.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        function frame() {
            if (global.IOE?.features?.oneko && nekoEl) {
                nekoEl.style.display = 'block';
                const diffX = mouseX - nekoX;
                const diffY = mouseY - nekoY;
                const dist = Math.hypot(diffX, diffY);
                if (dist > 10) {
                    nekoX += (diffX / dist) * 4;
                    nekoY += (diffY / dist) * 4;
                }
                nekoEl.style.left = `${nekoX - 16}px`;
                nekoEl.style.top = `${nekoY - 16}px`;
            } else if (nekoEl) {
                nekoEl.style.display = 'none';
            }
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    if (global.IOE?.onBodyReady) {
        global.IOE.onBodyReady(initOneko);
    } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initOneko);
    } else {
        initOneko();
    }
})(typeof window !== 'undefined' ? window : globalThis);


/* --- functions/questionSpoof.js --- */
(function (global) {
    'use strict';
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const IOE = global.IOE || win.IOE;
    if (!IOE) return;

    function checkLicensed() {
        return !!(IOE.state?.licensed || IOE.license?.isLicensed?.());
    }

    /* ================= 1. ADAPTIVE MISTAKE MEMORY ================= */
    const adaptiveMistakes = new Map();

    function recordAdaptiveMistake(qId, failedAns) {
        if (!qId || !failedAns) return;
        let entry = adaptiveMistakes.get(qId);
        if (!entry) {
            entry = { qId, wrong: new Set() };
            adaptiveMistakes.set(qId, entry);
        }
        entry.wrong.add(String(failedAns).trim().toLowerCase());
    }

    function isAnswerWrong(qId, ans) {
        const entry = adaptiveMistakes.get(qId);
        if (!entry || !ans) return false;
        return entry.wrong.has(String(ans).trim().toLowerCase());
    }

    function getWrongAnswers(qId) {
        const entry = adaptiveMistakes.get(qId);
        return entry ? Array.from(entry.wrong) : [];
    }

    function isValidClozeWord(w) {
        if (!w || typeof w !== 'string') return false;
        const str = w.trim();
        if (str.length < 1 || str.length > 40) return false;
        if (/^[_.\\s-]+$/.test(str) || str.includes('______') || str.includes('...')) return false;
        if (/https?:\/\/|\.com|\.net|\.org|\.vn|\.br|\.py|\.az|\.co|\.kh|\.il|\.hu|\.jp|translate\./i.test(str)) return false;
        if (!/[a-zA-Z]/.test(str)) return false;
        return true;
    }

    function stripOptionPrefix(s) {
        return String(s || '').replace(/^[A-Da-d][.:)\]\s_-]+/, '').trim();
    }

    function normalizeKeyStr(s) {
        return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    }

    /* ================= 2. 0MS INSTANT THINKING GENERATOR ================= */
    function generate0msThinking(qText, ans, tier = '') {
        const lower = String(qText || '').toLowerCase();
        const ansStr = String(ans || '');

        if (lower.includes('order') || lower.includes('reorder') || lower.includes('arrange') || lower.includes('sắp xếp')) {
            return [
                '🧠 [Tư duy 0ms - Cấu trúc câu tiếng Anh]:',
                '• Xác định chủ ngữ (Subject) và động từ chính (Main Verb) trong các thẻ từ.',
                '• Sắp xếp trật tự S + V + O + Adv theo chuẩn ngữ pháp tiếng Anh.',
                '• Kiểm tra liên từ và dấu câu kết thúc.',
                `➔ Kết quả sắp xếp: ${ansStr}`
            ].join('\n');
        }

        if (lower.includes('fill') || lower.includes('blank') || lower.includes('điền')) {
            return [
                '🧠 [Tư duy 0ms - Ngữ pháp & Điền khuyết]:',
                '• Phân tích thì của câu (Tense) và ngữ cảnh xung quanh vị trí trống.',
                '• Xác định từ loại cần điền (danh từ, động từ, tính từ hoặc giới từ đi kèm).',
                '• Đối chiếu biến đổi hình thái từ (V-ing, V-ed, số nhiều).',
                `➔ Từ cần điền: ${ansStr}`
            ].join('\n');
        }

        if (lower.includes('match') || lower.includes('nối') || lower.includes('cặp')) {
            return [
                '🧠 [Tư duy 0ms - Ghép cặp từ vựng & Nghĩa]:',
                '• Quét danh sách các thẻ từ vựng và ảnh/định nghĩa tương ứng.',
                '• Xác định cặp đồng nghĩa / trái nghĩa hoặc từ chỉ vật thể tương ứng.',
                `➔ Cặp ghép: ${ansStr}`
            ].join('\n');
        }

        return [
            '🧠 [Tư duy 0ms - Phân tích ngữ cảnh & Loại trừ]:',
            '• Đọc câu hỏi, xác định trọng tâm ngữ pháp hoặc nghĩa từ vựng.',
            '• Loại trừ các phương án sai thì, sai cấu trúc hoặc không hợp ngữ cảnh.',
            `➔ Đáp án (${tier || 'CAS'}): ${ansStr}`
        ].join('\n');
    }

    /* ================= 3. TIER 1: LOCAL ENGLISH CAS (0MS OFFLINE) ================= */
    const IRREGULAR_VERBS = {
        'go': 'went / gone', 'be': 'was, were / been', 'see': 'saw / seen',
        'do': 'did / done', 'have': 'had / had', 'eat': 'ate / eaten',
        'buy': 'bought / bought', 'take': 'took / taken', 'make': 'made / made',
        'write': 'wrote / written', 'read': 'read / read', 'speak': 'spoke / spoken',
        'come': 'came / come', 'give': 'gave / given', 'find': 'found / found',
        'know': 'knew / known', 'think': 'thought / thought', 'tell': 'told / told',
        'become': 'became / become', 'leave': 'left / left', 'feel': 'felt / felt',
        'put': 'put / put', 'bring': 'brought / brought', 'begin': 'began / begun',
        'keep': 'kept / kept', 'hold': 'held / held', 'stand': 'stood / stood',
        'hear': 'heard / heard', 'let': 'let / let', 'mean': 'meant / meant',
        'set': 'set / set', 'meet': 'met / met', 'run': 'ran / run',
        'pay': 'paid / paid', 'sit': 'sat / sat', 'win': 'won / won',
        'send': 'sent / sent', 'build': 'built / built', 'fall': 'fell / fallen',
        'cut': 'cut / cut', 'sell': 'sold / sold', 'break': 'broke / broken',
        'wear': 'wore / worn', 'choose': 'chose / chosen', 'fly': 'flew / flown',
        'draw': 'drew / drawn', 'drive': 'drove / driven', 'drink': 'drank / drunk',
        'sing': 'sang / sung', 'swim': 'swam / swum', 'teach': 'taught / taught',
        'catch': 'caught / caught', 'sleep': 'slept / slept', 'spend': 'spent / spent',
        'forget': 'forgot / forgotten', 'get': 'got / got'
    };

    const LETTER_BANK = [
        'apple', 'animals', 'afternoon', 'airport', 'airplane', 'always', 'amazing', 'answer', 'august', 'autumn',
        'banana', 'basketball', 'beautiful', 'because', 'bedroom', 'bicycle', 'birthday', 'blackboard', 'breakfast', 'brother', 'building',
        'calendar', 'camera', 'candle', 'cartoon', 'celebrate', 'children', 'chocolate', 'cinema', 'classroom', 'clothes', 'computer', 'country', 'crocodile',
        'daughter', 'december', 'delicious', 'dentist', 'dictionary', 'different', 'difficult', 'dinosaur', 'doctor', 'dolphin', 'drawing',
        'elephant', 'engineer', 'english', 'evening', 'everyday', 'everything', 'example', 'excellent', 'exciting', 'exercise', 'expensive',
        'family', 'fantastic', 'farmer', 'favorite', 'favourite', 'february', 'festival', 'flower', 'football', 'forest', 'friendly', 'fruit', 'furniture',
        'garden', 'giraffe', 'glasses', 'goodbye', 'grandfather', 'grandmother', 'grandparents', 'guitar',
        'halloween', 'hamburger', 'handwriting', 'happiness', 'healthy', 'helicopter', 'history', 'holiday', 'homework', 'hospital', 'hungry', 'husband',
        'icecream', 'important', 'internet', 'island', 'january', 'jacket', 'journalist', 'juice', 'july', 'june',
        'kangaroo', 'keyboard', 'kitchen', 'kitten', 'knowledge', 'language', 'lantern', 'library', 'listen', 'little', 'lizard', 'london',
        'magazine', 'march', 'market', 'mathematics', 'medicine', 'message', 'midnight', 'minute', 'mirror', 'monday', 'monkey', 'morning', 'mountain', 'museum', 'music',
        'natural', 'neighbor', 'neighbour', 'newspaper', 'night', 'notebook', 'november', 'number', 'nurse',
        'october', 'office', 'orange', 'orchestra', 'outside', 'painting', 'pancake', 'parents', 'parrot', 'party', 'passport', 'pencil', 'penguin', 'people', 'pepper', 'person', 'photograph', 'piano', 'picnic', 'picture', 'pineapple', 'playground', 'please', 'pocket', 'police', 'postcard', 'potato', 'practice', 'present', 'pretty', 'primary', 'princess', 'problem', 'project', 'pumpkin', 'pupil', 'purple',
        'quarter', 'question', 'quiet', 'rabbit', 'rainbow', 'raincoat', 'reading', 'remember', 'restaurant', 'river', 'robot', 'ruler',
        'sandwich', 'saturday', 'sausage', 'school', 'science', 'scissors', 'season', 'second', 'september', 'seventeen', 'shopping', 'shoulder', 'sister', 'skateboard', 'snowman', 'soccer', 'soldier', 'something', 'sometimes', 'song', 'special', 'spelling', 'spring', 'stadium', 'station', 'strawberry', 'street', 'student', 'subject', 'subway', 'summer', 'sunday', 'sunglasses', 'supermarket', 'surprise', 'sweater', 'swimming',
        'table', 'teacher', 'telephone', 'television', 'tennis', 'theater', 'theatre', 'thirsty', 'thursday', 'ticket', 'tiger', 'together', 'tomato', 'tomorrow', 'toothache', 'toothbrush', 'tourist', 'traffic', 'train', 'travel', 'treasure', 'triangle', 'trousers', 'tuesday', 'turtle',
        'umbrella', 'uncle', 'understand', 'uniform', 'university', 'usually', 'vacation', 'vegetable', 'vietnam', 'vietnamese', 'village', 'violin', 'visitor', 'volleyball',
        'waiter', 'walking', 'wallet', 'water', 'watermelon', 'weather', 'wednesday', 'weekend', 'welcome', 'window', 'winter', 'wonderful', 'writing',
        'yellow', 'yesterday', 'young', 'zebra'
    ];

    function solveLocalEnglish(qText, options = []) {
        if (!qText) return null;

        // 1. Irregular verb lookup
        for (const [v, p] of Object.entries(IRREGULAR_VERBS)) {
            if (new RegExp(`past\\s+(?:tense|participle)\\s+of\\s+['"]?${v}['"]?`, 'i').test(qText)) {
                return { answer: p, tier: 'Tier 1 (Local CAS 0ms)' };
            }
        }

        // 2. Simple arithmetic/number questions inside English UI
        const mathMatch = /(?:what is|equals?|=)\s*(\d+)\s*([+\-*x×÷/])\s*(\d+)/i.exec(qText);
        if (mathMatch) {
            const a = parseInt(mathMatch[1], 10), op = mathMatch[2], b = parseInt(mathMatch[3], 10);
            let res = null;
            if (op === '+') res = a + b;
            else if (op === '-') res = a - b;
            else if (op === '*' || op === 'x' || op === '×') res = a * b;
            else if ((op === '/' || op === '÷') && b !== 0) res = Math.round((a / b) * 100) / 100;
            if (res !== null) return { answer: String(res), tier: 'Tier 1 (Local CAS 0ms)' };
        }

        // 3. Partial hidden-letter puzzle (e.g. "b _ a u t _ f _ l" or "el_ph_nt")
        const spacedMask = /(?:\b[a-zA-Z_](?:\s+[a-zA-Z_]){2,}\b)/.exec(qText);
        if (spacedMask && spacedMask[0].includes('_')) {
            const pat = spacedMask[0].replace(/\s+/g, '').toLowerCase();
            if (pat.includes('_') && pat.length >= 3) {
                const rx = new RegExp('^' + pat.replace(/_/g, '[a-z]') + '$');
                const cand = LETTER_BANK.find(w => w.length === pat.length && rx.test(w));
                if (cand) return { answer: cand, tier: 'Tier 1 (Word Pattern 0ms)' };
            }
        }
        const compactMask = /\b([a-zA-Z]*_[a-zA-Z_]*)\b/.exec(qText);
        if (compactMask && compactMask[1].length >= 4 && compactMask[1].length <= 16) {
            const pat = compactMask[1].toLowerCase();
            if (/^[a-z_]+$/.test(pat) && /[a-z]/.test(pat) && pat.includes('_')) {
                const rx = new RegExp('^' + pat.replace(/_/g, '[a-z]') + '$');
                const cand = LETTER_BANK.find(w => w.length === pat.length && rx.test(w));
                if (cand && (!options.length || options.some(o => stripOptionPrefix(o).toLowerCase() === cand))) {
                    return { answer: cand, tier: 'Tier 1 (Word Pattern 0ms)' };
                }
            }
        }

        return null;
    }

    /* ================= 4. TIER 2: AI SOLVER (AUTO-DISCOVERING GEMINI / GROQ / OPENROUTER) ================= */
    let lastAiError = '';
    const discoveredModelsCache = new Map();

    async function extRequestJson(endpoint, method = 'POST', headers = {}, payloadObj = null, timeoutMs = 8500) {
        const reqExt = IOE.net?.requestExternal;
        const bodyStr = (method === 'GET' || payloadObj === null) ? undefined : JSON.stringify(payloadObj);
        if (reqExt) {
            return await reqExt(endpoint, { method, headers, body: bodyStr, timeoutMs });
        }
        const ctrl = new AbortController();
        const tm = IOE.timers?.setTimeout ? IOE.timers.setTimeout(() => ctrl.abort(), timeoutMs) : setTimeout(() => ctrl.abort(), timeoutMs);
        try {
            const init = { method, headers, signal: ctrl.signal };
            if (bodyStr !== undefined) init.body = bodyStr;
            const res = await fetch(endpoint, init);
            return { ok: res.ok, status: res.status, text: await res.text() };
        } finally {
            if (IOE.timers?.clearTimeout) IOE.timers.clearTimeout(tm); else clearTimeout(tm);
        }
    }

    async function discoverLiveModels(provider, apiKey) {
        const cacheKey = `${provider}:${String(apiKey || '').slice(0, 10)}`;
        const cached = discoveredModelsCache.get(cacheKey);
        if (cached && (Date.now() - cached.ts < 600000)) return cached.models;

        let found = [];
        try {
            if (provider === 'gemini') {
                const r = await extRequestJson(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`, 'GET', {}, null, 6000);
                if (r?.ok && r.text) {
                    const j = JSON.parse(r.text);
                    found = (j.models || [])
                        .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
                        .map(m => String(m.name || '').replace(/^models\//, ''))
                        .filter(n => /flash/i.test(n) && !/(tts|live|image|audio|embedding|vision)/i.test(n))
                        .sort((a, b) => b.localeCompare(a))
                        .slice(0, 5);
                }
            } else if (provider === 'groq') {
                const r = await extRequestJson('https://api.groq.com/openai/v1/models', 'GET', { 'Authorization': `Bearer ${apiKey}` }, null, 6000);
                if (r?.ok && r.text) {
                    const j = JSON.parse(r.text);
                    const allIds = (j.data || [])
                        .map(m => String(m.id || ''))
                        .filter(id => id && !/(whisper|tts|guard|safeguard|orpheus|embed)/i.test(id));
                    const prio = (id) => (/llama-3\.3|gpt-oss-120b/.test(id) ? 0 : /gpt-oss|qwen|llama-3/.test(id) ? 1 : 2);
                    found = allIds.sort((a, b) => prio(a) - prio(b)).slice(0, 6);
                }
            } else if (provider === 'openrouter') {
                const r = await extRequestJson('https://openrouter.ai/api/v1/models', 'GET', {}, null, 6000);
                if (r?.ok && r.text) {
                    const j = JSON.parse(r.text);
                    found = (j.data || [])
                        .map(m => String(m.id || ''))
                        .filter(id => id.endsWith(':free') && !/(embed|whisper|tts)/i.test(id))
                        .slice(0, 5);
                }
            }
        } catch (e) {}

        if (found.length > 0) {
            discoveredModelsCache.set(cacheKey, { ts: Date.now(), models: found });
        }
        return found;
    }

    async function callGeminiApi(apiKey, prompt, expectJson = true) {
        const cacheKey = `gemini:${String(apiKey || '').slice(0, 10)}`;
        const initialModels = discoveredModelsCache.get(cacheKey)?.models || [
            'gemini-3.8-flash',
            'gemini-3.5-flash-lite',
            'gemini-3.6-flash',
            'gemini-2.5-flash',
            'gemini-2.5-flash-lite'
        ];

        async function tryList(models) {
            let authFatal = false;
            for (const m of models) {
                try {
                    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(apiKey)}`;
                    const genCfg = { temperature: 0.1, maxOutputTokens: 1000 };
                    if (expectJson) genCfg.responseMimeType = 'application/json';
                    const r = await extRequestJson(endpoint, 'POST', { 'Content-Type': 'application/json' }, {
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: genCfg
                    }, 8500);

                    if (r && r.ok && r.text) {
                        const j = JSON.parse(r.text);
                        const txt = j?.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (txt) { lastAiError = ''; return { txt }; }
                    } else if (r) {
                        lastAiError = `Gemini ${m}: HTTP ${r.status} ${(r.text || r.error || '').slice(0, 120)}`;
                        if (r.status === 401 || r.status === 403 || (r.status === 400 && /API key/i.test(r.text || ''))) {
                            authFatal = true;
                            break;
                        }
                    }
                } catch (e) {
                    lastAiError = `Gemini ${m}: ${e?.message || e}`;
                }
            }
            return { txt: null, authFatal };
        }

        const first = await tryList(initialModels);
        if (first.txt) return first.txt;
        if (!first.authFatal) {
            const live = await discoverLiveModels('gemini', apiKey);
            const unseen = live.filter(m => !initialModels.includes(m));
            if (unseen.length > 0) {
                const retry = await tryList(unseen);
                if (retry.txt) return retry.txt;
            }
        }
        return null;
    }

    async function callOpenAiCompat(endpoint, apiKey, defaultModels, prompt, useJsonFormat = true, providerTag = 'groq') {
        const cacheKey = `${providerTag}:${String(apiKey || '').slice(0, 10)}`;
        const initialModels = discoveredModelsCache.get(cacheKey)?.models || defaultModels;

        async function tryList(models) {
            let authFatal = false;
            for (const model of models) {
                let wantJson = useJsonFormat && !/gemma|free/i.test(model);
                for (let pass = 0; pass < 2; pass++) {
                    try {
                        const bodyObj = {
                            model,
                            messages: [{ role: 'user', content: prompt }],
                            temperature: 0.1
                        };
                        if (wantJson) bodyObj.response_format = { type: 'json_object' };
                        const r = await extRequestJson(endpoint, 'POST', {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        }, bodyObj, 8500);

                        if (r && r.ok && r.text) {
                            const j = JSON.parse(r.text);
                            const txt = j?.choices?.[0]?.message?.content || '';
                            if (txt) { lastAiError = ''; return { txt }; }
                        } else if (r) {
                            lastAiError = `${model}: HTTP ${r.status} ${(r.text || r.error || '').slice(0, 120)}`;
                            if (r.status === 400 && wantJson && /response_format|json/i.test(r.text || '')) {
                                wantJson = false;
                                continue;
                            }
                            if (r.status === 401 || r.status === 403) { authFatal = true; break; }
                        }
                    } catch (e) {
                        lastAiError = `${model}: ${e?.message || e}`;
                    }
                    break;
                }
                if (authFatal) break;
            }
            return { txt: null, authFatal };
        }

        const first = await tryList(initialModels);
        if (first.txt) return first.txt;
        if (!first.authFatal) {
            const live = await discoverLiveModels(providerTag, apiKey);
            const unseen = live.filter(m => !initialModels.includes(m));
            if (unseen.length > 0) {
                const retry = await tryList(unseen);
                if (retry.txt) return retry.txt;
            }
        }
        return null;
    }

    function detectProvider(apiKey) {
        const k = String(apiKey || '').trim();
        const cfg = IOE.featureConfigs?.aiProvider;
        if (k.startsWith('AIza')) return 'gemini';
        if (k.startsWith('gsk_')) return 'groq';
        if (k.startsWith('sk-or-')) return 'openrouter';
        return cfg || 'gemini';
    }

    async function callAiRaw(prompt) {
        const apiKey = (IOE.featureConfigs?.apiKey || '').trim();
        if (!apiKey) { lastAiError = 'Chưa nhập API Key'; return null; }
        const provider = detectProvider(apiKey);
        if (provider === 'gemini') {
            return await callGeminiApi(apiKey, prompt, true);
        }
        if (provider === 'groq') {
            return await callOpenAiCompat('https://api.groq.com/openai/v1/chat/completions', apiKey, [
                'llama-3.3-70b-versatile',
                'openai/gpt-oss-120b',
                'openai/gpt-oss-20b',
                'qwen/qwen3-32b',
                'llama-3.1-8b-instant'
            ], prompt, true, 'groq');
        }
        return await callOpenAiCompat('https://openrouter.ai/api/v1/chat/completions', apiKey, [
            'openrouter/free',
            'google/gemma-4-31b-it:free',
            'google/gemma-4-26b-a4b-it:free',
            'nvidia/nemotron-3.5-super-vl:free'
        ], prompt, true, 'openrouter');
    }

    function resolveOptionAnswer(rawAns, options = []) {
        let ans = String(rawAns || '').trim();
        if (!ans || !Array.isArray(options) || options.length === 0) return ans;
        const cleanOpts = options.map(stripOptionPrefix);
        // Handle single option letter "A", "B", "C", "D" or "A."
        const mLet = /^([A-Da-d])\.?$/.exec(ans);
        if (mLet) {
            const idx = mLet[1].toUpperCase().charCodeAt(0) - 65;
            if (cleanOpts[idx]) return cleanOpts[idx];
        }
        return ans;
    }

    async function solveWithAi(qId, qText, options = [], taskHint = '') {
        const apiKey = (IOE.featureConfigs?.apiKey || '').trim();
        if (!apiKey) return null;

        const wrongList = getWrongAnswers(qId);
        const wrongNote = wrongList.length ? `\nKnown WRONG options (NEVER pick these): ${wrongList.join(', ')}` : '';
        const cleanOpts = (options || []).map(o => stripOptionPrefix(o)).filter(Boolean);
        const optsText = cleanOpts.length
            ? `\nOptions:\n${cleanOpts.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n')}`
            : '';

        let instruction = '';
        if (taskHint === 'reorder') {
            instruction = `Task: Reorder ALL given word/phrase blocks into ONE grammatically correct English sentence.\nBlocks: ${cleanOpts.join(' | ')}\nRules: Return exact sentence using only those blocks.`;
        } else if (taskHint === 'pairs') {
            instruction = `Task: Match ALL ${cleanOpts.length} cards below into ${Math.floor(cleanOpts.length / 2)} exact pairs.\nCards:\n${cleanOpts.map((c, i) => `${i}: ${c}`).join('\n')}\nRules: Return ONLY raw JSON {"answer": [["card1", "card2"], ...]} with exact card texts.`;
        } else {
            instruction = `Solve this Vietnamese Olympic English (IOE) question accurately.\nIf multiple choice, return the exact winning option text (NOT just letter A/B/C/D if text is shown).\nIf fill in the blank, return ONLY the missing word or phrase.\nIf word reordering, return ONLY the full reordered English sentence.`;
        }

        const prompt = `${instruction}\nReturn ONLY raw JSON: {"answer": "..."} with NO markdown.\nQuestion: ${qText}${optsText}${wrongNote}`;

        try {
            const raw = await callAiRaw(prompt);
            if (!raw) return null;
            const m = /\{[\s\S]*"answer"[\s\S]*\}/.exec(raw);
            let extracted = '';
            if (m) {
                try {
                    const parsed = JSON.parse(m[0]);
                    const v = parsed.answer;
                    extracted = Array.isArray(v) ? JSON.stringify(v) : String(v || '').trim();
                } catch (e) {}
            }
            if (!extracted) {
                extracted = raw.replace(/```json|```/gi, '').replace(/^[\s"'{}]+|[\s"'{}]+$/g, '').trim();
            }
            return (taskHint === 'reorder' || taskHint === 'pairs') ? extracted : resolveOptionAnswer(extracted, cleanOpts);
        } catch (err) {
            lastAiError = err?.message || String(err);
            return null;
        }
    }

    async function testAiKey() {
        const apiKey = (IOE.featureConfigs?.apiKey || '').trim();
        if (!apiKey) return { ok: false, error: 'Chưa nhập API Key!' };
        const raw = await callAiRaw('Reply ONLY JSON: {"answer":"OK"}');
        if (raw && raw.toUpperCase().includes('OK')) {
            return { ok: true, provider: detectProvider(apiKey) };
        }
        return { ok: false, error: lastAiError || 'Không nhận được phản hồi hợp lệ từ API AI.' };
    }

    /* ================= 4B. CLOZE PASSAGE KNOWLEDGE & SOLVER ================= */
    const CLOZE_KNOWLEDGE_BANK = [
        {
            keywords: ['vietnam is becoming', 'different nations', 'cuisines', 'japan, korea, and italy', 'hanoi and ho chi minh city', 'offices in vietnam', 'open to learning'],
            words: {
                "1": "multicultural",
                "2": "from",
                "3": "set up",
                "4": "foreign",
                "5": "explore",
                "6": "cultural",
                "7": "appreciation",
                "8": "respect",
                "9": "conflict",
                "10": "lonely",
                "11": "citizenship"
            }
        },
        {
            keywords: ['gia long', 'nguyen dynasty', 'nguyen phuc anh', 'pigneau de', 'rival leaders', 'rival groups', 'first emperor'],
            words: {
                "1": "first",
                "2": "as",
                "3": "southern",
                "4": "In spite of",
                "5": "encounter",
                "6": "target",
                "7": "wipe out",
                "8": "hands",
                "9": "where",
                "10": "role"
            }
        }
    ];

    const COMMON_COLLOCATIONS = [
        { pattern: /(?:the|was the)\s+(?:\(\d+\)|_{2,}|\.{3,})\s+emperor/i, word: 'first' },
        { pattern: /born\s+(?:\(\d+\)|_{2,}|\.{3,})\s+Nguyen/i, word: 'as' },
        { pattern: /ruled over\s+(?:\(\d+\)|_{2,}|\.{3,})\s+Vietnam/i, word: 'southern' },
        { pattern: /(?:\(\d+\)|_{2,}|\.{3,})\s+being born into/i, word: 'In spite of' },
        { pattern: /had to\s+(?:\(\d+\)|_{2,}|\.{3,})\s+many difficulties/i, word: 'encounter' },
        { pattern: /became the\s+(?:\(\d+\)|_{2,}|\.{3,})\s+of rival groups/i, word: 'target' },
        { pattern: /attempted to\s+(?:\(\d+\)|_{2,}|\.{3,})\s+the/i, word: 'wipe out' },
        { pattern: /at the\s+(?:\(\d+\)|_{2,}|\.{3,})\s+of the rival leaders/i, word: 'hands' },
        { pattern: /spirit\s+of\s+global\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'citizenship' },
        { pattern: /global\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'citizenship' },
        { pattern: /depend\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'on' },
        { pattern: /rely\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'on' },
        { pattern: /interested\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'in' },
        { pattern: /good\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'at' },
        { pattern: /look forward\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'to' },
        { pattern: /take care\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'of' },
        { pattern: /keen\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'on' },
        { pattern: /fond\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'of' },
        { pattern: /proud\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'of' },
        { pattern: /responsible\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'for' },
        { pattern: /capable\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'of' }
    ];

    async function solveClozeWithAi(passageText, rows = []) {
        const apiKey = (IOE.featureConfigs?.apiKey || '').trim();
        if (!apiKey) return null;

        const rowsFormatted = rows.map(r => {
            const optsStr = Array.isArray(r.options) && r.options.length
                ? r.options.map((o, idx) => `${String.fromCharCode(65 + idx)}. ${stripOptionPrefix(o)}`).join(' | ')
                : '';
            return `Blank (${r.index || r.rowNumber}): ${optsStr}`;
        }).filter(Boolean).join('\n');

        const prompt = `You are an expert English teacher solving a Vietnamese Olympic English (IOE) Cloze Test.\nPassage:\n${passageText}\n\n${rowsFormatted ? `Candidate choices:\n${rowsFormatted}\n` : ''}Choose the exact grammatically and contextually right word for every numbered blank.\nReturn ONLY raw JSON object mapping blank string number to chosen exact word, e.g. {"1":"word1","2":"word2"}.`;

        try {
            const raw = await callAiRaw(prompt);
            if (!raw) return null;
            const m = /\{[\s\S]*\}/.exec(raw);
            if (!m) return null;
            const parsed = JSON.parse(m[0]);
            const result = {};
            for (const [k, v] of Object.entries(parsed)) {
                let word = String(v).trim();
                const r = rows.find(row => String(row.index || row.rowNumber) === String(k));
                if (r && Array.isArray(r.options) && /^[A-Da-d]\.?$/.test(word)) {
                    const idx = word[0].toUpperCase().charCodeAt(0) - 65;
                    if (r.options[idx]) word = stripOptionPrefix(r.options[idx]);
                }
                result[String(k)] = word;
            }
            return result;
        } catch (e) {
            return null;
        }
    }

    async function solveClozePassage(passageText, rows = []) {
        if (!checkLicensed()) return null;
        if (!passageText) return null;
        const normPassage = passageText.toLowerCase();

        const passageSnippet = normPassage.replace(/[^a-z0-9]/g, '').slice(0, 40);
        if (IOE.state._lastClozeSnippet && IOE.state._lastClozeSnippet !== passageSnippet) {
            IOE.state.clozeAnswers = {};
        }
        IOE.state._lastClozeSnippet = passageSnippet;

        try { scanCocosMemoryForAnswers(); } catch (e) {}

        const outAnswers = {};

        // 1. Tier 0 captured system Cloze answers
        const validSystemAnswers = {};
        if (IOE.state.clozeAnswers) {
            for (const [k, v] of Object.entries(IOE.state.clozeAnswers)) {
                if (isValidClozeWord(v)) validSystemAnswers[k] = String(v).trim();
            }
        }

        if (Object.keys(validSystemAnswers).length >= (rows.length || 6)) {
            if (rows.length === 0) {
                Object.assign(outAnswers, validSystemAnswers);
            } else {
                for (const r of rows) {
                    const idxStr = String(r.index);
                    if (validSystemAnswers[idxStr]) outAnswers[idxStr] = validSystemAnswers[idxStr];
                }
            }
            if (Object.keys(outAnswers).length >= (rows.length || 6)) {
                const validEntries = Object.entries(outAnswers)
                    .filter(([, v]) => isValidClozeWord(v))
                    .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10));
                if (validEntries.length > 0) {
                    const detailedAnswers = validEntries.map(([k, v]) => `• Câu ${k}: ${v}`).join('\n');
                    const compactAnswers = validEntries.map(([k, v]) => `Câu ${k}: ${v}`).join('  |  ');
                    IOE.events?.emit('questionSolved', {
                        qId: 'cloze_passage',
                        qText: `[Đoạn văn điền từ - ${validEntries.length} câu hỏi]\n${passageText.slice(0, 100)}...`,
                        answer: compactAnswers,
                        tier: 'Tier 0 (Hệ Thống IOE - Key Gốc)',
                        thinking: `🔓 [Key Gốc Hệ Thống]: Bắt được ${validEntries.length} đáp án từ bộ nhớ IOE.\n${detailedAnswers}`
                    });
                    return outAnswers;
                }
            }
        }

        // 2. Tier 1: Verified bank (require >= 2 distinct keywords to avoid false triggers)
        for (const entry of CLOZE_KNOWLEDGE_BANK) {
            const matches = entry.keywords.filter(k => normPassage.includes(k.toLowerCase()));
            if (matches.length >= 2) {
                const sourceDict = entry.words || {};
                if (!IOE.state.clozeAnswers) IOE.state.clozeAnswers = {};
                Object.assign(IOE.state.clozeAnswers, sourceDict);

                if (rows.length === 0) {
                    Object.assign(outAnswers, sourceDict);
                } else {
                    for (const r of rows) {
                        const idxStr = String(r.index || r.rowNumber);
                        if (sourceDict[idxStr]) outAnswers[idxStr] = sourceDict[idxStr];
                    }
                }

                const validEntries = Object.entries(outAnswers)
                    .filter(([, v]) => isValidClozeWord(v))
                    .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10));
                if (validEntries.length > 0) {
                    const detailedAnswers = validEntries.map(([k, v]) => `• Câu ${k}: ${v}`).join('\n');
                    const compactAnswers = validEntries.map(([k, v]) => `Câu ${k}: ${v}`).join('  |  ');
                    IOE.events?.emit('questionSolved', {
                        qId: 'cloze_passage',
                        qText: `[Đoạn văn điền từ - ${validEntries.length} câu hỏi]\n${passageText.slice(0, 100)}...`,
                        answer: compactAnswers,
                        tier: 'Tier 0 (Ngân hàng đề IOE chuẩn)',
                        thinking: `📖 [Đoạn văn Cloze Test]: Khớp chuẩn ${validEntries.length} vị trí.\n${detailedAnswers}`
                    });
                    return outAnswers;
                }
            }
        }

        // 3. Collocation CAS Matching
        for (const row of rows) {
            const rowIdx = String(row.index || '');
            if (outAnswers[rowIdx]) continue;
            const opts = (row.options || []).map(o => stripOptionPrefix(o));
            for (const col of COMMON_COLLOCATIONS) {
                if (col.pattern.test(passageText)) {
                    const matchedOpt = opts.find(o => o.toLowerCase() === col.word.toLowerCase());
                    if (matchedOpt) { outAnswers[rowIdx] = matchedOpt; break; }
                }
            }
        }

        if (rows.length > 0 && Object.keys(outAnswers).length >= rows.length) {
            const validEntries = Object.entries(outAnswers)
                .filter(([, v]) => isValidClozeWord(v))
                .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10));
            if (validEntries.length > 0) {
                IOE.events?.emit('questionSolved', {
                    qId: 'cloze_passage_collocation',
                    qText: `[Đoạn văn điền từ - ${validEntries.length} câu hỏi]\n${passageText.slice(0, 100)}...`,
                    answer: validEntries.map(([k, v]) => `Câu ${k}: ${v}`).join('  |  '),
                    tier: 'Tier 1 (Collocation CAS)',
                    thinking: validEntries.map(([k, v]) => `• Câu ${k}: ${v}`).join('\n')
                });
                return outAnswers;
            }
        }

        // 4. AI Solver
        const aiResult = await solveClozeWithAi(passageText, rows);
        if (aiResult && typeof aiResult === 'object') {
            for (const [k, v] of Object.entries(aiResult)) {
                if (!outAnswers[k] && isValidClozeWord(v)) outAnswers[k] = v;
            }
            const validEntries = Object.entries(outAnswers)
                .filter(([, v]) => isValidClozeWord(v))
                .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10));
            if (validEntries.length > 0) {
                IOE.events?.emit('questionSolved', {
                    qId: 'cloze_passage_ai',
                    qText: `[Đoạn văn điền từ - ${validEntries.length} câu hỏi]\n${passageText.slice(0, 100)}...`,
                    answer: validEntries.map(([k, v]) => `Câu ${k}: ${v}`).join('  |  '),
                    tier: 'Tier 2 (AI Cloze)',
                    thinking: `📖 [AI Cloze Solver]:\n${validEntries.map(([k, v]) => `• Câu ${k}: ${v}`).join('\n')}`
                });
                return outAnswers;
            }
        }

        return outAnswers;
    }

    /* ================= 5. SOLVE ORCHESTRATOR ================= */
    async function solveQuestion(qId, qText, options = [], taskHint = '') {
        if (!checkLicensed()) {
            IOE.license?.showLicenseModal?.('Vui lòng kích hoạt Key YANZ-IOE trước khi giải bài!');
            return null;
        }
        if (!qText && !qId) return null;

        // Tier 0: Lookup in packet/RAM ground truth (check ID + exact normalized question stem + substring match)
        let tier0Ans = null;
        if (qId && IOE.state.correctAnswers.has(String(qId))) {
            tier0Ans = IOE.state.correctAnswers.get(String(qId));
        } else if (qText) {
            const normStem = normalizeKeyStr(qText);
            if (IOE.state.correctAnswers.has(normStem)) {
                tier0Ans = IOE.state.correctAnswers.get(normStem);
            } else {
                for (const [k, v] of IOE.state.correctAnswers.entries()) {
                    if (k.length >= 12 && (normStem.includes(k) || k.includes(normStem))) {
                        tier0Ans = v;
                        break;
                    }
                }
            }
        }

        if (tier0Ans && !isAnswerWrong(qId, tier0Ans)) {
            const resolved = resolveOptionAnswer(tier0Ans, options);
            const thinking = generate0msThinking(qText, resolved, 'Tier 0 (Key Gốc)');
            const meta = { qId, qText, answer: resolved, tier: 'Tier 0 (Key Gốc)', thinking };
            IOE.state.solvedMeta.set(qId || normKey(qText), meta);
            IOE.events.emit('questionSolved', meta);
            return meta;
        }

        // Tier 1: Local English CAS
        if (taskHint !== 'reorder') {
            const cas = solveLocalEnglish(qText, options);
            if (cas && !isAnswerWrong(qId, cas.answer)) {
                const resolved = resolveOptionAnswer(cas.answer, options);
                const thinking = generate0msThinking(qText, resolved, cas.tier);
                const meta = { qId, qText, answer: resolved, tier: cas.tier, thinking };
                IOE.state.solvedMeta.set(qId || normKey(qText), meta);
                IOE.events.emit('questionSolved', meta);
                return meta;
            }
        }

        // Tier 2: AI Solver
        const apiKey = (IOE.featureConfigs?.apiKey || '').trim();
        if (!apiKey) {
            IOE.toast('⚠️ Chưa nhập API Key AI trong mục Tùy chỉnh (chỉ chạy Tier 0/CAS)', 2400);
            return null;
        }

        IOE.toast('🔍 Đang giải câu hỏi...', 1000);
        const aiAns = await solveWithAi(qId, qText, options, taskHint);
        if (aiAns && !isAnswerWrong(qId, aiAns)) {
            const thinking = generate0msThinking(qText, aiAns, 'Tier 2 (AI)');
            const meta = { qId, qText, answer: aiAns, tier: 'Tier 2 (AI)', thinking };
            IOE.state.solvedMeta.set(qId || normKey(qText), meta);
            IOE.events.emit('questionSolved', meta);
            return meta;
        } else if (lastAiError) {
            IOE.appendLog?.(`❌ Lỗi AI: ${lastAiError}`);
            const now = Date.now();
            if (!IOE.state._lastAiToastAt || (now - IOE.state._lastAiToastAt) > 6000) {
                IOE.state._lastAiToastAt = now;
                IOE.toast(`⚠️ AI lỗi: ${lastAiError.slice(0, 75)}`, 2800);
            }
        }

        return null;
    }

    function normKey(s) {
        return normalizeKeyStr(s).slice(0, 60);
    }

    /* ================= 6. UNIVERSAL PACKET SNIFFER & COCOS RAM EXTRACTOR ================= */
    function tryDecodeBase64Json(val) {
        if (typeof val !== 'string' || val.length < 16 || val.length > 500000) return null;
        const t = val.trim();
        if (t.startsWith('{') || t.startsWith('[')) {
            try { return JSON.parse(t); } catch (e) { return null; }
        }
        if (/^eyJ[A-Za-z0-9+/=_-]+$/.test(t)) {
            try {
                const norm = t.replace(/-/g, '+').replace(/_/g, '/');
                const bin = atob(norm);
                const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
                const txt = new TextDecoder().decode(bytes);
                return JSON.parse(txt);
            } catch (e) { return null; }
        }
        return null;
    }

    function extractAnswerString(val) {
        if (val === undefined || val === null) return '';
        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
        if (Array.isArray(val)) {
            const parts = val.map(x => extractAnswerString(x)).filter(Boolean);
            return parts.join(' ').trim();
        }
        if (typeof val === 'object') {
            const inner = val.tans ?? val.Tans ?? val.content ?? val.Content ?? val.text ?? val.ans ?? val.value;
            return inner !== undefined ? extractAnswerString(inner) : '';
        }
        return '';
    }

    function storeQuestionAnswer(qObj, fallbackId) {
        if (!qObj || typeof qObj !== 'object') return false;
        let hit = false;
        const id = qObj.questionId ?? qObj.QuestionId ?? qObj.id ?? qObj.Id ?? qObj.questId ?? fallbackId;
        const contentRaw = qObj.content ?? qObj.Content ?? qObj.questionContent?.content ?? qObj.QuestionText ?? qObj.question ?? qObj.title ?? '';
        const contentClean = typeof contentRaw === 'string' ? contentRaw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';

        let rawAns = qObj.tans ?? qObj.Tans ?? qObj.trueAns ?? qObj.TrueAns ?? qObj.correctAnswer ?? qObj.CorrectAnswer ?? qObj.TrueAnswer ?? qObj.DapAn ?? qObj.RightAnswer;
        if ((rawAns === undefined || rawAns === null || rawAns === '') && (typeof qObj.answer === 'string' || typeof qObj.Answer === 'string' || Array.isArray(qObj.answer))) {
            rawAns = qObj.answer ?? qObj.Answer;
        }
        let strAns = extractAnswerString(rawAns);

        const optArr = qObj.ans ?? qObj.Ans ?? qObj.answearArr ?? qObj.options ?? qObj.Options ?? qObj.listAnswer ?? qObj.ListAnswer ?? qObj.answers ?? qObj.Answers;
        if (Array.isArray(optArr) && optArr.length > 0) {
            if (strAns && /^\d+$/.test(strAns.trim())) {
                const nIdx = parseInt(strAns.trim(), 10);
                const byId = optArr.find(o => o && typeof o === 'object' && Number(o.id ?? o.Id ?? o.position ?? o.Order) === nIdx);
                const chosen = byId || optArr[nIdx] || optArr[nIdx - 1];
                const txt = extractAnswerString(chosen);
                if (txt && txt.trim() !== '______') strAns = txt.trim();
            }
            if (!strAns || strAns.trim() === '______') {
                const trueOpt = optArr.find(o => o && typeof o === 'object' && (o.isTrue === true || o.IsTrue === true || o.true === 1 || o.True === 1 || o.isCorrect === true || Number(o.point ?? o.Point ?? 0) > 0));
                const txt = extractAnswerString(trueOpt);
                if (txt && txt.trim() !== '______') strAns = txt.trim();
            }
        }

        if (strAns) {
            const ansClean = strAns.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            if (ansClean && ansClean !== '______' && ansClean !== '...' && !ansClean.includes('translate.')) {
                if (id !== undefined && id !== null && String(id) !== '') {
                    IOE.state.correctAnswers.set(String(id), ansClean);
                    hit = true;
                }
                if (contentClean.length >= 4) {
                    IOE.state.correctAnswers.set(normalizeKeyStr(contentClean), ansClean);
                    hit = true;
                }
            }
        }
        return hit;
    }

    function parsePacket(data) {
        if (!data) return false;
        if (typeof data === 'string') {
            const dec = tryDecodeBase64Json(data);
            if (!dec) return false;
            data = dec;
        }
        if (typeof data !== 'object') return false;
        if (!IOE.state.clozeAnswers) IOE.state.clozeAnswers = {};

        let foundCount = 0;
        const visited = new WeakSet();

        function traverse(obj, depth = 0) {
            if (!obj || typeof obj !== 'object' || depth > 8) return;
            if (visited.has(obj)) return;
            visited.add(obj);

            if (storeQuestionAnswer(obj)) foundCount++;

            // Explicit Cloze-style answear/ans arrays with positions
            for (const key of ['answear', 'ans', 'Ans']) {
                const arr = obj[key];
                if (Array.isArray(arr) && arr.length > 0) {
                    arr.forEach((a, idx) => {
                        if (a && typeof a === 'object') {
                            if (storeQuestionAnswer(a, idx + 1)) foundCount++;
                            const pos = String(a.position || a.Order || (idx + 1));
                            const val = a.tans || a.Tans || (a.isTrue || Number(a.point || 0) > 0 ? (a.content || a.ans) : null);
                            if (val && isValidClozeWord(String(val)) && parseInt(pos, 10) <= 15) {
                                IOE.state.clozeAnswers[pos] = String(val).trim();
                                foundCount++;
                            }
                        }
                    });
                }
            }

            // Question lists
            for (const qKey of ['question', 'questionArr', 'listQuestion', 'Questions', 'questions']) {
                const qArr = obj[qKey];
                if (Array.isArray(qArr)) {
                    qArr.forEach((q, idx) => {
                        if (storeQuestionAnswer(q, idx + 1)) foundCount++;
                    });
                }
            }

            if (Array.isArray(obj)) {
                for (let i = 0; i < obj.length && i < 200; i++) traverse(obj[i], depth + 1);
            } else {
                for (const k of Object.keys(obj)) {
                    if (k === 'window' || k === 'document' || k === 'global' || k === 'self' || k === '_parent' || k === 'parent') continue;
                    const v = obj[k];
                    if (typeof v === 'string' && (v.startsWith('eyJ') || v.startsWith('{'))) {
                        const sub = tryDecodeBase64Json(v);
                        if (sub) traverse(sub, depth + 1);
                    } else if (v && typeof v === 'object') {
                        traverse(v, depth + 1);
                    }
                }
            }
        }

        traverse(data, 0);
        if (foundCount > 0) {
            IOE.state.packetHits = (IOE.state.packetHits || 0) + 1;
            IOE.events.emit('packetCaptured', { hits: IOE.state.packetHits, answers: IOE.state.correctAnswers.size });
        }
        return foundCount > 0;
    }

    if (!win.__YANZIOE_NET_HOOKED__) {
        win.__YANZIOE_NET_HOOKED__ = true;

        try {
            const origJsonParse = JSON.parse;
            JSON.parse = function (...args) {
                const res = origJsonParse.apply(this, args);
                try {
                    if (res && typeof res === 'object') parsePacket(res);
                } catch (e) {}
                return res;
            };
        } catch (e) {}

        try {
            const originalFetch = win.fetch;
            if (typeof originalFetch === 'function') {
                win.fetch = async function (...args) {
                    const res = await originalFetch.apply(this, args);
                    try {
                        const clone = res.clone();
                        clone.text().then(t => parsePacket(t)).catch(() => {});
                    } catch (e) {}
                    return res;
                };
            }
        } catch (e) {}

        try {
            const origOpen = XMLHttpRequest.prototype.open;
            const origSend = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.open = function (m, url, ...rest) {
                this._ioeUrl = url;
                return origOpen.apply(this, [m, url, ...rest]);
            };
            XMLHttpRequest.prototype.send = function (...args) {
                this.addEventListener('load', function () {
                    try {
                        if (!this.responseType || this.responseType === 'text') {
                            if (this.responseText) parsePacket(this.responseText);
                        } else if (this.responseType === 'json') {
                            if (this.response) parsePacket(this.response);
                        }
                    } catch (e) {}
                });
                return origSend.apply(this, args);
            };
        } catch (e) {}

        try {
            if (win.Response?.prototype?.json) {
                const origRespJson = win.Response.prototype.json;
                win.Response.prototype.json = async function () {
                    const data = await origRespJson.apply(this, arguments);
                    try { if (data && typeof data === 'object') parsePacket(data); } catch (e) {}
                    return data;
                };
            }
        } catch (e) {}
    }

    function bypassIOESystemAnswers() {
        let extracted = false;
        if (!IOE.state.clozeAnswers) IOE.state.clozeAnswers = {};

        // 1. Cocos __require Modules
        try {
            if (typeof win.__require === 'function') {
                for (const modName of ['ClientData', 'AppModel', 'GameData', 'ExamModel']) {
                    try {
                        const m = win.__require(modName);
                        const rootObj = m?.default || m;
                        if (rootObj) {
                            if (parsePacket(rootObj)) extracted = true;
                            const appModel = rootObj.AppModel || rootObj;
                            if (appModel?.game && parsePacket(appModel.game)) extracted = true;
                        }
                    } catch (e) {}
                }
            }
        } catch (e) {}

        // 2. Scan Running Cocos Scene node components deeply
        try {
            const cc = win.cc;
            if (cc && cc.director) {
                const scene = (typeof cc.director.getRunningScene === 'function' ? cc.director.getRunningScene() : (typeof cc.director.getScene === 'function' ? cc.director.getScene() : null));
                if (scene) {
                    const seenNodes = new WeakSet();
                    function inspectNode(node, depth = 0) {
                        if (!node || depth > 14 || seenNodes.has(node)) return;
                        seenNodes.add(node);
                        const comps = node._components || [];
                        for (const comp of comps) {
                            if (!comp) continue;
                            for (const fld of ['questionModel', 'curQuestion', 'currentQuestion', 'examData', 'question', 'data', 'info']) {
                                if (comp[fld] && parsePacket(comp[fld])) extracted = true;
                            }
                            if (Array.isArray(comp.listQuestion) && parsePacket(comp.listQuestion)) extracted = true;
                            if (comp.data && comp.data !== comp && parsePacket(comp.data)) extracted = true;
                        }
                        const children = (typeof node.getChildren === 'function' ? node.getChildren() : node.children) || [];
                        for (const ch of children) inspectNode(ch, depth + 1);
                    }
                    inspectNode(scene, 0);
                }
            }
        } catch (e) {}

        // 3. Global variables
        for (const gk of ['gameData', 'examData', 'exam', 'quizData', 'IOE_DATA', 'currentExam']) {
            try {
                if (win[gk] && parsePacket(win[gk])) extracted = true;
            } catch (e) {}
        }

        return extracted;
    }

    function scanCocosMemoryForAnswers() {
        return bypassIOESystemAnswers();
    }

    IOE.CLOZE_KNOWLEDGE_BANK = CLOZE_KNOWLEDGE_BANK;
    IOE.isValidClozeWord = isValidClozeWord;

    IOE.question = {
        solveQuestion,
        solveClozePassage,
        scanCocosMemoryForAnswers,
        bypassIOESystemAnswers,
        parsePacket,
        testAiKey,
        generate0msThinking,
        recordAdaptiveMistake,
        isAnswerWrong,
        getWrongAnswers
    };
})(typeof window !== 'undefined' ? window : globalThis);


/* --- functions/canvasEngine.js --- */
(function (global) {
    'use strict';
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const IOE = win.IOE || global.IOE;
    if (!IOE) return;

    function isLicensed() {
        return !!(IOE.state?.licensed || IOE.license?.isLicensed?.());
    }

    function stripOptPrefix(s) {
        return String(s || '').replace(/^[A-Da-d][.:)\]\s_-]+/, '').trim();
    }

    function getCanvasEl() {
        return document.getElementById('gameCanvas') ||
            document.getElementById('GameCanvas') ||
            document.querySelector('canvas.gameCanvas') ||
            document.querySelector('canvas');
    }

    /* ================= 1. COCOS2D-JS / COCOS CREATOR ENGINE ================= */
    function getCocosScene() {
        try {
            const cc = win.cc;
            if (cc && cc.director) {
                if (typeof cc.director.getRunningScene === 'function') {
                    const s = cc.director.getRunningScene();
                    if (s) { IOE.state.lastEngine = 'Cocos2d-html5'; return s; }
                }
                if (typeof cc.director.getScene === 'function') {
                    const s = cc.director.getScene();
                    if (s) { IOE.state.lastEngine = 'Cocos Creator'; return s; }
                }
            }
        } catch (e) {}
        return null;
    }

    function getLogicalCanvasSize() {
        try {
            const cc = win.cc;
            const vis = cc?.winSize || (typeof cc?.director?.getWinSize === 'function' ? cc.director.getWinSize() : null);
            if (vis && vis.width > 100 && vis.height > 100) return { width: vis.width, height: vis.height };
            const v2 = cc?.view?.getVisibleSize?.();
            if (v2 && v2.width > 100 && v2.height > 100) return { width: v2.width, height: v2.height };
        } catch (e) {}
        return { width: 960, height: 640 };
    }

    function canTraverseNode(node) {
        if (!node) return false;
        try {
            if (node.activeInHierarchy === false) return false;
            if (node.activeInHierarchy === undefined && node.active === false) return false;
            if (node.visible === false) return false;
            if (typeof node.isVisible === 'function' && !node.isVisible()) return false;
            if (node.scaleX === 0 || node.scaleY === 0) return false;
        } catch (e) {}
        return true;
    }

    function isSelfOpaque(node) {
        if (!node) return false;
        try {
            if (typeof node.opacity === 'number' && node.opacity <= 8) return false;
            if (typeof node.getOpacity === 'function' && node.getOpacity() <= 8) return false;
            if (node._uiProps && typeof node._uiProps.localOpacity === 'number' && node._uiProps.localOpacity <= 0.03) return false;
        } catch (e) {}
        return true;
    }

    function isNodeVisible(node) {
        return canTraverseNode(node) && isSelfOpaque(node);
    }

    function getNodeText(node) {
        if (!node) return '';
        try {
            if (typeof node.getString === 'function') {
                const s = node.getString();
                if (s && typeof s === 'string') return s.trim();
            }
            if (typeof node.getTitleText === 'function') {
                const s = node.getTitleText();
                if (s && typeof s === 'string') return s.trim();
            }
            if (typeof node.getStringText === 'function') {
                const s = node.getStringText();
                if (s && typeof s === 'string') return s.trim();
            }
            const cc = win.cc;
            if (typeof node.getComponent === 'function' && cc) {
                let comp = null;
                if (cc.Label) comp = node.getComponent(cc.Label);
                if (!comp && cc.RichText) comp = node.getComponent(cc.RichText);
                if (!comp && cc.EditBox) comp = node.getComponent(cc.EditBox);
                if (!comp) comp = node.getComponent('cc.Label') || node.getComponent('cc.RichText');
                const s = comp?.string ?? comp?.text;
                if (s && typeof s === 'string') return s.replace(/<[^>]+>/g, '').trim();
            }
            if (Array.isArray(node._components)) {
                for (const comp of node._components) {
                    const s = comp?.string ?? comp?._string ?? comp?.text ?? comp?.btnTxt ?? comp?.btnContent;
                    if (s && typeof s === 'string' && s.trim()) {
                        return s.replace(/<[^>]+>/g, '').trim();
                    }
                }
            }
            if (node._string && typeof node._string === 'string') return node._string.trim();
            if (node.string && typeof node.string === 'string') return node.string.trim();
        } catch (e) {}
        return '';
    }

    function getNodeWorldPos(node) {
        let pos = { x: node.x || 0, y: node.y || 0 };
        try {
            const cc = win.cc;
            const origin = cc?.p ? cc.p(0, 0) : (cc?.v2 ? cc.v2(0, 0) : { x: 0, y: 0 });
            if (typeof node.convertToWorldSpaceAR === 'function') {
                pos = node.convertToWorldSpaceAR(origin);
            } else if (typeof node.convertToWorldSpace === 'function') {
                pos = node.convertToWorldSpace(origin);
            }
        } catch (e) {}
        return pos;
    }

    function extractCocosTexts(node, maxDepth = 24, curDepth = 0) {
        if (!node || curDepth > maxDepth || !canTraverseNode(node)) return [];
        const results = [];
        try {
            if (isSelfOpaque(node)) {
                const clean = getNodeText(node);
                if (clean.length > 0) {
                    const worldPos = getNodeWorldPos(node);
                    results.push({ node, text: clean, y: node.y || 0, x: node.x || 0, worldX: worldPos.x, worldY: worldPos.y });
                }
            }
            const children = (typeof node.getChildren === 'function' ? node.getChildren() : node.children) || [];
            for (const child of children) {
                results.push(...extractCocosTexts(child, maxDepth, curDepth + 1));
            }
        } catch (e) {}
        return results;
    }

    function extractSceneSpriteClues(node, maxDepth = 16, curDepth = 0, out = []) {
        if (!node || curDepth > maxDepth || !canTraverseNode(node)) return out;
        try {
            if (isSelfOpaque(node)) {
                const cc = win.cc;
                let rawName = '';
                if (typeof node.getComponent === 'function' && cc?.Sprite) {
                    const sp = node.getComponent(cc.Sprite);
                    rawName = sp?.spriteFrame?._name || sp?._spriteFrame?.name || '';
                }
                if (!rawName && node._spriteFrame) {
                    rawName = node._spriteFrame._name || node._spriteFrame.name || '';
                }
                if (rawName && typeof rawName === 'string') {
                    const clean = rawName.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim();
                    const lower = clean.toLowerCase();
                    if (clean.length >= 3 && clean.length <= 32 && /[a-z]/i.test(clean) &&
                        !/^(bg|btn|button|panel|frame|border|icon|bar|box|popup|dialog|mask|cloud|star|coin|heart|sound|audio|close|next|back|ok|start|sprite|default|avatar|logo|arrow|line|dot|check|tick|cross|white|black)/i.test(lower) &&
                        !out.includes(clean)) {
                        out.push(clean);
                    }
                }
            }
            const ch = (typeof node.getChildren === 'function' ? node.getChildren() : node.children) || [];
            for (const c of ch) extractSceneSpriteClues(c, maxDepth, curDepth + 1, out);
        } catch (e) {}
        return out;
    }

    function hasEventListeners(node) {
        const pools = [node._bubblingListeners, node._capturingListeners, node._eventTarget?._bubblingListeners];
        for (const pool of pools) {
            if (pool && typeof pool === 'object' && Object.keys(pool).length > 0) return true;
        }
        return false;
    }

    function findCocosClickables(node, maxDepth = 24, curDepth = 0) {
        if (!node || curDepth > maxDepth || !canTraverseNode(node)) return [];
        const results = [];
        try {
            const cc = win.cc;
            let isClickable = false;
            let btnComp = null;

            if (typeof node.getComponent === 'function') {
                btnComp = (cc?.Button && node.getComponent(cc.Button)) || node.getComponent('cc.Button') || null;
                if (btnComp && btnComp.interactable !== false && btnComp.enabled !== false) isClickable = true;
            }
            if (cc?.MenuItem && node instanceof cc.MenuItem && (typeof node.isEnabled !== 'function' || node.isEnabled())) isClickable = true;
            if (cc?.ui?.Button && node instanceof cc.ui.Button && (typeof node.isEnabled !== 'function' || node.isEnabled())) isClickable = true;
            if (cc?.ui?.Widget && node instanceof cc.ui.Widget && typeof node.isTouchEnabled === 'function' && node.isTouchEnabled()) isClickable = true;
            if (node._hasClickEventListener || node._touchListener || node._touchEnabled || hasEventListeners(node)) isClickable = true;

            const name = (node.name || '').toLowerCase();
            if (name.includes('btn') || name.includes('opt') || name.includes('choice') || name.includes('item') || name.includes('ans') || name.includes('block') || name.includes('word')) {
                isClickable = true;
            }

            if (isClickable) {
                let txt = isSelfOpaque(node) ? getNodeText(node) : '';
                if (!txt) {
                    txt = extractCocosTexts(node, 5).map(t => t.text).join(' ');
                }
                if (isSelfOpaque(node) || txt.trim() || btnComp) {
                    const worldPos = getNodeWorldPos(node);
                    results.push({ node, text: txt.trim(), btnComp, y: node.y || 0, x: node.x || 0, worldX: worldPos.x, worldY: worldPos.y, name: node.name || '' });
                }
            }

            const children = (typeof node.getChildren === 'function' ? node.getChildren() : node.children) || [];
            for (const child of children) {
                results.push(...findCocosClickables(child, maxDepth, curDepth + 1));
            }
        } catch (e) {}
        return results;
    }

    async function clickCocosNode(node) {
        if (!node || !canTraverseNode(node)) return false;
        try {
            const cc = win.cc;
            const worldPos = getNodeWorldPos(node);

            const mockTouch = {
                getLocation: () => ({ x: worldPos.x, y: worldPos.y }),
                getPreviousLocation: () => ({ x: worldPos.x, y: worldPos.y }),
                getDelta: () => ({ x: 0, y: 0 }),
                getID: () => 0
            };

            const mockEvent = {
                type: 'touchend',
                target: node,
                currentTarget: node,
                touch: mockTouch,
                bubbles: true,
                stopPropagation: () => {},
                isStopped: () => false
            };

            if (typeof node.activate === 'function') {
                try { node.activate(); } catch (e) {}
            }

            let firedClickEvents = false;
            let btnComp = null;
            if (typeof node.getComponent === 'function') {
                btnComp = (cc?.Button && node.getComponent(cc.Button)) || node.getComponent('cc.Button') || null;
                if (btnComp && btnComp.interactable !== false) {
                    btnComp._pressed = true;
                    if (Array.isArray(btnComp.clickEvents) && btnComp.clickEvents.length > 0) {
                        if (typeof cc?.Component?.EventHandler?.emitEvents === 'function') {
                            try {
                                cc.Component.EventHandler.emitEvents(btnComp.clickEvents, mockEvent);
                                firedClickEvents = true;
                            } catch (e) {}
                        } else {
                            for (const ev of btnComp.clickEvents) {
                                if (typeof ev?.emit === 'function') {
                                    try { ev.emit([mockEvent, ev.customEventData]); firedClickEvents = true; } catch (e) {}
                                }
                            }
                        }
                    }
                    if (!firedClickEvents && typeof btnComp._onTouchEnded === 'function') {
                        try { btnComp._onTouchEnded(mockEvent); firedClickEvents = true; } catch (e) {}
                    }
                    btnComp._pressed = false;
                }
            }

            if (!firedClickEvents) {
                if (cc?.eventManager && typeof cc.eventManager.dispatchEvent === 'function' && cc.EventTouch) {
                    try {
                        const touchEvt = new cc.EventTouch([mockTouch]);
                        touchEvt.setEventCode(cc.EventTouch.EventCode.BEGAN);
                        cc.eventManager.dispatchEvent(touchEvt);
                        touchEvt.setEventCode(cc.EventTouch.EventCode.ENDED);
                        cc.eventManager.dispatchEvent(touchEvt);
                    } catch (e) {}
                }

                if (typeof node.emit === 'function') {
                    node.emit('touchstart', { ...mockEvent, type: 'touchstart' });
                    node.emit('touchend', mockEvent);
                    node.emit('click', btnComp || mockEvent);
                }

                const canvas = getCanvasEl();
                if (canvas) {
                    const rect = canvas.getBoundingClientRect();
                    const { width: canvasW, height: canvasH } = getLogicalCanvasSize();
                    const scaleX = rect.width / (canvasW || rect.width);
                    const scaleY = rect.height / (canvasH || rect.height);
                    const clientX = rect.left + (worldPos.x * scaleX);
                    const clientY = rect.bottom - (worldPos.y * scaleY);
                    dispatchCanvasClick(canvas, clientX, clientY);
                }
            } else if (typeof node.emit === 'function') {
                node.emit('click', btnComp || mockEvent);
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    function matchCocosButton(buttons, ansStr) {
        if (!Array.isArray(buttons) || !buttons.length || !ansStr) return null;
        const cleanAns = stripOptPrefix(ansStr).toLowerCase();
        const ansUpper = String(ansStr).trim().toUpperCase();

        // 1. Exact clean text equality
        let match = buttons.find(b => stripOptPrefix(b.text).toLowerCase() === cleanAns);
        if (match) return match;

        // 2. Word-boundary exact match (only length >= 2 to prevent single-char "a" matching "apple")
        if (cleanAns.length >= 2) {
            const esc = cleanAns.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const rx = new RegExp(`(^|\\s)${esc}(\\s|$)`, 'i');
            match = buttons.find(b => rx.test(stripOptPrefix(b.text)));
            if (match) return match;
        }

        // 3. Explicit single option letter A/B/C/D -> prefix match or sorted index
        const mLet = /^([A-D])\.?$/.exec(ansUpper);
        if (mLet) {
            const letCh = mLet[1];
            match = buttons.find(b => {
                const up = b.text.trim().toUpperCase();
                return up === letCh || up.startsWith(letCh + '.') || up.startsWith(letCh + ')') || up.startsWith(letCh + ':') || up.startsWith(letCh + ' ');
            });
            if (match) return match;
            const idx = letCh.charCodeAt(0) - 65;
            if (buttons[idx]) return buttons[idx];
        }

        // 4. Safe substring match for >= 3 chars
        if (cleanAns.length >= 3) {
            match = buttons.find(b => {
                const bt = stripOptPrefix(b.text).toLowerCase();
                return bt.length >= 3 && (bt.includes(cleanAns) || cleanAns.includes(bt));
            });
            if (match) return match;
        }
        return null;
    }

    /* ================= 2. CLOZE PASSAGE SOLVER (COCOS2D) ================= */
    async function solveCocosClozePassage(scene) {
        try { IOE.question?.bypassIOESystemAnswers?.(); } catch (e) {}
        const allTexts = extractCocosTexts(scene);
        if (allTexts.length === 0) return false;

        const { width: W, height: H } = getLogicalCanvasSize();

        let passageObj = allTexts.find(t => t.text.length > 50 && (/\(\s*\d+\s*\)|_{3,}|\.{3,}/i.test(t.text)));
        if (!passageObj) passageObj = allTexts.find(t => t.text.length > 85 && t.worldY > H * 0.42);
        if (!passageObj || !passageObj.text) return false;
        const passageText = passageObj.text;

        function extractRowsFromScene() {
            const curTexts = extractCocosTexts(scene);
            const clickables = findCocosClickables(scene);
            const candBtns = [];
            for (const c of clickables) {
                const nl = (c.name || '').toLowerCase();
                if (/(submit|refresh|close|sound|time|score|back|exit|mute|help)/.test(nl)) continue;
                if (c.worldX > W * 0.78 && c.worldY > H * 0.72) continue;
                const t = (c.text || '').trim();
                if (!t || /^(ok|start|tiếp tục|nộp bài|submit)$/i.test(t)) continue;
                if (/^[A-Da-d][.:)\s]/i.test(t) || (t.length >= 1 && t.length <= 42 && !/^\d+$/.test(t))) {
                    if (!candBtns.some(b => Math.abs(b.worldX - c.worldX) < 15 && Math.abs(b.worldY - c.worldY) < 15)) {
                        candBtns.push(c);
                    }
                }
            }
            if (candBtns.length < 4) return [];

            candBtns.sort((a, b) => b.worldY - a.worldY);
            const rows = [];
            for (const btn of candBtns) {
                let r = rows.find(row => Math.abs(row.y - btn.worldY) < 22);
                if (!r) { r = { y: btn.worldY, buttons: [] }; rows.push(r); }
                r.buttons.push(btn);
            }
            rows.forEach(r => r.buttons.sort((a, b) => a.worldX - b.worldX));

            const numLabels = [];
            for (const tObj of curTexts) {
                const m = /^([0-9]{1,2})[.:)]?$/.exec(tObj.text.trim());
                if (m && tObj.worldX < W * 0.20) {
                    numLabels.push({ ...tObj, rowNumber: parseInt(m[1], 10) });
                }
            }
            rows.forEach((r, idx) => {
                const lbl = numLabels.find(l => Math.abs(l.worldY - r.y) < 30);
                r.rowNumber = (lbl && lbl.rowNumber > 0) ? lbl.rowNumber : (idx + 1);
            });
            return rows.filter(r => r.rowNumber > 0 && r.buttons.length >= 2).sort((a, b) => a.rowNumber - b.rowNumber);
        }

        const initialRowsRaw = extractRowsFromScene();
        if (initialRowsRaw.length === 0 && !/\(\s*\d+\s*\)/.test(passageText)) return false;

        const initialRows = initialRowsRaw.map(r => ({
            index: r.rowNumber,
            rowNumber: r.rowNumber,
            options: r.buttons.map(b => stripOptPrefix(b.text)).filter(Boolean)
        }));

        let fullAnswers = await IOE.question?.solveClozePassage(passageText, initialRows);
        if (!fullAnswers || Object.keys(fullAnswers).length === 0) return false;

        const blankMatches = [...passageText.matchAll(/\(([0-9]{1,2})\)/g)].map(m => parseInt(m[1], 10));
        let detectedCount = blankMatches.length > 0 ? Math.max(...blankMatches) : Object.keys(fullAnswers).length;
        if (detectedCount > 15 || detectedCount < 1) detectedCount = Math.min(Object.keys(fullAnswers).length, 10);
        const totalBlanks = Math.min(Math.max(detectedCount, 2), 12);

        let scrollViewComp = null;
        try {
            (function findSV(n) {
                if (!n || scrollViewComp) return;
                const cc = win.cc;
                if (typeof n.getComponent === 'function' && cc?.ScrollView) {
                    const sv = n.getComponent(cc.ScrollView);
                    if (sv) { scrollViewComp = sv; return; }
                }
                if (win.ccui?.ScrollView && n instanceof win.ccui.ScrollView) { scrollViewComp = n; return; }
                const ch = (typeof n.getChildren === 'function' ? n.getChildren() : n.children) || [];
                for (const c of ch) findSV(c);
            })(scene);
        } catch (e) {}

        const clickedRowNumbers = new Set();
        const recordedAnswers = {};
        let filledCount = 0;

        async function solveVisibleRows() {
            let stepFilled = 0;
            const validRows = extractRowsFromScene();
            for (const row of validRows) {
                const rNum = row.rowNumber;
                if (clickedRowNumbers.has(rNum)) continue;
                const targetRaw = fullAnswers[rNum] || fullAnswers[String(rNum)] || '';
                const targetStr = String(targetRaw).trim();
                if (!targetStr) continue;

                const targetButton = matchCocosButton(row.buttons, targetStr);
                if (targetButton) {
                    await clickCocosNode(targetButton.node);
                    clickedRowNumbers.add(rNum);
                    filledCount++;
                    stepFilled++;
                    const chosenIdx = row.buttons.indexOf(targetButton);
                    const chosenLetter = chosenIdx >= 0 ? String.fromCharCode(65 + chosenIdx) : '';
                    const cleanBtnTxt = stripOptPrefix(targetButton.text);
                    recordedAnswers[rNum] = chosenLetter ? `${chosenLetter} (${cleanBtnTxt || targetStr})` : (cleanBtnTxt || targetStr);
                    IOE.updateQuizSummary?.(totalBlanks, filledCount);
                    await IOE.delay?.(220);
                }
            }
            return stepFilled;
        }

        if (scrollViewComp) {
            try {
                if (typeof scrollViewComp.scrollToTop === 'function') scrollViewComp.scrollToTop(0.1);
                else if (typeof scrollViewComp.scrollToPercentVertical === 'function') scrollViewComp.scrollToPercentVertical(0, 0.1);
            } catch (e) {}
            await IOE.delay?.(220);
        }
        await solveVisibleRows();

        if (filledCount < totalBlanks) {
            if (scrollViewComp) {
                try {
                    if (typeof scrollViewComp.scrollToBottom === 'function') scrollViewComp.scrollToBottom(0.15);
                    else if (typeof scrollViewComp.scrollToPercentVertical === 'function') scrollViewComp.scrollToPercentVertical(1.0, 0.15);
                } catch (e) {}
            }
            const canvas = getCanvasEl();
            if (canvas) canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 800, clientX: 400, clientY: 400, bubbles: true }));
            await IOE.delay?.(320);
            await solveVisibleRows();
        }

        if (filledCount > 0) {
            IOE.toast(`🎉 Đã điền ${filledCount}/${totalBlanks} đáp án Cloze Test!`, 2400);
        }
        return filledCount > 0;
    }

    /* ================= 3. DISPATCH CANVAS CLICK, KEYBOARD & EDITBOX ================= */
    function dispatchCanvasClick(canvas, x, y) {
        if (!canvas) return;
        const opts = { bubbles: true, cancelable: true, view: win, clientX: x, clientY: y, pageX: x, pageY: y };
        try {
            if (typeof PointerEvent !== 'undefined') {
                canvas.dispatchEvent(new PointerEvent('pointerdown', opts));
                canvas.dispatchEvent(new PointerEvent('pointerup', opts));
            }
            canvas.dispatchEvent(new MouseEvent('mousedown', opts));
            canvas.dispatchEvent(new MouseEvent('mouseup', opts));
            canvas.dispatchEvent(new MouseEvent('click', opts));
        } catch (e) {}
    }

    function setDomInputValue(el, value) {
        if (!el) return;
        try {
            const proto = el.tagName === 'TEXTAREA' ? win.HTMLTextAreaElement?.prototype : win.HTMLInputElement?.prototype;
            const desc = proto && Object.getOwnPropertyDescriptor(proto, 'value');
            if (desc && typeof desc.set === 'function') desc.set.call(el, value);
            else el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {}
    }

    function keyInfoForChar(ch) {
        if (ch === ' ') return { key: ' ', code: 'Space', keyCode: 32 };
        if (ch === "'") return { key: "'", code: 'Quote', keyCode: 222 };
        if (ch === '.') return { key: '.', code: 'Period', keyCode: 190 };
        if (ch === ',') return { key: ',', code: 'Comma', keyCode: 188 };
        if (ch === '-') return { key: '-', code: 'Minus', keyCode: 189 };
        if (ch === '?') return { key: '?', code: 'Slash', keyCode: 191 };
        const up = ch.toUpperCase();
        const isDigit = ch >= '0' && ch <= '9';
        return {
            key: ch,
            code: isDigit ? `Digit${ch}` : `Key${up}`,
            keyCode: up.charCodeAt(0)
        };
    }

    function typeCanvasString(str) {
        const cleanStr = String(str || '').trim();
        if (!cleanStr) return false;

        // 1. Check active Cocos DOM EditBox input overlay first
        const domInputs = Array.from(document.querySelectorAll('input.cocosEditBox, textarea.cocosEditBox, input[type="text"], input:not([type])'))
            .filter(el => el.offsetParent !== null && !el.closest('#yanzioe-root') && !el.closest('#yanzioe-license-modal'));
        if (domInputs.length > 0) {
            const tgt = domInputs.find(el => el === document.activeElement) || domInputs[0];
            tgt.focus();
            setDomInputValue(tgt, cleanStr);
            tgt.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            tgt.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            return true;
        }

        // 2. Fallback Canvas keyboard events
        const target = getCanvasEl() || win;
        for (let i = 0; i < cleanStr.length; i++) {
            const info = keyInfoForChar(cleanStr[i]);
            const keyOpts = { key: info.key, code: info.code, keyCode: info.keyCode, which: info.keyCode, bubbles: true };
            target.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
            target.dispatchEvent(new KeyboardEvent('keypress', keyOpts));
            target.dispatchEvent(new KeyboardEvent('keyup', keyOpts));
        }
        target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        target.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        return true;
    }

    /* ================= 3B. WORD REORDERING (COCOS2D) ================= */
    function isAncestorNamed(node, pattern) {
        let p = node?.parent || node?._parent;
        let guard = 0;
        while (p && guard++ < 12) {
            if (pattern.test(String(p.name || ''))) return true;
            p = p.parent || p._parent;
        }
        return false;
    }

    function inspectIoeGameComponents(scene) {
        let gamePlayComp = null;
        let reorderComp = null;
        let matchComp = null;
        let textComp = null;
        const seen = new WeakSet();
        (function walk(n, d = 0) {
            if (!n || d > 16 || seen.has(n) || !canTraverseNode(n)) return;
            seen.add(n);
            for (const c of (n._components || [])) {
                if (!c) continue;
                if (!gamePlayComp && (c.btnSubmit || c.quest || typeof c.findQuestModel === 'function')) gamePlayComp = c;
                if (!reorderComp && Array.isArray(c.listText) && Array.isArray(c.listAnswer)) reorderComp = c;
                if (!matchComp && c.ctnCross && (c.rootGame || c.data?.game?.question)) matchComp = c;
                if (!textComp && c.questionModel && Array.isArray(c.buttons)) textComp = c;
            }
            const ch = (typeof n.getChildren === 'function' ? n.getChildren() : n.children) || [];
            for (const x of ch) walk(x, d + 1);
        })(scene, 0);
        return { gamePlayComp, reorderComp, matchComp, textComp };
    }

    async function solveCocosMatchingPairs(scene) {
        if (!scene) return false;
        let matchCompRef = null;
        try {
            const cc = win.cc;
            const { gamePlayComp, matchComp } = inspectIoeGameComponents(scene);
            if (!matchComp || !matchComp.ctnCross || matchComp._yanzBusy) return false;
            matchCompRef = matchComp;
            matchCompRef._yanzBusy = true;
            const rootGame = matchComp.rootGame || gamePlayComp;
            if (rootGame?.isEndGame) return false;

            const cardNodes = (matchComp.ctnCross.children || []).filter(n => {
                if (!canTraverseNode(n)) return false;
                if (typeof n.opacity === 'number' && n.opacity <= 8) return false;
                const btn = typeof n.getComponent === 'function' ? ((cc?.Button && n.getComponent(cc.Button)) || n.getComponent('cc.Button')) : null;
                return !(btn && btn.interactable === false);
            });
            if (cardNodes.length < 2) return false;

            // If user had 1 card half-selected, clear it before pairing cleanly
            if (matchComp.selectCross1) {
                await clickCocosNode(matchComp.selectCross1);
                await IOE.delay?.(120);
            }

            const pairsToClick = [];
            const usedNodes = new WeakSet();
            const qList = matchComp.data?.game?.question || [];

            // Tier 0 (RAM / ClientData.AppModel exact pairs - supports text, IPA & image cards!)
            if (qList.length > 0 || typeof rootGame?.findQuestModel === 'function') {
                const leftCards = cardNodes.filter(n => n.dataAnswer && (n.dataAnswer.content?.content || (typeof n.dataAnswer.content === 'string' && !n.dataAnswer.ans)));
                for (const leftNode of leftCards) {
                    if (usedNodes.has(leftNode)) continue;
                    const i = String(leftNode.dataAnswer?.content?.content ?? leftNode.dataAnswer?.content ?? '').trim();
                    if (!i) continue;
                    const qModel = rootGame?.findQuestModel?.(i);
                    let targetAns = qModel?.answearArr?.[0]?.content;
                    if (!targetAns) {
                        const rawQ = qList.find(q => String(q.content?.content ?? q.content ?? '').trim() === i);
                        targetAns = rawQ?.ans?.[0]?.content ?? rawQ?.answearArr?.[0]?.content;
                    }
                    if (!targetAns) continue;
                    const targetNorm = String(targetAns).replace(/\.(PNG|JPG|JPEG|GIF)$/i, m => m.toLowerCase()).trim();

                    const rightNode = cardNodes.find(n => {
                        if (n === leftNode || usedNodes.has(n) || !n.dataAnswer) return false;
                        const a = typeof n.dataAnswer.ans === 'string' ? n.dataAnswer.ans : '';
                        const aNorm = a.replace(/\.(PNG|JPG|JPEG|GIF)$/i, m => m.toLowerCase()).trim();
                        return a && (a.trim() === String(targetAns).trim() || aNorm === targetNorm);
                    });
                    if (rightNode) {
                        usedNodes.add(leftNode);
                        usedNodes.add(rightNode);
                        pairsToClick.push([leftNode, rightNode, `${i} ↔ ${targetNorm}`]);
                    }
                }
            }

            // Tier 2 Fallback (AI Batch Pair Matching if dataAnswer RAM not bound)
            if (pairsToClick.length === 0) {
                const cardsWithText = cardNodes.map(n => ({
                    node: n,
                    text: (getNodeText(n) || extractCocosTexts(n, 3).map(t => t.text).join(' ')).trim()
                })).filter(c => c.text);
                if (cardsWithText.length >= 2) {
                    const qPrompt = getNodeText(matchComp.txtQuestion?.node || matchComp.txtQuestion) || 'Match the exact pairs';
                    const meta = await IOE.question?.solveQuestion(null, qPrompt, cardsWithText.map(c => c.text), 'pairs');
                    let pairsArr = null;
                    try { pairsArr = meta?.answer ? JSON.parse(meta.answer) : null; } catch (e) {}
                    if (Array.isArray(pairsArr)) {
                        for (const pair of pairsArr) {
                            if (!Array.isArray(pair) || pair.length < 2) continue;
                            const cardA = cardsWithText.find(c => !usedNodes.has(c.node) && c.text.toLowerCase() === String(pair[0]).trim().toLowerCase());
                            const cardB = cardsWithText.find(c => c !== cardA && !usedNodes.has(c.node) && c.text.toLowerCase() === String(pair[1]).trim().toLowerCase());
                            if (cardA && cardB) {
                                usedNodes.add(cardA.node);
                                usedNodes.add(cardB.node);
                                pairsToClick.push([cardA.node, cardB.node, `${cardA.text} ↔ ${cardB.text}`]);
                            }
                        }
                    }
                }
            }

            if (pairsToClick.length === 0) return false;
            IOE.state.lastEngine = 'Cocos2d (Ghép Cặp)';
            let solvedPairs = 0;
            for (const [n1, n2, label] of pairsToClick) {
                if (rootGame?.isEndGame) break;
                let waitMs = 0;
                while (matchComp.mask?.active && waitMs < 4000) {
                    await IOE.delay?.(80);
                    waitMs += 80;
                }
                if (typeof n1.opacity === 'number' && n1.opacity <= 8) continue;
                if (typeof n2.opacity === 'number' && n2.opacity <= 8) continue;
                await clickCocosNode(n1);
                await IOE.delay?.(160);
                await clickCocosNode(n2);
                solvedPairs++;
                IOE.toast(`🧩 Ghép cặp (${solvedPairs}/${pairsToClick.length}): ${label}`, 1100);
                await IOE.delay?.(260);
            }
            return solvedPairs > 0;
        } catch (e) {
            return false;
        } finally {
            if (matchCompRef) matchCompRef._yanzBusy = false;
        }
    }

    async function solveCocosWordReordering(scene) {
        if (!scene) return false;
        try {
            const { width: W, height: H } = getLogicalCanvasSize();
            const { gamePlayComp, reorderComp } = inspectIoeGameComponents(scene);
            if (reorderComp && reorderComp._enableClick === false) return false;

            const clickables = findCocosClickables(scene);
            let wordBlocks = [];
            let answerBtn = gamePlayComp?.btnSubmit ? { node: gamePlayComp.btnSubmit.node || gamePlayComp.btnSubmit, text: 'ANSWER', name: 'btnSubmit' } : null;

            if (reorderComp && reorderComp.listText.length >= 4) {
                for (const tileNode of reorderComp.listText) {
                    if (!canTraverseNode(tileNode)) continue;
                    if (typeof tileNode.opacity === 'number' && tileNode.opacity <= 8) continue;
                    const txt = getNodeText(tileNode) || extractCocosTexts(tileNode, 4).map(x => x.text).join(' ');
                    if (txt.trim()) {
                        wordBlocks.push({ node: tileNode, text: txt.trim(), name: tileNode.name || '' });
                    }
                }
            } else {
                for (const c of clickables) {
                    const nl = (c.name || '').toLowerCase();
                    const t = (c.text || '').trim();
                    const tl = t.toLowerCase();
                    if (c.worldX > W * 0.72 && c.worldY > H * 0.65) continue;
                    if (nl.includes('submit') || nl.includes('answer') || nl.includes('traloi') || tl === 'answer' || tl === 'trả lời' || tl === 'nộp bài') {
                        if (!answerBtn) answerBtn = c;
                        continue;
                    }
                    if (!t) continue;
                    if (isAncestorNamed(c.node, /ctnAnwser|ctnAnswer|profile|header/i)) continue;
                    if (typeof c.node?.opacity === 'number' && c.node.opacity <= 8) continue;
                    if (t.length > 0 && t.length < 48 && !isHudChromeText(t) && !/^(ok|start|close|back|reset|sound|skip|replay|score|round:.*)$/i.test(tl) && !/^[A-D][.:)]/i.test(t)) {
                        wordBlocks.push(c);
                    }
                }
            }

            // Reorder scenes usually show >= 4 clickable word pills with a prompt or without A/B/C/D options
            if (wordBlocks.length < 4) return false;
            const looksLikeMC = wordBlocks.every(w => /^[A-D][.:)]/i.test(w.text));
            if (looksLikeMC) return false;

            const words = wordBlocks.map(b => b.text.trim());
            const texts = extractCocosTexts(scene)
                .filter(x => !(x.worldX > W * 0.72 && x.worldY > H * 0.65))
                .map(x => x.text.trim())
                .filter(t => !words.includes(t) && !isHudChromeText(t) && !/^(id:|round:|score|\d+(\.\d+)?)$/i.test(t));
            const stem = texts.join(' ');
            const promptContext = `Arrange words: ${words.join(' | ')}${stem ? ' (' + stem + ')' : ''}`;
            const meta = await IOE.question?.solveQuestion(null, promptContext, words, 'reorder');
            if (!meta || !meta.answer) return false;

            const fullTarget = String(meta.answer).trim().toLowerCase().replace(/[^a-z0-9\s']/g, '').replace(/\s+/g, ' ');
            const availableBlocks = wordBlocks.slice();
            const clickOrder = [];
            let remaining = fullTarget;

            while (remaining.length > 0 && availableBlocks.length > 0) {
                remaining = remaining.trim();
                let foundIdx = availableBlocks.findIndex(block => {
                    const cb = block.text.toLowerCase().replace(/[^a-z0-9\s']/g, '').trim();
                    return cb && (remaining === cb || remaining.startsWith(cb + ' '));
                });
                if (foundIdx < 0) {
                    foundIdx = availableBlocks.findIndex(block => {
                        const cb = block.text.toLowerCase().replace(/[^a-z0-9\s']/g, '').trim();
                        return cb && remaining.startsWith(cb);
                    });
                }
                if (foundIdx < 0) break;
                const chosen = availableBlocks.splice(foundIdx, 1)[0];
                const cb = chosen.text.toLowerCase().replace(/[^a-z0-9\s']/g, '').trim();
                clickOrder.push(chosen);
                remaining = remaining.slice(cb.length).trim();
            }

            if (clickOrder.length < 3) return false;
            for (const block of clickOrder) {
                await clickCocosNode(block.node);
                await IOE.delay?.(240);
            }
            if (answerBtn?.node) {
                await IOE.delay?.(320);
                await clickCocosNode(answerBtn.node);
            }
            IOE.toast(`🧩 Đã ghép ${clickOrder.length} khối từ!`, 1500);
            return true;
        } catch (e) {
            return false;
        }
    }

    /* ================= 4. CREATEJS / ADOBE ANIMATE ENGINE ================= */
    function isCreateJSVisible(obj) {
        if (!obj) return false;
        if (obj.visible === false) return false;
        if (typeof obj.alpha === 'number' && obj.alpha <= 0.05) return false;
        return true;
    }

    function extractCreateJSData(root) {
        const texts = [];
        const clickables = [];
        const seen = new WeakSet();

        function walk(obj, depth = 0) {
            if (!obj || depth > 14 || !isCreateJSVisible(obj) || seen.has(obj)) return;
            seen.add(obj);

            if (typeof obj.text === 'string' && obj.text.trim()) {
                let gx = obj.x || 0, gy = obj.y || 0;
                try {
                    if (typeof obj.localToGlobal === 'function') {
                        const gp = obj.localToGlobal(0, 0);
                        gx = gp.x; gy = gp.y;
                    }
                } catch (e) {}
                texts.push({ obj, text: obj.text.trim(), x: gx, y: gy });
            }

            const hasListener = !!(obj._listeners?.click || obj._listeners?.mousedown || obj.cursor === 'pointer');
            const nameLower = (obj.name || '').toLowerCase();
            const isNamedBtn = /(btn|opt|choice|ans|item|next|submit|start|ok)/.test(nameLower);
            if (obj.mouseEnabled !== false && (hasListener || isNamedBtn) && obj.children) {
                const subTexts = [];
                (obj.children || []).forEach(c => {
                    if (isCreateJSVisible(c) && typeof c.text === 'string' && c.text.trim()) subTexts.push(c.text.trim());
                });
                const label = subTexts.join(' ').trim();
                let gx = obj.x || 0, gy = obj.y || 0;
                try {
                    if (typeof obj.localToGlobal === 'function') {
                        const gp = obj.localToGlobal(0, 0);
                        gx = gp.x; gy = gp.y;
                    }
                } catch (e) {}
                if (label || isNamedBtn) {
                    clickables.push({ obj, text: label, x: gx, y: gy, name: obj.name || '' });
                }
            }

            if (Array.isArray(obj.children)) {
                for (const ch of obj.children) walk(ch, depth + 1);
            }
        }

        walk(root, 0);
        return { texts, clickables };
    }

    function clickCreateJSObj(item, canvas) {
        if (!item?.obj) return false;
        try {
            const obj = item.obj;
            if (typeof obj.dispatchEvent === 'function') {
                obj.dispatchEvent('mousedown');
                obj.dispatchEvent('pressup');
                obj.dispatchEvent('click');
            }
            if (canvas && (canvas.width || 1) > 0) {
                const rect = canvas.getBoundingClientRect();
                const cx = rect.left + (item.x / canvas.width) * rect.width;
                const cy = rect.top + (item.y / canvas.height) * rect.height;
                dispatchCanvasClick(canvas, cx, cy);
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    async function solveCreateJSGame() {
        const stage = win.stage || win.exportRoot?.stage || null;
        const root = win.exportRoot || stage;
        if (!root) return false;
        IOE.state.lastEngine = 'CreateJS / Animate';

        const canvas = getCanvasEl();
        const { texts, clickables } = extractCreateJSData(root);
        if (texts.length === 0 && clickables.length === 0) return false;

        // Filter non-chrome texts
        const btnTextSet = new Set(clickables.map(c => c.text).filter(Boolean));
        const optionBtns = clickables.filter(c => c.text && !/^(score|time|sound|mute|back|exit|\d+:\d+)$/i.test(c.text));
        const optStrings = optionBtns.map(c => c.text);
        const stemParts = texts
            .map(t => t.text)
            .filter(t => !btnTextSet.has(t) && !/^(score|điểm|time|0?\d:\d\d|\d+\/\d+)$/i.test(t));

        const qText = (stemParts.length ? stemParts : texts.map(t => t.text)).join(' ').trim();
        if (!qText) return false;

        const meta = await IOE.question?.solveQuestion(null, qText, optStrings);
        if (!meta?.answer) return false;

        if (optionBtns.length > 0) {
            const matched = matchCocosButton(optionBtns, meta.answer);
            if (matched && clickCreateJSObj(matched, canvas)) {
                IOE.toast(`⚡ [CreateJS] Chọn: ${matched.text || meta.answer}`, 1400);
                return true;
            }
        }
        typeCanvasString(String(meta.answer));
        return true;
    }

    /* ================= 5. UNIFIED CANVAS SOLVER ================= */
    function isHudChromeText(t) {
        const s = String(t || '').trim();
        return /^(score|điểm|time|timer|thời gian|\d{1,2}:\d{2}|câu\s*\d+(\/\d+)?|question\s*\d+(\/\d+)?|\d+\/\d+)$/i.test(s);
    }

    async function solveCanvasGame() {
        if (!isLicensed()) return false;
        try { IOE.question?.scanCocosMemoryForAnswers?.(); } catch (e) {}

        const cocosScene = getCocosScene();
        if (cocosScene) {
            const clickables = findCocosClickables(cocosScene);

            // Only auto-press OK / Start if it's an intro/transition screen (<= 3 clickable buttons total)
            if (clickables.length > 0 && clickables.length <= 3) {
                for (const c of clickables) {
                    const tl = c.text.toLowerCase();
                    if (tl === 'ok' || tl === 'start' || tl === 'bắt đầu' || tl === 'tiếp tục') {
                        await clickCocosNode(c.node);
                        IOE.toast('🚀 Tiếp tục màn Cocos2d!', 1100);
                        await IOE.delay?.(700);
                        return true;
                    }
                }
            }

            // 1. Cloze Passage ("Lâu đài trên mây")
            if (await solveCocosClozePassage(cocosScene)) return true;

            // 1B. Matching Pairs ("Ghép Cặp" / Game12)
            if (await solveCocosMatchingPairs(cocosScene)) return true;

            // 2. Word Reordering ("Bạch tuộc thu ngọc")
            if (await solveCocosWordReordering(cocosScene)) return true;

            // 3. Multiple Choice / Fill-in-the-blank (separate prompt stem vs option buttons + image clues)
            const { width: W, height: H } = getLogicalCanvasSize();
            const { gamePlayComp, textComp } = inspectIoeGameComponents(cocosScene);
            if (textComp && textComp.canClick === false) return false;

            const cocosTexts = extractCocosTexts(cocosScene);
            if (cocosTexts.length > 0 || textComp) {
                let optBtns = clickables.filter(c => {
                    if (c.worldX > W * 0.72 && c.worldY > H * 0.65) return false;
                    const t = (c.text || '').trim();
                    const nl = (c.name || '').toLowerCase();
                    return t && !isHudChromeText(t) && !/(submit|next|skip|close|sound|back|reset|hint)/.test(nl) &&
                        !/^(nộp bài|trả lời|tiếp tục|bỏ qua|nghe lại|submit|next|ok|start|answer|score)$/i.test(t);
                });
                if (textComp?.buttons?.length) {
                    const compBtns = textComp.buttons
                        .filter(b => b?.node && canTraverseNode(b.node) && b.btnIdx !== 6 && (b.btnTxt || b.btnContent || getNodeText(b.node)))
                        .map(b => ({
                            node: b.node,
                            text: String(b.btnTxt || b.btnContent || getNodeText(b.node)).replace(/<[^>]+>/g, '').trim(),
                            btnComp: b,
                            name: b.node.name || ''
                        }))
                        .filter(b => b.text);
                    if (compBtns.length >= 2) optBtns = compBtns;
                }

                const optSet = new Set(optBtns.map(b => b.text.trim()));
                const stemTexts = cocosTexts
                    .filter(x => !(x.worldX > W * 0.72 && x.worldY > H * 0.65))
                    .map(x => x.text.trim())
                    .filter(t => !isHudChromeText(t) && !optSet.has(t) && !/^(id:|round:|score|\d+(\.\d+)?)$/i.test(t));

                const spriteClues = extractSceneSpriteClues(cocosScene);
                const modelText = [textComp?.questionModel?.questionDescription?.content, textComp?.questionModel?.questionContent?.content]
                    .filter(Boolean).join(' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                let qPrompt = modelText || stemTexts.join(' ').trim() || cocosTexts.map(x => x.text).join(' ').trim();
                if (spriteClues.length > 0) {
                    qPrompt += ` [Image hints: ${spriteClues.slice(0, 5).join(', ')}]`;
                }

                const qId = textComp?.questionModel?.questionId ?? null;
                const optStrings = optBtns.map(b => b.text);
                const meta = await IOE.question?.solveQuestion(qId, qPrompt, optStrings);
                if (meta?.answer) {
                    const ansStr = String(meta.answer).trim();

                    // a. Check Cocos EditBox + visible DOM input overlay
                    const cc = win.cc;
                    if (cc && cc.EditBox) {
                        const editBoxes = [];
                        (function findEB(n) {
                            if (!n || !canTraverseNode(n)) return;
                            if (typeof n.getComponent === 'function') {
                                const eb = n.getComponent(cc.EditBox) || n.getComponent('cc.EditBox');
                                if (eb) editBoxes.push({ node: n, comp: eb });
                            }
                            const ch = (typeof n.getChildren === 'function' ? n.getChildren() : n.children) || [];
                            ch.forEach(findEB);
                        })(cocosScene);

                        if (editBoxes.length > 0) {
                            for (const eb of editBoxes) {
                                eb.comp.string = ansStr;
                                if (eb.comp._impl?._elem) setDomInputValue(eb.comp._impl._elem, ansStr);
                                if (typeof eb.comp._updateStringLabel === 'function') eb.comp._updateStringLabel();
                                if (cc?.Component?.EventHandler?.emitEvents) {
                                    if (Array.isArray(eb.comp.textChanged)) cc.Component.EventHandler.emitEvents(eb.comp.textChanged, ansStr, eb.comp);
                                    if (Array.isArray(eb.comp.editingDidEnded)) cc.Component.EventHandler.emitEvents(eb.comp.editingDidEnded, eb.comp);
                                }
                                eb.node.emit?.('text-changed', eb.comp);
                                eb.node.emit?.('editing-did-ended', eb.comp);
                            }
                            IOE.toast(`✍️ Đã điền EditBox: ${ansStr}`, 1400);
                            const submitNode = gamePlayComp?.btnSubmit?.node || gamePlayComp?.btnSubmit ||
                                textComp?.buttons?.find?.(b => b.btnIdx === 6)?.node ||
                                clickables.find(c => /(submit|answer|trả lời|nộp bài|xác nhận|ok|next)/i.test(c.text + ' ' + c.name))?.node;
                            if (submitNode) {
                                await IOE.delay?.(250);
                                await clickCocosNode(submitNode);
                            }
                            return true;
                        }
                    }

                    // b. Click matched multiple-choice button cleanly
                    if (optBtns.length > 0) {
                        const matchedBtn = matchCocosButton(optBtns, ansStr);
                        if (matchedBtn) {
                            await clickCocosNode(matchedBtn.node);
                            IOE.toast(`⚡ [Cocos2d] Chọn: ${matchedBtn.text || ansStr}`, 1400);
                            return true;
                        }
                    }

                    // c. Keyboard/DOM typing fallback
                    typeCanvasString(ansStr);
                    return true;
                }
            }
        }

        // Fallback: CreateJS / Adobe Animate Canvas
        return await solveCreateJSGame();
    }

    function getSceneDiagnostics() {
        const sc = getCocosScene();
        const texts = sc ? extractCocosTexts(sc) : [];
        const clicks = sc ? findCocosClickables(sc) : [];
        return {
            ccPresent: !!win.cc,
            sceneFound: !!sc,
            sceneActive: sc?.active,
            sceneActiveInHierarchy: sc?.activeInHierarchy,
            canvasCount: document.querySelectorAll('canvas').length,
            cocosTextCount: texts.length,
            cocosClickableCount: clicks.length,
            sampleTexts: texts.slice(0, 6).map(t => t.text),
            createJsRoot: !!(win.exportRoot || win.stage)
        };
    }

    IOE.canvas = {
        solveCanvasGame,
        solveCocosClozePassage,
        solveCocosMatchingPairs,
        solveCocosWordReordering,
        solveCreateJSGame,
        getCocosScene,
        canTraverseNode,
        isNodeVisible,
        getSceneDiagnostics,
        extractCocosTexts,
        extractSceneSpriteClues,
        findCocosClickables,
        matchCocosButton,
        clickCocosNode,
        typeCanvasString,
        typeIntoCanvas: typeCanvasString,
        setDomInputValue
    };
})(typeof window !== 'undefined' ? window : globalThis);


/* --- functions/answerRevealer.js --- */
(function (global) {
    'use strict';
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const IOE = win.IOE || global.IOE;
    if (!IOE) return;

    const HUD_ID = 'yanzioe-revealer-hud';

    function copyToClipboard(text) {
        if (navigator.clipboard?.writeText) {
            return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
        }
        return Promise.resolve(fallbackCopy(text));
    }

    function fallbackCopy(text) {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
        } catch (e) {}
    }

    function ensureHud() {
        let hud = document.getElementById(HUD_ID);
        if (!hud && document.body) {
            hud = document.createElement('div');
            hud.id = HUD_ID;
            hud.style.cssText = `
                position: fixed;
                bottom: 12px;
                left: 16px;
                transform: none;
                z-index: 2147483645;
                background: rgba(15, 23, 42, 0.94);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(56, 189, 248, 0.45);
                border-radius: 8px;
                padding: 6px 12px;
                box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 12px;
                color: #f8fafc;
                min-width: 280px;
                max-width: min(90vw, 750px);
                max-height: 54px;
                overflow: hidden;
                display: none;
                flex-direction: column;
                gap: 6px;
                transition: max-height 0.25s ease;
            `;
            document.body.appendChild(hud);
        }
        return hud;
    }

    function renderReveal(meta) {
        if (!meta || !(IOE.state?.licensed || IOE.license?.isLicensed?.()) || !IOE.features?.showAnswers || IOE.features?.streamMode) {
            const hud = document.getElementById(HUD_ID);
            if (hud) hud.style.display = 'none';
            return;
        }

        const hud = ensureHud();
        if (!hud) return;

        const safeTier = IOE.escHtml(meta.tier || 'AI');
        const safeAns = IOE.escHtml(meta.answer || '');
        const safeThink = IOE.escHtml(meta.thinking || '');

        hud.style.display = 'flex';
        hud.style.maxHeight = '54px';
        hud.style.overflow = 'hidden';
        hud.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:nowrap;width:100%;">
                <div style="display:flex;align-items:center;gap:6px;min-width:0;max-width:calc(100% - 215px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;" id="yanzioe-copy-area" title="Nhấn để sao chép">
                    <span style="background:#0284c7;color:#fff;padding:2px 7px;border-radius:5px;font-size:10.5px;font-weight:700;flex-shrink:0;">${safeTier}</span>
                    <span style="color:#f8fafc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><strong>Đáp Án:</strong> ${safeAns}</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                    <button type="button" id="yanzioe-fill-btn" style="background:#38bdf8;color:#082f49;border:none;border-radius:5px;padding:3px 9px;font-weight:700;cursor:pointer;font-size:11.5px;">Fill</button>
                    <button type="button" id="yanzioe-copy-btn" style="background:#1e293b;color:#e2e8f0;border:1px solid rgba(56,189,248,0.45);border-radius:5px;padding:3px 8px;font-weight:700;cursor:pointer;font-size:11.5px;">Sao chép</button>
                    ${safeThink ? '<button type="button" id="yanzioe-think-btn" style="background:#4f46e5;color:#ffffff;border:none;border-radius:5px;padding:3px 8px;font-weight:700;cursor:pointer;font-size:11.5px;display:inline-flex;align-items:center;gap:3px;" title="Xem tư duy AI (0ms)">🧠 Suy nghĩ (0ms)</button>' : ''}
                </div>
            </div>
            ${safeThink ? `<div id="yanzioe-think-panel" style="display:none;width:100%;margin-top:4px;padding:8px 10px;background:rgba(15,23,42,0.92);border:1px solid rgba(99,102,241,0.45);border-radius:6px;font-size:11.5px;line-height:1.5;color:#e2e8f0;white-space:pre-wrap;word-break:break-word;max-height:160px;overflow-y:auto;">${safeThink}</div>` : ''}
        `;

        document.getElementById('yanzioe-fill-btn')?.addEventListener('click', () => {
            const okDom = IOE.auto?.fillAnswer ? IOE.auto.fillAnswer(meta.answer) : false;
            if (!okDom && IOE.canvas?.typeIntoCanvas) {
                IOE.canvas.typeIntoCanvas(meta.answer);
            }
        });

        const copyAction = () => {
            copyToClipboard(meta.answer || '').then(() => {
                IOE.toast('✓ Đã chép đáp án!', 1200);
            });
        };

        document.getElementById('yanzioe-copy-btn')?.addEventListener('click', copyAction);
        document.getElementById('yanzioe-copy-area')?.addEventListener('click', copyAction);

        const thinkBtn = document.getElementById('yanzioe-think-btn');
        const thinkPanel = document.getElementById('yanzioe-think-panel');
        if (thinkBtn && thinkPanel) {
            thinkBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isOpen = thinkPanel.style.display !== 'none';
                thinkPanel.style.display = isOpen ? 'none' : 'block';
                thinkBtn.style.background = isOpen ? '#4f46e5' : '#4338ca';
                hud.style.maxHeight = isOpen ? '54px' : '240px';
                hud.style.overflow = isOpen ? 'hidden' : 'visible';
            });
        }
    }

    IOE.events.on('questionSolved', renderReveal);
    IOE.revealer = { renderReveal };
})(typeof window !== 'undefined' ? window : globalThis);


/* --- functions/autoAnswer.js --- */
(function (global) {
    'use strict';
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const IOE = global.IOE || win.IOE;
    if (!IOE) return;

    const nativeSetInterval = IOE.timers?.setInterval || win.setInterval.bind(win);

    /* ================= 1. SAFE FREEZE EXAM TIMER ================= */
    let frozenTickCount = 0;
    if (!win.__YANZIOE_TIMER_HOOKED__) {
        win.__YANZIOE_TIMER_HOOKED__ = true;
        const rawSetInterval = win.setInterval.bind(win);
        win.setInterval = function (fn, ms, ...args) {
            const delayMs = Number(ms || 0);
            let fnSrc = '';
            try { fnSrc = typeof fn === 'function' ? Function.prototype.toString.call(fn) : String(fn || ''); } catch (e) {}
            const isCountdownTick = delayMs >= 850 && delayMs <= 1200 &&
                /(time|timer|second|sec|countdown|remain|left|demnguoc|clock|minutes?|phut|giay)/i.test(fnSrc) &&
                !fnSrc.includes('yanzioe');

            if (isCountdownTick && typeof fn === 'function') {
                const wrapped = function (...wArgs) {
                    if (IOE.features?.freezeTimer && (IOE.state?.licensed || IOE.license?.isLicensed?.())) {
                        frozenTickCount++;
                        return;
                    }
                    return fn.apply(this, wArgs);
                };
                return rawSetInterval(wrapped, delayMs, ...args);
            }
            return rawSetInterval(fn, ms, ...args);
        };
    }

    function computeStepDelay() {
        const mode = IOE.featureConfigs?.questionMode || 'stealth';
        if (mode === 'turbo') return 220;
        const base = Number(IOE.featureConfigs?.autoDelay || 1400);
        return Math.round(base * (0.78 + Math.random() * 0.44));
    }

    let isProcessing = false;
    let processingStartedAt = 0;

    function isElVisible(el) {
        if (!el || el.closest('#yanzioe-root, #yanzioe-license-modal, #yanzioe-revealer-hud, nav, header, footer')) return false;
        const st = win.getComputedStyle ? win.getComputedStyle(el) : null;
        if (st && (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity || '1') <= 0.02)) return false;
        return el.offsetParent !== null || (st && st.position === 'fixed');
    }

    function isActionChromeText(txt) {
        const s = String(txt || '').trim().toLowerCase();
        return !s || /^(nộp bài|thoát|bỏ qua|tiếp tục|câu tiếp|câu sau|nghe lại|submit|next|skip|close|back|exit|ok|start|replay|play)$/.test(s);
    }

    function isLobbyNavigationText(txt) {
        const s = String(txt || '').trim().toLowerCase();
        return /^(vào thi|vào tự luyện|làm bài|xem lại|xem kết quả|thể lệ|chi tiết|bảng xếp hạng|đăng nhập|đăng ký|nâng cấp|mua gói|bắt đầu ngay|khám phá|tìm hiểu thêm|trở về|trang chủ)/.test(s);
    }

    function isLobbyDashboardPage() {
        try {
            const path = String(location.pathname || '').toLowerCase();
            if (!/^\/($|trang-chu|hoc-sinh(\/tu-luyen|\/ket-qua|\/lich-su|\/bang-xep-hang|\/tai-khoan)?|tin-tuc|gioi-thieu|huong-dan)\/?$/.test(path)) return false;
            return !document.querySelector('.question-content, .exam-content, .ioe-exam-card, #question-content, .quiz-question');
        } catch (e) { return false; }
    }

    function extractGenericDomQuestion() {
        if (isLobbyDashboardPage()) return null;
        const containers = Array.from(document.querySelectorAll('[class*="exam" i], [class*="question" i], [class*="quiz" i], [class*="card" i], main, #root, section, article'))
            .filter(isElVisible);
        const optSelector = 'button, [role="button"], label, [class*="option" i], [class*="choice" i], [class*="answer" i], [class*="btn" i]';

        for (const box of containers) {
            const rawChoices = Array.from(box.querySelectorAll(optSelector)).filter(el =>
                isElVisible(el) && !el.closest('#yanzioe-root, #yanzioe-license-modal, #yanzioe-revealer-hud') && !isActionChromeText(el.innerText || el.textContent)
            );
            const dedupChoices = rawChoices.filter((el, idx) => !rawChoices.some((other, oIdx) => oIdx !== idx && other.contains(el) && (other.innerText || '').trim() === (el.innerText || '').trim()));
            const inputs = Array.from(box.querySelectorAll('input[type="text"], input:not([type]), textarea'))
                .filter(el => isElVisible(el) && !el.closest('#yanzioe-root, #yanzioe-license-modal, #yanzioe-revealer-hud'));
            const chips = Array.from(box.querySelectorAll('.word-item, .drag-item, .card-word, .item-reorder, [class*="word" i][class*="item" i]'))
                .filter(isElVisible);

            if (dedupChoices.length < 2 && inputs.length === 0 && chips.length < 3) continue;
            const lobbyChoiceCount = dedupChoices.filter(c => isLobbyNavigationText(c.innerText || c.textContent)).length;
            if (dedupChoices.length > 0 && lobbyChoiceCount * 2 >= dedupChoices.length) continue;

            const choiceSet = new Set(dedupChoices);
            const stemNodes = Array.from(box.querySelectorAll('h1, h2, h3, h4, p, div, span')).filter(el => {
                if (!isElVisible(el) || choiceSet.has(el)) return false;
                if (dedupChoices.some(c => el.contains(c) || c.contains(el))) return false;
                const t = (el.innerText || el.textContent || '').trim();
                return t.length >= 6 && !/^\d{1,2}:\d{2}$/.test(t);
            });
            const stemEl = stemNodes.find(el => !stemNodes.some(other => other !== el && el.contains(other) && (other.innerText || '').trim().length >= 6)) || stemNodes[0];
            const qText = (stemEl ? (stemEl.innerText || stemEl.textContent) : '').trim();
            if (qText.length >= 6 && !/^(vòng tự luyện|cấp (trường|xã|phường|huyện|tỉnh|quốc gia)|hành trình cuộc thi|bảng xếp hạng|danh sách vòng)\b/i.test(qText)) {
                return { qEl: stemEl, scopeRoot: box, qText, choiceEls: dedupChoices, chips };
            }
        }
        return null;
    }

    async function stepOnce(forceRun = false) {
        if (isProcessing && (Date.now() - processingStartedAt < 18000)) return false;
        if (!forceRun && !IOE.features?.autoAnswer) return false;
        if (!(IOE.state?.licensed || IOE.license?.isLicensed?.())) return false;
        isProcessing = true;
        processingStartedAt = Date.now();

        try {
            // 1. Canvas / Cocos2d / CreateJS minigame
            if (IOE.features?.canvasMode !== false && IOE.canvas?.solveCanvasGame) {
                const canvasSolved = await IOE.canvas.solveCanvasGame();
                if (canvasSolved) {
                    IOE.events?.emit?.('frameSolved', { engine: IOE.state.lastEngine || 'Canvas' });
                    await IOE.delay(computeStepDelay());
                    return true;
                }
            }

            // 2. Web DOM Question Extraction (legacy selectors -> generic React DOM fallback)
            const qSelectors = '.question-content, .exam-content, .title-question, .content-question, #question-content, .ques-content, .quiz-question';
            const qEls = Array.from(document.querySelectorAll(qSelectors)).filter(isElVisible);
            let qEl = qEls[0] || null;
            let qText = qEl ? (qEl.innerText || qEl.textContent || '').trim() : '';
            let scopeRoot = qEl ? (qEl.closest('.question-container, .question-box, .quiz-item, .exam-item') || document) : document;
            let choiceEls = [];
            let chips = [];

            if (qText) {
                choiceEls = Array.from(scopeRoot.querySelectorAll('.answer-item, .choice-item, .btn-answer, .item-answer, label'))
                    .filter(el => !el.closest('#yanzioe-root') && !el.closest('#yanzioe-license-modal'));
                chips = Array.from(scopeRoot.querySelectorAll('.word-item, .drag-item, .card-word, .item-reorder'));
            } else {
                const fallbackDom = extractGenericDomQuestion();
                if (fallbackDom) {
                    qEl = fallbackDom.qEl;
                    qText = fallbackDom.qText;
                    scopeRoot = fallbackDom.scopeRoot;
                    choiceEls = fallbackDom.choiceEls;
                    chips = fallbackDom.chips;
                }
            }

            if (qText) {
                IOE.state.lastEngine = 'Web DOM';
                const options = choiceEls.map(c => (c.innerText || c.textContent || '').trim()).filter(Boolean);
                const isDomReorder = chips.length >= 3 && !options.length;
                const taskOpts = isDomReorder ? chips.map(c => (c.innerText || c.textContent || '').trim()).filter(Boolean) : options;
                const qId = qEl?.dataset?.id || qEl?.id || qText.slice(0, 48);

                let meta = IOE.state.solvedMeta.get(qId);
                if (!meta) {
                    meta = await IOE.question.solveQuestion(qId, qText, taskOpts, isDomReorder ? 'reorder' : '');
                }

                if (meta?.answer) {
                    const filled = fillAnswer(meta.answer, scopeRoot === document ? null : scopeRoot);
                    if (filled && IOE.features?.autoAnswer) {
                        await IOE.delay(computeStepDelay());
                        clickNextButton();
                    }
                    return true;
                }
            } else if (forceRun) {
                const diag = IOE.canvas?.getSceneDiagnostics ? IOE.canvas.getSceneDiagnostics() : {};
                IOE.appendLog?.(`[Debug] Không phát hiện câu hỏi ở frame hiện tại: ${JSON.stringify({ href: location.href, top: win === win.top, ...diag })}`);
                IOE.toast('⚠️ Không thấy câu hỏi trên trang (xem tab 🛠 Logs -> Soi trang)', 2500);
            }
        } catch (e) {
            console.error('[IOE AutoAnswer Error]', e);
            if (forceRun) IOE.toast(`⚠️ Lỗi AutoAnswer: ${e?.message || e}`, 2500);
        } finally {
            isProcessing = false;
        }
        return false;
    }

    function setNativeInputValue(inp, val) {
        if (!inp) return;
        const proto = inp.tagName === 'TEXTAREA' ? win.HTMLTextAreaElement?.prototype : win.HTMLInputElement?.prototype;
        const desc = proto && Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && typeof desc.set === 'function') desc.set.call(inp, val);
        else inp.value = val;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function stripPrefix(s) {
        return String(s || '').replace(/^[A-Da-d][.:)\]\s_-]+/, '').trim();
    }

    function fillAnswer(ans, area = null) {
        if (!ans) return false;
        const rawAns = String(ans).trim();
        const normAns = rawAns.toLowerCase();
        const cleanAns = stripPrefix(rawAns).toLowerCase();
        const root = area || document;

        // 1. Word Reordering chips
        const chips = Array.from(root.querySelectorAll('.word-item, .drag-item, .card-word, .item-reorder'));
        if (chips.length > 0 && cleanAns.includes(' ')) {
            chips.forEach(c => { delete c.dataset.kwClicked; });
            const words = rawAns.split(/\s+/).map(w => w.toLowerCase().replace(/[^a-z0-9']/g, ''));
            let hits = 0;
            words.forEach(targetWord => {
                if (!targetWord) return;
                const matchedChip = chips.find(chip => {
                    const cText = (chip.innerText || chip.textContent || '').trim().toLowerCase().replace(/[^a-z0-9']/g, '');
                    return cText === targetWord && !chip.dataset.kwClicked;
                });
                if (matchedChip) {
                    matchedChip.dataset.kwClicked = '1';
                    matchedChip.click();
                    hits++;
                }
            });
            if (hits > 0) {
                IOE.toast('🧩 Đã sắp xếp câu!', 1200);
                return true;
            }
        }

        // 2. Fill-in-the-blank input
        const inputs = Array.from(root.querySelectorAll('input.blank-input, input[type="text"].answer, input.form-control, input.input-answer, textarea.answer'))
            .filter(el => !el.closest('#yanzioe-root') && !el.closest('#yanzioe-license-modal') && !el.closest('#yanzioe-revealer-hud'));
        if (inputs.length > 0) {
            const inp = inputs.find(el => !el.value) || inputs[0];
            if (inp) {
                setNativeInputValue(inp, rawAns);
                IOE.toast(`✍️ Đã điền: ${rawAns}`, 1000);
                return true;
            }
        }

        // 3. Multiple Choice buttons / radios (strict match, no single-letter substring collision)
        let choices = Array.from(root.querySelectorAll('.answer-item, .choice-item, .btn-answer, .item-answer, input[type="radio"]'))
            .filter(el => !el.closest('#yanzioe-root') && !el.closest('#yanzioe-license-modal'));
        if (choices.length === 0) {
            choices = Array.from(root.querySelectorAll('button, [role="button"], label, [class*="option" i], [class*="choice" i], [class*="answer" i], [class*="btn" i]'))
                .filter(el => !el.closest('#yanzioe-root') && !el.closest('#yanzioe-license-modal') && !isActionChromeText(el.innerText || el.textContent));
        }
        if (choices.length > 0) {
            // Pass 1: exact text match
            let matched = choices.find(c => {
                const ct = stripPrefix(c.innerText || c.textContent || c.value || '').toLowerCase();
                return ct && ct === cleanAns;
            });
            // Pass 2: word-boundary match (>= 2 chars)
            if (!matched && cleanAns.length >= 2) {
                const esc = cleanAns.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const rx = new RegExp(`(^|\\s)${esc}(\\s|$)`, 'i');
                matched = choices.find(c => rx.test(stripPrefix(c.innerText || c.textContent || c.value || '')));
            }
            // Pass 3: explicit letter A/B/C/D
            if (!matched && /^[a-d]\.?$/.test(normAns)) {
                const letIdx = normAns.charCodeAt(0) - 97;
                if (choices[letIdx]) matched = choices[letIdx];
            }
            if (matched) {
                if (matched.tagName === 'INPUT') matched.checked = true;
                matched.click();
                IOE.toast(`🎯 Đã chọn: ${(matched.innerText || matched.textContent || matched.value || rawAns).trim()}`, 1000);
                return true;
            }
        }
        return false;
    }

    function clickNextButton() {
        const nextBtns = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]')).filter(btn => {
            if (btn.closest('#yanzioe-root') || btn.closest('#yanzioe-revealer-hud') || btn.closest('#yanzioe-license-modal')) return false;
            if (btn.disabled) return false;
            const style = win.getComputedStyle ? win.getComputedStyle(btn) : null;
            if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
            const t = (btn.innerText || btn.value || '').toLowerCase().trim();
            return /^(tiếp tục|câu tiếp|câu sau|qua câu|nộp bài|xác nhận|next|next question|submit|continue)/.test(t);
        });
        if (nextBtns.length > 0) {
            nextBtns[0].click();
            IOE.toast('⏩ Đã chuyển câu tiếp theo', 900);
            return true;
        }
        return false;
    }

    nativeSetInterval(() => { stepOnce(false); }, 1800);

    IOE.auto = {
        stepOnce,
        fillAnswer,
        clickNextButton,
        extractGenericDomQuestion,
        getFreezeTicks: () => frozenTickCount
    };
})(typeof window !== 'undefined' ? window : globalThis);


/* --- visuals/mainMenu.js --- */
(function (global) {
    'use strict';
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const IOE = win.IOE || global.IOE;
    if (!IOE) return;

    const nativeSetInterval = IOE.timers?.setInterval || win.setInterval.bind(win);
    let isMenuVisible = true;
    const STORAGE_KEY = 'YANZIOE_CONFIG_VIP_V1';

    function loadSavedConfig() {
        let bestKey = '';
        try {
            const candidates = [
                IOE.featureConfigs?.apiKey,
                localStorage.getItem('IOE_API_KEY'),
                localStorage.getItem('YANZIOE_API_KEY'),
                (function () { try { return sessionStorage.getItem('IOE_API_KEY') || sessionStorage.getItem('YANZIOE_API_KEY'); } catch (e) { return ''; } })(),
                (function () { try { const wn = JSON.parse(window.name || '{}'); return wn.IOE_API_KEY || wn.apiKey || ''; } catch (e) { return ''; } })(),
                (function () { const m = /IOE_API_KEY=([^;]+)/.exec(document.cookie || ''); return m ? decodeURIComponent(m[1]) : ''; })(),
                (typeof GM_getValue === 'function' ? GM_getValue('IOE_API_KEY') : '')
            ];
            for (const c of candidates) {
                if (c && typeof c === 'string' && c.trim().length > 5) {
                    bestKey = c.trim();
                    break;
                }
            }

            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.features) Object.assign(IOE.features, parsed.features);
                if (parsed.configs) {
                    const savedApiKey = parsed.configs.apiKey;
                    delete parsed.configs.apiKey;
                    Object.assign(IOE.featureConfigs, parsed.configs);
                    if (savedApiKey && savedApiKey.trim().length > 5 && !bestKey) bestKey = savedApiKey.trim();
                }
            }
        } catch (e) {}

        if (bestKey) IOE.featureConfigs.apiKey = bestKey;
    }

    function isTopFrame() {
        try { return win === win.top; } catch (e) { return false; }
    }

    function broadcastToFrames(msg) {
        try {
            const iframes = document.querySelectorAll('iframe');
            for (const f of iframes) {
                try { f.contentWindow?.postMessage(msg, '*'); } catch (e) {}
            }
        } catch (e) {}
    }

    async function loadSavedConfigAsync() {
        try {
            if (!IOE.kv?.get) return;
            const rawCfg = await IOE.kv.get(STORAGE_KEY);
            if (rawCfg) {
                const parsed = JSON.parse(rawCfg);
                if (parsed.features) Object.assign(IOE.features, parsed.features);
                if (parsed.configs) {
                    const k = (parsed.configs.apiKey || '').trim();
                    delete parsed.configs.apiKey;
                    Object.assign(IOE.featureConfigs, parsed.configs);
                    if (k && k.length > 5 && !(IOE.featureConfigs.apiKey || '').trim()) {
                        IOE.featureConfigs.apiKey = k;
                    }
                }
            }
            if (!(IOE.featureConfigs.apiKey || '').trim()) {
                const kvKey = (await IOE.kv.get('IOE_API_KEY') || '').trim();
                if (kvKey.length > 5) IOE.featureConfigs.apiKey = kvKey;
            }
            const keyInp = document.getElementById('yanz-inp-key');
            if (keyInp && IOE.featureConfigs.apiKey) keyInp.value = IOE.featureConfigs.apiKey;
        } catch (e) {}
    }

    function saveAllConfigs() {
        try {
            const key = (IOE.featureConfigs.apiKey || '').trim();
            const payload = {
                features: IOE.features,
                configs: { ...IOE.featureConfigs, apiKey: key },
                savedAt: Date.now()
            };
            const payloadStr = JSON.stringify(payload);
            try { localStorage.setItem(STORAGE_KEY, payloadStr); } catch (e) {}
            IOE.kv?.set?.(STORAGE_KEY, payloadStr);
            if (key) {
                try { localStorage.setItem('IOE_API_KEY', key); } catch (e) {}
                try { localStorage.setItem('YANZIOE_API_KEY', key); } catch (e) {}
                IOE.kv?.set?.('IOE_API_KEY', key);
                try { sessionStorage.setItem('IOE_API_KEY', key); } catch (e) {}
                try {
                    let wn = {}; try { wn = JSON.parse(window.name || '{}'); } catch (e) {}
                    wn.IOE_API_KEY = key; window.name = JSON.stringify(wn);
                } catch (e) {}
                try { document.cookie = `IOE_API_KEY=${encodeURIComponent(key)}; path=/; max-age=315360000; SameSite=Lax`; } catch (e) {}
                if (typeof GM_setValue === 'function') { try { GM_setValue('IOE_API_KEY', key); } catch (e) {} }
            }
            broadcastToFrames({ type: 'YANZIOE_CMD', action: 'SYNC_CFG', features: { ...IOE.features }, featureConfigs: { ...IOE.featureConfigs } });
        } catch (e) {}
    }

    loadSavedConfig();
    loadSavedConfigAsync();

    if (!win.__YANZIOE_FRAME_RELAY__) {
        win.__YANZIOE_FRAME_RELAY__ = true;
        win.addEventListener('message', async (ev) => {
            const d = ev?.data;
            if (!d || typeof d !== 'object') return;
            if (d.type === 'YANZIOE_CMD') {
                if (d.action === 'SYNC_CFG') {
                    if (d.features) Object.assign(IOE.features, d.features);
                    if (d.featureConfigs) Object.assign(IOE.featureConfigs, d.featureConfigs);
                    broadcastToFrames(d);
                } else if (d.action === 'STEP_ONCE') {
                    broadcastToFrames(d);
                    if (!isTopFrame()) await IOE.auto?.stepOnce?.(true);
                } else if (d.action === 'DEBUG_SCAN') {
                    broadcastToFrames(d);
                    if (!isTopFrame()) {
                        const diag = IOE.canvas?.getSceneDiagnostics ? IOE.canvas.getSceneDiagnostics() : {};
                        const domP = IOE.auto?.extractGenericDomQuestion ? IOE.auto.extractGenericDomQuestion()?.qText?.slice(0, 60) : '';
                        try {
                            win.top.postMessage({
                                type: 'YANZIOE_TELEMETRY',
                                event: 'debug',
                                payload: { href: location.href, ...diag, domPreview: domP || '', pkt: IOE.state.packetHits || 0, keys: IOE.state.correctAnswers.size }
                            }, '*');
                        } catch (e) {}
                    }
                }
            } else if (d.type === 'YANZIOE_TELEMETRY' && isTopFrame()) {
                if (d.event === 'questionSolved' && d.meta) {
                    IOE.state.lastEngine = d.meta.tier || IOE.state.lastEngine;
                    IOE.events?.emit?.('questionSolved', d.meta);
                } else if (d.event === 'debug' && d.payload) {
                    IOE.appendLog?.(`[IFRAME Debug] ${JSON.stringify(d.payload)}`);
                }
            }
        });
        IOE.events.on('questionSolved', (meta) => {
            if (!isTopFrame() && meta) {
                try { win.top.postMessage({ type: 'YANZIOE_TELEMETRY', event: 'questionSolved', meta }, '*'); } catch (e) {}
            }
        });
    }

    function createMainMenu() {
        if (!isTopFrame()) return;
        if (!(IOE.state?.licensed || IOE.license?.isLicensed?.())) return;
        if (document.getElementById('yanzioe-root') || !document.body) return;

        const root = document.createElement('div');
        root.id = 'yanzioe-root';
        root.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;pointer-events:auto;user-select:none;';

        const licState = IOE.license?.getState?.() || {};

        root.innerHTML = `
            <style>
                @keyframes ioeRgb {
                    0% { color: #38bdf8; text-shadow: 0 0 10px rgba(56,189,248,0.7); }
                    33% { color: #818cf8; text-shadow: 0 0 10px rgba(129,140,248,0.7); }
                    66% { color: #c084fc; text-shadow: 0 0 10px rgba(192,132,252,0.7); }
                    100% { color: #38bdf8; text-shadow: 0 0 10px rgba(56,189,248,0.7); }
                }
                .yanz-rgb-text { animation: ioeRgb 4s linear infinite; }
                .yanz-tab-btn {
                    flex: 1; padding: 7px 0; background: transparent; border: none; border-bottom: 2px solid transparent;
                    color: #94a3b8; font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; text-align: center;
                }
                .yanz-tab-btn.active { color: #38bdf8; border-bottom: 2px solid #38bdf8; background: rgba(56,189,248,0.08); }
                .yanz-tab-btn:hover { color: #f8fafc; }
                .yanz-toggle-row {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 6px 0; border-bottom: 1px solid rgba(51,65,85,0.4);
                    font-size: 11.5px; color: #e2e8f0; cursor: pointer;
                }
                .yanz-toggle-row input { cursor: pointer; accent-color: #38bdf8; width: 14px; height: 14px; }
                .yanz-input {
                    width: 100%; box-sizing: border-box; background: rgba(15,23,42,0.8);
                    border: 1px solid rgba(56,189,248,0.3); border-radius: 6px;
                    color: #f8fafc; padding: 6px 8px; font-size: 11px; outline: none; margin-top: 4px;
                }
                .yanz-input:focus { border-color: #38bdf8; box-shadow: 0 0 8px rgba(56,189,248,0.3); }
                .yanz-btn {
                    background: linear-gradient(135deg, #0284c7, #2563eb); color: #fff;
                    border: none; border-radius: 6px; padding: 7px 0; font-weight: 700; font-size: 11.5px;
                    cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 10px rgba(2,132,199,0.35);
                    width: 100%; text-align: center;
                }
                .yanz-btn:hover { filter: brightness(1.15); }
            </style>

            <div id="yanzioe-panel" style="width:320px;max-height:88vh;overflow-y:auto;background:rgba(15,23,42,0.96);backdrop-filter:blur(16px);border:1px solid rgba(56,189,248,0.45);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.65);color:#f8fafc;">
                <div id="yanzioe-drag-handle" style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(30,41,59,0.9);border-bottom:1px solid rgba(56,189,248,0.25);cursor:move;">
                    <div style="display:flex;align-items:center;gap:7px;">
                        <span style="font-size:16px;">🌐</span>
                        <strong class="yanz-rgb-text" style="font-size:13.5px;letter-spacing:0.5px;">YANZIOE VIP</strong>
                        <span style="background:linear-gradient(135deg,#0284c7,#3b82f6);color:#fff;font-size:9px;padding:1.5px 5px;border-radius:4px;font-weight:800;">v${IOE.escHtml(IOE.version || '1.2.2')}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:5px;">
                        <button id="yanzioe-collapse-btn" style="background:rgba(51,65,85,0.7);border:1px solid rgba(148,163,184,0.3);color:#cbd5e1;cursor:pointer;font-size:10px;padding:2px 7px;border-radius:4px;font-weight:700;">Thu nhỏ ▲</button>
                        <button id="yanzioe-close-btn" style="background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:14px;padding:0 3px;font-weight:700;">✕</button>
                    </div>
                </div>

                <div id="yanzioe-tabs" style="display:flex;background:rgba(15,23,42,0.9);border-bottom:1px solid rgba(51,65,85,0.6);">
                    <button class="yanz-tab-btn active" data-tab="features">⚡ Tính năng</button>
                    <button class="yanz-tab-btn" data-tab="settings">🎯 Tùy chỉnh</button>
                    <button class="yanz-tab-btn" data-tab="status">📊 Trạng thái</button>
                    <button class="yanz-tab-btn" data-tab="answers">🧠 Đáp án</button>
                    <button class="yanz-tab-btn" data-tab="dev">🛠 Logs</button>
                </div>

                <!-- Tab 1: Tính năng -->
                <div id="yanz-tab-features" class="yanz-tab-content" style="padding:12px 14px;">
                    <button id="yanzioe-solve-btn" class="yanz-btn" style="margin-bottom:10px;font-size:12px;padding:8px 0;">
                        ⚡ GIẢI BÀI NGAY LẬP TỨC (Alt+S)
                    </button>

                    <label class="yanz-toggle-row">
                        <span>Tự động giải &amp; Điền (Alt+A)</span>
                        <input type="checkbox" id="yanz-chk-auto" ${IOE.features.autoAnswer ? 'checked' : ''}>
                    </label>
                    <label class="yanz-toggle-row">
                        <span>Hiển thị HUD đáp án nổi (Revealer)</span>
                        <input type="checkbox" id="yanz-chk-show" ${IOE.features.showAnswers ? 'checked' : ''}>
                    </label>
                    <label class="yanz-toggle-row">
                        <span>Quét Cocos2d / CreateJS Canvas</span>
                        <input type="checkbox" id="yanz-chk-canvas" ${IOE.features.canvasMode ? 'checked' : ''}>
                    </label>
                    <label class="yanz-toggle-row">
                        <span>Đóng băng đồng hồ đếm (Freeze Time)</span>
                        <input type="checkbox" id="yanz-chk-freeze" ${IOE.features.freezeTimer ? 'checked' : ''}>
                    </label>
                    <label class="yanz-toggle-row">
                        <span>Mèo cưng Oneko dạo bước</span>
                        <input type="checkbox" id="yanz-chk-oneko" ${IOE.features.oneko ? 'checked' : ''}>
                    </label>
                    <label class="yanz-toggle-row" style="border-bottom:none;">
                        <span>Stream Mode (Ẩn toàn bộ tool)</span>
                        <input type="checkbox" id="yanz-chk-stream" ${IOE.features.streamMode ? 'checked' : ''}>
                    </label>

                    <div style="margin-top:8px;padding:6px 8px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:6px;font-size:10.5px;display:flex;justify-content:space-between;align-items:center;">
                        <span style="color:#6ee7b7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">🔑 Hạn: ${IOE.escHtml(licState.expiresAt || 'Active')}</span>
                        <button id="yanz-btn-switch-key" type="button" style="background:rgba(245,158,11,0.2);border:1px solid rgba(245,158,11,0.45);color:#fde68a;border-radius:4px;padding:2px 6px;font-size:10px;cursor:pointer;font-weight:700;">Đổi Key</button>
                    </div>
                </div>

                <!-- Tab 2: Tùy chỉnh -->
                <div id="yanz-tab-settings" class="yanz-tab-content" style="display:none;padding:12px 14px;">
                    <div style="font-size:11px;color:#94a3b8;margin-bottom:3px;">Nhà cung cấp AI giải bài:</div>
                    <select id="yanz-sel-provider" class="yanz-input" style="cursor:pointer;padding:5px;">
                        <option value="gemini" ${(!IOE.featureConfigs?.aiProvider || IOE.featureConfigs?.aiProvider === 'gemini') ? 'selected' : ''}>🌟 Google Gemini 2.5 Flash (Chuẩn &amp; Free)</option>
                        <option value="groq" ${IOE.featureConfigs?.aiProvider === 'groq' ? 'selected' : ''}>⚡ Groq (Llama 3.3 70B - Siêu nhanh)</option>
                        <option value="openrouter" ${IOE.featureConfigs?.aiProvider === 'openrouter' ? 'selected' : ''}>🚀 OpenRouter (Auto Free Models)</option>
                    </select>

                    <div style="font-size:11px;color:#94a3b8;margin-top:8px;margin-bottom:3px;">API Key (AIzaSy... / gsk_... / sk-or-...):</div>
                    <input type="password" id="yanz-inp-key" class="yanz-input" placeholder="Dán API Key AI của bạn..." value="${IOE.escHtml(IOE.featureConfigs?.apiKey || '')}">
                    <div style="display:flex;gap:6px;margin-top:6px;">
                        <button id="yanz-btn-save-key" class="yanz-btn" style="flex:1;padding:5px 0;background:#0369a1;">💾 Lưu Key</button>
                        <button id="yanz-btn-test-key" class="yanz-btn" style="flex:1;padding:5px 0;background:#4f46e5;">🔌 Test Key AI</button>
                    </div>
                    <div id="yanz-ai-test-msg" style="font-size:10.5px;margin-top:5px;color:#94a3b8;"></div>

                    <div style="font-size:11px;color:#94a3b8;margin-top:8px;margin-bottom:3px;">
                        Độ trễ điền đáp án: <strong id="yanz-delay-val" style="color:#38bdf8;">${((IOE.featureConfigs?.autoDelay || 1400) / 1000).toFixed(1)}s</strong>
                    </div>
                    <input type="range" id="yanz-rng-delay" min="300" max="4000" step="100" value="${IOE.featureConfigs?.autoDelay || 1400}" style="width:100%;accent-color:#38bdf8;cursor:pointer;">

                    <div style="font-size:11px;color:#94a3b8;margin-top:8px;margin-bottom:3px;">Chế độ hoạt động:</div>
                    <select id="yanz-sel-mode" class="yanz-input" style="cursor:pointer;padding:5px;">
                        <option value="stealth" ${IOE.featureConfigs?.questionMode === 'stealth' ? 'selected' : ''}>🕵️ Stealth (Trễ ngẫu nhiên tự nhiên)</option>
                        <option value="turbo" ${IOE.featureConfigs?.questionMode === 'turbo' ? 'selected' : ''}>⚡ Turbo (Siêu tốc ~0.2s)</option>
                    </select>
                </div>

                <!-- Tab 3: Trạng thái -->
                <div id="yanz-tab-status" class="yanz-tab-content" style="display:none;padding:12px 14px;font-size:11.5px;">
                    <div style="background:rgba(30,41,59,0.7);padding:8px 10px;border-radius:6px;border:1px solid rgba(56,189,248,0.25);margin-bottom:8px;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                            <span style="color:#94a3b8;">Động cơ nhận diện:</span>
                            <strong id="yanz-stat-engine" style="color:#38bdf8;">${IOE.escHtml(IOE.state.lastEngine || 'Đang quét')}</strong>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                            <span style="color:#94a3b8;">Đã giải / Bộ nhớ:</span>
                            <strong id="yanz-stat-total-q" style="color:#38bdf8;">0 câu</strong>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                            <span style="color:#94a3b8;">Tiến độ Cloze:</span>
                            <strong id="yanz-stat-progress" style="color:#4ade80;">Sẵn sàng</strong>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                            <span style="color:#94a3b8;">Gói tin / Key gốc:</span>
                            <strong id="yanz-stat-packet" style="color:#4ade80;">0 gói (0 key)</strong>
                        </div>
                        <div style="display:flex;justify-content:space-between;">
                            <span style="color:#94a3b8;">Mã Key VIP:</span>
                            <strong id="yanz-stat-license" style="color:#38bdf8;font-family:monospace;font-size:10.5px;">${IOE.escHtml(licState.key || 'N/A')}</strong>
                        </div>
                    </div>
                    <div style="font-size:10.5px;color:#94a3b8;text-align:center;">
                        Phím tắt: <strong>Alt+H</strong> (Ẩn/Hiện) • <strong>Alt+A</strong> (Auto) • <strong>Alt+S</strong> (Giải ngay)
                    </div>
                </div>

                <!-- Tab 4: Đáp án -->
                <div id="yanz-tab-answers" class="yanz-tab-content" style="display:none;padding:12px 14px;">
                    <div style="font-size:11px;color:#94a3b8;margin-bottom:4px;">Câu hỏi phát hiện:</div>
                    <div id="yanz-ans-question" style="background:rgba(30,41,59,0.7);padding:7px 10px;border-radius:6px;font-size:11px;color:#e2e8f0;max-height:60px;overflow-y:auto;border:1px solid rgba(51,65,85,0.7);">
                        Chưa có câu hỏi được quét.
                    </div>
                    <div style="font-size:11px;color:#94a3b8;margin-top:8px;margin-bottom:4px;">Đáp án giải được:</div>
                    <div id="yanz-ans-result" style="background:rgba(2,132,199,0.15);border:1px solid #0284c7;padding:7px 10px;border-radius:6px;font-size:12px;font-weight:700;color:#38bdf8;white-space:pre-wrap;max-height:90px;overflow-y:auto;">
                        ---
                    </div>
                    <div style="font-size:11px;color:#94a3b8;margin-top:8px;margin-bottom:4px;">🧠 Tư duy ngôn ngữ 0ms:</div>
                    <div id="yanz-ans-thinking" style="background:rgba(15,23,42,0.9);padding:7px 10px;border-radius:6px;font-size:10.5px;color:#cbd5e1;line-height:1.45;white-space:pre-wrap;max-height:90px;overflow-y:auto;border:1px solid rgba(51,65,85,0.7);">
                        Sẵn sàng phân tích câu hỏi &amp; đáp án.
                    </div>
                </div>

                <!-- Tab 5: Logs -->
                <div id="yanz-tab-dev" class="yanz-tab-content" style="display:none;padding:12px 14px;">
                    <div id="yanz-log-box" style="background:#090d16;border:1px solid rgba(51,65,85,0.8);border-radius:6px;padding:6px 8px;font-family:monospace;font-size:10.5px;color:#38bdf8;height:120px;overflow-y:auto;white-space:pre-wrap;text-align:left;word-break:break-word;">[YANZIOE] Khởi động hệ thống v${IOE.escHtml(IOE.version || '1.2.3')} (Licensed).</div>
                    <div style="display:flex;gap:5px;margin-top:6px;">
                        <button id="yanz-btn-clear-log" style="flex:1;background:rgba(51,65,85,0.6);border:none;color:#cbd5e1;padding:5px 0;border-radius:4px;font-size:10px;cursor:pointer;">Xóa Logs</button>
                        <button id="yanz-btn-debug" style="flex:1;background:#4f46e5;border:none;color:#fff;padding:5px 0;border-radius:4px;font-size:10px;cursor:pointer;font-weight:700;">🔍 Soi trang</button>
                        <button id="yanz-btn-scan-again" style="flex:1;background:#0369a1;border:none;color:#fff;padding:5px 0;border-radius:4px;font-size:10px;cursor:pointer;font-weight:700;">Quét lại Scene</button>
                    </div>
                </div>
            </div>

            <div id="yanzioe-pill" style="display:none;background:rgba(15,23,42,0.95);backdrop-filter:blur(12px);border:1px solid rgba(56,189,248,0.6);border-radius:20px;padding:6px 14px;box-shadow:0 8px 24px rgba(0,0,0,0.5);cursor:pointer;color:#38bdf8;font-size:12px;font-weight:800;animation:ioeRgb 4s linear infinite;">
                🌐 YANZIOE v${IOE.escHtml(IOE.version || '1.2.2')}
            </div>
        `;

        document.body.appendChild(root);

        function refreshStatusStats() {
            const eng = document.getElementById('yanz-stat-engine');
            const tot = document.getElementById('yanz-stat-total-q');
            const pkt = document.getElementById('yanz-stat-packet');
            const licEl = document.getElementById('yanz-stat-license');
            if (eng) eng.innerText = IOE.state.lastEngine || 'Đang quét';
            if (tot) tot.innerText = `${IOE.state.solvedMeta.size} câu`;
            if (pkt) pkt.innerText = `${IOE.state.packetHits || 0} gói (${IOE.state.correctAnswers.size} key)`;
            const st = IOE.license?.getState?.();
            if (licEl && st?.key) licEl.innerText = st.key;
        }
        refreshStatusStats();

        function syncUIWithState() {
            const mapChk = [
                ['yanz-chk-auto', 'autoAnswer'],
                ['yanz-chk-show', 'showAnswers'],
                ['yanz-chk-canvas', 'canvasMode'],
                ['yanz-chk-freeze', 'freezeTimer'],
                ['yanz-chk-oneko', 'oneko'],
                ['yanz-chk-stream', 'streamMode']
            ];
            for (const [id, prop] of mapChk) {
                const el = document.getElementById(id);
                if (el) el.checked = !!IOE.features[prop];
            }
            const keyInp = document.getElementById('yanz-inp-key');
            if (keyInp) keyInp.value = IOE.featureConfigs.apiKey || '';
            const selProv = document.getElementById('yanz-sel-provider');
            if (selProv && IOE.featureConfigs.aiProvider) selProv.value = IOE.featureConfigs.aiProvider;
            const selMode = document.getElementById('yanz-sel-mode');
            if (selMode && IOE.featureConfigs.questionMode) selMode.value = IOE.featureConfigs.questionMode;
            const rngDelay = document.getElementById('yanz-rng-delay');
            const delayVal = document.getElementById('yanz-delay-val');
            if (rngDelay && IOE.featureConfigs.autoDelay) {
                rngDelay.value = IOE.featureConfigs.autoDelay;
                if (delayVal) delayVal.innerText = `${(IOE.featureConfigs.autoDelay / 1000).toFixed(1)}s`;
            }
        }
        syncUIWithState();

        const tabs = root.querySelectorAll('.yanz-tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                root.querySelectorAll('.yanz-tab-content').forEach(c => { c.style.display = 'none'; });
                const showContent = root.querySelector(`#yanz-tab-${tab.dataset.tab}`);
                if (showContent) showContent.style.display = 'block';
                refreshStatusStats();
            });
        });

        const panel = document.getElementById('yanzioe-panel');
        const pill = document.getElementById('yanzioe-pill');
        const dragHandle = document.getElementById('yanzioe-drag-handle');
        let isDragging = false, startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

        dragHandle?.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            startX = e.clientX; startY = e.clientY;
            const rect = root.getBoundingClientRect();
            initialLeft = rect.left; initialTop = rect.top;
            root.style.right = 'auto';
            root.style.left = `${initialLeft}px`;
            root.style.top = `${initialTop}px`;
        });
        win.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            root.style.left = `${Math.max(0, initialLeft + (e.clientX - startX))}px`;
            root.style.top = `${Math.max(0, initialTop + (e.clientY - startY))}px`;
        });
        win.addEventListener('mouseup', () => { isDragging = false; });

        document.getElementById('yanzioe-collapse-btn')?.addEventListener('click', () => {
            panel.style.display = 'none'; pill.style.display = 'block';
        });
        pill?.addEventListener('click', () => {
            panel.style.display = 'block'; pill.style.display = 'none';
        });
        document.getElementById('yanzioe-close-btn')?.addEventListener('click', () => {
            root.style.display = 'none'; isMenuVisible = false;
        });

        function appendLog(msg) {
            const box = document.getElementById('yanz-log-box');
            if (box) {
                const line = document.createElement('div');
                line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
                box.appendChild(line);
                box.scrollTop = box.scrollHeight;
            }
        }
        IOE.appendLog = appendLog;

        IOE.updateQuizSummary = function (total, filled) {
            const totalEl = document.getElementById('yanz-stat-total-q');
            const progEl = document.getElementById('yanz-stat-progress');
            if (totalEl) totalEl.innerText = `${total} câu`;
            if (progEl) {
                const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
                progEl.innerText = `${filled}/${total} (${pct}%)`;
            }
        };

        document.getElementById('yanz-btn-switch-key')?.addEventListener('click', () => {
            root.remove();
            IOE.license?.clearKey?.();
        });

        document.getElementById('yanzioe-solve-btn')?.addEventListener('click', async () => {
            appendLog('Quét & giải bài hiện tại...');
            broadcastToFrames({ type: 'YANZIOE_CMD', action: 'STEP_ONCE' });
            if (IOE.auto?.stepOnce) await IOE.auto.stepOnce(true);
            refreshStatusStats();
        });

        const keyInpEl = document.getElementById('yanz-inp-key');
        const saveKeyFn = () => {
            IOE.featureConfigs.apiKey = (keyInpEl?.value || '').trim();
            saveAllConfigs();
        };
        keyInpEl?.addEventListener('input', saveKeyFn);
        keyInpEl?.addEventListener('change', () => { saveKeyFn(); IOE.toast('💾 Đã lưu API Key!', 1100); });
        keyInpEl?.addEventListener('blur', saveKeyFn);

        document.getElementById('yanz-btn-save-key')?.addEventListener('click', () => {
            saveKeyFn();
            IOE.toast('💾 Đã lưu cấu hình AI!', 1200);
        });

        document.getElementById('yanz-btn-test-key')?.addEventListener('click', async () => {
            saveKeyFn();
            const msgEl = document.getElementById('yanz-ai-test-msg');
            if (msgEl) { msgEl.style.color = '#38bdf8'; msgEl.textContent = '⏳ Đang kiểm tra kết nối API Key...'; }
            const r = await IOE.question?.testAiKey?.();
            if (msgEl) {
                if (r?.ok) {
                    msgEl.style.color = '#4ade80';
                    msgEl.textContent = `✓ Kết nối ${r.provider?.toUpperCase()} thành công!`;
                } else {
                    msgEl.style.color = '#fca5a5';
                    msgEl.textContent = `✕ ${r?.error || 'Key không hợp lệ hoặc hết quota'}`;
                }
            }
        });

        document.getElementById('yanz-sel-provider')?.addEventListener('change', (e) => {
            IOE.featureConfigs.aiProvider = e.target.value; saveAllConfigs();
        });
        document.getElementById('yanz-sel-mode')?.addEventListener('change', (e) => {
            IOE.featureConfigs.questionMode = e.target.value; saveAllConfigs();
            IOE.toast(`Chế độ: ${e.target.value}`, 1000);
        });
        document.getElementById('yanz-rng-delay')?.addEventListener('input', (e) => {
            const v = parseInt(e.target.value, 10);
            IOE.featureConfigs.autoDelay = v;
            const dv = document.getElementById('yanz-delay-val');
            if (dv) dv.innerText = `${(v / 1000).toFixed(1)}s`;
            saveAllConfigs();
        });

        document.getElementById('yanz-chk-auto')?.addEventListener('change', (e) => {
            IOE.features.autoAnswer = e.target.checked; saveAllConfigs();
            IOE.toast(e.target.checked ? '⚡ Auto-Answer: BẬT' : '⏹ Auto-Answer: TẮT', 1100);
        });
        document.getElementById('yanz-chk-canvas')?.addEventListener('change', (e) => {
            IOE.features.canvasMode = e.target.checked; saveAllConfigs();
        });
        document.getElementById('yanz-chk-show')?.addEventListener('change', (e) => {
            IOE.features.showAnswers = e.target.checked; saveAllConfigs();
        });
        document.getElementById('yanz-chk-freeze')?.addEventListener('change', (e) => {
            IOE.features.freezeTimer = e.target.checked; saveAllConfigs();
            IOE.toast(e.target.checked ? '❄️ Đóng băng giờ: BẬT' : '⏱ Đóng băng giờ: TẮT', 1100);
        });
        document.getElementById('yanz-chk-oneko')?.addEventListener('change', (e) => {
            IOE.features.oneko = e.target.checked; saveAllConfigs();
            IOE.oneko?.toggle?.(e.target.checked);
        });
        document.getElementById('yanz-chk-stream')?.addEventListener('change', (e) => {
            IOE.features.streamMode = e.target.checked; saveAllConfigs();
            root.style.display = e.target.checked ? 'none' : 'block';
            const hud = document.getElementById('yanzioe-revealer-hud');
            if (hud) hud.style.display = e.target.checked ? 'none' : 'flex';
        });

        document.getElementById('yanz-btn-clear-log')?.addEventListener('click', () => {
            const box = document.getElementById('yanz-log-box');
            if (box) box.innerHTML = '';
        });
        document.getElementById('yanz-btn-debug')?.addEventListener('click', () => {
            const diag = IOE.canvas?.getSceneDiagnostics ? IOE.canvas.getSceneDiagnostics() : {};
            const domP = IOE.auto?.extractGenericDomQuestion ? IOE.auto.extractGenericDomQuestion()?.qText?.slice(0, 60) : '';
            appendLog(`[TOP Debug] ${JSON.stringify({ ...diag, iframes: document.querySelectorAll('iframe').length, pkt: IOE.state.packetHits || 0, keys: IOE.state.correctAnswers.size, domPreview: domP || '', href: location.href })}`);
            broadcastToFrames({ type: 'YANZIOE_CMD', action: 'DEBUG_SCAN' });
        });
        document.getElementById('yanz-btn-scan-again')?.addEventListener('click', async () => {
            appendLog('Đang quét lại Cocos2d/CreateJS/DOM...');
            broadcastToFrames({ type: 'YANZIOE_CMD', action: 'STEP_ONCE' });
            if (IOE.auto?.stepOnce) await IOE.auto.stepOnce(true);
            refreshStatusStats();
        });

        IOE.events.on('questionSolved', (meta) => {
            const qEl = document.getElementById('yanz-ans-question');
            const aEl = document.getElementById('yanz-ans-result');
            const tEl = document.getElementById('yanz-ans-thinking');
            if (qEl && (meta.qText || meta.qId)) qEl.innerText = meta.qText || meta.qId;
            if (aEl && meta.answer) aEl.innerText = meta.answer;
            if (tEl && meta.thinking) tEl.innerText = meta.thinking;
            refreshStatusStats();
        });
        IOE.events.on('packetCaptured', refreshStatusStats);
        nativeSetInterval(refreshStatusStats, 2500);

        if (!win.__YANZIOE_HOTKEYS__) {
            win.__YANZIOE_HOTKEYS__ = true;
            win.addEventListener('keydown', (e) => {
                if (!e.altKey) return;
                if (e.code === 'KeyH') {
                    e.preventDefault();
                    const rEl = document.getElementById('yanzioe-root');
                    if (rEl) {
                        isMenuVisible = rEl.style.display === 'none';
                        rEl.style.display = isMenuVisible ? 'block' : 'none';
                    }
                } else if (e.code === 'KeyA') {
                    e.preventDefault();
                    IOE.features.autoAnswer = !IOE.features.autoAnswer;
                    saveAllConfigs();
                    const chk = document.getElementById('yanz-chk-auto');
                    if (chk) chk.checked = IOE.features.autoAnswer;
                    IOE.toast(IOE.features.autoAnswer ? '⚡ Auto-Answer: BẬT (Alt+A)' : '⏹ Auto-Answer: TẮT (Alt+A)', 1200);
                } else if (e.code === 'KeyS') {
                    e.preventDefault();
                    broadcastToFrames({ type: 'YANZIOE_CMD', action: 'STEP_ONCE' });
                    IOE.auto?.stepOnce?.(true);
                }
            });
        }
    }

    IOE.events.on('licenseVerified', () => IOE.onBodyReady(createMainMenu));
    if (IOE.state?.licensed || IOE.license?.isLicensed?.()) {
        IOE.onBodyReady(createMainMenu);
    }
})(typeof window !== 'undefined' ? window : globalThis);

})();
