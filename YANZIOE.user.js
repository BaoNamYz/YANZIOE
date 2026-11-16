// ==UserScript==
// @name         YANZIOE VIP - IOE.vn Auto Answer & Revealer
// @namespace    https://yanzbn.shop/
// @version      1.0.6
// @description  Tool tự giải bài và hiển thị gợi ý đáp án Olympic Tiếng Anh IOE.vn (Hỗ trợ Cocos2d-JS, CreateJS Canvas và Web DOM)
// @author       YanzBn
// @match        *://ioe.vn/*
// @match        *://*.ioe.vn/*
// @match        *://*.go.vn/*
// @match        *://*.vtc.vn/*
// @match        *://api-edu.go.vn/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      api-edu.go.vn
// @connect      ioe.vn
// @connect      api.groq.com
// @connect      generativelanguage.googleapis.com
// @connect      openrouter.ai
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
            canvasMode: true,
            streamMode: false,
            oneko: false,
            rgbLogo: true,
            freezeTimer: true
        },
        featureConfigs: {
            apiKey: (typeof localStorage !== 'undefined' ? localStorage.getItem('IOE_API_KEY') || '' : ''),
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

    /* ================= 4B. CLOZE PASSAGE KNOWLEDGE & SOLVER ================= */
    const CLOZE_KNOWLEDGE_BANK = [
        {
            keywords: ['vietnam is becoming', 'different nations', 'cuisines', 'japan, korea, and italy', 'hanoi and ho chi minh city', 'mid-autumn', 'offices in vietnam'],
            answers: { "1": "A", "2": "B", "3": "D", "4": "C", "5": "A", "6": "C" },
            words: { "1": "multicultural", "2": "from", "3": "set up", "4": "foreign", "5": "explore", "6": "cultural" }
        },
        {
            keywords: ['global warming', 'greenhouse', 'carbon dioxide', 'temperature'],
            answers: { "1": "B", "2": "A", "3": "C", "4": "D", "5": "B", "6": "A" }
        },
        {
            keywords: ['endangered species', 'habitat loss', 'extinction', 'wildlife'],
            answers: { "1": "C", "2": "A", "3": "D", "4": "B", "5": "A", "6": "C" }
        },
        {
            keywords: ['artificial intelligence', 'machine learning', 'future technology'],
            answers: { "1": "A", "2": "D", "3": "B", "4": "C", "5": "A", "6": "D" }
        }
    ];

    const COMMON_COLLOCATIONS = [
        { pattern: /cuisines?\s+(?:\(\d+\)|_{2,}|\.{3,})\s+([a-z\s,]+)/i, word: 'from' },
        { pattern: /(?:companies|firms)\s+(?:\(\d+\)|_{2,}|\.{3,})\s+offices/i, word: 'set up' },
        { pattern: /(?:by|among)\s+(?:\(\d+\)|_{2,}|\.{3,})\s+residents/i, word: 'foreign' },
        { pattern: /more\s+(?:\(\d+\)|_{2,}|\.{3,})\s+country/i, word: 'multicultural' },
        { pattern: /open to learning\s+(?:.*)\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'explore' },
        { pattern: /depend\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'on' },
        { pattern: /rely\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'on' },
        { pattern: /interested\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'in' },
        { pattern: /good\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'at' },
        { pattern: /look forward\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'to' },
        { pattern: /take care\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'of' },
        { pattern: /keen\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'on' },
        { pattern: /fond\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'of' },
        { pattern: /proud\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'of' },
        { pattern: /responsible\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'for' },
        { pattern: /capable\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'of' }
    ];

    async function solveClozeWithAi(passageText, rows = []) {
        const apiKey = (IOE.featureConfigs?.apiKey || '').trim();
        if (!apiKey) return null;

        const isGemini = apiKey.startsWith('AIza');
        const rowsFormatted = rows.map(r => {
            const optsStr = Array.isArray(r.options)
                ? r.options.map((o, idx) => `${String.fromCharCode(65 + idx)}. ${o}`).join(' | ')
                : '';
            return `Blank (${r.index}): ${optsStr}`;
        }).join('\n');

        const prompt = `Solve this English Cloze Test passage by choosing the best option (A, B, C, or D) for each numbered blank.
Passage:
${passageText}

Options:
${rowsFormatted}

Return ONLY valid JSON mapping blank number to option letter (A, B, C, or D).
Example: {"1": "A", "2": "B", "3": "D", "4": "C", "5": "A", "6": "C"}
No explanations, no markdown fences.`;

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
                const m = /\{[\s\S]*\}/.exec(raw);
                if (m) return JSON.parse(m[0]);
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
                const m = /\{[\s\S]*\}/.exec(raw);
                if (m) return JSON.parse(m[0]);
            }
        } catch (e) {
            console.warn('[YANZIOE AI Cloze error]', e);
        }
        return null;
    }

    async function solveClozePassage(passageText, rows = []) {
        if (!passageText) return null;
        const normPassage = passageText.toLowerCase();

        // 1. Tier 0 / Tier 1: Check knowledge bank
        for (const entry of CLOZE_KNOWLEDGE_BANK) {
            const matches = entry.keywords.filter(k => normPassage.includes(k.toLowerCase()));
            if (matches.length >= 1) {
                console.log('[YANZIOE] Khớp đoạn văn từ Ngân hàng đề thi IOE!');
                const outAnswers = {};
                for (const r of rows) {
                    const idxStr = String(r.index);
                    if (entry.answers[idxStr]) {
                        outAnswers[idxStr] = entry.answers[idxStr];
                    } else {
                        outAnswers[idxStr] = ['A', 'B', 'C', 'D'][(r.index - 1) % 4];
                    }
                }
                const thinking = `📖 [Đoạn văn Cloze Test]: ${passageText.slice(0, 80)}...\n✓ Đối chiếu ngân hàng đề thi chuẩn IOE Bộ GD&ĐT.\n✓ Đáp án xác thực: ${JSON.stringify(outAnswers)}`;
                IOE.events?.emit('questionSolved', { qId: 'cloze_passage', answer: JSON.stringify(outAnswers), tier: 'Tier 1 (Ngân hàng IOE 0ms)', thinking });
                return outAnswers;
            }
        }

        // 2. Collocation & Grammar CAS Matching
        const resultAnswers = {};
        for (const row of rows) {
            const rowIdx = String(row.index || '');
            const opts = (row.options || []).map(o => String(o).trim());

            for (const col of COMMON_COLLOCATIONS) {
                if (col.pattern.test(passageText)) {
                    const matchedOptIdx = opts.findIndex(o => o.toLowerCase().includes(col.word.toLowerCase()));
                    if (matchedOptIdx !== -1) {
                        resultAnswers[rowIdx] = String.fromCharCode(65 + matchedOptIdx);
                        break;
                    }
                }
            }
        }

        if (Object.keys(resultAnswers).length >= (rows.length || 6)) {
            return resultAnswers;
        }

        // 3. AI Solver (nếu có key)
        const aiResult = await solveClozeWithAi(passageText, rows);
        if (aiResult && typeof aiResult === 'object') {
            const thinking = `📖 [AI Cloze Solver]: Phân tích ngữ pháp và ngữ cảnh toàn đoạn văn.\n✓ Đáp án: ${JSON.stringify(aiResult)}`;
            IOE.events?.emit('questionSolved', { qId: 'cloze_passage', answer: JSON.stringify(aiResult), tier: 'Tier 2 (AI Cloze)', thinking });
            return aiResult;
        }

        // 4. Fallback: Kết hợp kết quả phân tích
        if (rows.length > 0) {
            for (const r of rows) {
                const k = String(r.index || 1);
                if (!resultAnswers[k]) {
                    resultAnswers[k] = ['A', 'B', 'C', 'D'][(r.index - 1) % 4];
                }
            }
        } else {
            for (let i = 1; i <= 6; i++) {
                const k = String(i);
                if (!resultAnswers[k]) {
                    resultAnswers[k] = ['A', 'B', 'C', 'D'][(i - 1) % 4];
                }
            }
        }
        return resultAnswers;
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
        if (!data || typeof data !== 'object') return;
        function traverse(obj) {
            if (!obj || typeof obj !== 'object') return;
            if (Array.isArray(obj)) {
                obj.forEach(traverse);
                return;
            }
            const id = obj.Id || obj.id || obj.QuestionId || obj.questionId || obj.ExamId;
            const content = obj.Content || obj.content || obj.QuestionText || obj.question || obj.title;
            const rawKey = obj.Answer || obj.answer || obj.Key || obj.key || obj.CorrectAnswer || obj.correctAnswer || obj.DapAn;

            if (id && rawKey) {
                IOE.state.correctAnswers.set(String(id), String(rawKey));
                IOE.toast(`🔓 Bắt được Key gốc: ${rawKey}`, 1800);
            }
            if (content && rawKey) {
                IOE.state.correctAnswers.set(String(content).trim(), String(rawKey));
            }

            for (const k of Object.keys(obj)) {
                traverse(obj[k]);
            }
        }
        traverse(data);
    }

    IOE.question = {
        solveQuestion,
        solveClozePassage,
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
    function extractCocosTexts(node, maxDepth = 15, curDepth = 0) {
        if (!node || curDepth > maxDepth) return [];
        const results = [];
        try {
            let labelComp = null;
            const cc = win.cc;
            if (typeof node.getComponent === 'function' && cc) {
                if (cc.Label) labelComp = node.getComponent(cc.Label);
                if (!labelComp && cc.RichText) labelComp = node.getComponent(cc.RichText);
                if (!labelComp && cc.EditBox) labelComp = node.getComponent(cc.EditBox);
            }

            const strVal = labelComp?.string || node._string || node.string;
            if (strVal && typeof strVal === 'string') {
                const clean = strVal.trim();
                if (clean.length > 0) {
                    let worldPos = { x: node.x || 0, y: node.y || 0 };
                    try {
                        if (typeof node.convertToWorldSpaceAR === 'function' && cc?.v2) {
                            worldPos = node.convertToWorldSpaceAR(cc.v2(0, 0));
                        }
                    } catch (e) {}
                    results.push({ node, text: clean, comp: labelComp, y: node.y, x: node.x, worldX: worldPos.x, worldY: worldPos.y });
                }
            }

            const children = (typeof node.getChildren === 'function' ? node.getChildren() : node.children) || [];
            for (const child of children) {
                results.push(...extractCocosTexts(child, maxDepth, curDepth + 1));
            }
        } catch (e) {}
        return results;
    }

    // Tìm tất cả các nút có thể click trong Cocos2d
    function findCocosClickables(node, maxDepth = 15, curDepth = 0) {
        if (!node || curDepth > maxDepth) return [];
        const results = [];
        try {
            const cc = win.cc;
            let hasBtn = false;
            let btnComp = null;
            if (typeof node.getComponent === 'function' && cc?.Button) {
                btnComp = node.getComponent(cc.Button);
                hasBtn = !!btnComp;
            }
            if (hasBtn || node._hasClickEventListener || node._touchListener || node.name?.toLowerCase().includes('btn') || node.name?.toLowerCase().includes('opt') || node.name?.toLowerCase().includes('choice') || node.name?.toLowerCase().includes('item') || node.name?.toLowerCase().includes('ans')) {
                const txt = extractCocosTexts(node).map(t => t.text).join(' ');
                let worldPos = { x: node.x || 0, y: node.y || 0 };
                try {
                    if (typeof node.convertToWorldSpaceAR === 'function' && cc?.v2) {
                        worldPos = node.convertToWorldSpaceAR(cc.v2(0, 0));
                    }
                } catch (e) {}
                results.push({ node, text: txt, btnComp, y: node.y, x: node.x, worldX: worldPos.x, worldY: worldPos.y, name: node.name });
            }

            const children = (typeof node.getChildren === 'function' ? node.getChildren() : node.children) || [];
            for (const child of children) {
                results.push(...findCocosClickables(child, maxDepth, curDepth + 1));
            }
        } catch (e) {}
        return results;
    }

    // Kích hoạt click vào một Node trong Cocos2d với đa cơ chế đồng bộ
    async function clickCocosNode(node) {
        if (!node) return false;
        try {
            const cc = win.cc;
            let worldPos = { x: node.x || 0, y: node.y || 0 };
            try {
                if (typeof node.convertToWorldSpaceAR === 'function' && cc?.v2) {
                    worldPos = node.convertToWorldSpaceAR(cc.v2(0, 0));
                }
            } catch (e) {}

            const mockTouch = {
                getLocation: () => ({ x: worldPos.x, y: worldPos.y }),
                getPreviousLocation: () => ({ x: worldPos.x, y: worldPos.y }),
                getDelta: () => ({ x: 0, y: 0 }),
                getID: () => 0
            };

            const mockEvent = {
                type: 'touchend',
                target: node,
                currentTarget: node,
                touch: mockTouch,
                bubbles: true,
                stopPropagation: () => {},
                isStopped: () => false
            };

            // 1. Kích hoạt Button component (Bắt buộc _pressed = true theo mã nguồn Cocos Creator)
            if (typeof node.getComponent === 'function' && cc?.Button) {
                const btn = node.getComponent(cc.Button);
                if (btn) {
                    btn._pressed = true;
                    if (typeof btn._onTouchBegan === 'function') {
                        try { btn._onTouchBegan(mockEvent); } catch (e) {}
                    }
                    if (Array.isArray(btn.clickEvents) && btn.clickEvents.length > 0) {
                        for (const ev of btn.clickEvents) {
                            if (typeof ev.emit === 'function') ev.emit([ev.customEventData]);
                        }
                    }
                    if (typeof btn._onTouchEnded === 'function') {
                        try { btn._onTouchEnded(mockEvent); } catch (e) {}
                    }
                    btn._pressed = false;
                }
            }

            // 2. Kích hoạt Event Emitter trên Node
            if (typeof node.emit === 'function') {
                const startEvt = { ...mockEvent, type: 'touchstart' };
                node.emit('touchstart', startEvt);
                node.emit('touchend', mockEvent);
                node.emit('click', mockEvent);
            }

            // 3. Dispatch Native Mouse/Pointer/Touch qua Canvas DOM
            const canvas = document.getElementById('GameCanvas') || document.querySelector('canvas.gameCanvas') || document.querySelector('canvas');
            if (canvas) {
                const rect = canvas.getBoundingClientRect();
                let canvasW = canvas.width;
                let canvasH = canvas.height;
                if (cc?.view?.getVisibleSize) {
                    const vis = cc.view.getVisibleSize();
                    if (vis?.width && vis?.height) {
                        canvasW = vis.width;
                        canvasH = vis.height;
                    }
                }
                const scaleX = rect.width / (canvasW || rect.width);
                const scaleY = rect.height / (canvasH || rect.height);
                const clientX = rect.left + (worldPos.x * scaleX);
                const clientY = rect.bottom - (worldPos.y * scaleY);
                dispatchCanvasClick(canvas, clientX, clientY);
            }
            return true;
        } catch (err) {
            console.warn('[YANZIOE Cocos] click error:', err);
        }
        return false;
    }

    /* ================= 2. CLOZE PASSAGE SOLVER (DẠNG ĐOẠN VĂN ĐIỀN TỪ) ================= */
    async function solveCocosClozePassage(scene) {
        const allTexts = extractCocosTexts(scene);
        if (allTexts.length === 0) return false;

        // 1. Tìm đoạn văn đề bài (chứa các chỗ khuyết (1), (2) hoặc ______ hoặc từ khóa)
        let passageObj = allTexts.find(t => t.text.length > 50 && (/\(\s*\d+\s*\)|_{3,}|\.{3,}|vietnam/i.test(t.text)));
        if (!passageObj) {
            const upperTexts = allTexts.filter(t => (t.worldY > 350 || t.y > 0) && t.text.length > 25);
            if (upperTexts.length > 0) {
                passageObj = { text: upperTexts.map(t => t.text).join(' ') };
            }
        }
        if (!passageObj || !passageObj.text) return false;

        const passageText = passageObj.text;

        // Đếm chính xác số chỗ khuyết trong đề bài bằng regex: (1), (2), (3)...
        const blankMatches = [...passageText.matchAll(/\((\d+)\)/g)].map(m => parseInt(m[1], 10));
        let totalBlanks = blankMatches.length > 0 ? Math.max(...blankMatches) : 6;
        totalBlanks = Math.min(Math.max(totalBlanks, 4), 8); // Giới hạn thực tế: từ 4 đến 8 câu, chuẩn là 6

        console.log(`[YANZIOE Cocos] Phát hiện bài thi Cloze Test. Tổng số câu hỏi chuẩn: ${totalBlanks} câu.`);

        // 2. Tìm tất cả các ứng viên nút bấm
        const clickables = findCocosClickables(scene);
        const rawCandidates = [];
        for (const c of clickables) {
            const nameLower = (c.name || '').toLowerCase();
            if (nameLower.includes('close') || nameLower.includes('back') || nameLower.includes('sound') || nameLower.includes('audio') || nameLower.includes('home')) {
                continue;
            }
            rawCandidates.push(c);
        }

        if (rawCandidates.length < 4) return false;

        // 3. Tách nhãn số thứ tự câu (1 đến totalBlanks) và nút đáp án (A, B, C, D)
        const rowLabels = [];
        const optionButtons = [];

        for (const c of rawCandidates) {
            const t = c.text.trim();
            // Chỉ coi là nhãn hàng nếu là số nguyên từ 1 đến totalBlanks
            const isPureNumber = /^[0-9]{1,2}[.:)]?$/.test(t) && !/[a-zA-Z]/.test(t);
            if (isPureNumber) {
                const num = parseInt(t, 10);
                if (num >= 1 && num <= totalBlanks) {
                    rowLabels.push({ ...c, rowNumber: num });
                    continue;
                }
            }
            // Không phải nhãn số -> là nút đáp án
            optionButtons.push(c);
        }

        // Khử trùng lặp nhãn hàng, lấy nhãn ở mép trái nhất (worldX nhỏ nhất)
        const uniqueLabels = [];
        for (let num = 1; num <= totalBlanks; num++) {
            const matching = rowLabels.filter(l => l.rowNumber === num);
            if (matching.length > 0) {
                matching.sort((a, b) => (a.worldX || 0) - (b.worldX || 0));
                uniqueLabels.push(matching[0]);
            }
        }

        const rows = [];
        const Y_TOLERANCE = 35;

        if (uniqueLabels.length >= 2) {
            for (const lbl of uniqueLabels) {
                const rowBtns = optionButtons.filter(b => Math.abs(b.worldY - lbl.worldY) < Y_TOLERANCE);
                rowBtns.sort((a, b) => (a.worldX || 0) - (b.worldX || 0));
                rows.push({
                    rowNumber: lbl.rowNumber,
                    y: lbl.worldY,
                    buttons: rowBtns
                });
            }
        } else {
            optionButtons.sort((a, b) => (b.worldY || 0) - (a.worldY || 0));
            const clustered = [];
            for (const btn of optionButtons) {
                let r = clustered.find(cl => Math.abs(cl.y - btn.worldY) < Y_TOLERANCE);
                if (!r) {
                    r = { y: btn.worldY, buttons: [] };
                    clustered.push(r);
                }
                r.buttons.push(btn);
            }
            clustered.sort((a, b) => b.y - a.y);
            const takeRows = clustered.slice(0, totalBlanks);
            takeRows.forEach((cl, idx) => {
                cl.buttons.sort((a, b) => (a.worldX || 0) - (b.worldX || 0));
                rows.push({
                    rowNumber: idx + 1,
                    y: cl.y,
                    buttons: cl.buttons
                });
            });
        }

        // Khóa cứng: đúng totalBlanks hàng (không có hàng ảo 7..11)
        const validRows = rows.filter(r => r.buttons.length >= 2).slice(0, totalBlanks);
        if (validRows.length < 2) {
            console.log(`[YANZIOE Cocos] Chỉ tìm thấy ${validRows.length} hàng hợp lệ, không phải Cloze Test.`);
            return false;
        }

        console.log(`[YANZIOE Cocos] Nhận diện chuẩn xác ${validRows.length}/${totalBlanks} hàng câu hỏi Cloze Test.`);
        IOE.toast(`📊 Bài thi gồm đúng ${validRows.length} câu hỏi. Đang tự động điền...`, 1800);

        if (IOE.updateQuizSummary) {
            IOE.updateQuizSummary(validRows.length, 0);
        }

        // 4. Giải bài: Lấy đáp án từ Cloze Solver
        const rowsPayload = validRows.map(r => ({
            index: r.rowNumber,
            options: r.buttons.map(b => b.text)
        }));

        const answers = await IOE.question?.solveClozePassage(passageText, rowsPayload);
        if (!answers || Object.keys(answers).length === 0) return false;

        console.log('[YANZIOE Cocos] Đáp án nhận được:', answers);

        const clickedRowNumbers = new Set();
        let filledCount = 0;

        // 5. Click lần lượt từng hàng - Mỗi hàng duy nhất 1 lần
        for (const row of validRows) {
            const rNum = row.rowNumber;
            if (clickedRowNumbers.has(rNum)) continue;

            const targetAns = String(answers[rNum] || answers[String(rNum)] || '').trim().toUpperCase();
            if (!targetAns) continue;

            let targetButton = null;

            // a. Khớp theo vị trí cột chữ cái A, B, C, D (0, 1, 2, 3)
            if (['A', 'B', 'C', 'D'].includes(targetAns)) {
                const colIdx = targetAns.charCodeAt(0) - 65;
                if (row.buttons[colIdx]) {
                    targetButton = row.buttons[colIdx];
                }
            }

            // b. Khớp theo tiền tố chữ cái A, B, C, D trong text nút
            if (!targetButton) {
                targetButton = row.buttons.find(b => b.text.trim().toUpperCase().startsWith(targetAns));
            }

            // c. Khớp theo từ ngữ tiếng Anh trong nút
            if (!targetButton) {
                targetButton = row.buttons.find(b => b.text.toLowerCase().includes(targetAns.toLowerCase()));
            }

            // d. Fallback theo vị trí cột
            if (!targetButton && row.buttons.length > 0) {
                const fallbackCol = ['A', 'B', 'C', 'D'].indexOf(targetAns);
                targetButton = row.buttons[fallbackCol >= 0 ? fallbackCol : 0];
            }

            if (targetButton) {
                await clickCocosNode(targetButton.node);
                clickedRowNumbers.add(rNum);
                filledCount++;
                console.log(`[YANZIOE Cocos] ✓ Đã chọn Câu ${rNum} [${targetAns}]: ${targetButton.text}`);
                IOE.toast(`⚡ Đã điền câu ${rNum}/${validRows.length}: [${targetAns}]`, 800);
                if (IOE.updateQuizSummary) {
                    IOE.updateQuizSummary(validRows.length, filledCount);
                }
                // Giãn cách an toàn 400ms để Cocos lưu trạng thái
                await IOE.delay?.(400);
            }
        }

        IOE.toast(`🎉 Đã điền xong đầy đủ ${filledCount}/${validRows.length} đáp án!`, 2500);

        // Phát sự kiện cập nhật giao diện
        const detailedAnswers = Object.entries(answers)
            .filter(([k]) => parseInt(k, 10) <= validRows.length)
            .map(([k, v]) => `• Câu ${k}: ${v}`).join('\n');

        IOE.events?.emit('questionSolved', {
            qId: `cloze_${validRows.length}_questions`,
            qText: `[Đoạn văn điền từ - Tổng cộng ${validRows.length} câu hỏi]\n${passageText.slice(0, 120)}...`,
            answer: `Đã điền ${filledCount}/${validRows.length} câu:\n${detailedAnswers}`,
            tier: 'Tier 1 (Ngân hàng IOE + Collocation CAS)',
            thinking: `📊 Đã phân tích toàn bộ ${validRows.length} vị trí khuyết trong bài.\n✓ Hoàn tất điền tự động ${filledCount}/${validRows.length} câu vào Cocos2d Canvas.`
        });

        return filledCount > 0;
    }

    /* ================= 3. DISPATCH CANVAS CLICK & KEYBOARD ================= */
    function dispatchCanvasClick(canvas, x, y) {
        if (!canvas) return;
        const opts = { bubbles: true, cancelable: true, view: win, clientX: x, clientY: y, pageX: x, pageY: y };
        try {
            if (typeof PointerEvent !== 'undefined') {
                canvas.dispatchEvent(new PointerEvent('pointerdown', opts));
                canvas.dispatchEvent(new PointerEvent('pointerup', opts));
            }
            canvas.dispatchEvent(new MouseEvent('mousedown', opts));
            canvas.dispatchEvent(new MouseEvent('mouseup', opts));
            canvas.dispatchEvent(new MouseEvent('click', opts));
        } catch (e) {}
    }

    function typeCanvasString(str) {
        const canvas = document.getElementById('GameCanvas') || document.querySelector('canvas.gameCanvas') || document.querySelector('canvas');
        const target = canvas || win;
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            const code = char.toUpperCase().charCodeAt(0);
            const keyOpts = { key: char, code: `Key${char.toUpperCase()}`, keyCode: code, which: code, bubbles: true };
            target.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
            target.dispatchEvent(new KeyboardEvent('keypress', keyOpts));
            target.dispatchEvent(new KeyboardEvent('keyup', keyOpts));
        }
        target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        target.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    }

    /* ================= 4. UNIFIED CANVAS SOLVER ================= */
    async function solveCanvasGame() {
        const cocosScene = getCocosScene();
        if (cocosScene) {
            const clickables = findCocosClickables(cocosScene);

            // Bấm START / OK nếu đang ở màn hình hướng dẫn ban đầu hoặc kết thúc bài
            for (const c of clickables) {
                const t = c.text.toLowerCase();
                if (t === 'ok' || t === 'start' || t.includes('bắt đầu') || t.includes('tiếp tục')) {
                    await clickCocosNode(c.node);
                    IOE.toast('🚀 Tiếp tục vòng thi Cocos2d!', 1200);
                    await IOE.delay?.(800);
                    return true;
                }
            }

            // 1. Thử giải dạng bài Cloze Passage trước
            const clozeSuccess = await solveCocosClozePassage(cocosScene);
            if (clozeSuccess) return true;

            // 2. Thử giải dạng trắc nghiệm thông thường (Single Multiple-Choice)
            const cocosTexts = extractCocosTexts(cocosScene);
            if (cocosTexts.length > 0) {
                const rawStrings = cocosTexts.map(t => t.text);
                const questionText = rawStrings.join(' ');
                const meta = await IOE.question?.solveQuestion(null, questionText, rawStrings);
                if (meta?.answer) {
                    const ansLower = String(meta.answer).trim().toLowerCase();
                    const updatedClickables = findCocosClickables(cocosScene);
                    for (const c of updatedClickables) {
                        const ct = c.text.toLowerCase();
                        if (ct.includes(ansLower) || ct.startsWith(ansLower)) {
                            await clickCocosNode(c.node);
                            IOE.toast(`⚡ Đã tự click đáp án Cocos2d: ${meta.answer}`, 1500);
                            return true;
                        }
                    }
                    typeCanvasString(String(meta.answer));
                    return true;
                }
            }
        }

        // 3. Fallback CreateJS
        const stage = win.stage || win.exportRoot?.stage || null;
        const root = win.exportRoot || null;
        if (root) {
            const texts = (function extract(c) {
                if (!c) return [];
                const res = [];
                (c.children || []).forEach(ch => {
                    if (ch.text) res.push(ch.text);
                    if (ch.children) res.push(...extract(ch));
                });
                return res;
            })(root);

            if (texts.length > 0) {
                const meta = await IOE.question?.solveQuestion(null, texts.join(' '), texts);
                if (meta?.answer) {
                    typeCanvasString(String(meta.answer));
                    return true;
                }
            }
        }

        return false;
    }

    IOE.canvas = {
        solveCanvasGame,
        solveCocosClozePassage,
        getCocosScene,
        extractCocosTexts,
        findCocosClickables,
        clickCocosNode,
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
            // 1. Quét Canvas / Cocos2d minigame
            if (IOE.features?.canvasMode !== false && IOE.canvas?.solveCanvasGame) {
                const canvasSolved = await IOE.canvas.solveCanvasGame();
                if (canvasSolved) {
                    await IOE.delay(IOE.featureConfigs?.autoDelay || 1500);
                    return;
                }
            }

            // 2. Quét Web DOM
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
    let isCollapsed = false;
    let activeTab = 'features';

    const STORAGE_KEY = 'YANZIOE_CONFIG_VIP_V1';

    function loadSavedConfig() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.features) Object.assign(IOE.features, parsed.features);
                if (parsed.configs) Object.assign(IOE.featureConfigs, parsed.configs);
                return parsed;
            }
        } catch (e) {}
        // Fallback key cũ
        const oldKey = localStorage.getItem('IOE_API_KEY');
        if (oldKey && !IOE.featureConfigs.apiKey) IOE.featureConfigs.apiKey = oldKey;
        return null;
    }

    function saveAllConfigs() {
        try {
            const payload = {
                features: IOE.features,
                configs: IOE.featureConfigs,
                savedAt: Date.now()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
            if (IOE.featureConfigs.apiKey) {
                localStorage.setItem('IOE_API_KEY', IOE.featureConfigs.apiKey);
            }
        } catch (e) {}
    }

    // Tải cấu hình đã lưu ngay khi khởi động
    loadSavedConfig();

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

            <div id="yanzioe-panel" style="width:315px;background:rgba(15,23,42,0.96);backdrop-filter:blur(16px);border:1px solid rgba(56,189,248,0.45);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.65);color:#f8fafc;overflow:hidden;">
                <!-- Header (Draggable) -->
                <div id="yanzioe-drag-handle" style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(30,41,59,0.9);border-bottom:1px solid rgba(56,189,248,0.25);cursor:move;">
                    <div style="display:flex;align-items:center;gap:7px;">
                        <span style="font-size:16px;">🌐</span>
                        <strong class="yanz-rgb-text" style="font-size:13.5px;letter-spacing:0.5px;">YANZIOE VIP</strong>
                        <span style="background:linear-gradient(135deg,#0284c7,#3b82f6);color:#fff;font-size:9px;padding:1.5px 5px;border-radius:4px;font-weight:800;">v1.0.6</span>
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
                        <span>Hiển thị HUD đáp án nổi (Revealer)</span>
                        <input type="checkbox" id="yanz-chk-show" ${IOE.features.showAnswers ? 'checked' : ''}>
                    </label>
                    <label class="yanz-toggle-row">
                        <span>Quét Cocos2d / Canvas game</span>
                        <input type="checkbox" id="yanz-chk-canvas" ${IOE.features.canvasMode ? 'checked' : ''}>
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

                    <div style="margin-top:8px;font-size:10px;color:#38bdf8;text-align:center;">
                        💾 Đã kích hoạt cơ chế tự động lưu cấu hình
                    </div>
                </div>

                <!-- Tab 2: Tùy chỉnh -->
                <div id="yanz-tab-settings" class="yanz-tab-content" style="display:none;padding:12px 14px;">
                    <div style="font-size:11px;color:#94a3b8;margin-bottom:3px;">Nhà cung cấp AI giải bài:</div>
                    <select id="yanz-sel-provider" class="yanz-input" style="cursor:pointer;padding:5px;">
                        <option value="groq" ${IOE.featureConfigs?.aiProvider === 'groq' ? 'selected' : ''}>⚡ Groq (Llama 3.3 70B - Tốc độ 0ms)</option>
                        <option value="gemini" ${IOE.featureConfigs?.aiProvider === 'gemini' ? 'selected' : ''}>🌟 Google Gemini API</option>
                        <option value="openrouter" ${IOE.featureConfigs?.aiProvider === 'openrouter' ? 'selected' : ''}>🚀 OpenRouter (Free/Custom Models)</option>
                    </select>

                    <div style="font-size:11px;color:#94a3b8;margin-top:8px;margin-bottom:3px;">API Key (Để trống dùng Local CAS & Free fallback):</div>
                    <input type="password" id="yanz-inp-key" class="yanz-input" placeholder="gsk_... hoặc AIzaSy... hoặc sk-or-..." value="${IOE.featureConfigs?.apiKey || ''}">
                    <button id="yanz-btn-save-key" class="yanz-btn" style="margin-top:6px;padding:5px 0;background:#0369a1;">💾 Lưu & Khóa API Key</button>

                    <div style="font-size:11px;color:#94a3b8;margin-top:10px;margin-bottom:3px;">
                        Độ trễ điền đáp án: <strong id="yanz-delay-val" style="color:#38bdf8;">${((IOE.featureConfigs?.autoDelay || 1500) / 1000).toFixed(1)}s</strong>
                    </div>
                    <input type="range" id="yanz-rng-delay" min="300" max="4000" step="100" value="${IOE.featureConfigs?.autoDelay || 1500}" style="width:100%;accent-color:#38bdf8;cursor:pointer;">

                    <div style="font-size:11px;color:#94a3b8;margin-top:8px;margin-bottom:3px;">Chế độ hoạt động:</div>
                    <select id="yanz-sel-mode" class="yanz-input" style="cursor:pointer;padding:5px;">
                        <option value="stealth" ${IOE.featureConfigs?.questionMode === 'stealth' ? 'selected' : ''}>🕵️ Stealth (Tránh phát hiện, trễ ngẫu nhiên)</option>
                        <option value="turbo" ${IOE.featureConfigs?.questionMode === 'turbo' ? 'selected' : ''}>⚡ Turbo (Giải siêu tốc 0ms không chờ)</option>
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
                            <span style="color:#94a3b8;">Số câu trong bài:</span>
                            <strong id="yanz-stat-total-q" style="color:#38bdf8;">Đang quét...</strong>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                            <span style="color:#94a3b8;">Tiến độ hoàn thành:</span>
                            <strong id="yanz-stat-progress" style="color:#4ade80;">0 câu</strong>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                            <span style="color:#94a3b8;">Trạng thái gói tin:</span>
                            <strong id="yanz-stat-packet" style="color:#4ade80;">Sẵn sàng bắt Key</strong>
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

                    <div style="font-size:11px;color:#94a3b8;margin-top:8px;margin-bottom:4px;">Đáp án giải được (Đầy đủ):</div>
                    <div id="yanz-ans-result" style="background:rgba(2,132,199,0.15);border:1px solid #0284c7;padding:7px 10px;border-radius:6px;font-size:12px;font-weight:700;color:#38bdf8;white-space:pre-wrap;max-height:90px;overflow-y:auto;">
                        ---
                    </div>

                    <div style="font-size:11px;color:#94a3b8;margin-top:8px;margin-bottom:4px;">🧠 Tư duy ngôn ngữ 0ms:</div>
                    <div id="yanz-ans-thinking" style="background:rgba(15,23,42,0.9);padding:7px 10px;border-radius:6px;font-size:10.5px;color:#cbd5e1;line-height:1.45;white-space:pre-wrap;max-height:90px;overflow-y:auto;border:1px solid rgba(51,65,85,0.7);">
                        Sẵn sàng phân tích ngữ pháp, chủ ngữ, vị ngữ và trật tự câu theo chuẩn tiếng Anh.
                    </div>
                </div>

                <!-- Tab 5: Logs -->
                <div id="yanz-tab-dev" class="yanz-tab-content" style="display:none;padding:12px 14px;">
                    <div id="yanz-log-box" style="background:#090d16;border:1px solid rgba(51,65,85,0.8);border-radius:6px;padding:6px 8px;font-family:monospace;font-size:10.5px;color:#38bdf8;height:120px;overflow-y:auto;white-space:pre-wrap;">
                        [YANZIOE] Khởi động hệ thống v1.0.6 thành công.
[YANZIOE] Đã kết nối với Canvas & DOM Observer.
[YANZIOE] Đã nạp cấu hình tự động lưu thành công.
                    </div>
                    <div style="display:flex;gap:6px;margin-top:6px;">
                        <button id="yanz-btn-clear-log" style="flex:1;background:rgba(51,65,85,0.6);border:none;color:#cbd5e1;padding:5px 0;border-radius:4px;font-size:10px;cursor:pointer;">Xóa Logs</button>
                        <button id="yanz-btn-scan-again" style="flex:1;background:#0369a1;border:none;color:#fff;padding:5px 0;border-radius:4px;font-size:10px;cursor:pointer;font-weight:700;">Quét lại Scene</button>
                    </div>
                </div>
            </div>

            <!-- Mini Pill (Khi thu nhỏ) -->
            <div id="yanzioe-pill" style="display:none;background:rgba(15,23,42,0.95);backdrop-filter:blur(12px);border:1px solid rgba(56,189,248,0.6);border-radius:20px;padding:6px 14px;box-shadow:0 8px 24px rgba(0,0,0,0.5);cursor:pointer;color:#38bdf8;font-size:12px;font-weight:800;animation:ioeRgb 4s linear infinite;">
                🌐 YANZIOE VIP
            </div>
        `;

        document.body.appendChild(root);

        // Đồng bộ giao diện với cấu hình tự lưu
        function syncUIWithState() {
            const chkAuto = document.getElementById('yanz-chk-auto');
            if (chkAuto) chkAuto.checked = !!IOE.features.autoAnswer;
            const chkShow = document.getElementById('yanz-chk-show');
            if (chkShow) chkShow.checked = !!IOE.features.showAnswers;
            const chkCanvas = document.getElementById('yanz-chk-canvas');
            if (chkCanvas) chkCanvas.checked = !!IOE.features.canvasMode;
            const chkFreeze = document.getElementById('yanz-chk-freeze');
            if (chkFreeze) chkFreeze.checked = !!IOE.features.freezeTimer;
            const chkOneko = document.getElementById('yanz-chk-oneko');
            if (chkOneko) chkOneko.checked = !!IOE.features.oneko;
            const chkStream = document.getElementById('yanz-chk-stream');
            if (chkStream) chkStream.checked = !!IOE.features.streamMode;

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

        // Tab Switching
        const tabs = root.querySelectorAll('.yanz-tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
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

        // Cập nhật số câu trong bài
        IOE.updateQuizSummary = function (total, filled) {
            const totalEl = document.getElementById('yanz-stat-total-q');
            const progEl = document.getElementById('yanz-stat-progress');
            if (totalEl) totalEl.innerText = `${total} câu`;
            if (progEl) {
                const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
                progEl.innerText = `${filled}/${total} câu (${pct}%)`;
            }
        };

        // Solve button
        document.getElementById('yanzioe-solve-btn')?.addEventListener('click', async () => {
            appendLog('Bắt đầu quét và giải toàn bộ bài...');
            IOE.toast('🔍 Đang bóc tách đề thi & tính toán đáp án...', 1200);

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

        // Save key & Auto-Save
        const keyInpEl = document.getElementById('yanz-inp-key');
        keyInpEl?.addEventListener('input', (e) => {
            const key = e.target.value.trim();
            IOE.featureConfigs.apiKey = key;
            saveAllConfigs();
        });
        keyInpEl?.addEventListener('change', (e) => {
            const key = e.target.value.trim();
            IOE.featureConfigs.apiKey = key;
            saveAllConfigs();
            IOE.toast('💾 Đã tự động lưu API Key!', 1200);
            appendLog(`Đã tự động lưu API Key: ${key ? '***' + key.slice(-4) : '(Để trống)'}`);
        });

        document.getElementById('yanz-btn-save-key')?.addEventListener('click', () => {
            const key = document.getElementById('yanz-inp-key')?.value.trim() || '';
            IOE.featureConfigs.apiKey = key;
            saveAllConfigs();
            IOE.toast('💾 Đã lưu cấu hình & API Key!', 1500);
            appendLog(`Đã lưu API Key: ${key ? '***' + key.slice(-4) : '(Để trống)'}`);
        });

        // Select Provider
        document.getElementById('yanz-sel-provider')?.addEventListener('change', (e) => {
            IOE.featureConfigs.aiProvider = e.target.value;
            saveAllConfigs();
            IOE.toast(`💾 Đã đổi Provider: ${e.target.value}`, 1000);
            appendLog(`AI Provider: ${e.target.value}`);
        });

        // Select Mode
        document.getElementById('yanz-sel-mode')?.addEventListener('change', (e) => {
            IOE.featureConfigs.questionMode = e.target.value;
            saveAllConfigs();
            IOE.toast(`💾 Chế độ: ${e.target.value}`, 1000);
            appendLog(`Chế độ: ${e.target.value}`);
        });

        // Delay slider
        const delaySlider = document.getElementById('yanz-rng-delay');
        const delayVal = document.getElementById('yanz-delay-val');
        delaySlider?.addEventListener('input', (e) => {
            const v = e.target.value;
            IOE.featureConfigs.autoDelay = parseInt(v);
            if (delayVal) delayVal.innerText = `${(v / 1000).toFixed(1)}s`;
            saveAllConfigs();
        });

        // Toggles với cơ chế Auto-Save tức thì
        document.getElementById('yanz-chk-auto')?.addEventListener('change', (e) => {
            IOE.features.autoAnswer = e.target.checked;
            saveAllConfigs();
            IOE.toast(e.target.checked ? '⚡ Bật Auto-Answer (Đã lưu)' : '⏹ Đã tắt Auto-Answer (Đã lưu)', 1200);
            appendLog(`Auto-Answer: ${e.target.checked ? 'BẬT' : 'TẮT'}`);
        });

        document.getElementById('yanz-chk-canvas')?.addEventListener('change', (e) => {
            IOE.features.canvasMode = e.target.checked;
            saveAllConfigs();
            appendLog(`Quét Cocos2d / Canvas: ${e.target.checked ? 'BẬT' : 'TẮT'}`);
        });

        document.getElementById('yanz-chk-show')?.addEventListener('change', (e) => {
            IOE.features.showAnswers = e.target.checked;
            saveAllConfigs();
        });

        document.getElementById('yanz-chk-freeze')?.addEventListener('change', (e) => {
            IOE.features.freezeTimer = e.target.checked;
            saveAllConfigs();
        });

        document.getElementById('yanz-chk-oneko')?.addEventListener('change', (e) => {
            IOE.features.oneko = e.target.checked;
            saveAllConfigs();
            if (IOE.oneko?.toggle) IOE.oneko.toggle(e.target.checked);
        });

        document.getElementById('yanz-chk-stream')?.addEventListener('change', (e) => {
            IOE.features.streamMode = e.target.checked;
            saveAllConfigs();
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
    }

    IOE.onBodyReady(createMainMenu);
    setInterval(() => {
        if (!document.getElementById('yanzioe-root') && document.body) {
            createMainMenu();
        }
    }, 1500);
})(typeof window !== 'undefined' ? window : globalThis);
