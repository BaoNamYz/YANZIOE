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
