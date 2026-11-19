/* YANZIOE Extension Bridge (ISOLATED World) */
(function () {
    'use strict';
    document.documentElement.dataset.ioeBridge = '1';

    window.addEventListener('message', function (ev) {
        if (ev.source !== window || ev.data?.type !== 'IOE_BRIDGE_FETCH_REQ') return;
        const { id, payload } = ev.data;
        chrome.runtime.sendMessage({ type: 'IOE_FETCH', payload }, function (res) {
            const err = chrome.runtime.lastError ? chrome.runtime.lastError.message : null;
            window.postMessage({
                type: 'IOE_BRIDGE_FETCH_RES',
                id,
                payload: err ? { ok: false, status: 0, error: err } : (res || { ok: false, status: 0, error: 'Empty bridge reply' })
            }, '*');
        });
    });
})();
