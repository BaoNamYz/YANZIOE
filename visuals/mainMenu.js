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

    function saveAllConfigs() {
        try {
            const key = (IOE.featureConfigs.apiKey || '').trim();
            const payload = {
                features: IOE.features,
                configs: { ...IOE.featureConfigs, apiKey: key },
                savedAt: Date.now()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
            if (key) {
                localStorage.setItem('IOE_API_KEY', key);
                localStorage.setItem('YANZIOE_API_KEY', key);
                try { sessionStorage.setItem('IOE_API_KEY', key); } catch (e) {}
                try {
                    let wn = {}; try { wn = JSON.parse(window.name || '{}'); } catch (e) {}
                    wn.IOE_API_KEY = key; window.name = JSON.stringify(wn);
                } catch (e) {}
                try { document.cookie = `IOE_API_KEY=${encodeURIComponent(key)}; path=/; max-age=315360000; SameSite=Lax`; } catch (e) {}
                if (typeof GM_setValue === 'function') { try { GM_setValue('IOE_API_KEY', key); } catch (e) {} }
            }
        } catch (e) {}
    }

    loadSavedConfig();

    function createMainMenu() {
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
                        <span style="background:linear-gradient(135deg,#0284c7,#3b82f6);color:#fff;font-size:9px;padding:1.5px 5px;border-radius:4px;font-weight:800;">v1.2.0</span>
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
                    <div id="yanz-log-box" style="background:#090d16;border:1px solid rgba(51,65,85,0.8);border-radius:6px;padding:6px 8px;font-family:monospace;font-size:10.5px;color:#38bdf8;height:120px;overflow-y:auto;white-space:pre-wrap;">[YANZIOE] Khởi động hệ thống v1.2.0 (Licensed).</div>
                    <div style="display:flex;gap:6px;margin-top:6px;">
                        <button id="yanz-btn-clear-log" style="flex:1;background:rgba(51,65,85,0.6);border:none;color:#cbd5e1;padding:5px 0;border-radius:4px;font-size:10px;cursor:pointer;">Xóa Logs</button>
                        <button id="yanz-btn-scan-again" style="flex:1;background:#0369a1;border:none;color:#fff;padding:5px 0;border-radius:4px;font-size:10px;cursor:pointer;font-weight:700;">Quét lại Scene</button>
                    </div>
                </div>
            </div>

            <div id="yanzioe-pill" style="display:none;background:rgba(15,23,42,0.95);backdrop-filter:blur(12px);border:1px solid rgba(56,189,248,0.6);border-radius:20px;padding:6px 14px;box-shadow:0 8px 24px rgba(0,0,0,0.5);cursor:pointer;color:#38bdf8;font-size:12px;font-weight:800;animation:ioeRgb 4s linear infinite;">
                🌐 YANZIOE v1.2.0
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
        document.getElementById('yanz-btn-scan-again')?.addEventListener('click', async () => {
            appendLog('Đang quét lại Cocos2d/CreateJS/DOM...');
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
