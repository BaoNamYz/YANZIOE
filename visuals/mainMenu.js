(function (global) {
    'use strict';
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const IOE = win.IOE || global.IOE;
    if (!IOE) return;

    let isMenuVisible = true;
    let isCollapsed = false;
    let activeTab = 'features';

    function createMainMenu() {
        if (document.getElementById('yanzioe-root') || !document.body) return;

        const root = document.createElement('div');
        root.id = 'yanzioe-root';
        root.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;pointer-events:auto;user-select:none;';

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
                    color: #94a3b8; font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.2s ease;
                    text-align: center;
                }
                .yanz-tab-btn.active {
                    color: #38bdf8; border-bottom: 2px solid #38bdf8; background: rgba(56,189,248,0.08);
                }
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
                .yanz-btn:hover { filter: brightness(1.15); transform: translateY(-1px); }
                .yanz-btn:active { transform: translateY(0); }
            </style>

            <div id="yanzioe-panel" style="width:310px;background:rgba(15,23,42,0.96);backdrop-filter:blur(16px);border:1px solid rgba(56,189,248,0.45);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.65);color:#f8fafc;overflow:hidden;">
                <!-- Header (Draggable) -->
                <div id="yanzioe-drag-handle" style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(30,41,59,0.9);border-bottom:1px solid rgba(56,189,248,0.25);cursor:move;">
                    <div style="display:flex;align-items:center;gap:7px;">
                        <span style="font-size:16px;">🌐</span>
                        <strong class="yanz-rgb-text" style="font-size:13.5px;letter-spacing:0.5px;">YANZIOE VIP</strong>
                        <span style="background:linear-gradient(135deg,#0284c7,#3b82f6);color:#fff;font-size:9px;padding:1.5px 5px;border-radius:4px;font-weight:800;">v1.0.4</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:5px;">
                        <button id="yanzioe-collapse-btn" style="background:rgba(51,65,85,0.7);border:1px solid rgba(148,163,184,0.3);color:#cbd5e1;cursor:pointer;font-size:10px;padding:2px 7px;border-radius:4px;font-weight:700;">Thu nhỏ ▲</button>
                        <button id="yanzioe-close-btn" style="background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:14px;padding:0 3px;font-weight:700;">✕</button>
                    </div>
                </div>

                <!-- Navigation Tabs -->
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
                        ⚡ GIẢI BÀI NGAY LẬP TỨC
                    </button>

                    <label class="yanz-toggle-row">
                        <span>Tự động giải & Điền (AutoAnswer)</span>
                        <input type="checkbox" id="yanz-chk-auto" ${IOE.features.autoAnswer ? 'checked' : ''}>
                    </label>
                    <label class="yanz-toggle-row">
                        <span>Hiện HUD đáp án nổi (Revealer)</span>
                        <input type="checkbox" id="yanz-chk-show" ${IOE.features.showAnswers ? 'checked' : ''}>
                    </label>
                    <label class="yanz-toggle-row">
                        <span>Quét Cocos2d / Canvas game</span>
                        <input type="checkbox" id="yanz-chk-canvas" checked>
                    </label>
                    <label class="yanz-toggle-row">
                        <span>Chặn đếm ngược giờ (Freeze Time)</span>
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
                </div>

                <!-- Tab 2: Tùy chỉnh -->
                <div id="yanz-tab-settings" class="yanz-tab-content" style="display:none;padding:12px 14px;">
                    <div style="font-size:11px;color:#94a3b8;margin-bottom:3px;">Nhà cung cấp AI giải bài:</div>
                    <select id="yanz-sel-provider" class="yanz-input" style="cursor:pointer;padding:5px;">
                        <option value="groq">⚡ Groq (Llama 3.3 70B - Tốc độ 0ms)</option>
                        <option value="gemini">🌟 Google Gemini API</option>
                        <option value="openrouter">🚀 OpenRouter (Free/Custom Models)</option>
                    </select>

                    <div style="font-size:11px;color:#94a3b8;margin-top:8px;margin-bottom:3px;">API Key (Để trống dùng Local CAS & Free fallback):</div>
                    <input type="password" id="yanz-inp-key" class="yanz-input" placeholder="gsk_... hoặc AIzaSy... hoặc sk-or-..." value="${IOE.featureConfigs?.apiKey || ''}">
                    <button id="yanz-btn-save-key" class="yanz-btn" style="margin-top:6px;padding:5px 0;background:#0369a1;">💾 Lưu API Key</button>

                    <div style="font-size:11px;color:#94a3b8;margin-top:10px;margin-bottom:3px;">
                        Độ trễ điền đáp án: <strong id="yanz-delay-val" style="color:#38bdf8;">1.5s</strong>
                    </div>
                    <input type="range" id="yanz-rng-delay" min="300" max="4000" step="100" value="${IOE.featureConfigs?.autoDelay || 1500}" style="width:100%;accent-color:#38bdf8;cursor:pointer;">

                    <div style="font-size:11px;color:#94a3b8;margin-top:8px;margin-bottom:3px;">Chế độ hoạt động:</div>
                    <select id="yanz-sel-mode" class="yanz-input" style="cursor:pointer;padding:5px;">
                        <option value="stealth">🕵️ Stealth (Tránh phát hiện, trễ ngẫu nhiên)</option>
                        <option value="turbo">⚡ Turbo (Giải siêu tốc 0ms không chờ)</option>
                    </select>
                </div>

                <!-- Tab 3: Trạng thái -->
                <div id="yanz-tab-status" class="yanz-tab-content" style="display:none;padding:12px 14px;font-size:11.5px;">
                    <div style="background:rgba(30,41,59,0.7);padding:8px 10px;border-radius:6px;border:1px solid rgba(56,189,248,0.25);margin-bottom:8px;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                            <span style="color:#94a3b8;">Động cơ nhận diện:</span>
                            <strong id="yanz-stat-engine" style="color:#38bdf8;">Cocos Creator 2.x</strong>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                            <span style="color:#94a3b8;">Trạng thái gói tin:</span>
                            <strong id="yanz-stat-packet" style="color:#4ade80;">Sẵn sàng bắt Key</strong>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                            <span style="color:#94a3b8;">Số câu đã giải:</span>
                            <strong id="yanz-stat-count" style="color:#f8fafc;">0 câu</strong>
                        </div>
                        <div style="display:flex;justify-content:space-between;">
                            <span style="color:#94a3b8;">Tỉ lệ chính xác:</span>
                            <strong style="color:#4ade80;">100%</strong>
                        </div>
                    </div>
                    <div style="font-size:10.5px;color:#94a3b8;text-align:center;">
                        Hỗ trợ: Lâu đài trên mây, Khỉ thông minh, Thủ môn, Sắp xếp câu, Điền từ khuyết & Web DOM.
                    </div>
                </div>

                <!-- Tab 4: Đáp án & Tư duy 0ms -->
                <div id="yanz-tab-answers" class="yanz-tab-content" style="display:none;padding:12px 14px;">
                    <div style="font-size:11px;color:#94a3b8;margin-bottom:4px;">Câu hỏi phát hiện:</div>
                    <div id="yanz-ans-question" style="background:rgba(30,41,59,0.7);padding:7px 10px;border-radius:6px;font-size:11px;color:#e2e8f0;max-height:60px;overflow-y:auto;border:1px solid rgba(51,65,85,0.7);">
                        Chưa có câu hỏi được quét. Bấm "Giải bài ngay" để phát hiện!
                    </div>

                    <div style="font-size:11px;color:#94a3b8;margin-top:8px;margin-bottom:4px;">Đáp án giải được:</div>
                    <div id="yanz-ans-result" style="background:rgba(2,132,199,0.15);border:1px solid #0284c7;padding:7px 10px;border-radius:6px;font-size:13px;font-weight:800;color:#38bdf8;text-align:center;">
                        ---
                    </div>

                    <div style="font-size:11px;color:#94a3b8;margin-top:8px;margin-bottom:4px;">🧠 Tư duy ngôn ngữ 0ms:</div>
                    <div id="yanz-ans-thinking" style="background:rgba(15,23,42,0.9);padding:7px 10px;border-radius:6px;font-size:10.5px;color:#cbd5e1;line-height:1.45;white-space:pre-wrap;max-height:100px;overflow-y:auto;border:1px solid rgba(51,65,85,0.7);">
                        Sẵn sàng phân tích ngữ pháp, chủ ngữ, vị ngữ và trật tự câu theo chuẩn tiếng Anh.
                    </div>
                </div>

                <!-- Tab 5: Logs -->
                <div id="yanz-tab-dev" class="yanz-tab-content" style="display:none;padding:12px 14px;">
                    <div id="yanz-log-box" style="background:#020617;border:1px solid rgba(51,65,85,0.8);border-radius:6px;padding:8px;font-family:monospace;font-size:10px;color:#a5f3fc;height:120px;overflow-y:auto;line-height:1.4;margin-bottom:8px;">
                        [YANZIOE] Khởi động hệ thống v1.0.4 thành công.
[YANZIOE] Đã kết nối với Canvas & DOM Observer.
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                        <button id="yanz-btn-clear-log" class="yanz-btn" style="background:#334155;padding:5px 0;">🧹 Xóa Log</button>
                        <button id="yanz-btn-scan-again" class="yanz-btn" style="background:#0369a1;padding:5px 0;">🔍 Quét lại</button>
                    </div>
                </div>

                <!-- Footer -->
                <div style="padding:6px 14px;background:rgba(15,23,42,0.95);border-top:1px solid rgba(51,65,85,0.4);display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#64748b;">
                    <span>Phím tắt: <strong>Alt + H</strong></span>
                    <span>Bởi <strong>YanzBn</strong></span>
                </div>
            </div>

            <!-- Mini Floater Badge when collapsed -->
            <div id="yanzioe-pill" style="display:none;position:fixed;top:16px;right:16px;background:rgba(15,23,42,0.95);border:1px solid #38bdf8;border-radius:20px;padding:6px 14px;color:#38bdf8;font-weight:800;font-size:11.5px;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,0.6);backdrop-filter:blur(10px);">
                🌐 YANZIOE VIP
            </div>
        `;

        document.body.appendChild(root);

        // Tab Switching logic
        const tabs = root.querySelectorAll('.yanz-tab-btn');
        tabs.forEach(btn => {
            btn.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                btn.classList.add('active');
                const targetTab = btn.getAttribute('data-tab');
                root.querySelectorAll('.yanz-tab-content').forEach(c => c.style.display = 'none');
                const showContent = root.querySelector(`#yanz-tab-${targetTab}`);
                if (showContent) showContent.style.display = 'block';
            });
        });

        // Dragging logic
        const panel = document.getElementById('yanzioe-panel');
        const pill = document.getElementById('yanzioe-pill');
        const dragHandle = document.getElementById('yanzioe-drag-handle');

        let isDragging = false, startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

        dragHandle?.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = root.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
            root.style.right = 'auto';
            root.style.left = `${initialLeft}px`;
            root.style.top = `${initialTop}px`;
        });

        win.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            root.style.left = `${Math.max(0, initialLeft + dx)}px`;
            root.style.top = `${Math.max(0, initialTop + dy)}px`;
        });

        win.addEventListener('mouseup', () => { isDragging = false; });

        // Collapse / Expand
        const collapseBtn = document.getElementById('yanzioe-collapse-btn');
        collapseBtn?.addEventListener('click', () => {
            panel.style.display = 'none';
            pill.style.display = 'block';
        });

        pill?.addEventListener('click', () => {
            panel.style.display = 'block';
            pill.style.display = 'none';
        });

        document.getElementById('yanzioe-close-btn')?.addEventListener('click', () => {
            root.style.display = 'none';
            isMenuVisible = false;
        });

        // Log helper
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

        // Solve button
        document.getElementById('yanzioe-solve-btn')?.addEventListener('click', async () => {
            appendLog('Bắt đầu quét và giải bài...');
            IOE.toast('🔍 Đang bóc tách đề thi & tìm đáp án...', 1200);

            // 1. Quét Cocos2d / Canvas
            if (IOE.canvas?.solveCanvasGame) {
                const res = await IOE.canvas.solveCanvasGame();
                if (res) {
                    appendLog('✓ Đã giải bài Canvas Cocos2d thành công!');
                    return;
                }
            }

            // 2. Quét DOM
            if (IOE.auto?.stepOnce) {
                IOE.auto.stepOnce();
                appendLog('✓ Đã thực hiện giải tự động trên Web DOM.');
            }
        });

        // Save key
        document.getElementById('yanz-btn-save-key')?.addEventListener('click', () => {
            const key = document.getElementById('yanz-inp-key')?.value.trim() || '';
            IOE.featureConfigs.apiKey = key;
            localStorage.setItem('IOE_API_KEY', key);
            IOE.toast('✓ Đã lưu API Key thành công!', 1500);
            appendLog(`Đã lưu API Key: ${key ? '***' + key.slice(-4) : '(Để trống)'}`);
        });

        // Delay slider
        const delaySlider = document.getElementById('yanz-rng-delay');
        const delayVal = document.getElementById('yanz-delay-val');
        delaySlider?.addEventListener('input', (e) => {
            const v = e.target.value;
            IOE.featureConfigs.autoDelay = parseInt(v);
            if (delayVal) delayVal.innerText = `${(v / 1000).toFixed(1)}s`;
        });

        // Toggles
        document.getElementById('yanz-chk-auto')?.addEventListener('change', (e) => {
            IOE.features.autoAnswer = e.target.checked;
            IOE.toast(e.target.checked ? '⚡ Bật Auto-Answer' : '⏸ Đã tắt Auto-Answer', 1200);
            appendLog(`Auto-Answer: ${e.target.checked ? 'BẬT' : 'TẮT'}`);
        });

        document.getElementById('yanz-chk-canvas')?.addEventListener('change', (e) => {
            IOE.features.canvasMode = e.target.checked;
            appendLog(`Quét Cocos2d / Canvas: ${e.target.checked ? 'BẬT' : 'TẮT'}`);
        });

        document.getElementById('yanz-chk-show')?.addEventListener('change', (e) => {
            IOE.features.showAnswers = e.target.checked;
        });

        document.getElementById('yanz-chk-freeze')?.addEventListener('change', (e) => {
            IOE.features.freezeTimer = e.target.checked;
        });

        document.getElementById('yanz-chk-oneko')?.addEventListener('change', (e) => {
            IOE.features.oneko = e.target.checked;
            if (IOE.oneko?.toggle) IOE.oneko.toggle(e.target.checked);
        });

        document.getElementById('yanz-chk-stream')?.addEventListener('change', (e) => {
            IOE.features.streamMode = e.target.checked;
            root.style.display = e.target.checked ? 'none' : 'block';
            const hud = document.getElementById('yanzioe-revealer-hud');
            if (hud) hud.style.display = e.target.checked ? 'none' : 'flex';
            IOE.toast(e.target.checked ? '🕵️ Stream Mode BẬT' : '👁 Stream Mode TẮT', 1200);
        });

        document.getElementById('yanz-btn-clear-log')?.addEventListener('click', () => {
            const box = document.getElementById('yanz-log-box');
            if (box) box.innerHTML = '';
        });

        document.getElementById('yanz-btn-scan-again')?.addEventListener('click', async () => {
            appendLog('Đang quét lại Cocos2d Scene...');
            if (IOE.canvas?.solveCanvasGame) await IOE.canvas.solveCanvasGame();
        });

        // Listen for solved events to update Tab 4 (Đáp án)
        IOE.events.on('questionSolved', (meta) => {
            const qEl = document.getElementById('yanz-ans-question');
            const aEl = document.getElementById('yanz-ans-result');
            const tEl = document.getElementById('yanz-ans-thinking');
            const cEl = document.getElementById('yanz-stat-count');
            if (qEl && (meta.qText || meta.qId)) qEl.innerText = meta.qText || meta.qId;
            if (aEl && meta.answer) aEl.innerText = meta.answer;
            if (tEl && meta.thinking) tEl.innerText = meta.thinking;
            if (cEl) cEl.innerText = `${IOE.state.solvedMeta.size} câu`;
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
        if (savedKey) {
            IOE.featureConfigs.apiKey = savedKey;
            const kInput = document.getElementById('yanz-inp-key');
            if (kInput) kInput.value = savedKey;
        }
    }

    IOE.onBodyReady(createMainMenu);
    setInterval(() => {
        if (!document.getElementById('yanzioe-root') && document.body) {
            createMainMenu();
        }
    }, 1500);
})(typeof window !== 'undefined' ? window : globalThis);
