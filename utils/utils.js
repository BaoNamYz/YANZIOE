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
        version: '1.2.0',
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
