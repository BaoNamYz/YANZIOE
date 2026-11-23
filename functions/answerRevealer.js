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
