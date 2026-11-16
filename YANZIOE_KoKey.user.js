// ==UserScript==
// @name         YANZIOE VIP (CoKey) - IOE.vn Auto Answer & Revealer
// @namespace    https://yanzbn.shop/
// @version      1.0.2
// @description  Tool tự giải bài và hiển thị gợi ý đáp án Olympic Tiếng Anh IOE.vn (Hỗ trợ Cocos2d-JS, CreateJS Canvas và Web DOM) - Bản Free/CoKey không cần nhập API Key
// @author       YanzBn
// @match        *://ioe.vn/*
// @match        *://*.ioe.vn/*
// @match        *://*.go.vn/*
// @match        *://*.vtc.vn/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @noframes     false
// ==/UserScript==

/* --- utils/utils.js --- */
(function (global) {
    'use strict';
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

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

    function toast(msg, duration = 2200) {
        onBodyReady(() => {
            let box = document.getElementById('ioe-toast-box');
            if (!box) {
                box = document.createElement('div');
                box.id = 'ioe-toast-box';
                box.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:99999999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
                document.body.appendChild(box);
            }
            const el = document.createElement('div');
            el.style.cssText = 'background:rgba(15,23,42,0.92);backdrop-filter:blur(8px);border:1px solid #38bdf8;color:#f8fafc;padding:8px 14px;border-radius:8px;font-size:12.5px;font-family:sans-serif;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,0.4);animation:ioeFade 0.25s ease-out;';
            el.innerText = msg;
            box.appendChild(el);
            setTimeout(() => {
                el.style.opacity = '0';
                el.style.transition = 'opacity 0.3s ease';
                setTimeout(() => el.remove(), 300);
            }, duration);
        });
    }

    function delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    function escHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    const ioeState = {
        events,
        toast,
        delay,
        escHtml,
        onBodyReady,
        state: {
            isSolving: false,
            currentQuestionId: null,
            questions: new Map(),
            solvedMeta: new Map(),
            correctAnswers: new Map()
        },
        features: {
            autoAnswer: false,
            showAnswers: true,
            streamMode: false,
            oneko: false,
            rgbLogo: true,
            freezeTimer: true
        },
        featureConfigs: {
            apiKey: '',
            autoDelay: 1500,
            questionMode: 'stealth'
        }
    };

    global.IOE = ioeState;
    win.IOE = ioeState;
})(typeof window !== 'undefined' ? window : globalThis);


/* --- functions/oneko.js --- */
(function (global) {
    'use strict';
    let nekoEl = null;
    let nekoX = 32, nekoY = 32, mouseX = 0, mouseY = 0, frameCount = 0;

    function initOneko() {
        if (nekoEl) return;
        nekoEl = document.createElement('div');
        nekoEl.id = 'yanz-oneko';
        nekoEl.style.cssText = 'width:32px;height:32px;position:fixed;pointer-events:none;z-index:9999998;image-rendering:pixelated;display:none;';
        nekoEl.innerHTML = '<span style="font-size:24px;">🐱</span>';
        document.body.appendChild(nekoEl);

        window.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        function frame() {
            if (global.IOE?.features?.oneko && nekoEl) {
                nekoEl.style.display = 'block';
                const diffX = mouseX - nekoX;
                const diffY = mouseY - nekoY;
                const dist = Math.hypot(diffX, diffY);
                if (dist > 10) {
                    nekoX += (diffX / dist) * 4;
                    nekoY += (diffY / dist) * 4;
                }
                nekoEl.style.left = `${nekoX - 16}px`;
                nekoEl.style.top = `${nekoY - 16}px`;
            } else if (nekoEl) {
                nekoEl.style.display = 'none';
            }
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initOneko);
    } else {
        initOneko();
    }
})(typeof window !== 'undefined' ? window : globalThis);


/* --- functions/questionSpoof.js --- */
(function (global) {
    'use strict';
    const IOE = global.IOE;
    if (!IOE) return;

    /* ================= 1. ADAPTIVE MISTAKE MEMORY ================= */
    const adaptiveMistakes = new Map();

    function recordAdaptiveMistake(qId, failedAns) {
        if (!qId || !failedAns) return;
        let entry = adaptiveMistakes.get(qId);
        if (!entry) {
            entry = { qId, wrong: new Set() };
            adaptiveMistakes.set(qId, entry);
        }
        entry.wrong.add(String(failedAns).trim().toLowerCase());
    }

    function isAnswerWrong(qId, ans) {
        const entry = adaptiveMistakes.get(qId);
        if (!entry) return false;
        return entry.wrong.has(String(ans).trim().toLowerCase());
    }

    /* ================= 2. 0MS INSTANT THINKING GENERATOR ================= */
    function generate0msThinking(qText, ans, tier = '') {
        const lower = String(qText || '').toLowerCase();
        const ansStr = String(ans || '');

        if (lower.includes('order') || lower.includes('reorder') || lower.includes('arrange') || lower.includes('sắp xếp')) {
            return [
                '🧠 [Tư duy 0ms - Cấu trúc câu tiếng Anh]:',
                '• Xác định chủ ngữ (Subject) và động từ chính (Main Verb) trong các thẻ từ.',
                '• Sắp xếp trật tự S + V + O + Adv theo chuẩn ngữ pháp tiếng Anh.',
                '• Kiểm tra liên từ và dấu câu kết thúc.',
                `➔ Kết quả sắp xếp: ${ansStr}`
            ].join('\n');
        }

        if (lower.includes('fill') || lower.includes('blank') || lower.includes('điền')) {
            return [
                '🧠 [Tư duy 0ms - Ngữ pháp & Điền khuyết]:',
                '• Phân tích thì của câu (Tense) và ngữ cảnh xung quanh vị trí trống.',
                '• Xác định từ loại cần điền (danh từ, động từ, tính từ hoặc giới từ đi kèm).',
                '• Đối chiếu biến đổi hình thái từ (V-ing, V-ed, số nhiều).',
                `➔ Từ cần điền: ${ansStr}`
            ].join('\n');
        }

        if (lower.includes('match') || lower.includes('nối') || lower.includes('cặp')) {
            return [
                '🧠 [Tư duy 0ms - Ghép cặp từ vựng & Nghĩa]:',
                '• Quét danh sách các thẻ từ vựng và ảnh/định nghĩa tương ứng.',
                '• Xác định cặp đồng nghĩa / trái nghĩa hoặc từ chỉ vật thể tương ứng.',
                `➔ Cặp ghép: ${ansStr}`
            ].join('\n');
        }

        return [
            '🧠 [Tư duy 0ms - Phân tích ngữ cảnh & Loại trừ]:',
            '• Đọc câu hỏi, xác định trọng tâm ngữ pháp hoặc nghĩa từ vựng.',
            '• Loại trừ các phương án sai thì, sai cấu trúc hoặc không hợp ngữ cảnh.',
            '• Khóa phương án chính xác nhất.',
            `➔ Đáp án: ${ansStr}`
        ].join('\n');
    }

    /* ================= 3. TIER 1: LOCAL ENGLISH CAS (0MS OFFLINE) ================= */
    const IRREGULAR_VERBS = {
        'go': 'went / gone', 'be': 'was, were / been', 'see': 'saw / seen',
        'do': 'did / done', 'have': 'had / had', 'eat': 'ate / eaten',
        'buy': 'bought / bought', 'take': 'took / taken', 'make': 'made / made',
        'write': 'wrote / written', 'read': 'read / read', 'speak': 'spoke / spoken'
    };

    function solveLocalEnglish(qText) {
        if (!qText) return null;
        // Kiểm tra mẫu hỏi quá khứ phân từ hoặc biến đổi từ đơn giản
        for (const [v, p] of Object.entries(IRREGULAR_VERBS)) {
            if (new RegExp(`past\\s+(?:tense|participle)\\s+of\\s+['"]?${v}['"]?`, 'i').test(qText)) {
                return { answer: p, tier: 'Tier 1 (Local CAS 0ms)' };
            }
        }
        return null;
    }

    /* ================= 4. TIER 2: AI SOLVER (GROQ / GEMINI / OPENROUTER) ================= */
    async function solveWithAi(qText, options = []) {
        const apiKey = (IOE.featureConfigs?.apiKey || '').trim();
        if (!apiKey) return null;

        const isGemini = apiKey.startsWith('AIza');
        const optsText = options.length ? `\nOptions:\n${options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n')}` : '';
        const prompt = `Solve this Olympic English (IOE) question accurately.
Return ONLY JSON format: {"answer": "..."} without any other text or markdown fences.
If multiple choice, answer must be the exact text or option letter.
If fill in blank, answer must be the exact word.
If sentence reorder, answer must be the full reordered sentence.

Question: ${qText}${optsText}`;

        try {
            if (isGemini) {
                const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });
                const j = await res.json();
                const raw = j?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                const m = /\{[\s\S]*"answer"[\s\S]*\}/.exec(raw);
                if (m) {
                    const parsed = JSON.parse(m[0]);
                    return parsed.answer;
                }
                return raw.replace(/["'{}]/g, '').trim();
            } else {
                const isGroq = apiKey.startsWith('gsk_');
                const endpoint = isGroq
                    ? 'https://api.groq.com/openai/v1/chat/completions'
                    : 'https://openrouter.ai/api/v1/chat/completions';
                const model = isGroq ? 'llama-3.3-70b-versatile' : 'openai/gpt-4o-mini';

                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model,
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.1
                    })
                });
                const j = await res.json();
                const raw = j?.choices?.[0]?.message?.content || '';
                const m = /\{[\s\S]*"answer"[\s\S]*\}/.exec(raw);
                if (m) {
                    const parsed = JSON.parse(m[0]);
                    return parsed.answer;
                }
                return raw.replace(/["'{}]/g, '').trim();
            }
        } catch (err) {
            return null;
        }
    }

    /* ================= 5. SOLVE ORCHESTRATOR ================= */
    async function solveQuestion(qId, qText, options = []) {
        if (!qText && !qId) return null;

        // Tier 0: Ground truth from raw packet
        if (qId && IOE.state.correctAnswers.has(qId)) {
            const ans = IOE.state.correctAnswers.get(qId);
            const thinking = generate0msThinking(qText, ans, 'Tier 0 (Key Gốc)');
            const meta = { qId, answer: ans, tier: 'Tier 0 (Key Gốc)', thinking };
            IOE.state.solvedMeta.set(qId, meta);
            IOE.events.emit('questionSolved', meta);
            return meta;
        }

        // Tier 1: Local English CAS
        const cas = solveLocalEnglish(qText);
        if (cas && !isAnswerWrong(qId, cas.answer)) {
            const thinking = generate0msThinking(qText, cas.answer, cas.tier);
            const meta = { qId, answer: cas.answer, tier: cas.tier, thinking };
            IOE.state.solvedMeta.set(qId, meta);
            IOE.events.emit('questionSolved', meta);
            return meta;
        }

        // Tier 2: AI Solver
        IOE.toast('🔍 Đang giải câu hỏi...', 1200);
        const aiAns = await solveWithAi(qText, options);
        if (aiAns) {
            const thinking = generate0msThinking(qText, aiAns, 'Tier 2 (AI)');
            const meta = { qId, answer: aiAns, tier: 'Tier 2 (AI)', thinking };
            IOE.state.solvedMeta.set(qId, meta);
            IOE.events.emit('questionSolved', meta);
            return meta;
        }

        return null;
    }

    /* ================= 6. NETWORK INTERCEPTOR ================= */
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const res = await originalFetch.apply(this, args);
        try {
            const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
            if (url.includes('api') || url.includes('exam') || url.includes('test') || url.includes('question')) {
                const clone = res.clone();
                clone.json().then(data => parsePacket(data)).catch(() => {});
            }
        } catch (e) {}
        return res;
    };

    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, url, ...rest) {
        this._ioeUrl = url;
        return origOpen.apply(this, [m, url, ...rest]);
    };
    XMLHttpRequest.prototype.send = function (...args) {
        this.addEventListener('load', function () {
            try {
                if (this._ioeUrl && (this._ioeUrl.includes('api') || this._ioeUrl.includes('exam'))) {
                    const data = JSON.parse(this.responseText);
                    parsePacket(data);
                }
            } catch (e) {}
        });
        return origSend.apply(this, args);
    };

    function parsePacket(data) {
        if (!data) return;
        const list = Array.isArray(data) ? data : (data.data || data.Questions || data.items || []);
        if (Array.isArray(list) && list.length > 0) {
            list.forEach(q => {
                const id = q.Id || q.id || q.QuestionId;
                if (id) {
                    IOE.state.questions.set(String(id), q);
                    const rawKey = q.Answer || q.Key || q.CorrectAnswer;
                    if (rawKey) {
                        IOE.state.correctAnswers.set(String(id), String(rawKey));
                        IOE.toast(`🔓 Bắt được Key gốc: ${rawKey}`, 1800);
                    }
                }
            });
        }
    }

    IOE.question = {
        solveQuestion,
        generate0msThinking,
        recordAdaptiveMistake,
        isAnswerWrong
    };
})(typeof window !== 'undefined' ? window : globalThis);


/* --- functions/canvasEngine.js --- */
(function (global) {
    'use strict';
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const IOE = win.IOE || global.IOE;
    if (!IOE) return;

    /* ================= 1. COCOS2D-JS / COCOS CREATOR ENGINE ================= */
    // IOE games like "Lâu đài trên mây", "Thủ môn bắt bóng", v.v. sử dụng Cocos2d-JS
    function getCocosScene() {
        try {
            const cc = win.cc;
            if (cc && cc.director && typeof cc.director.getScene === 'function') {
                return cc.director.getScene();
            }
        } catch (e) {}
        return null;
    }

    // Đệ quy quét toàn bộ text trong cây đối tượng Cocos2d
    function extractCocosTexts(node, maxDepth = 10, curDepth = 0) {
        if (!node || curDepth > maxDepth) return [];
        const results = [];
        try {
            // 1. Kiểm tra Label Component
            let labelComp = null;
            if (typeof node.getComponent === 'function') {
                const cc = win.cc;
                if (cc && cc.Label) labelComp = node.getComponent(cc.Label);
                if (!labelComp && cc && cc.RichText) labelComp = node.getComponent(cc.RichText);
                if (!labelComp && cc && cc.EditBox) labelComp = node.getComponent(cc.EditBox);
            }

            const strVal = labelComp?.string || node._string || node.string;
            if (strVal && typeof strVal === 'string') {
                const clean = strVal.trim();
                if (clean.length > 0) {
                    results.push({ node, text: clean, comp: labelComp });
                }
            }

            // 2. Quét các node con
            const children = (typeof node.getChildren === 'function' ? node.getChildren() : node.children) || [];
            for (const child of children) {
                results.push(...extractCocosTexts(child, maxDepth, curDepth + 1));
            }
        } catch (e) {}
        return results;
    }

    // Tìm các nút bấm có thể click được trong Cocos2d
    function findCocosClickables(node, maxDepth = 10, curDepth = 0) {
        if (!node || curDepth > maxDepth) return [];
        const results = [];
        try {
            const cc = win.cc;
            let hasBtn = false;
            if (typeof node.getComponent === 'function' && cc?.Button) {
                hasBtn = !!node.getComponent(cc.Button);
            }
            if (hasBtn || node._hasClickEventListener || node._touchListener) {
                const txt = extractCocosTexts(node).map(t => t.text).join(' ');
                results.push({ node, text: txt });
            }

            const children = (typeof node.getChildren === 'function' ? node.getChildren() : node.children) || [];
            for (const child of children) {
                results.push(...findCocosClickables(child, maxDepth, curDepth + 1));
            }
        } catch (e) {}
        return results;
    }

    // Kích hoạt click vào một Node trong Cocos2d
    function clickCocosNode(node) {
        if (!node) return false;
        try {
            const cc = win.cc;
            // Cách 1: Kích hoạt Button component
            if (typeof node.getComponent === 'function' && cc?.Button) {
                const btn = node.getComponent(cc.Button);
                if (btn) {
                    if (Array.isArray(btn.clickEvents)) {
                        for (const ev of btn.clickEvents) {
                            if (typeof ev.emit === 'function') ev.emit([ev.customEventData]);
                        }
                    }
                    if (typeof btn._onTouchEnded === 'function') {
                        btn._onTouchEnded({});
                        return true;
                    }
                }
            }

            // Cách 2: Bắn Event TOUCH_END trên Node
            if (typeof node.emit === 'function') {
                node.emit('touchend');
                node.emit('click');
                return true;
            }

            // Cách 3: Dispatch native touch / mouse qua canvas
            const canvas = document.getElementById('GameCanvas') || document.querySelector('canvas.gameCanvas');
            if (canvas && typeof node.convertToWorldSpaceAR === 'function') {
                const worldPos = node.convertToWorldSpaceAR(cc.v2(0, 0));
                const rect = canvas.getBoundingClientRect();
                const clientX = rect.left + worldPos.x;
                const clientY = rect.bottom - worldPos.y; // Cocos trục Y từ dưới lên
                dispatchCanvasClick(canvas, clientX, clientY);
                return true;
            }
        } catch (err) {
            console.warn('[YANZIOE Cocos] clickCocosNode error:', err);
        }
        return false;
    }

    /* ================= 2. CREATEJS / EASELJS CANVAS ENGINE ================= */
    function getStageAndRoot() {
        const stage = win.stage || win.exportRoot?.stage || null;
        const root = win.exportRoot || null;
        return { stage, root };
    }

    function extractCreateJSTexts(container, maxDepth = 6, curDepth = 0) {
        if (!container || curDepth > maxDepth) return [];
        const texts = [];
        const children = container.children || [];
        for (const child of children) {
            if (child.text !== undefined && typeof child.text === 'string') {
                const t = child.text.trim();
                if (t && t.length > 1) texts.push({ obj: child, text: t });
            }
            if (child.children && child.children.length > 0) {
                texts.push(...extractCreateJSTexts(child, maxDepth, curDepth + 1));
            }
        }
        return texts;
    }

    function findCreateJSClickables(container, maxDepth = 6, curDepth = 0) {
        if (!container || curDepth > maxDepth) return [];
        const clickables = [];
        const children = container.children || [];
        for (const child of children) {
            if (child.hasEventListener?.('click') || child.hasEventListener?.('mousedown') || child.cursor === 'pointer' || child.buttonMode) {
                const texts = extractCreateJSTexts(child).map(t => t.text).join(' ');
                clickables.push({ obj: child, label: texts });
            }
            if (child.children && child.children.length > 0) {
                clickables.push(...findCreateJSClickables(child, maxDepth, curDepth + 1));
            }
        }
        return clickables;
    }

    function clickCreateJS(obj, stage) {
        if (!obj) return false;
        try {
            if (win.createjs?.MouseEvent) {
                const ev = new win.createjs.MouseEvent('click', true, true, 0, 0, null, 0, true, 0);
                obj.dispatchEvent(ev);
                if (stage && typeof stage.update === 'function') stage.update();
                return true;
            }
        } catch (e) {}
        return false;
    }

    /* ================= 3. DISPATCH CANVAS CLICK / KEYBOARD ================= */
    function dispatchCanvasClick(canvas, x, y) {
        if (!canvas) return;
        const opts = { bubbles: true, cancelable: true, view: win, clientX: x, clientY: y };
        canvas.dispatchEvent(new MouseEvent('mousedown', opts));
        canvas.dispatchEvent(new MouseEvent('mouseup', opts));
        canvas.dispatchEvent(new MouseEvent('click', opts));
    }

    function typeCanvasString(str) {
        const canvas = document.getElementById('GameCanvas') || document.querySelector('canvas');
        const target = canvas || win;
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            const code = char.toUpperCase().charCodeAt(0);
            const keyOpts = { key: char, code: `Key${char.toUpperCase()}`, keyCode: code, which: code, bubbles: true };
            target.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
            target.dispatchEvent(new KeyboardEvent('keypress', keyOpts));
            target.dispatchEvent(new KeyboardEvent('keyup', keyOpts));
        }
    }

    /* ================= 4. UNIFIED CANVAS SOLVER ================= */
    async function solveCanvasGame() {
        // 1. Kiểm tra Cocos2d-JS Engine
        const cocosScene = getCocosScene();
        if (cocosScene) {
            const cocosTexts = extractCocosTexts(cocosScene);
            if (cocosTexts.length > 0) {
                const rawStrings = cocosTexts.map(t => t.text);
                console.log('[YANZIOE Cocos] Scanned texts:', rawStrings);
                const questionText = rawStrings.join(' ');
                IOE.toast(`🎮 Bắt được Minigame Cocos2d: ${rawStrings[0]}`, 1500);

                const meta = await IOE.question?.solveQuestion(null, questionText, rawStrings);
                if (meta?.answer) {
                    const clickables = findCocosClickables(cocosScene);
                    for (const c of clickables) {
                        if (c.text.toLowerCase().includes(String(meta.answer).toLowerCase())) {
                            clickCocosNode(c.node);
                            IOE.toast(`⚡ Đã tự click đáp án: ${meta.answer}`, 1500);
                            return true;
                        }
                    }
                    typeCanvasString(String(meta.answer));
                    return true;
                }
            }
        }

        // 2. Kiểm tra CreateJS / EaselJS
        const { stage, root } = getStageAndRoot();
        if (root) {
            const texts = extractCreateJSTexts(root);
            if (texts.length > 0) {
                const fullText = texts.map(t => t.text).join(' ');
                const meta = await IOE.question?.solveQuestion(null, fullText, texts.map(t => t.text));
                if (meta?.answer) {
                    const clickables = findCreateJSClickables(root);
                    for (const c of clickables) {
                        if (c.label.toLowerCase().includes(String(meta.answer).toLowerCase())) {
                            clickCreateJS(c.obj, stage);
                            return true;
                        }
                    }
                    typeCanvasString(String(meta.answer));
                    return true;
                }
            }
        }

        return false;
    }

    IOE.canvas = {
        solveCanvasGame,
        getCocosScene,
        extractCocosTexts,
        findCocosClickables,
        clickCocosNode,
        extractCreateJSTexts,
        findCreateJSClickables,
        clickCreateJS,
        typeCanvasString
    };
})(typeof window !== 'undefined' ? window : globalThis);


/* --- functions/answerRevealer.js --- */
(function (global) {
    'use strict';
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const IOE = win.IOE || global.IOE;
    if (!IOE) return;

    const HUD_ID = 'yanzioe-revealer-hud';

    function ensureHud() {
        let hud = document.getElementById(HUD_ID);
        if (!hud && document.body) {
            hud = document.createElement('div');
            hud.id = HUD_ID;
            hud.style.cssText = `
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 9999999;
                background: rgba(15, 23, 42, 0.94);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(56, 189, 248, 0.45);
                border-radius: 8px;
                padding: 7px 12px;
                box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 12px;
                color: #f8fafc;
                min-width: 280px;
                max-width: 90vw;
                display: none;
                flex-direction: column;
                gap: 6px;
            `;
            document.body.appendChild(hud);
        }
        return hud;
    }

    function renderReveal(meta) {
        if (!meta || !IOE.features?.showAnswers || IOE.features?.streamMode) {
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
        hud.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                <div style="display:flex;align-items:center;gap:6px;min-width:0;cursor:pointer;" id="yanzioe-copy-area" title="Nhấn để sao chép">
                    <span style="background:#0284c7;color:#fff;padding:2px 7px;border-radius:5px;font-size:10.5px;font-weight:700;flex-shrink:0;">${safeTier}</span>
                    <span style="color:#f8fafc;word-break:break-word;"><strong>Đáp Án:</strong> ${safeAns}</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                    <button type="button" id="yanzioe-fill-btn" style="background:#38bdf8;color:#082f49;border:none;border-radius:5px;padding:3px 9px;font-weight:700;cursor:pointer;font-size:11.5px;">Fill</button>
                    <button type="button" id="yanzioe-copy-btn" style="background:#1e293b;color:#e2e8f0;border:1px solid rgba(56,189,248,0.45);border-radius:5px;padding:3px 8px;font-weight:700;cursor:pointer;font-size:11.5px;">Sao chép</button>
                    ${safeThink ? '<button type="button" id="yanzioe-think-btn" style="background:#4f46e5;color:#ffffff;border:none;border-radius:5px;padding:3px 8px;font-weight:700;cursor:pointer;font-size:11.5px;display:inline-flex;align-items:center;gap:3px;" title="Xem tư duy AI (0ms)">🧠 Suy nghĩ (0ms)</button>' : ''}
                </div>
            </div>
            ${safeThink ? `<div id="yanzioe-think-panel" style="display:none;width:100%;margin-top:4px;padding:8px 10px;background:rgba(15,23,42,0.92);border:1px solid rgba(99,102,241,0.45);border-radius:6px;font-size:11.5px;line-height:1.5;color:#e2e8f0;white-space:pre-wrap;word-break:break-word;">${safeThink}</div>` : ''}
        `;

        document.getElementById('yanzioe-fill-btn')?.addEventListener('click', () => {
            if (IOE.auto?.fillAnswer) IOE.auto.fillAnswer(meta.answer);
            if (IOE.canvas?.typeIntoCanvas) IOE.canvas.typeIntoCanvas(meta.answer);
        });

        const copyAction = () => {
            navigator.clipboard.writeText(meta.answer || '').then(() => {
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
            });
        }
    }

    IOE.events.on('questionSolved', renderReveal);
    IOE.revealer = { renderReveal };
})(typeof window !== 'undefined' ? window : globalThis);


/* --- functions/autoAnswer.js --- */
(function (global) {
    'use strict';
    const IOE = global.IOE;
    if (!IOE) return;

    let isProcessing = false;

    async function stepOnce() {
        if (isProcessing || !IOE.features?.autoAnswer) return;
        isProcessing = true;

        try {
            const qEl = document.querySelector('.question-content, .exam-content, .title-question, .content-question, #question-content');
            const qText = qEl ? qEl.innerText.trim() : '';

            const choiceEls = Array.from(document.querySelectorAll('.answer-item, .choice-item, input[type="radio"], .btn-answer, .item-answer'));
            const options = choiceEls.map(c => c.innerText.trim()).filter(Boolean);

            if (qText) {
                const qId = qEl.dataset?.id || qEl.id || qText.slice(0, 40);
                let meta = IOE.state.solvedMeta.get(qId);
                if (!meta) {
                    meta = await IOE.question.solveQuestion(qId, qText, options);
                }

                if (meta?.answer) {
                    fillAnswer(meta.answer);
                    if (IOE.features?.autoAnswer) {
                        await IOE.delay(IOE.featureConfigs?.autoDelay || 1200);
                        clickNextButton();
                    }
                }
            }
        } catch (e) {
            console.error('[IOE AutoAnswer Error]', e);
        } finally {
            isProcessing = false;
        }
    }

    function fillAnswer(ans, area = null) {
        if (!ans) return;
        const normAns = String(ans).trim().toLowerCase();
        const root = area || document;

        // 1. Dạng Sắp xếp từ (nếu có thẻ từ .word-item và đáp án là câu nhiều từ)
        const chips = Array.from(root.querySelectorAll('.word-item, .drag-item, .card-word, .item-reorder'));
        if (chips.length > 0 && normAns.includes(' ')) {
            const words = ans.split(/\s+/).map(w => w.toLowerCase().replace(/[^a-z0-9]/g, ''));
            words.forEach(targetWord => {
                const matchedChip = chips.find(chip => {
                    const cText = chip.innerText.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                    return cText === targetWord && !chip.dataset.kwClicked;
                });
                if (matchedChip) {
                    matchedChip.dataset.kwClicked = '1';
                    matchedChip.click();
                }
            });
            IOE.toast('🧩 Đã sắp xếp câu!', 1200);
            return;
        }

        // 2. Dạng Điền từ vào ô input
        const inputs = Array.from(root.querySelectorAll('input.blank-input, input[type="text"].answer, input.form-control, input.input-answer'));
        if (inputs.length > 0) {
            const inp = inputs.find(el => !el.value) || inputs[0];
            if (inp) {
                inp.value = ans;
                inp.dispatchEvent(new Event('input', { bubbles: true }));
                inp.dispatchEvent(new Event('change', { bubbles: true }));
                IOE.toast(`✍️ Đã điền: ${ans}`, 1000);
                return;
            }
        }

        // 3. Dạng Trắc nghiệm (Radio / Buttons A, B, C, D)
        const choices = Array.from(root.querySelectorAll('.answer-item, .choice-item, .btn-answer, .item-answer, input[type="radio"]'));
        if (choices.length > 0) {
            for (let i = 0; i < choices.length; i++) {
                const c = choices[i];
                const text = c.innerText.trim().toLowerCase();
                const letter = String.fromCharCode(65 + i).toLowerCase();
                if (normAns === letter || text.includes(normAns) || normAns.includes(text)) {
                    c.click();
                    IOE.toast(`🎯 Đã chọn: ${c.innerText.trim()}`, 1000);
                    return;
                }
            }
        }
    }

    function clickNextButton() {
        const nextBtns = Array.from(document.querySelectorAll('button, a, input[type="button"]')).filter(btn => {
            const t = (btn.innerText || btn.value || '').toLowerCase();
            return /(tiếp tục|câu tiếp|qua câu|nộp bài|xác nhận|next|submit)/.test(t) && !btn.disabled;
        });
        if (nextBtns.length > 0) {
            nextBtns[0].click();
            IOE.toast('⏩ Đã chuyển câu tiếp theo', 1000);
        }
    }

    setInterval(stepOnce, 2000);

    IOE.auto = {
        stepOnce,
        fillAnswer,
        clickNextButton
    };
})(typeof window !== 'undefined' ? window : globalThis);


/* --- visuals/mainMenu.js --- */
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
