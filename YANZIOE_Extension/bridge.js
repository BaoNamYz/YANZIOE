/* YANZIOE Extension Bridge (ISOLATED World) */
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
