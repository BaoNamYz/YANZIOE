(function (global) {
    'use strict';
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    /* Authorized host enforcement on live web origins (allows file:// local harness) */
    if (typeof location !== 'undefined' && /^https?:$/i.test(location.protocol || '') &&
        !/(^|\.)(ioe\.vn|go\.vn|vtc\.vn|vtconline\.vn|goplay\.vn)$/i.test(location.hostname || '')) {
        return;
    }

    /* Capture pristine native timers & fetch before page scripts alter them */
    const isLiveOrigin = (typeof location !== 'undefined' && /^https?:$/i.test(location.protocol || ''));
    const nativeFetch = typeof win.fetch === 'function' ? win.fetch.bind(win) : null;
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
        const { method = 'GET', headers = {}, body = undefined, timeoutMs = 15000, responseType = 'text', multipartAudioBase64 = '', whisperModel = '' } = options;

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
                    payload: { url, method, headers, body, responseType, multipartAudioBase64, whisperModel }
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
            const cleanHeaders = { ...headers };
            let fetchBody = body;
            if (multipartAudioBase64) {
                const binStr = atob(multipartAudioBase64);
                const bytes = new Uint8Array(binStr.length);
                for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
                const fd = new FormData();
                fd.append('file', new Blob([bytes], { type: 'audio/mpeg' }), 'question.mp3');
                fd.append('model', whisperModel || 'whisper-large-v3-turbo');
                fetchBody = fd;
                delete cleanHeaders['Content-Type'];
            }
            const r = await ((isLiveOrigin && nativeFetch) ? nativeFetch : fetch)(url, { method, headers: cleanHeaders, body: fetchBody, signal: ctrl.signal });
            if (responseType === 'base64' && typeof r.arrayBuffer === 'function') {
                const buf = await r.arrayBuffer();
                const bytes = new Uint8Array(buf);
                let bin = '';
                for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
                return { ok: r.ok, status: r.status, text: '', base64: btoa(bin), contentType: r.headers?.get?.('content-type') || 'audio/mpeg' };
            }
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

    function isHumanPacingActive() {
        if (IOE.state?._forcePacingForTest) return true;
        if (IOE.features?.humanPacing === false) return false;
        if (IOE.featureConfigs?.questionMode === 'turbo') return false;
        try {
            if (typeof location !== 'undefined' && !String(location.protocol || '').startsWith('http')) return false;
        } catch (e) {}
        return true;
    }

    function getMinExamSeconds(totalItems = 10) {
        let srv = Number(IOE.state?.serverTimeAuto || 0);
        try {
            if (!srv && typeof win.__require === 'function') {
                const cd = win.__require('ClientData');
                const am = cd?.default?.AppModel || cd?.AppModel;
                if (am?.timeAuto > 0) srv = Number(am.timeAuto);
            }
        } catch (e) {}
        const n = Math.max(1, Number(totalItems || 10));
        const defaultFloor = Math.min(Math.max(34, Math.round(n * 4.5)), 95);
        return Math.max(srv > 0 ? (srv + 5) : 0, defaultFloor);
    }

    async function waitUntilMinElapsed(targetMinSec, label = 'tránh quét tốc độ') {
        if (!isHumanPacingActive()) return 0;
        const started = Number(IOE.state?.examStartedAt || Date.now());
        let slept = 0;
        while (isHumanPacingActive()) {
            const elapsedSec = (Date.now() - started) / 1000;
            const remain = Math.ceil(targetMinSec - elapsedSec);
            if (remain <= 0) break;
            IOE.state.lastPacingHeartbeat = Date.now();
            if (slept === 0 || remain % 4 === 0) {
                toast(`🛡️ Chờ thời gian ${label} tự nhiên (còn ${remain}s)...`, 3200);
            }
            const step = Math.min(1000, remain * 1000);
            await delay(step);
            slept += step;
            if (slept > 120000) break;
        }
        return slept;
    }

    async function waitQuestionReadTime(minMs = 2600, hasAudio = false) {
        if (!isHumanPacingActive()) return 0;
        const floor = hasAudio ? Math.max(minMs, 4200) : minMs;
        const started = Number(IOE.state?.questStartedAt || Date.now());
        const need = floor - (Date.now() - started);
        if (need <= 0) return 0;
        const waitMs = Math.min(need + Math.floor(Math.random() * 750), 9000);
        IOE.state.lastPacingHeartbeat = Date.now();
        await delay(waitMs);
        return waitMs;
    }

    let _devHarnessLicensed = false;
    const ioeState = {
        version: '1.2.9',
        events,
        toast,
        delay,
        escHtml,
        onBodyReady,
        pacing: {
            isHumanPacingActive,
            getMinExamSeconds,
            waitUntilMinElapsed,
            waitQuestionReadTime
        },
        timers: {
            setInterval: nativeSetInterval,
            clearInterval: nativeClearInterval,
            setTimeout: nativeSetTimeout,
            clearTimeout: nativeClearTimeout
        },
        net: { requestExternal, nativeFetch },
        state: {
            isSolving: false,
            currentQuestionId: null,
            packetHits: 0,
            lastEngine: 'Đang quét...',
            examStartedAt: Date.now(),
            serverTimeAuto: 0,
            totalExamQuestions: 10,
            currentExamKey: '',
            currentQuestKey: '',
            questStartedAt: Date.now(),
            lastPacingHeartbeat: 0,
            questions: new Map(),
            solvedMeta: new Map(),
            correctAnswers: new Map(),
            clozeAnswers: {}
        },
        features: {
            autoAnswer: true,
            showAnswers: true,
            canvasMode: true,
            humanPacing: true,
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
            autoDelay: 3000,
            questionMode: 'stealth'
        }
    };

    Object.defineProperty(ioeState.state, 'licensed', {
        enumerable: true,
        configurable: false,
        get() {
            if (!isLiveOrigin && _devHarnessLicensed) return true;
            return !!ioeState.license?.verifySeal?.('93e7d590b85d867a', true);
        },
        set(v) {
            if (!isLiveOrigin) _devHarnessLicensed = !!v;
        }
    });

    global.IOE = ioeState;
    if (!isLiveOrigin) {
        win.IOE = ioeState;
    }
})(typeof window !== 'undefined' ? window : globalThis);
