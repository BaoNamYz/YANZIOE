/* YANZIOE Extension Background Service Worker (CSP-Free Proxy + Cross-Domain Storage) */
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

    const { url, method = 'GET', headers = {}, body, responseType = 'text' } = msg.payload;
    (async () => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 28000);
        try {
            const init = { method, headers, signal: ctrl.signal };
            if (body !== undefined && method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD') {
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
