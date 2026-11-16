(function (global) {
    'use strict';
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const IOE = win.IOE || global.IOE;
    if (!IOE) return;

    let isMenuVisible = true;

    function createMainMenu() {
        if (document.getElementById('yanzioe-root') || !document.body) return;

        const root = document.createElement('div');
        root.id = 'yanzioe-root';
        root.style.cssText = 'position:fixed;top:15px;right:15px;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

        root.innerHTML = `
            <style>
                @keyframes ioeRgb {
                    0% { color: #38bdf8; text-shadow: 0 0 8px rgba(56,189,248,0.6); }
                    33% { color: #818cf8; text-shadow: 0 0 8px rgba(129,140,248,0.6); }
                    66% { color: #c084fc; text-shadow: 0 0 8px rgba(192,132,252,0.6); }
                    100% { color: #38bdf8; text-shadow: 0 0 8px rgba(56,189,248,0.6); }
                }
                .yanz-rgb-text { animation: ioeRgb 4s linear infinite; }
                .yanz-toggle { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; cursor: pointer; font-size: 11.5px; color: #e2e8f0; user-select: none; }
                .yanz-toggle input { cursor: pointer; accent-color: #38bdf8; width: 14px; height: 14px; }
            </style>
            <div id="yanzioe-panel" style="width:235px;background:rgba(15,23,42,0.95);backdrop-filter:blur(14px);border:1px solid rgba(56,189,248,0.4);border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.6);color:#f8fafc;overflow:hidden;">
                <!-- Header -->
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(30,41,59,0.85);border-bottom:1px solid rgba(56,189,248,0.25);cursor:move;" id="yanzioe-drag-handle">
                    <div style="display:flex;align-items:center;gap:6px;">
                        <span style="font-size:14px;">🌐</span>
                        <strong class="yanz-rgb-text" style="font-size:13px;letter-spacing:0.5px;">YANZIOE</strong>
                        <span style="background:#0284c7;color:#fff;font-size:9px;padding:1px 5px;border-radius:4px;font-weight:700;">VIP v1.0.2</span>
                    </div>
                    <div style="display:flex;gap:4px;">
                        <button id="yanzioe-min-btn" style="background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:12px;padding:2px 4px;">▼</button>
                    </div>
                </div>

                <!-- Body -->
                <div id="yanzioe-body" style="padding:10px 12px;">
                    <!-- Action Buttons -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
                        <button id="yanzioe-solve-btn" style="background:linear-gradient(135deg, #0284c7, #2563eb);color:#fff;border:none;border-radius:6px;padding:6px 0;font-weight:700;font-size:11.5px;cursor:pointer;box-shadow:0 2px 8px rgba(2,132,199,0.4);">⚡ Giải ngay</button>
                        <button id="yanzioe-key-btn" style="background:#1e293b;color:#38bdf8;border:1px solid rgba(56,189,248,0.4);border-radius:6px;padding:6px 0;font-weight:700;font-size:11.5px;cursor:pointer;">🔑 Đổi Key</button>
                    </div>

                    <!-- Toggles -->
                    <div style="border-top:1px solid rgba(51,65,85,0.7);padding-top:8px;">
                        <label class="yanz-toggle">
                            <span>Hiện đáp án nổi</span>
                            <input type="checkbox" id="yanz-chk-show" ${IOE.features.showAnswers ? 'checked' : ''}>
                        </label>
                        <label class="yanz-toggle">
                            <span>Tự điền & Qua câu</span>
                            <input type="checkbox" id="yanz-chk-auto" ${IOE.features.autoAnswer ? 'checked' : ''}>
                        </label>
                        <label class="yanz-toggle">
                            <span>Quét Cocos2d / Canvas</span>
                            <input type="checkbox" id="yanz-chk-canvas" checked>
                        </label>
                        <label class="yanz-toggle">
                            <span>Chặn đếm ngược giờ</span>
                            <input type="checkbox" id="yanz-chk-freeze" ${IOE.features.freezeTimer ? 'checked' : ''}>
                        </label>
                        <label class="yanz-toggle">
                            <span>Stream Mode (Ẩn menu)</span>
                            <input type="checkbox" id="yanz-chk-stream" ${IOE.features.streamMode ? 'checked' : ''}>
                        </label>
                    </div>

                    <div style="font-size:10px;color:#94a3b8;margin-top:8px;text-align:center;border-top:1px solid rgba(51,65,85,0.4);padding-top:6px;">
                        Phím tắt: <strong>Alt + H</strong> ẩn/hiện menu
                    </div>
                </div>
            </div>

            <!-- Mini Floater Pill when minimized -->
            <div id="yanzioe-pill" style="display:none;position:fixed;top:15px;right:15px;background:rgba(15,23,42,0.92);border:1px solid #38bdf8;border-radius:20px;padding:5px 12px;color:#38bdf8;font-weight:700;font-size:11px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.5);">
                🌐 YANZIOE VIP
            </div>
        `;

        document.body.appendChild(root);

        // Bind events
        const panel = document.getElementById('yanzioe-panel');
        const pill = document.getElementById('yanzioe-pill');

        pill?.addEventListener('click', () => {
            panel.style.display = 'block';
            pill.style.display = 'none';
        });

        document.getElementById('yanz-chk-show')?.addEventListener('change', (e) => {
            IOE.features.showAnswers = e.target.checked;
        });

        document.getElementById('yanz-chk-auto')?.addEventListener('change', (e) => {
            IOE.features.autoAnswer = e.target.checked;
            IOE.toast(e.target.checked ? '⚡ Bật Auto-Answer (Tự động giải)' : '⏸ Đã tắt Auto-Answer', 1200);
        });

        document.getElementById('yanz-chk-freeze')?.addEventListener('change', (e) => {
            IOE.features.freezeTimer = e.target.checked;
        });

        document.getElementById('yanz-chk-stream')?.addEventListener('change', (e) => {
            IOE.features.streamMode = e.target.checked;
            toggleStreamMode(e.target.checked);
        });

        document.getElementById('yanzioe-solve-btn')?.addEventListener('click', async () => {
            IOE.toast('🔍 Đang bóc tách đề thi & tìm đáp án...', 1200);
            if (IOE.canvas?.solveCanvasGame) {
                const res = await IOE.canvas.solveCanvasGame();
                if (res) return;
            }
            if (IOE.auto?.stepOnce) IOE.auto.stepOnce();
        });

        document.getElementById('yanzioe-key-btn')?.addEventListener('click', () => {
            const current = IOE.featureConfigs?.apiKey || '';
            const key = prompt('Nhập Groq API Key (gsk_...) hoặc Gemini API Key (AIza...):', current);
            if (key !== null) {
                IOE.featureConfigs.apiKey = key.trim();
                localStorage.setItem('IOE_API_KEY', key.trim());
                IOE.toast('✓ Đã lưu API Key thành công!', 1500);
            }
        });

        document.getElementById('yanzioe-min-btn')?.addEventListener('click', () => {
            panel.style.display = 'none';
            if (pill) pill.style.display = 'block';
        });

        // Hotkey Alt+H
        win.addEventListener('keydown', (e) => {
            if (e.altKey && e.code === 'KeyH') {
                e.preventDefault();
                isMenuVisible = !isMenuVisible;
                root.style.display = isMenuVisible ? 'block' : 'none';
            }
        });

        // Load saved key
        const savedKey = localStorage.getItem('IOE_API_KEY');
        if (savedKey) IOE.featureConfigs.apiKey = savedKey;
    }

    function toggleStreamMode(active) {
        const hud = document.getElementById('yanzioe-revealer-hud');
        if (hud) hud.style.display = active ? 'none' : 'flex';
        IOE.toast(active ? '🕵️ Kích hoạt Stream Mode (Ẩn giao diện)' : '👁 Tắt Stream Mode', 1200);
    }

    IOE.onBodyReady(createMainMenu);
    // Extra safety polling in case of dynamic SPA root reloads
    setInterval(() => {
        if (!document.getElementById('yanzioe-root') && document.body) {
            createMainMenu();
        }
    }, 1500);
})(typeof window !== 'undefined' ? window : globalThis);
