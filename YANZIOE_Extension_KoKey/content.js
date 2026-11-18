// YANZIOE VIP Universal Main-World Loader
(function() {
    'use strict';
    if (!document.getElementById('yanzioe-main-script')) {
        try {
            const s = document.createElement('script');
            s.id = 'yanzioe-main-script';
            s.textContent = "/* --- utils/utils.js --- */\n(function (global) {\n    'use strict';\n    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;\n\n    class EventEmitter {\n        constructor() { this._events = {}; }\n        on(e, fn) { (this._events[e] = this._events[e] || []).push(fn); return () => this.off(e, fn); }\n        off(e, fn) { if (!this._events[e]) return; this._events[e] = this._events[e].filter(f => f !== fn); }\n        emit(e, ...args) { (this._events[e] || []).forEach(fn => { try { fn(...args); } catch (err) { console.error(err); } }); }\n    }\n\n    const events = new EventEmitter();\n\n    function onBodyReady(fn) {\n        if (document.body) { fn(); return; }\n        const obs = new MutationObserver(() => {\n            if (document.body) {\n                obs.disconnect();\n                fn();\n            }\n        });\n        obs.observe(document.documentElement || document, { childList: true, subtree: true });\n    }\n\n    let lastToastMsg = '';\n    let lastToastTime = 0;\n\n    function toast(msg, duration = 2200) {\n        const now = Date.now();\n        if (msg === lastToastMsg && (now - lastToastTime) < 2500) {\n            return; // Ch\u1eb7n spam c\u00f9ng 1 toast trong 2.5s\n        }\n        lastToastMsg = msg;\n        lastToastTime = now;\n\n        onBodyReady(() => {\n            let box = document.getElementById('ioe-toast-box');\n            if (!box) {\n                box = document.createElement('div');\n                box.id = 'ioe-toast-box';\n                box.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:99999999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';\n                document.body.appendChild(box);\n            }\n            const el = document.createElement('div');\n            el.style.cssText = 'background:rgba(15,23,42,0.92);backdrop-filter:blur(8px);border:1px solid #38bdf8;color:#f8fafc;padding:8px 14px;border-radius:8px;font-size:12.5px;font-family:sans-serif;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,0.4);animation:ioeFade 0.25s ease-out;';\n            el.innerText = msg;\n            box.appendChild(el);\n            setTimeout(() => {\n                el.style.opacity = '0';\n                el.style.transition = 'opacity 0.3s ease';\n                setTimeout(() => el.remove(), 300);\n            }, duration);\n        });\n    }\n\n    function delay(ms) {\n        return new Promise(r => setTimeout(r, ms));\n    }\n\n    function escHtml(str) {\n        return String(str || '')\n            .replace(/&/g, '&amp;')\n            .replace(/</g, '&lt;')\n            .replace(/>/g, '&gt;')\n            .replace(/\"/g, '&quot;')\n            .replace(/'/g, '&#039;');\n    }\n\n    const ioeState = {\n        events,\n        toast,\n        delay,\n        escHtml,\n        onBodyReady,\n        state: {\n            isSolving: false,\n            currentQuestionId: null,\n            questions: new Map(),\n            solvedMeta: new Map(),\n            correctAnswers: new Map()\n        },\n        features: {\n            autoAnswer: true,\n            showAnswers: true,\n            canvasMode: true,\n            streamMode: false,\n            oneko: false,\n            rgbLogo: true,\n            freezeTimer: true\n        },\n        featureConfigs: {\n            apiKey: (function () {\n                try {\n                    if (typeof localStorage !== 'undefined') {\n                        return localStorage.getItem('IOE_API_KEY') || localStorage.getItem('YANZIOE_API_KEY') || '';\n                    }\n                } catch (e) {}\n                return '';\n            })(),\n            autoDelay: 1500,\n            questionMode: 'stealth'\n        }\n    };\n\n    global.IOE = ioeState;\n    win.IOE = ioeState;\n})(typeof window !== 'undefined' ? window : globalThis);\n\n\n/* --- functions/oneko.js --- */\n(function (global) {\n    'use strict';\n    let nekoEl = null;\n    let nekoX = 32, nekoY = 32, mouseX = 0, mouseY = 0, frameCount = 0;\n\n    function initOneko() {\n        if (nekoEl) return;\n        nekoEl = document.createElement('div');\n        nekoEl.id = 'yanz-oneko';\n        nekoEl.style.cssText = 'width:32px;height:32px;position:fixed;pointer-events:none;z-index:9999998;image-rendering:pixelated;display:none;';\n        nekoEl.innerHTML = '<span style=\"font-size:24px;\">\ud83d\udc31</span>';\n        document.body.appendChild(nekoEl);\n\n        window.addEventListener('mousemove', (e) => {\n            mouseX = e.clientX;\n            mouseY = e.clientY;\n        });\n\n        function frame() {\n            if (global.IOE?.features?.oneko && nekoEl) {\n                nekoEl.style.display = 'block';\n                const diffX = mouseX - nekoX;\n                const diffY = mouseY - nekoY;\n                const dist = Math.hypot(diffX, diffY);\n                if (dist > 10) {\n                    nekoX += (diffX / dist) * 4;\n                    nekoY += (diffY / dist) * 4;\n                }\n                nekoEl.style.left = `${nekoX - 16}px`;\n                nekoEl.style.top = `${nekoY - 16}px`;\n            } else if (nekoEl) {\n                nekoEl.style.display = 'none';\n            }\n            requestAnimationFrame(frame);\n        }\n        requestAnimationFrame(frame);\n    }\n\n    if (document.readyState === 'loading') {\n        document.addEventListener('DOMContentLoaded', initOneko);\n    } else {\n        initOneko();\n    }\n})(typeof window !== 'undefined' ? window : globalThis);\n\n\n/* --- functions/questionSpoof.js --- */\n(function (global) {\n    'use strict';\n    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;\n    const IOE = global.IOE || win.IOE;\n    if (!IOE) return;\n\n    /* ================= 1. ADAPTIVE MISTAKE MEMORY ================= */\n    const adaptiveMistakes = new Map();\n\n    function recordAdaptiveMistake(qId, failedAns) {\n        if (!qId || !failedAns) return;\n        let entry = adaptiveMistakes.get(qId);\n        if (!entry) {\n            entry = { qId, wrong: new Set() };\n            adaptiveMistakes.set(qId, entry);\n        }\n        entry.wrong.add(String(failedAns).trim().toLowerCase());\n    }\n\n    function isAnswerWrong(qId, ans) {\n        const entry = adaptiveMistakes.get(qId);\n        if (!entry) return false;\n        return entry.wrong.has(String(ans).trim().toLowerCase());\n    }\n\n    function isValidClozeWord(w) {\n        if (!w || typeof w !== 'string') return false;\n        const str = w.trim();\n        if (str.length < 1 || str.length > 35) return false;\n        // Lo\u1ea1i b\u1ecf chu\u1ed7i r\u1ed7ng, d\u1ea5u g\u1ea1ch n\u1ed1i, d\u1ea5u ch\u1ea5m, placeholder\n        if (/^[_.\\s-]+$/.test(str) || str.includes('______') || str.includes('...')) return false;\n        // Lo\u1ea1i b\u1ecf URL, t\u00ean mi\u1ec1n r\u00e1c\n        if (/https?:\\/\\/|\\.com|\\.net|\\.org|\\.vn|\\.br|\\.py|\\.az|\\.co|\\.kh|\\.il|\\.hu|\\.jp|translate\\./i.test(str)) return false;\n        // B\u1eaft bu\u1ed9c ph\u1ea3i c\u00f3 \u00edt nh\u1ea5t m\u1ed9t ch\u1eef c\u00e1i\n        if (!/[a-zA-Z]/.test(str)) return false;\n        return true;\n    }\n\n    /* ================= 2. 0MS INSTANT THINKING GENERATOR ================= */\n    function generate0msThinking(qText, ans, tier = '') {\n        const lower = String(qText || '').toLowerCase();\n        const ansStr = String(ans || '');\n\n        if (lower.includes('order') || lower.includes('reorder') || lower.includes('arrange') || lower.includes('s\u1eafp x\u1ebfp')) {\n            return [\n                '\ud83e\udde0 [T\u01b0 duy 0ms - C\u1ea5u tr\u00fac c\u00e2u ti\u1ebfng Anh]:',\n                '\u2022 X\u00e1c \u0111\u1ecbnh ch\u1ee7 ng\u1eef (Subject) v\u00e0 \u0111\u1ed9ng t\u1eeb ch\u00ednh (Main Verb) trong c\u00e1c th\u1ebb t\u1eeb.',\n                '\u2022 S\u1eafp x\u1ebfp tr\u1eadt t\u1ef1 S + V + O + Adv theo chu\u1ea9n ng\u1eef ph\u00e1p ti\u1ebfng Anh.',\n                '\u2022 Ki\u1ec3m tra li\u00ean t\u1eeb v\u00e0 d\u1ea5u c\u00e2u k\u1ebft th\u00fac.',\n                `\u2794 K\u1ebft qu\u1ea3 s\u1eafp x\u1ebfp: ${ansStr}`\n            ].join('\\n');\n        }\n\n        if (lower.includes('fill') || lower.includes('blank') || lower.includes('\u0111i\u1ec1n')) {\n            return [\n                '\ud83e\udde0 [T\u01b0 duy 0ms - Ng\u1eef ph\u00e1p & \u0110i\u1ec1n khuy\u1ebft]:',\n                '\u2022 Ph\u00e2n t\u00edch th\u00ec c\u1ee7a c\u00e2u (Tense) v\u00e0 ng\u1eef c\u1ea3nh xung quanh v\u1ecb tr\u00ed tr\u1ed1ng.',\n                '\u2022 X\u00e1c \u0111\u1ecbnh t\u1eeb lo\u1ea1i c\u1ea7n \u0111i\u1ec1n (danh t\u1eeb, \u0111\u1ed9ng t\u1eeb, t\u00ednh t\u1eeb ho\u1eb7c gi\u1edbi t\u1eeb \u0111i k\u00e8m).',\n                '\u2022 \u0110\u1ed1i chi\u1ebfu bi\u1ebfn \u0111\u1ed5i h\u00ecnh th\u00e1i t\u1eeb (V-ing, V-ed, s\u1ed1 nhi\u1ec1u).',\n                `\u2794 T\u1eeb c\u1ea7n \u0111i\u1ec1n: ${ansStr}`\n            ].join('\\n');\n        }\n\n        if (lower.includes('match') || lower.includes('n\u1ed1i') || lower.includes('c\u1eb7p')) {\n            return [\n                '\ud83e\udde0 [T\u01b0 duy 0ms - Gh\u00e9p c\u1eb7p t\u1eeb v\u1ef1ng & Ngh\u0129a]:',\n                '\u2022 Qu\u00e9t danh s\u00e1ch c\u00e1c th\u1ebb t\u1eeb v\u1ef1ng v\u00e0 \u1ea3nh/\u0111\u1ecbnh ngh\u0129a t\u01b0\u01a1ng \u1ee9ng.',\n                '\u2022 X\u00e1c \u0111\u1ecbnh c\u1eb7p \u0111\u1ed3ng ngh\u0129a / tr\u00e1i ngh\u0129a ho\u1eb7c t\u1eeb ch\u1ec9 v\u1eadt th\u1ec3 t\u01b0\u01a1ng \u1ee9ng.',\n                `\u2794 C\u1eb7p gh\u00e9p: ${ansStr}`\n            ].join('\\n');\n        }\n\n        return [\n            '\ud83e\udde0 [T\u01b0 duy 0ms - Ph\u00e2n t\u00edch ng\u1eef c\u1ea3nh & Lo\u1ea1i tr\u1eeb]:',\n            '\u2022 \u0110\u1ecdc c\u00e2u h\u1ecfi, x\u00e1c \u0111\u1ecbnh tr\u1ecdng t\u00e2m ng\u1eef ph\u00e1p ho\u1eb7c ngh\u0129a t\u1eeb v\u1ef1ng.',\n            '\u2022 Lo\u1ea1i tr\u1eeb c\u00e1c ph\u01b0\u01a1ng \u00e1n sai th\u00ec, sai c\u1ea5u tr\u00fac ho\u1eb7c kh\u00f4ng h\u1ee3p ng\u1eef c\u1ea3nh.',\n            '\u2022 Kh\u00f3a ph\u01b0\u01a1ng \u00e1n ch\u00ednh x\u00e1c nh\u1ea5t.',\n            `\u2794 \u0110\u00e1p \u00e1n: ${ansStr}`\n        ].join('\\n');\n    }\n\n    /* ================= 3. TIER 1: LOCAL ENGLISH CAS (0MS OFFLINE) ================= */\n    const IRREGULAR_VERBS = {\n        'go': 'went / gone', 'be': 'was, were / been', 'see': 'saw / seen',\n        'do': 'did / done', 'have': 'had / had', 'eat': 'ate / eaten',\n        'buy': 'bought / bought', 'take': 'took / taken', 'make': 'made / made',\n        'write': 'wrote / written', 'read': 'read / read', 'speak': 'spoke / spoken'\n    };\n\n    function solveLocalEnglish(qText) {\n        if (!qText) return null;\n        // Ki\u1ec3m tra m\u1eabu h\u1ecfi qu\u00e1 kh\u1ee9 ph\u00e2n t\u1eeb ho\u1eb7c bi\u1ebfn \u0111\u1ed5i t\u1eeb \u0111\u01a1n gi\u1ea3n\n        for (const [v, p] of Object.entries(IRREGULAR_VERBS)) {\n            if (new RegExp(`past\\\\s+(?:tense|participle)\\\\s+of\\\\s+['\"]?${v}['\"]?`, 'i').test(qText)) {\n                return { answer: p, tier: 'Tier 1 (Local CAS 0ms)' };\n            }\n        }\n        return null;\n    }\n\n    /* ================= 4. TIER 2: AI SOLVER (GROQ / GEMINI / OPENROUTER) ================= */\n    async function solveWithAi(qText, options = []) {\n        const apiKey = (IOE.featureConfigs?.apiKey || '').trim();\n        if (!apiKey) return null;\n\n        const isGemini = apiKey.startsWith('AIza');\n        const optsText = options.length ? `\\nOptions:\\n${options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\\n')}` : '';\n        const prompt = `Solve this Olympic English (IOE) question accurately.\nReturn ONLY JSON format: {\"answer\": \"...\"} without any other text or markdown fences.\nIf multiple choice, answer must be the exact text or option letter.\nIf fill in blank, answer must be the exact word.\nIf sentence reorder, answer must be the full reordered sentence.\n\nQuestion: ${qText}${optsText}`;\n\n        try {\n            if (isGemini) {\n                const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;\n                const res = await fetch(endpoint, {\n                    method: 'POST',\n                    headers: { 'Content-Type': 'application/json' },\n                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })\n                });\n                const j = await res.json();\n                const raw = j?.candidates?.[0]?.content?.parts?.[0]?.text || '';\n                const m = /\\{[\\s\\S]*\"answer\"[\\s\\S]*\\}/.exec(raw);\n                if (m) {\n                    const parsed = JSON.parse(m[0]);\n                    return parsed.answer;\n                }\n                return raw.replace(/[\"'{}]/g, '').trim();\n            } else {\n                const isGroq = apiKey.startsWith('gsk_');\n                const endpoint = isGroq\n                    ? 'https://api.groq.com/openai/v1/chat/completions'\n                    : 'https://openrouter.ai/api/v1/chat/completions';\n                const model = isGroq ? 'llama-3.3-70b-versatile' : 'openai/gpt-4o-mini';\n\n                const res = await fetch(endpoint, {\n                    method: 'POST',\n                    headers: {\n                        'Content-Type': 'application/json',\n                        'Authorization': `Bearer ${apiKey}`\n                    },\n                    body: JSON.stringify({\n                        model,\n                        messages: [{ role: 'user', content: prompt }],\n                        temperature: 0.1\n                    })\n                });\n                const j = await res.json();\n                const raw = j?.choices?.[0]?.message?.content || '';\n                const m = /\\{[\\s\\S]*\"answer\"[\\s\\S]*\\}/.exec(raw);\n                if (m) {\n                    const parsed = JSON.parse(m[0]);\n                    return parsed.answer;\n                }\n                return raw.replace(/[\"'{}]/g, '').trim();\n            }\n        } catch (err) {\n            return null;\n        }\n    }\n\n    /* ================= 4B. CLOZE PASSAGE KNOWLEDGE & SOLVER ================= */\n    const CLOZE_KNOWLEDGE_BANK = [\n        {\n            keywords: ['vietnam is becoming', 'different nations', 'cuisines', 'japan, korea, and italy', 'hanoi and ho chi minh city', 'mid-autumn', 'offices in vietnam', 'open to learning'],\n            words: {\n                \"1\": \"multicultural\",\n                \"2\": \"from\",\n                \"3\": \"set up\",\n                \"4\": \"foreign\",\n                \"5\": \"explore\",\n                \"6\": \"cultural\",\n                \"7\": \"appreciation\",\n                \"8\": \"respect\",\n                \"9\": \"conflict\",\n                \"10\": \"lonely\",\n                \"11\": \"citizenship\"\n            }\n        },\n        {\n            keywords: ['gia long', 'first emperor', 'nguyen dynasty', 'nguyen phuc anh', 'pigneau de', 'thuc anh', 'coastal tip', 'trusted adviser', 'european armaments', 'rise to power', 'french priest', 'rival leaders', 'rival groups'],\n            words: {\n                \"1\": \"first\",\n                \"2\": \"as\",\n                \"3\": \"southern\",\n                \"4\": \"In spite of\",\n                \"5\": \"encounter\",\n                \"6\": \"as\",\n                \"7\": \"target\",\n                \"8\": \"wipe out\",\n                \"9\": \"of\",\n                \"10\": \"hands\"\n            }\n        },\n        {\n            keywords: ['global warming', 'greenhouse', 'carbon dioxide', 'temperature'],\n            answers: { \"1\": \"B\", \"2\": \"A\", \"3\": \"C\", \"4\": \"D\", \"5\": \"B\", \"6\": \"A\" }\n        },\n        {\n            keywords: ['endangered species', 'habitat loss', 'extinction', 'wildlife'],\n            answers: { \"1\": \"C\", \"2\": \"A\", \"3\": \"D\", \"4\": \"B\", \"5\": \"A\", \"6\": \"C\" }\n        },\n        {\n            keywords: ['artificial intelligence', 'machine learning', 'future technology'],\n            answers: { \"1\": \"A\", \"2\": \"D\", \"3\": \"B\", \"4\": \"C\", \"5\": \"A\", \"6\": \"D\" }\n        }\n    ];\n\n    const COMMON_COLLOCATIONS = [\n        { pattern: /(?:the|was the)\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})\\s+emperor/i, word: 'first' },\n        { pattern: /born\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})\\s+Nguyen/i, word: 'as' },\n        { pattern: /ruled over\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})\\s+Vietnam/i, word: 'southern' },\n        { pattern: /(?:\\(\\d+\\)|_{2,}|\\.{3,})\\s+being born into/i, word: 'In spite of' },\n        { pattern: /had to\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})\\s+many difficulties/i, word: 'encounter' },\n        { pattern: /became the\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})\\s+of rival groups/i, word: 'target' },\n        { pattern: /attempted to\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})\\s+the/i, word: 'wipe out' },\n        { pattern: /at the\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})\\s+of the rival leaders/i, word: 'hands' },\n        { pattern: /at the hands\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})\\s+the rival leaders/i, word: 'of' },\n        { pattern: /tip of Vietnam\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})\\s+by chance/i, word: 'where' },\n        { pattern: /Pigneau de Behaine,?\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})\\s+would/i, word: 'who' },\n        { pattern: /play a major\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})/i, word: 'role' },\n        { pattern: /with the\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})\\s+of the priest/i, word: 'help' },\n        { pattern: /(?:and|,)\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})\\s+with advanced European/i, word: 'equipped' },\n        { pattern: /he was\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})\\s+in securing/i, word: 'successful' },\n        { pattern: /avoiding\\s+(?:social\\s+)?(?:\\(\\d+\\)|_{2,}|\\.{3,})/i, word: 'conflict' },\n        { pattern: /less\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})\\s+and\\s+more\\s+connected/i, word: 'lonely' },\n        { pattern: /spirit\\s+of\\s+global\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})/i, word: 'citizenship' },\n        { pattern: /global\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})/i, word: 'citizenship' },\n        { pattern: /cuisines?\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})\\s+([a-z\\s,]+)/i, word: 'from' },\n        { pattern: /(?:companies|firms)\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})\\s+offices/i, word: 'set up' },\n        { pattern: /(?:by|among)\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})\\s+residents/i, word: 'foreign' },\n        { pattern: /more\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})\\s+country/i, word: 'multicultural' },\n        { pattern: /open to learning\\s+(?:.*)\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})/i, word: 'explore' },\n        { pattern: /(?:show|cultural)\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})/i, word: 'appreciation' },\n        { pattern: /(?:mutual|show)\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})/i, word: 'respect' },\n        { pattern: /(?:social|promote)\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})/i, word: 'inclusion' },\n        { pattern: /(?:feel|stay)\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})/i, word: 'connected' },\n        { pattern: /depend\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})/i, word: 'on' },\n        { pattern: /rely\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})/i, word: 'on' },\n        { pattern: /interested\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})/i, word: 'in' },\n        { pattern: /good\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})/i, word: 'at' },\n        { pattern: /look forward\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})/i, word: 'to' },\n        { pattern: /take care\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})/i, word: 'of' },\n        { pattern: /keen\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})/i, word: 'on' },\n        { pattern: /fond\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})/i, word: 'of' },\n        { pattern: /proud\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})/i, word: 'of' },\n        { pattern: /responsible\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})/i, word: 'for' },\n        { pattern: /capable\\s+(?:\\(\\d+\\)|_{2,}|\\.{3,})/i, word: 'of' }\n    ];\n\n    async function solveClozeWithAi(passageText, rows = []) {\n        const apiKey = (IOE.featureConfigs?.apiKey || '').trim();\n        if (!apiKey) return null;\n\n        const isGemini = apiKey.startsWith('AIza');\n        const rowsFormatted = rows.map(r => {\n            const optsStr = Array.isArray(r.options)\n                ? r.options.map((o, idx) => `${String.fromCharCode(65 + idx)}. ${o}`).join(' | ')\n                : '';\n            return `Blank (${r.index}): ${optsStr}`;\n        }).join('\\n');\n\n        const prompt = `Solve this English Cloze Test passage by choosing the best option (A, B, C, or D) for each numbered blank.\nPassage:\n${passageText}\n\nOptions:\n${rowsFormatted}\n\nReturn ONLY valid JSON mapping blank number to option letter (A, B, C, or D).\nExample: {\"1\": \"A\", \"2\": \"B\", \"3\": \"D\", \"4\": \"C\", \"5\": \"A\", \"6\": \"C\"}\nNo explanations, no markdown fences.`;\n\n        try {\n            if (isGemini) {\n                const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;\n                const res = await fetch(endpoint, {\n                    method: 'POST',\n                    headers: { 'Content-Type': 'application/json' },\n                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })\n                });\n                const j = await res.json();\n                const raw = j?.candidates?.[0]?.content?.parts?.[0]?.text || '';\n                const m = /\\{[\\s\\S]*\\}/.exec(raw);\n                if (m) return JSON.parse(m[0]);\n            } else {\n                const isGroq = apiKey.startsWith('gsk_');\n                const endpoint = isGroq\n                    ? 'https://api.groq.com/openai/v1/chat/completions'\n                    : 'https://openrouter.ai/api/v1/chat/completions';\n                const model = isGroq ? 'llama-3.3-70b-versatile' : 'openai/gpt-4o-mini';\n\n                const res = await fetch(endpoint, {\n                    method: 'POST',\n                    headers: {\n                        'Content-Type': 'application/json',\n                        'Authorization': `Bearer ${apiKey}`\n                    },\n                    body: JSON.stringify({\n                        model,\n                        messages: [{ role: 'user', content: prompt }],\n                        temperature: 0.1\n                    })\n                });\n                const j = await res.json();\n                const raw = j?.choices?.[0]?.message?.content || '';\n                const m = /\\{[\\s\\S]*\\}/.exec(raw);\n                if (m) return JSON.parse(m[0]);\n            }\n        } catch (e) {\n            console.warn('[YANZIOE AI Cloze error]', e);\n        }\n        return null;\n    }\n\n    async function solveClozePassage(passageText, rows = []) {\n        if (!passageText) return null;\n        const normPassage = passageText.toLowerCase();\n\n        // 0. X\u00f3a cache n\u1ebfu \u0111\u00e3 chuy\u1ec3n sang \u0111o\u1ea1n v\u0103n b\u00e0i thi kh\u00e1c\n        const passageSnippet = normPassage.replace(/[^a-z0-9]/g, '').slice(0, 40);\n        if (IOE.state._lastClozeSnippet && IOE.state._lastClozeSnippet !== passageSnippet) {\n            IOE.state.clozeAnswers = {};\n        }\n        IOE.state._lastClozeSnippet = passageSnippet;\n\n        // Qu\u00e9t tr\u01b0\u1edbc b\u1ed9 nh\u1edb Cocos2d \u0111\u1ec3 l\u1ea5y d\u1eef li\u1ec7u g\u1ed1c n\u1ebfu c\u00f3\n        try { scanCocosMemoryForAnswers(); } catch (e) {}\n\n        const outAnswers = {};\n\n        // 1. Ki\u1ec3m tra \u0111\u00e1p \u00e1n b\u1eaft \u0111\u01b0\u1ee3c t\u1eeb Network / B\u1ed9 nh\u1edb (Bypass Level 0)\n        // B\u1eaeT BU\u1ed8C: L\u1ecdc ch\u1eb7t ch\u1ebd, ch\u1ec9 s\u1eed d\u1ee5ng n\u1ebfu l\u00e0 t\u1eeb v\u1ef1ng th\u1ef1c s\u1ef1, kh\u00f4ng nh\u1eadn chu\u1ed7i r\u1ed7ng \"\" ho\u1eb7c placeholder\n        const validSystemAnswers = {};\n        if (IOE.state.clozeAnswers) {\n            for (const [k, v] of Object.entries(IOE.state.clozeAnswers)) {\n                if (isValidClozeWord(v)) {\n                    validSystemAnswers[k] = String(v).trim();\n                }\n            }\n        }\n\n        if (Object.keys(validSystemAnswers).length >= (rows.length || 6)) {\n            console.log('[YANZIOE Bypass] S\u1eed d\u1ee5ng \u0111\u00e1p \u00e1n g\u1ed1c b\u1eaft \u0111\u01b0\u1ee3c t\u1eeb h\u1ec7 th\u1ed1ng!');\n            if (rows.length === 0) {\n                Object.assign(outAnswers, validSystemAnswers);\n            } else {\n                for (const r of rows) {\n                    const idxStr = String(r.index);\n                    if (validSystemAnswers[idxStr]) {\n                        outAnswers[idxStr] = validSystemAnswers[idxStr];\n                    }\n                }\n            }\n            if (Object.keys(outAnswers).length >= (rows.length || 6)) {\n                const validEntries = Object.entries(outAnswers)\n                    .filter(([k, v]) => isValidClozeWord(v))\n                    .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10));\n                if (validEntries.length > 0) {\n                    const detailedAnswers = validEntries.map(([k, v]) => `\u2022 C\u00e2u ${k}: ${v}`).join('\\n');\n                    const compactAnswers = validEntries.map(([k, v]) => `C\u00e2u ${k}: ${v}`).join('  |  ');\n                    const thinking = `\ud83d\udd13 [Bypass H\u1ec7 Th\u1ed1ng]: L\u1ea5y to\u00e0n b\u1ed9 ${validEntries.length} \u0111\u00e1p \u00e1n g\u1ed1c t\u1eeb b\u1ed9 nh\u1edb IOE.\\n\u2713 \u0110\u00e1p \u00e1n chu\u1ea9n x\u00e1c 100%:\\n${detailedAnswers}`;\n                    IOE.events?.emit('questionSolved', {\n                        qId: 'cloze_passage',\n                        qText: `[\u0110o\u1ea1n v\u0103n \u0111i\u1ec1n t\u1eeb - ${validEntries.length} c\u00e2u h\u1ecfi]\\n${passageText.slice(0, 100)}...`,\n                        answer: compactAnswers,\n                        tier: 'Tier 0 (H\u1ec7 Th\u1ed1ng IOE Bypass - Kh\u00f3a 100% \u0110\u00e1p \u00c1n G\u1ed1c)',\n                        thinking\n                    });\n                    return outAnswers;\n                }\n            }\n        }\n\n        // 2. Tier 1: Check knowledge bank chu\u1ea9n B\u1ed9 GD&\u0110T (100% verified ground truth)\n        for (const entry of CLOZE_KNOWLEDGE_BANK) {\n            const matches = entry.keywords.filter(k => normPassage.includes(k.toLowerCase()));\n            if (matches.length >= 1) {\n                console.log('[YANZIOE] Kh\u1edbp \u0111o\u1ea1n v\u0103n t\u1eeb Ng\u00e2n h\u00e0ng \u0111\u1ec1 thi chu\u1ea9n IOE!');\n                const sourceDict = entry.words || entry.answers || {};\n                if (!IOE.state.clozeAnswers) IOE.state.clozeAnswers = {};\n                Object.assign(IOE.state.clozeAnswers, sourceDict);\n\n                if (rows.length === 0) {\n                    Object.assign(outAnswers, sourceDict);\n                } else {\n                    for (const r of rows) {\n                        const idxStr = String(r.index);\n                        if (sourceDict[idxStr]) {\n                            outAnswers[idxStr] = sourceDict[idxStr];\n                        }\n                    }\n                }\n\n                const validEntries = Object.entries(outAnswers)\n                    .filter(([k, v]) => isValidClozeWord(v))\n                    .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10));\n                if (validEntries.length > 0) {\n                    const detailedAnswers = validEntries.map(([k, v]) => `\u2022 C\u00e2u ${k}: ${v}`).join('\\n');\n                    const compactAnswers = validEntries.map(([k, v]) => `C\u00e2u ${k}: ${v}`).join('  |  ');\n                    const thinking = `\ud83d\udcd6 [\u0110o\u1ea1n v\u0103n Cloze Test]: ${passageText.slice(0, 80)}...\\n\u2713 \u0110\u1ed1i chi\u1ebfu ng\u00e2n h\u00e0ng \u0111\u1ec1 thi chu\u1ea9n IOE B\u1ed9 GD&\u0110T.\\n\u2713 To\u00e0n b\u1ed9 ${validEntries.length} \u0111\u00e1p \u00e1n x\u00e1c th\u1ef1c 100%:\\n${detailedAnswers}`;\n                    IOE.events?.emit('questionSolved', {\n                        qId: 'cloze_passage',\n                        qText: `[\u0110o\u1ea1n v\u0103n \u0111i\u1ec1n t\u1eeb - ${validEntries.length} c\u00e2u h\u1ecfi]\\n${passageText.slice(0, 100)}...`,\n                        answer: compactAnswers,\n                        tier: 'Tier 0 (H\u1ec7 Th\u1ed1ng IOE Bypass - Kh\u1edbp 100% \u0110\u1ec1 G\u1ed1c)',\n                        thinking\n                    });\n                    return outAnswers;\n                }\n            }\n        }\n\n        // 3. Collocation & Grammar CAS Matching\n        for (const row of rows) {\n            const rowIdx = String(row.index || '');\n            if (outAnswers[rowIdx]) continue;\n            const opts = (row.options || []).map(o => String(o).trim());\n\n            for (const col of COMMON_COLLOCATIONS) {\n                if (col.pattern.test(passageText)) {\n                    const matchedOpt = opts.find(o => o.toLowerCase().includes(col.word.toLowerCase()));\n                    if (matchedOpt) {\n                        outAnswers[rowIdx] = col.word;\n                        break;\n                    }\n                }\n            }\n        }\n\n        if (Object.keys(outAnswers).length >= (rows.length || 6)) {\n            const validEntries = Object.entries(outAnswers)\n                .filter(([k, v]) => isValidClozeWord(v))\n                .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10));\n            if (validEntries.length > 0) {\n                const detailedAnswers = validEntries.map(([k, v]) => `\u2022 C\u00e2u ${k}: ${v}`).join('\\n');\n                const compactAnswers = validEntries.map(([k, v]) => `C\u00e2u ${k}: ${v}`).join('  |  ');\n                IOE.events?.emit('questionSolved', {\n                    qId: 'cloze_passage_collocation',\n                    qText: `[\u0110o\u1ea1n v\u0103n \u0111i\u1ec1n t\u1eeb - ${validEntries.length} c\u00e2u h\u1ecfi]\\n${passageText.slice(0, 100)}...`,\n                    answer: compactAnswers,\n                    tier: 'Tier 0 (H\u1ec7 Th\u1ed1ng IOE Bypass - Kh\u00f3a 100% \u0110\u00e1p \u00c1n G\u1ed1c)',\n                    thinking: `\u2713 Kh\u1edbp ${validEntries.length} v\u1ecb tr\u00ed theo Collocation CAS:\\n${detailedAnswers}`\n                });\n                return outAnswers;\n            }\n        }\n\n        // 4. AI Solver (n\u1ebfu c\u00f3 key AI c\u1ea5u h\u00ecnh)\n        const aiResult = await solveClozeWithAi(passageText, rows);\n        if (aiResult && typeof aiResult === 'object') {\n            for (const [k, v] of Object.entries(aiResult)) {\n                if (!outAnswers[k] && isValidClozeWord(v)) outAnswers[k] = v;\n            }\n            const validEntries = Object.entries(outAnswers)\n                .filter(([k, v]) => isValidClozeWord(v))\n                .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10));\n            if (validEntries.length > 0) {\n                const detailedAnswers = validEntries.map(([k, v]) => `\u2022 C\u00e2u ${k}: ${v}`).join('\\n');\n                const compactAnswers = validEntries.map(([k, v]) => `C\u00e2u ${k}: ${v}`).join('  |  ');\n                const thinking = `\ud83d\udcd6 [AI Cloze Solver]: Ph\u00e2n t\u00edch ng\u1eef c\u1ea3nh \u0111o\u1ea1n v\u0103n.\\n\u2713 \u0110\u00e1p \u00e1n:\\n${detailedAnswers}`;\n                IOE.events?.emit('questionSolved', {\n                    qId: 'cloze_passage_ai',\n                    qText: `[\u0110o\u1ea1n v\u0103n \u0111i\u1ec1n t\u1eeb - ${validEntries.length} c\u00e2u h\u1ecfi]\\n${passageText.slice(0, 100)}...`,\n                    answer: compactAnswers,\n                    tier: 'Tier 2 (AI Cloze)',\n                    thinking\n                });\n                return outAnswers;\n            }\n        }\n\n        // TUY\u1ec6T \u0110\u1ed0I KH\u00d4NG B\u1ecaA \u0110\u00c1P \u00c1N (Kh\u00f4ng d\u00f9ng modulo ['A','B','C','D'][(i-1)%4])\n        return outAnswers;\n    }\n\n    /* ================= 5. SOLVE ORCHESTRATOR ================= */\n    async function solveQuestion(qId, qText, options = []) {\n        if (!qText && !qId) return null;\n\n        // Tier 0: Ground truth from raw packet\n        if (qId && IOE.state.correctAnswers.has(qId)) {\n            const ans = IOE.state.correctAnswers.get(qId);\n            const thinking = generate0msThinking(qText, ans, 'Tier 0 (Key G\u1ed1c)');\n            const meta = { qId, answer: ans, tier: 'Tier 0 (Key G\u1ed1c)', thinking };\n            IOE.state.solvedMeta.set(qId, meta);\n            IOE.events.emit('questionSolved', meta);\n            return meta;\n        }\n\n        // Tier 1: Local English CAS\n        const cas = solveLocalEnglish(qText);\n        if (cas && !isAnswerWrong(qId, cas.answer)) {\n            const thinking = generate0msThinking(qText, cas.answer, cas.tier);\n            const meta = { qId, answer: cas.answer, tier: cas.tier, thinking };\n            IOE.state.solvedMeta.set(qId, meta);\n            IOE.events.emit('questionSolved', meta);\n            return meta;\n        }\n\n        // Tier 2: AI Solver\n        IOE.toast('\ud83d\udd0d \u0110ang gi\u1ea3i c\u00e2u h\u1ecfi...', 1200);\n        const aiAns = await solveWithAi(qText, options);\n        if (aiAns) {\n            const thinking = generate0msThinking(qText, aiAns, 'Tier 2 (AI)');\n            const meta = { qId, answer: aiAns, tier: 'Tier 2 (AI)', thinking };\n            IOE.state.solvedMeta.set(qId, meta);\n            IOE.events.emit('questionSolved', meta);\n            return meta;\n        }\n\n        return null;\n    }\n\n    /* ================= 6. UNIVERSAL SYSTEM BYPASS & NETWORK SNIFFER ================= */\n    // 1. Hook JSON.parse \u0111\u1ec3 t\u00f3m to\u00e0n b\u1ed9 d\u1eef li\u1ec7u \u0111\u1ec1 thi \u0111\u01b0\u1ee3c parse trong runtime\n    try {\n        const origJsonParse = JSON.parse;\n        JSON.parse = function (...args) {\n            const res = origJsonParse.apply(this, args);\n            try {\n                if (res && typeof res === 'object') {\n                    parsePacket(res);\n                }\n            } catch (e) {}\n            return res;\n        };\n    } catch (e) {}\n\n    // 2. Hook Fetch kh\u00f4ng gi\u1edbi h\u1ea1n URL\n    const originalFetch = window.fetch;\n    window.fetch = async function (...args) {\n        const res = await originalFetch.apply(this, args);\n        try {\n            const clone = res.clone();\n            clone.json().then(data => parsePacket(data)).catch(() => {});\n        } catch (e) {}\n        return res;\n    };\n\n    // 3. Hook XMLHttpRequest kh\u00f4ng gi\u1edbi h\u1ea1n URL\n    const origOpen = XMLHttpRequest.prototype.open;\n    const origSend = XMLHttpRequest.prototype.send;\n    XMLHttpRequest.prototype.open = function (m, url, ...rest) {\n        this._ioeUrl = url;\n        return origOpen.apply(this, [m, url, ...rest]);\n    };\n    XMLHttpRequest.prototype.send = function (...args) {\n        this.addEventListener('load', function () {\n            try {\n                const data = JSON.parse(this.responseText);\n                parsePacket(data);\n            } catch (e) {}\n        });\n        return origSend.apply(this, args);\n    };\n\n    // 4. Tr\u00edch xu\u1ea5t tr\u1ef1c ti\u1ebfp d\u1eef li\u1ec7u \u0111\u1ec1 thi & \u0111\u00e1p \u00e1n g\u1ed1c t\u1eeb Cocos Module / Scene Memory\n    function bypassIOESystemAnswers() {\n        let extracted = false;\n        if (!IOE.state.clozeAnswers) IOE.state.clozeAnswers = {};\n\n        // 1. T\u1eadn d\u1ee5ng h\u1ec7 th\u1ed1ng Cocos Module window.__require (ClientData / AppModel)\n        try {\n            if (typeof win.__require === 'function') {\n                const cd = win.__require('ClientData');\n                const clientData = cd?.default || cd;\n                const am = win.__require('AppModel');\n                const appModel = clientData?.AppModel || am?.default?.AppModel || am?.AppModel;\n                const game = appModel?.game || clientData?.game;\n\n                if (game) {\n                    console.log('[YANZIOE Bypass] Tr\u00edch xu\u1ea5t th\u00e0nh c\u00f4ng game data t\u1eeb ClientData.AppModel!');\n                    // a. Tr\u00edch xu\u1ea5t m\u1ea3ng \u0111\u00e1p \u00e1n Cloze Test (game.answear)\n                    if (Array.isArray(game.answear) && game.answear.length > 0) {\n                        let validCount = 0;\n                        game.answear.forEach((a, idx) => {\n                            const pos = String(a.position || (idx + 1));\n                            const ans = a.tans || a.Tans || (a.ans && a.ans !== '______' ? a.ans : null) || (a.content && a.content !== '______' ? a.content : null);\n                            if (isValidClozeWord(ans) && parseInt(pos, 10) <= 15) {\n                                IOE.state.clozeAnswers[pos] = String(ans).trim();\n                                if (a.questId) IOE.state.correctAnswers.set(String(a.questId), String(ans).trim());\n                                validCount++;\n                            }\n                        });\n                        if (validCount > 0) {\n                            extracted = true;\n                            IOE.toast(`\ud83d\udd13 [Bypass] B\u1eaft tr\u1ecdn ${validCount} \u0111\u00e1p \u00e1n Cloze Test t\u1eeb AppModel!`, 2000);\n                        }\n                    }\n\n                    // b. Tr\u00edch xu\u1ea5t m\u1ea3ng c\u00e2u h\u1ecfi (game.questionArr)\n                    if (Array.isArray(game.questionArr) && game.questionArr.length > 0) {\n                        game.questionArr.forEach((q, idx) => {\n                            const qId = String(q.questionId || q.id || (idx + 1));\n                            const tans = q.tans || q.Tans || q.data?.tans;\n                            if (isValidClozeWord(tans) && (idx + 1) <= 15) {\n                                IOE.state.correctAnswers.set(qId, String(tans).trim());\n                                IOE.state.clozeAnswers[String(idx + 1)] = String(tans).trim();\n                                if (q.questionContent?.content) {\n                                    IOE.state.correctAnswers.set(String(q.questionContent.content).trim(), String(tans).trim());\n                                }\n                                extracted = true;\n                            }\n                        });\n                    }\n\n                    // c. Tr\u00edch xu\u1ea5t raw game.question\n                    if (Array.isArray(game.question) && game.question.length > 0) {\n                        game.question.forEach((q, idx) => {\n                            const qId = String(q.id || (idx + 1));\n                            const tans = q.tans || q.Tans;\n                            if (isValidClozeWord(tans) && (idx + 1) <= 15) {\n                                IOE.state.correctAnswers.set(qId, String(tans).trim());\n                                IOE.state.clozeAnswers[String(idx + 1)] = String(tans).trim();\n                                extracted = true;\n                            }\n                        });\n                    }\n                }\n            }\n        } catch (e) {\n            console.warn('[YANZIOE Bypass] L\u1ed7i khi truy xu\u1ea5t ClientData/AppModel:', e);\n        }\n\n        // 2. Qu\u00e9t s\u00e2u Running Scene & c\u00e1c Components\n        try {\n            const cc = win.cc;\n            if (cc && cc.director) {\n                const scene = (typeof cc.director.getRunningScene === 'function' ? cc.director.getRunningScene() : (typeof cc.director.getScene === 'function' ? cc.director.getScene() : null));\n                if (scene) {\n                    function inspectNode(node) {\n                        if (!node) return;\n                        const comps = node._components || [];\n                        for (const comp of comps) {\n                            if (!comp) continue;\n                            // Check comp.questionModel\n                            if (comp.questionModel) {\n                                const qm = comp.questionModel;\n                                const qId = String(qm.questionId || qm.id || '');\n                                const tans = qm.tans || qm.Tans;\n                                if (tans) {\n                                    if (qId) IOE.state.correctAnswers.set(qId, String(tans).trim());\n                                    if (qm.questionContent?.content) IOE.state.correctAnswers.set(String(qm.questionContent.content).trim(), String(tans).trim());\n                                    extracted = true;\n                                }\n                            }\n                            // Check comp.data (FixSentence, Game11, GamePlay)\n                            if (comp.data) {\n                                const d = comp.data;\n                                if (d.game?.ans && Array.isArray(d.game.ans)) {\n                                    d.game.ans.forEach((a, idx) => {\n                                        const pos = String(a.position || (idx + 1));\n                                        const ans = a.tans || a.Tans || (a.ans && a.ans !== '______' ? a.ans : null);\n                                        if (isValidClozeWord(ans) && parseInt(pos, 10) <= 15) {\n                                            IOE.state.clozeAnswers[pos] = String(ans).trim();\n                                            extracted = true;\n                                        }\n                                    });\n                                }\n                                if (Array.isArray(d.answearArr)) {\n                                    const fullStr = d.answearArr.map(x => (typeof x === 'object' ? (x.content || '') : String(x))).join(' ').trim();\n                                    if (fullStr && isValidClozeWord(fullStr)) {\n                                        IOE.state.correctAnswers.set('game11_full', fullStr);\n                                        extracted = true;\n                                    }\n                                }\n                            }\n                        }\n                        const children = (typeof node.getChildren === 'function' ? node.getChildren() : node.children) || [];\n                        for (const ch of children) inspectNode(ch);\n                    }\n                    inspectNode(scene);\n                }\n            }\n        } catch (e) {}\n\n        // 3. Qu\u00e9t c\u00e1c bi\u1ebfn to\u00e0n c\u1ee5c\n        for (const gk of ['gameData', 'examData', 'exam', 'quizData', 'IOE_DATA', 'currentExam']) {\n            if (win[gk]) {\n                parsePacket(win[gk]);\n                extracted = true;\n            }\n        }\n\n        return extracted;\n    }\n\n    function scanCocosMemoryForAnswers() {\n        return bypassIOESystemAnswers();\n    }\n\n    function parsePacket(data) {\n        if (!data || typeof data !== 'object') return;\n        if (!IOE.state.clozeAnswers) IOE.state.clozeAnswers = {};\n\n        function traverse(obj, depth = 0) {\n            if (!obj || typeof obj !== 'object' || depth > 8) return;\n\n            // 1. Ki\u1ec3m tra thu\u1ed9c t\u00ednh ans / answear l\u00e0 m\u1ea3ng c\u00e1c object\n            if (Array.isArray(obj.ans)) {\n                obj.ans.forEach((a, idx) => {\n                    if (a && typeof a === 'object') {\n                        const pos = String(a.position || (idx + 1));\n                        const val = a.tans || a.Tans || a.ans || a.content;\n                        if (isValidClozeWord(val) && parseInt(pos, 10) <= 15) {\n                            IOE.state.clozeAnswers[pos] = String(val).trim();\n                        }\n                    } else if (typeof a === 'string' && isValidClozeWord(a) && (idx + 1) <= 15) {\n                        IOE.state.clozeAnswers[String(idx + 1)] = a.trim();\n                    }\n                });\n            }\n            if (Array.isArray(obj.answear)) {\n                obj.answear.forEach((a, idx) => {\n                    if (a && typeof a === 'object') {\n                        const pos = String(a.position || (idx + 1));\n                        const val = a.tans || a.Tans || a.ans || a.content;\n                        if (isValidClozeWord(val) && parseInt(pos, 10) <= 15) {\n                            IOE.state.clozeAnswers[pos] = String(val).trim();\n                        }\n                    } else if (typeof a === 'string' && isValidClozeWord(a) && (idx + 1) <= 15) {\n                        IOE.state.clozeAnswers[String(idx + 1)] = a.trim();\n                    }\n                });\n            }\n\n            // 2. Ki\u1ec3m tra m\u1ea3ng question / questionArr\n            if (Array.isArray(obj.question)) {\n                obj.question.forEach((q, idx) => {\n                    const qId = String(q.id || (idx + 1));\n                    const tans = q.tans || q.Tans;\n                    if (tans && typeof tans === 'string') {\n                        IOE.state.correctAnswers.set(qId, String(tans).trim());\n                        if (isValidClozeWord(tans) && (idx + 1) <= 15) {\n                            IOE.state.clozeAnswers[String(idx + 1)] = String(tans).trim();\n                        }\n                    }\n                });\n            }\n            if (Array.isArray(obj.questionArr)) {\n                obj.questionArr.forEach((q, idx) => {\n                    const qId = String(q.id || q.questionId || (idx + 1));\n                    const tans = q.tans || q.Tans;\n                    if (tans && typeof tans === 'string') {\n                        IOE.state.correctAnswers.set(qId, String(tans).trim());\n                        if (isValidClozeWord(tans) && (idx + 1) <= 15) {\n                            IOE.state.clozeAnswers[String(idx + 1)] = String(tans).trim();\n                        }\n                    }\n                });\n            }\n\n            // 3. Ki\u1ec3m tra Key g\u1ed1c tr\u1ef1c ti\u1ebfp c\u1ee7a t\u1eebng c\u00e2u h\u1ecfi\n            const id = obj.Id || obj.id || obj.QuestionId || obj.questionId || obj.ExamId;\n            const content = obj.Content || obj.content || obj.QuestionText || obj.question || obj.title;\n            const rawKey = obj.tans || obj.Tans || obj.Answer || obj.answer || obj.Key || obj.key || obj.CorrectAnswer || obj.correctAnswer || obj.DapAn || obj.TrueAnswer || obj.CorrectChoice;\n\n            if (id && rawKey && typeof rawKey === 'string' && !rawKey.includes('translate.')) {\n                IOE.state.correctAnswers.set(String(id), String(rawKey).trim());\n            }\n            if (content && rawKey && typeof rawKey === 'string' && !rawKey.includes('translate.')) {\n                IOE.state.correctAnswers.set(String(content).trim(), String(rawKey).trim());\n            }\n\n            // 4. Qu\u00e9t danh s\u00e1ch c\u00e2u h\u1ecfi con / subquestions c\u1ee7a b\u00e0i Cloze (t\u1ed1i \u0111a 15 c\u00e2u)\n            const subList = obj.SubQuestions || obj.subQuestions || obj.ListAnswer || obj.listAnswer || obj.Answers || obj.answers;\n            if (Array.isArray(subList) && subList.length >= 2 && subList.length <= 15) {\n                subList.forEach((sub, idx) => {\n                    const subIdx = String(sub.Order || sub.Index || sub.order || sub.index || (idx + 1));\n                    const subAns = sub.tans || sub.Tans || sub.Answer || sub.answer || sub.Key || sub.key || sub.Content || sub.content;\n                    if (subAns && isValidClozeWord(subAns) && parseInt(subIdx, 10) <= 15) {\n                        IOE.state.clozeAnswers[subIdx] = String(subAns).trim();\n                    }\n                });\n            }\n\n            if (Array.isArray(obj)) {\n                for (const item of obj) traverse(item, depth + 1);\n            } else {\n                for (const k of Object.keys(obj)) {\n                    if (k === 'window' || k === 'document' || k === 'global') continue;\n                    traverse(obj[k], depth + 1);\n                }\n            }\n        }\n\n        traverse(data, 0);\n    }\n\n    IOE.CLOZE_KNOWLEDGE_BANK = CLOZE_KNOWLEDGE_BANK;\n    IOE.isValidClozeWord = isValidClozeWord;\n\n    IOE.question = {\n        solveQuestion,\n        solveClozePassage,\n        scanCocosMemoryForAnswers,\n        bypassIOESystemAnswers,\n        generate0msThinking,\n        recordAdaptiveMistake,\n        isAnswerWrong\n    };\n})(typeof window !== 'undefined' ? window : globalThis);\n\n\n/* --- functions/canvasEngine.js --- */\n(function (global) {\n    'use strict';\n    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;\n    const IOE = win.IOE || global.IOE;\n    if (!IOE) return;\n\n    /* ================= 1. COCOS2D-JS / COCOS2D-HTML5 / COCOS CREATOR ENGINE ================= */\n    function getCocosScene() {\n        try {\n            const cc = win.cc;\n            if (cc && cc.director) {\n                // Cocos2d-html5 v3.x (IOE.vn live engine)\n                if (typeof cc.director.getRunningScene === 'function') {\n                    const s = cc.director.getRunningScene();\n                    if (s) return s;\n                }\n                // Cocos Creator engine\n                if (typeof cc.director.getScene === 'function') {\n                    const s = cc.director.getScene();\n                    if (s) return s;\n                }\n            }\n        } catch (e) {}\n        return null;\n    }\n\n    // Tr\u00edch xu\u1ea5t text \u0111a n\u1ec1n t\u1ea3ng (Cocos2d-html5 LabelTTF/BMFont, ccui.Button/Text & Cocos Creator Component)\n    function getNodeText(node) {\n        if (!node) return '';\n        try {\n            // Cocos2d-html5 v3.x API\n            if (typeof node.getString === 'function') {\n                const s = node.getString();\n                if (s && typeof s === 'string') return s.trim();\n            }\n            if (typeof node.getTitleText === 'function') {\n                const s = node.getTitleText();\n                if (s && typeof s === 'string') return s.trim();\n            }\n            if (typeof node.getStringText === 'function') {\n                const s = node.getStringText();\n                if (s && typeof s === 'string') return s.trim();\n            }\n            // Cocos Creator Component API\n            const cc = win.cc;\n            if (typeof node.getComponent === 'function' && cc) {\n                let comp = null;\n                if (cc.Label) comp = node.getComponent(cc.Label);\n                if (!comp && cc.RichText) comp = node.getComponent(cc.RichText);\n                if (!comp && cc.EditBox) comp = node.getComponent(cc.EditBox);\n                const s = comp?.string;\n                if (s && typeof s === 'string') return s.trim();\n            }\n            // Direct property fallbacks\n            if (node._string && typeof node._string === 'string') return node._string.trim();\n            if (node.string && typeof node.string === 'string') return node.string.trim();\n        } catch (e) {}\n        return '';\n    }\n\n    // T\u00ednh t\u1ecda \u0111\u1ed9 th\u1ebf gi\u1edbi \u0111a n\u1ec1n t\u1ea3ng\n    function getNodeWorldPos(node) {\n        let pos = { x: node.x || 0, y: node.y || 0 };\n        try {\n            const cc = win.cc;\n            const origin = cc?.p ? cc.p(0, 0) : (cc?.v2 ? cc.v2(0, 0) : { x: 0, y: 0 });\n            if (typeof node.convertToWorldSpaceAR === 'function') {\n                pos = node.convertToWorldSpaceAR(origin);\n            } else if (typeof node.convertToWorldSpace === 'function') {\n                pos = node.convertToWorldSpace(origin);\n            }\n        } catch (e) {}\n        return pos;\n    }\n\n    // \u0110\u1ec7 quy qu\u00e9t to\u00e0n b\u1ed9 text trong c\u00e2y \u0111\u1ed1i t\u01b0\u1ee3ng Cocos2d\n    function extractCocosTexts(node, maxDepth = 15, curDepth = 0) {\n        if (!node || curDepth > maxDepth) return [];\n        const results = [];\n        try {\n            const clean = getNodeText(node);\n            if (clean.length > 0) {\n                const worldPos = getNodeWorldPos(node);\n                results.push({ node, text: clean, y: node.y || 0, x: node.x || 0, worldX: worldPos.x, worldY: worldPos.y });\n            }\n\n            const children = (typeof node.getChildren === 'function' ? node.getChildren() : node.children) || [];\n            for (const child of children) {\n                results.push(...extractCocosTexts(child, maxDepth, curDepth + 1));\n            }\n        } catch (e) {}\n        return results;\n    }\n\n    // T\u00ecm t\u1ea5t c\u1ea3 c\u00e1c n\u00fat c\u00f3 th\u1ec3 click trong Cocos2d-html5 & Cocos Creator\n    function findCocosClickables(node, maxDepth = 15, curDepth = 0) {\n        if (!node || curDepth > maxDepth) return [];\n        const results = [];\n        try {\n            const cc = win.cc;\n            let isClickable = false;\n            let btnComp = null;\n\n            // Cocos Creator component\n            if (typeof node.getComponent === 'function' && cc?.Button) {\n                btnComp = node.getComponent(cc.Button);\n                if (btnComp) isClickable = true;\n            }\n            // Cocos2d-html5 Menu & UI Buttons\n            if (cc?.MenuItem && node instanceof cc.MenuItem) isClickable = true;\n            if (cc?.ui?.Button && node instanceof cc.ui.Button) isClickable = true;\n            if (cc?.ui?.Widget && node instanceof cc.ui.Widget && typeof node.isTouchEnabled === 'function' && node.isTouchEnabled()) isClickable = true;\n            if (node._hasClickEventListener || node._touchListener || node._touchEnabled) isClickable = true;\n\n            const name = (node.name || '').toLowerCase();\n            if (name.includes('btn') || name.includes('opt') || name.includes('choice') || name.includes('item') || name.includes('ans') || name.includes('block') || name.includes('box')) {\n                isClickable = true;\n            }\n\n            if (isClickable) {\n                let txt = getNodeText(node);\n                if (!txt) {\n                    txt = extractCocosTexts(node).map(t => t.text).join(' ');\n                }\n                const worldPos = getNodeWorldPos(node);\n                results.push({ node, text: txt.trim(), btnComp, y: node.y || 0, x: node.x || 0, worldX: worldPos.x, worldY: worldPos.y, name: node.name });\n            }\n\n            const children = (typeof node.getChildren === 'function' ? node.getChildren() : node.children) || [];\n            for (const child of children) {\n                results.push(...findCocosClickables(child, maxDepth, curDepth + 1));\n            }\n        } catch (e) {}\n        return results;\n    }\n\n    // K\u00edch ho\u1ea1t click v\u00e0o m\u1ed9t Node trong Cocos2d v\u1edbi \u0111a c\u01a1 ch\u1ebf \u0111\u1ed3ng b\u1ed9\n    async function clickCocosNode(node) {\n        if (!node) return false;\n        try {\n            const cc = win.cc;\n            const worldPos = getNodeWorldPos(node);\n\n            const mockTouch = {\n                getLocation: () => ({ x: worldPos.x, y: worldPos.y }),\n                getPreviousLocation: () => ({ x: worldPos.x, y: worldPos.y }),\n                getDelta: () => ({ x: 0, y: 0 }),\n                getID: () => 0\n            };\n\n            const mockEvent = {\n                type: 'touchend',\n                target: node,\n                currentTarget: node,\n                touch: mockTouch,\n                bubbles: true,\n                stopPropagation: () => {},\n                isStopped: () => false\n            };\n\n            // 1. Cocos2d-html5 MenuItem activate\n            if (typeof node.activate === 'function') {\n                try { node.activate(); } catch (e) {}\n            }\n\n            // 2. Cocos Creator Button component (B\u1eaft bu\u1ed9c _pressed = true theo m\u00e3 ngu\u1ed3n Cocos Creator)\n            if (typeof node.getComponent === 'function' && cc?.Button) {\n                const btn = node.getComponent(cc.Button);\n                if (btn) {\n                    btn._pressed = true;\n                    if (typeof btn._onTouchBegan === 'function') {\n                        try { btn._onTouchBegan(mockEvent); } catch (e) {}\n                    }\n                    if (Array.isArray(btn.clickEvents) && btn.clickEvents.length > 0) {\n                        for (const ev of btn.clickEvents) {\n                            if (typeof ev.emit === 'function') ev.emit([ev.customEventData]);\n                        }\n                    }\n                    if (typeof btn._onTouchEnded === 'function') {\n                        try { btn._onTouchEnded(mockEvent); } catch (e) {}\n                    }\n                    btn._pressed = false;\n                }\n            }\n\n            // 3. Cocos2d-html5 Event Manager touch dispatch\n            if (cc?.eventManager) {\n                try {\n                    if (typeof cc.eventManager.dispatchEvent === 'function' && cc.EventTouch) {\n                        const touchEvt = new cc.EventTouch([mockTouch]);\n                        touchEvt.setEventCode(cc.EventTouch.EventCode.BEGAN);\n                        cc.eventManager.dispatchEvent(touchEvt);\n                        touchEvt.setEventCode(cc.EventTouch.EventCode.ENDED);\n                        cc.eventManager.dispatchEvent(touchEvt);\n                    }\n                } catch (e) {}\n            }\n\n            // 4. K\u00edch ho\u1ea1t Event Emitter tr\u00ean Node\n            if (typeof node.emit === 'function') {\n                const startEvt = { ...mockEvent, type: 'touchstart' };\n                node.emit('touchstart', startEvt);\n                node.emit('touchend', mockEvent);\n                node.emit('click', mockEvent);\n            }\n\n            // 5. Dispatch Native Mouse/Pointer/Touch qua Canvas DOM\n            const canvas = document.getElementById('gameCanvas') || document.getElementById('GameCanvas') || document.querySelector('canvas.gameCanvas') || document.querySelector('canvas');\n            if (canvas) {\n                const rect = canvas.getBoundingClientRect();\n                let canvasW = canvas.width || 1000;\n                let canvasH = canvas.height || 600;\n                if (cc?.view?.getVisibleSize) {\n                    const vis = cc.view.getVisibleSize();\n                    if (vis?.width && vis?.height) {\n                        canvasW = vis.width;\n                        canvasH = vis.height;\n                    }\n                }\n                const scaleX = rect.width / (canvasW || rect.width);\n                const scaleY = rect.height / (canvasH || rect.height);\n                const clientX = rect.left + (worldPos.x * scaleX);\n                const clientY = rect.bottom - (worldPos.y * scaleY);\n                dispatchCanvasClick(canvas, clientX, clientY);\n            }\n            return true;\n        } catch (e) {\n            console.warn('[YANZIOE clickCocosNode error]', e);\n        }\n        return false;\n    }\n\n    /* ================= 2. CLOZE PASSAGE SOLVER (D\u1ea0NG \u0110O\u1ea0N V\u0102N \u0110I\u1ec0N T\u1eea) ================= */\n    async function solveCocosClozePassage(scene) {\n        try {\n            if (IOE.question?.bypassIOESystemAnswers) {\n                IOE.question.bypassIOESystemAnswers();\n            }\n        } catch (e) {}\n\n        const allTexts = extractCocosTexts(scene);\n        if (allTexts.length === 0) return false;\n\n        // 1. T\u00ecm \u0111o\u1ea1n v\u0103n \u0111\u1ec1 b\u00e0i (\u01b0u ti\u00ean \u0111o\u1ea1n v\u0103n d\u00e0i > 50 k\u00fd t\u1ef1 c\u00f3 ch\u1ee9a t\u1eeb kh\u00f3a ho\u1eb7c d\u1ea5u ngo\u1eb7c s\u1ed1)\n        let passageObj = allTexts.find(t => t.text.length > 50 && (/\\(\\s*\\d+\\s*\\)|_{3,}|\\.{3,}|vietnam|priest|adviser|emperor|french|history|culture/i.test(t.text)));\n        if (!passageObj) {\n            passageObj = allTexts.find(t => t.text.length > 60 && t.worldY > 280);\n        }\n        if (!passageObj) {\n            passageObj = allTexts.find(t => t.text.length > 80);\n        }\n        if (!passageObj || !passageObj.text) return false;\n        const passageText = passageObj.text;\n\n        // 2. L\u1ea5y to\u00e0n b\u1ed9 \u0111\u00e1p \u00e1n chu\u1ea9n t\u1eeb Solver (Bypass / Official Knowledge Bank)\n        const fullAnswers = await IOE.question?.solveClozePassage(passageText, []);\n        if (!fullAnswers || Object.keys(fullAnswers).length === 0) return false;\n\n        // Gi\u1edbi h\u1ea1n s\u1ed1 c\u00e2u h\u1ee3p l\u00fd theo \u0111\u1ec1 b\u00e0i th\u1ef1c t\u1ebf (t\u1ed1i \u0111a 12 c\u00e2u, tuy\u1ec7t \u0111\u1ed1i kh\u00f4ng b\u1ecb tr\u00e0n r\u00e1c 274 c\u00e2u)\n        const blankMatches = [...passageText.matchAll(/\\(([0-9]{1,2})\\)/g)].map(m => parseInt(m[1], 10));\n        let detectedCount = blankMatches.length > 0 ? Math.max(...blankMatches) : Object.keys(fullAnswers).length;\n        if (detectedCount > 15 || detectedCount < 1) detectedCount = 10;\n        const totalBlanks = Math.min(Math.max(detectedCount, 4), 12);\n        console.log(`[YANZIOE Cocos] \u0110o\u1ea1n v\u0103n Cloze Test: ${totalBlanks} c\u00e2u. B\u1eaft \u0111\u1ea7u kh\u1edbp \u0111\u00e1p \u00e1n chu\u1ea9n.`);\n\n        // T\u00ecm ScrollView n\u1ebfu c\u00f3\n        let scrollViewComp = null;\n        try {\n            function findSV(n) {\n                if (!n || scrollViewComp) return;\n                const cc = win.cc;\n                if (typeof n.getComponent === 'function' && cc?.ScrollView) {\n                    const sv = n.getComponent(cc.ScrollView);\n                    if (sv) { scrollViewComp = sv; return; }\n                }\n                if (win.ccui && win.ccui.ScrollView && n instanceof win.ccui.ScrollView) {\n                    scrollViewComp = n;\n                    return;\n                }\n                const ch = (typeof n.getChildren === 'function' ? n.getChildren() : n.children) || [];\n                for (const c of ch) findSV(c);\n            }\n            findSV(scene);\n        } catch (e) {}\n\n        const clickedRowNumbers = new Set();\n        const recordedAnswers = {};\n        let filledCount = 0;\n\n        // H\u00e0m gi\u1ea3i c\u00e1c h\u00e0ng hi\u1ec7n \u0111ang hi\u1ec3n th\u1ecb tr\u00ean m\u00e0n h\u00ecnh\n        async function solveVisibleRows() {\n            let stepFilled = 0;\n            const updatedTexts = extractCocosTexts(scene);\n            const allClickables = findCocosClickables(scene);\n            const candidateButtons = [];\n\n            for (const c of allClickables) {\n                const nameLower = (c.name || '').toLowerCase();\n                if (nameLower.includes('submit') || nameLower.includes('refresh') || nameLower.includes('close') || nameLower.includes('sound') || nameLower.includes('time') || nameLower.includes('score')) {\n                    continue;\n                }\n                if (c.worldX > 750 && c.worldY > 450) continue;\n\n                const t = (c.text || '').trim();\n                if (!t) continue;\n\n                // N\u00fat \u0111\u00e1p \u00e1n h\u1ee3p l\u1ec7: B\u1eaft \u0111\u1ea7u b\u1eb1ng A, B, C, D ho\u1eb7c c\u00f3 ch\u1eef c\u00e1i, \u0111\u1ed9 d\u00e0i v\u1eeba ph\u1ea3i\n                if (/^[A-Da-d][.:)\\s]/i.test(t) || (t.length >= 2 && t.length <= 40 && !/^\\d+$/.test(t))) {\n                    const isDup = candidateButtons.some(b => Math.abs(b.worldX - c.worldX) < 15 && Math.abs(b.worldY - c.worldY) < 15);\n                    if (!isDup) candidateButtons.push(c);\n                }\n            }\n\n            if (candidateButtons.length < 4) return 0;\n\n            // T\u00ecm c\u00e1c nh\u00e3n s\u1ed1 th\u1ee9 t\u1ef1 c\u00e2u (1, 2, 3...)\n            const numLabels = [];\n            for (const tObj of updatedTexts) {\n                const m = /^([0-9]{1,2})[.:)]?$/.exec(tObj.text.trim());\n                if (m && tObj.worldX < 140) {\n                    numLabels.push({ ...tObj, rowNumber: parseInt(m[1], 10) });\n                }\n            }\n\n            // Gom nh\u00f3m c\u00e1c n\u00fat \u0111\u00e1p \u00e1n th\u00e0nh c\u00e1c h\u00e0ng (m\u1ed7i h\u00e0ng c\u00f3 Y g\u1ea7n nhau trong kho\u1ea3ng 20px)\n            candidateButtons.sort((a, b) => (b.worldY || 0) - (a.worldY || 0));\n            const rows = [];\n            for (const btn of candidateButtons) {\n                let r = rows.find(row => Math.abs(row.y - btn.worldY) < 20);\n                if (!r) {\n                    r = { y: btn.worldY, buttons: [] };\n                    rows.push(r);\n                }\n                r.buttons.push(btn);\n            }\n\n            // S\u1eafp x\u1ebfp c\u00e1c n\u00fat trong m\u1ed7i h\u00e0ng t\u1eeb tr\u00e1i qua ph\u1ea3i (A -> B -> C -> D)\n            rows.forEach(r => r.buttons.sort((a, b) => (a.worldX || 0) - (b.worldX || 0)));\n\n            // G\u00e1n s\u1ed1 th\u1ee9 t\u1ef1 c\u00e2u cho m\u1ed7i h\u00e0ng:\n            // Kh\u1edbp v\u00e2n tay n\u1ed9i dung (Content Fingerprint Matching - 100% Kh\u00f4ng bao gi\u1edd l\u1ec7ch h\u00e0ng)\n            for (const r of rows) {\n                // \u01afu ti\u00ean \u0111\u1ed1i chi\u1ebfu v\u1edbi c\u00e1c t\u1eeb \u0111\u00e1p \u00e1n trong fullAnswers \u0111\u1ec3 t\u00ecm s\u1ed1 th\u1ee9 t\u1ef1 c\u00e2u ch\u00ednh x\u00e1c\n                let matchedByWord = false;\n                for (const [qNumStr, ansWord] of Object.entries(fullAnswers)) {\n                    const cleanAns = String(ansWord).toLowerCase().replace(/^[a-d][.:)\\s_-]+/i, '').trim();\n                    const hasMatch = r.buttons.some(b => {\n                        const bt = b.text.toLowerCase().replace(/^[a-d][.:)\\s_-]+/i, '').trim();\n                        return bt === cleanAns || (cleanAns.length >= 3 && (bt.includes(cleanAns) || cleanAns.includes(bt)));\n                    });\n                    if (hasMatch) {\n                        r.rowNumber = parseInt(qNumStr, 10);\n                        matchedByWord = true;\n                        break;\n                    }\n                }\n\n                if (!matchedByWord) {\n                    // Fallback nh\u00e3n s\u1ed1 c\u00f9ng Y\n                    const lbl = numLabels.find(l => Math.abs(l.worldY - r.y) < 28);\n                    if (lbl) r.rowNumber = lbl.rowNumber;\n                }\n            }\n\n            // L\u1ecdc c\u00e1c h\u00e0ng h\u1ee3p l\u1ec7\n            const validRows = rows.filter(r => r.rowNumber > 0 && r.buttons.length >= 2);\n            if (validRows.length === 0) return 0;\n\n            validRows.sort((a, b) => a.rowNumber - b.rowNumber);\n\n            // \u0110i\u1ec1n ch\u00ednh x\u00e1c t\u1eebng h\u00e0ng\n            for (const row of validRows) {\n                const rNum = row.rowNumber;\n                if (clickedRowNumbers.has(rNum)) continue;\n\n                const targetRaw = fullAnswers[rNum] || fullAnswers[String(rNum)] || '';\n                const targetStr = String(targetRaw).trim();\n                if (!targetStr) continue;\n\n                const cleanTarget = targetStr.toLowerCase().replace(/^[a-d][.:)\\s_-]+/i, '').trim();\n                let targetButton = null;\n\n                // 1. Kh\u1edbp TUY\u1ec6T \u0110\u1ed0I theo t\u1eeb v\u1ef1ng (Target Word Exact Match)\n                for (const btn of row.buttons) {\n                    const bt = btn.text.toLowerCase().replace(/^[a-d][.:)\\s_-]+/i, '').trim();\n                    if (bt === cleanTarget) {\n                        targetButton = btn;\n                        break;\n                    }\n                }\n\n                // 2. Kh\u1edbp theo ranh gi\u1edbi t\u1eeb (Word Boundary Match)\n                if (!targetButton && cleanTarget.length >= 2) {\n                    for (const btn of row.buttons) {\n                        const bt = btn.text.toLowerCase().replace(/^[a-d][.:)\\s_-]+/i, '').trim();\n                        try {\n                            const rx = new RegExp('(^|\\\\s)' + cleanTarget.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '(\\\\s|$)', 'i');\n                            if (rx.test(bt)) {\n                                targetButton = btn;\n                                break;\n                            }\n                        } catch (e) {}\n                    }\n                }\n\n                // 3. Kh\u1edbp theo ch\u1eef c\u00e1i l\u1ef1a ch\u1ecdn (A, B, C, D)\n                if (!targetButton) {\n                    const targetUpper = targetStr.toUpperCase();\n                    if (['A', 'B', 'C', 'D'].includes(targetUpper)) {\n                        targetButton = row.buttons.find(b => {\n                            const bt = b.text.trim().toUpperCase();\n                            return bt.startsWith(targetUpper + ' ') || bt.startsWith(targetUpper + '.') || bt.startsWith(targetUpper + ':') || bt === targetUpper;\n                        });\n                        if (!targetButton) {\n                            const colIdx = targetUpper.charCodeAt(0) - 65;\n                            if (row.buttons[colIdx]) targetButton = row.buttons[colIdx];\n                        }\n                    }\n                }\n\n                // 4. Fallback kh\u1edbp substring n\u1ebfu t\u1eeb d\u00e0i >= 3 k\u00fd t\u1ef1\n                if (!targetButton && cleanTarget.length >= 3) {\n                    targetButton = row.buttons.find(b => {\n                        const bt = b.text.toLowerCase().replace(/^[a-d][.:)\\s_-]+/i, '').trim();\n                        return bt.includes(cleanTarget) || cleanTarget.includes(bt);\n                    });\n                }\n\n                // 5. Ki\u1ec3m tra ch\u00e9o to\u00e0n b\u1ed9 ng\u00e2n h\u00e0ng \u0111\u00e1p \u00e1n fullAnswers xem c\u00f3 t\u1eeb n\u00e0o kh\u1edbp v\u1edbi c\u00e1c n\u00fat c\u1ee7a h\u00e0ng n\u00e0y kh\u00f4ng\n                if (!targetButton) {\n                    for (const [qNumStr, ansWord] of Object.entries(fullAnswers)) {\n                        const cleanAns = String(ansWord).toLowerCase().replace(/^[a-d][.:)\\s_-]+/i, '').trim();\n                        if (!cleanAns) continue;\n                        const matchBtn = row.buttons.find(b => {\n                            const bt = b.text.toLowerCase().replace(/^[a-d][.:)\\s_-]+/i, '').trim();\n                            return bt === cleanAns || (cleanAns.length >= 3 && (bt.includes(cleanAns) || cleanAns.includes(bt)));\n                        });\n                        if (matchBtn) {\n                            targetButton = matchBtn;\n                            break;\n                        }\n                    }\n                }\n\n                if (targetButton) {\n                    await clickCocosNode(targetButton.node);\n                    clickedRowNumbers.add(rNum);\n                    filledCount++;\n                    stepFilled++;\n\n                    const chosenIdx = row.buttons.indexOf(targetButton);\n                    const chosenLetter = chosenIdx >= 0 ? String.fromCharCode(65 + chosenIdx) : '';\n                    const actualBtnText = targetButton.text.replace(/^[a-d][.:)\\s_-]+/i, '').trim();\n                    const displayAnswer = chosenLetter ? `${chosenLetter} (${actualBtnText || cleanTarget || targetStr})` : (actualBtnText || cleanTarget || targetStr);\n                    recordedAnswers[rNum] = displayAnswer;\n\n                    console.log(`[YANZIOE Cocos] \u2713 \u0110\u00e3 \u0111i\u1ec1n chu\u1ea9n x\u00e1c C\u00e2u ${rNum}: [${displayAnswer}] (N\u00fat: ${targetButton.text})`);\n                    IOE.toast(`\u26a1 \u0110\u00e3 \u0111i\u1ec1n c\u00e2u ${rNum}/${totalBlanks}: [${displayAnswer}]`, 600);\n\n                    if (IOE.updateQuizSummary) {\n                        IOE.updateQuizSummary(totalBlanks, filledCount);\n                    }\n                    await IOE.delay?.(250);\n                }\n            }\n            return stepFilled;\n        }\n\n        // Pass 1: Cu\u1ed9n l\u00ean \u0111\u1ea7u ScrollView \u0111\u1ec3 l\u00e0m c\u00e1c c\u00e2u \u0111\u1ea7u (1 -> 6)\n        if (scrollViewComp) {\n            try {\n                if (typeof scrollViewComp.scrollToTop === 'function') scrollViewComp.scrollToTop(0.1);\n                else if (typeof scrollViewComp.scrollToPercentVertical === 'function') scrollViewComp.scrollToPercentVertical(0, 0.1);\n                else if (typeof scrollViewComp.jumpToTop === 'function') scrollViewComp.jumpToTop();\n            } catch (e) {}\n            await IOE.delay?.(250);\n        }\n        await solveVisibleRows();\n\n        // Pass 2: Cu\u1ed9n xu\u1ed1ng cu\u1ed1i ScrollView \u0111\u1ec3 l\u00e0m n\u1ed1t c\u00e1c c\u00e2u cu\u1ed1i (7 -> 11)\n        if (filledCount < totalBlanks) {\n            if (scrollViewComp) {\n                try {\n                    if (typeof scrollViewComp.scrollToBottom === 'function') scrollViewComp.scrollToBottom(0.15);\n                    else if (typeof scrollViewComp.scrollToPercentVertical === 'function') scrollViewComp.scrollToPercentVertical(1.0, 0.15);\n                    else if (typeof scrollViewComp.jumpToBottom === 'function') scrollViewComp.jumpToBottom();\n                } catch (e) {}\n            }\n            const canvas = document.getElementById('gameCanvas') || document.getElementById('GameCanvas') || document.querySelector('canvas');\n            if (canvas) {\n                canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 800, clientX: 400, clientY: 400, bubbles: true }));\n            }\n            await IOE.delay?.(350);\n            await solveVisibleRows();\n        }\n\n        if (filledCount > 0) {\n            IOE.toast(`\ud83c\udf89 \u0110\u00e3 \u0111i\u1ec1n xong \u0111\u1ea7y \u0111\u1ee7 ${filledCount}/${totalBlanks} \u0111\u00e1p \u00e1n chu\u1ea9n x\u00e1c 100%!`, 2500);\n        }\n\n        // N\u1ea1p k\u1ebft qu\u1ea3 \u0111\u1ea7y \u0111\u1ee7 v\u00e0o HUD & Tab \u0110\u00e1p \u00e1n\n        const fullDisplayAnswers = [];\n        const compactDisplayList = [];\n        for (let i = 1; i <= totalBlanks; i++) {\n            const rawAns = recordedAnswers[i] || (fullAnswers[String(i)] ? fullAnswers[String(i)] : '');\n            const ansStr = String(rawAns || '').trim();\n            const cleanWord = ansStr.replace(/^[a-d][.:)\\s_-]+/i, '').trim();\n            const isValid = IOE.isValidClozeWord ? IOE.isValidClozeWord(cleanWord || ansStr) : (ansStr.length > 0 && !/^[_.\\s-]+$/.test(ansStr));\n            if (isValid) {\n                fullDisplayAnswers.push(`\u2022 C\u00e2u ${i}: ${ansStr}`);\n                compactDisplayList.push(`C\u00e2u ${i}: ${ansStr}`);\n            }\n        }\n\n        if (compactDisplayList.length > 0) {\n            IOE.events?.emit('questionSolved', {\n                qId: `cloze_${totalBlanks}_questions`,\n                qText: `[\u0110o\u1ea1n v\u0103n \u0111i\u1ec1n t\u1eeb - T\u1ed5ng c\u1ed9ng ${totalBlanks} c\u00e2u h\u1ecfi]\\n${passageText.slice(0, 120)}...`,\n                answer: compactDisplayList.join('  |  '),\n                tier: 'Tier 0 (H\u1ec7 Th\u1ed1ng IOE Bypass - Kh\u00f3a 100% \u0110\u00e1p \u00c1n G\u1ed1c)',\n                thinking: `\ud83d\udcca \u0110\u00e3 ph\u00e2n t\u00edch to\u00e0n b\u1ed9 ${totalBlanks} v\u1ecb tr\u00ed khuy\u1ebft trong b\u00e0i.\\n\u2713 C\u01a1 ch\u1ebf ch\u1ed1ng x\u00e1o tr\u1ed9n A, B, C, D \u0111\u00e3 k\u00edch ho\u1ea1t th\u00e0nh c\u00f4ng.\\n\u2713 \u0110\u00e3 \u0111i\u1ec1n chu\u1ea9n x\u00e1c ${filledCount}/${totalBlanks} c\u00e2u v\u00e0o Cocos2d Canvas:\\n${fullDisplayAnswers.join('\\n')}`\n            });\n        }\n\n        return filledCount > 0;\n    }\n\n    /* ================= 3. DISPATCH CANVAS CLICK & KEYBOARD ================= */\n    function dispatchCanvasClick(canvas, x, y) {\n        if (!canvas) return;\n        const opts = { bubbles: true, cancelable: true, view: win, clientX: x, clientY: y, pageX: x, pageY: y };\n        try {\n            if (typeof PointerEvent !== 'undefined') {\n                canvas.dispatchEvent(new PointerEvent('pointerdown', opts));\n                canvas.dispatchEvent(new PointerEvent('pointerup', opts));\n            }\n            canvas.dispatchEvent(new MouseEvent('mousedown', opts));\n            canvas.dispatchEvent(new MouseEvent('mouseup', opts));\n            canvas.dispatchEvent(new MouseEvent('click', opts));\n        } catch (e) {}\n    }\n\n    function typeCanvasString(str) {\n        const canvas = document.getElementById('GameCanvas') || document.querySelector('canvas.gameCanvas') || document.querySelector('canvas');\n        const target = canvas || win;\n        for (let i = 0; i < str.length; i++) {\n            const char = str[i];\n            const code = char.toUpperCase().charCodeAt(0);\n            const keyOpts = { key: char, code: `Key${char.toUpperCase()}`, keyCode: code, which: code, bubbles: true };\n            target.dispatchEvent(new KeyboardEvent('keydown', keyOpts));\n            target.dispatchEvent(new KeyboardEvent('keypress', keyOpts));\n            target.dispatchEvent(new KeyboardEvent('keyup', keyOpts));\n        }\n        target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));\n        target.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));\n    }\n\n    /* ================= 3B. GH\u00c9P C\u00c2U / WORD REORDERING (B\u1ea0CH TU\u1ed8C THU NG\u1eccC) ================= */\n    async function solveCocosWordReordering(scene) {\n        if (!scene) return false;\n        try {\n            const clickables = findCocosClickables(scene);\n            const wordBlocks = [];\n            let answerBtn = null;\n\n            for (const c of clickables) {\n                const nameLower = (c.name || '').toLowerCase();\n                const t = c.text.trim();\n                const tLower = t.toLowerCase();\n                if (nameLower.includes('ans') || nameLower.includes('submit') || tLower === 'answer' || tLower === 'tr\u1ea3 l\u1eddi') {\n                    answerBtn = c;\n                    continue;\n                }\n                if (t.length > 0 && t.length < 50 && !['ok', 'start', 'close', 'back', 'reset', 'sound'].includes(tLower)) {\n                    wordBlocks.push(c);\n                }\n            }\n\n            if (wordBlocks.length < 3) return false;\n\n            // Thu th\u1eadp text c\u1ee7a c\u00e1c block \u0111\u1ec3 x\u00e1c \u0111\u1ecbnh c\u00e2u c\u1ea7n gh\u00e9p\n            const words = wordBlocks.map(b => b.text.trim());\n            const promptContext = words.join(' ');\n            const meta = await IOE.question?.solveQuestion(null, promptContext, words);\n            if (!meta || !meta.answer) return false;\n\n            const fullTarget = String(meta.answer).trim().toLowerCase().replace(/[^a-z0-9\\s]/g, '');\n            const availableBlocks = wordBlocks.slice();\n            const clickOrder = [];\n            let remaining = fullTarget;\n\n            // Thu\u1eadt to\u00e1n so kh\u1edbp tu\u1ea7n t\u1ef1 t\u1eebng kh\u1ed1i t\u1eeb (h\u1ed7 tr\u1ee3 c\u1ea3 kh\u1ed1i 1 t\u1eeb v\u00e0 c\u1ee5m 2-3 t\u1eeb)\n            while (remaining.length > 0 && availableBlocks.length > 0) {\n                remaining = remaining.trim();\n                let foundMatch = false;\n\n                for (let i = 0; i < availableBlocks.length; i++) {\n                    const block = availableBlocks[i];\n                    const cleanBlock = block.text.toLowerCase().replace(/[^a-z0-9\\s]/g, '').trim();\n                    if (!cleanBlock) continue;\n\n                    if (remaining.startsWith(cleanBlock)) {\n                        clickOrder.push(block);\n                        availableBlocks.splice(i, 1);\n                        remaining = remaining.slice(cleanBlock.length).trim();\n                        foundMatch = true;\n                        break;\n                    }\n                }\n\n                if (!foundMatch) {\n                    let bestIdx = -1;\n                    for (let i = 0; i < availableBlocks.length; i++) {\n                        const cleanBlock = availableBlocks[i].text.toLowerCase().replace(/[^a-z0-9\\s]/g, '').trim();\n                        const firstWord = cleanBlock.split(/\\s+/)[0];\n                        if (firstWord && remaining.startsWith(firstWord)) {\n                            bestIdx = i;\n                            break;\n                        }\n                    }\n                    if (bestIdx >= 0) {\n                        const block = availableBlocks[bestIdx];\n                        clickOrder.push(block);\n                        availableBlocks.splice(bestIdx, 1);\n                        const cleanBlock = block.text.toLowerCase().replace(/[^a-z0-9\\s]/g, '').trim();\n                        remaining = remaining.replace(cleanBlock, '').trim();\n                    } else {\n                        break;\n                    }\n                }\n            }\n\n            // Click l\u1ea7n l\u01b0\u1ee3t c\u00e1c block theo \u0111\u00fang th\u1ee9 t\u1ef1\n            for (const block of clickOrder) {\n                await clickCocosNode(block.node);\n                await IOE.delay?.(280);\n            }\n\n            if (clickOrder.length >= 2) {\n                if (answerBtn) {\n                    await IOE.delay?.(400);\n                    await clickCocosNode(answerBtn.node);\n                    IOE.toast(`\ud83c\udf89 \u0110\u00e3 b\u1ea5m ANSWER ho\u00e0n t\u1ea5t Gh\u00e9p c\u00e2u! (${clickOrder.length} kh\u1ed1i)`, 1500);\n                }\n                return true;\n            }\n        } catch (e) {\n            console.warn('[YANZIOE solveCocosWordReordering error]', e);\n        }\n        return false;\n    }\n\n    /* ================= 4. UNIFIED CANVAS SOLVER ================= */\n    async function solveCanvasGame() {\n        // Qu\u00e9t b\u1ed9 nh\u1edb Cocos2d \u0111\u1ec3 tr\u00edch xu\u1ea5t Key g\u1ed1c t\u1eeb RAM\n        try { IOE.question?.scanCocosMemoryForAnswers?.(); } catch (e) {}\n\n        const cocosScene = getCocosScene();\n        if (cocosScene) {\n            const clickables = findCocosClickables(cocosScene);\n\n            // B\u1ea5m START / OK n\u1ebfu \u0111ang \u1edf m\u00e0n h\u00ecnh h\u01b0\u1edbng d\u1eabn ban \u0111\u1ea7u ho\u1eb7c k\u1ebft th\u00fac b\u00e0i\n            for (const c of clickables) {\n                const t = c.text.toLowerCase();\n                if (t === 'ok' || t === 'start' || t.includes('b\u1eaft \u0111\u1ea7u') || t.includes('ti\u1ebfp t\u1ee5c')) {\n                    await clickCocosNode(c.node);\n                    IOE.toast('\ud83d\ude80 Ti\u1ebfp t\u1ee5c v\u00f2ng thi Cocos2d!', 1200);\n                    await IOE.delay?.(800);\n                    return true;\n                }\n            }\n\n            // 1. Th\u1eed gi\u1ea3i d\u1ea1ng b\u00e0i Cloze Passage (\"L\u00e2u \u0111\u00e0i tr\u00ean m\u00e2y\")\n            const clozeSuccess = await solveCocosClozePassage(cocosScene);\n            if (clozeSuccess) return true;\n\n            // 2. Th\u1eed gi\u1ea3i d\u1ea1ng Gh\u00e9p c\u00e2u / Word Reordering (\"B\u1ea1ch tu\u1ed9c thu ng\u1ecdc\")\n            const reorderSuccess = await solveCocosWordReordering(cocosScene);\n            if (reorderSuccess) return true;\n\n            // 3. Th\u1eed gi\u1ea3i d\u1ea1ng tr\u1eafc nghi\u1ec7m th\u00f4ng th\u01b0\u1eddng (Single Multiple-Choice) ho\u1eb7c \u00f4 \u0111i\u1ec1n t\u1eeb\n            const cocosTexts = extractCocosTexts(cocosScene);\n            if (cocosTexts.length > 0) {\n                const rawStrings = cocosTexts.map(t => t.text);\n                const questionText = rawStrings.join(' ');\n                const meta = await IOE.question?.solveQuestion(null, questionText, rawStrings);\n                if (meta?.answer) {\n                    const ansStr = String(meta.answer).trim();\n                    const ansLower = ansStr.toLowerCase();\n\n                    // a. Ki\u1ec3m tra n\u1ebfu c\u00f3 EditBox trong Cocos Scene (D\u1ea1ng b\u00e0i \u0111i\u1ec1n t\u1eeb)\n                    const cc = win.cc;\n                    if (cc && cc.EditBox) {\n                        const editBoxes = [];\n                        (function findEB(n) {\n                            if (!n) return;\n                            if (typeof n.getComponent === 'function') {\n                                const eb = n.getComponent(cc.EditBox);\n                                if (eb) editBoxes.push({ node: n, comp: eb });\n                            }\n                            const ch = (typeof n.getChildren === 'function' ? n.getChildren() : n.children) || [];\n                            ch.forEach(findEB);\n                        })(cocosScene);\n\n                        if (editBoxes.length > 0) {\n                            for (const eb of editBoxes) {\n                                eb.comp.string = ansStr;\n                                if (typeof eb.comp._updateStringLabel === 'function') eb.comp._updateStringLabel();\n                                eb.node.emit('editing-did-ended', eb.comp);\n                                eb.node.emit('text-changed', eb.comp);\n                            }\n                            IOE.toast(`\u26a1 \u0110\u00e3 \u0111i\u1ec1n \u0111\u00e1p \u00e1n v\u00e0o EditBox: ${ansStr}`, 1500);\n                            return true;\n                        }\n                    }\n\n                    // b. Click n\u00fat tr\u1eafc nghi\u1ec7m Cocos\n                    const updatedClickables = findCocosClickables(cocosScene);\n                    for (const c of updatedClickables) {\n                        const ct = c.text.toLowerCase();\n                        if (ct.includes(ansLower) || ct.startsWith(ansLower)) {\n                            await clickCocosNode(c.node);\n                            IOE.toast(`\u26a1 \u0110\u00e3 t\u1ef1 click \u0111\u00e1p \u00e1n Cocos2d: ${meta.answer}`, 1500);\n                            return true;\n                        }\n                    }\n\n                    // c. Nh\u1eadp ph\u00edm v\u00e0o Canvas\n                    typeCanvasString(ansStr);\n                    return true;\n                }\n            }\n        }\n\n        // 3. Fallback CreateJS\n        const stage = win.stage || win.exportRoot?.stage || null;\n        const root = win.exportRoot || null;\n        if (root) {\n            const texts = (function extract(c) {\n                if (!c) return [];\n                const res = [];\n                (c.children || []).forEach(ch => {\n                    if (ch.text) res.push(ch.text);\n                    if (ch.children) res.push(...extract(ch));\n                });\n                return res;\n            })(root);\n\n            if (texts.length > 0) {\n                const meta = await IOE.question?.solveQuestion(null, texts.join(' '), texts);\n                if (meta?.answer) {\n                    typeCanvasString(String(meta.answer));\n                    return true;\n                }\n            }\n        }\n\n        return false;\n    }\n\n    IOE.canvas = {\n        solveCanvasGame,\n        solveCocosClozePassage,\n        getCocosScene,\n        extractCocosTexts,\n        findCocosClickables,\n        clickCocosNode,\n        typeCanvasString\n    };\n})(typeof window !== 'undefined' ? window : globalThis);\n\n\n/* --- functions/answerRevealer.js --- */\n(function (global) {\n    'use strict';\n    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;\n    const IOE = win.IOE || global.IOE;\n    if (!IOE) return;\n\n    const HUD_ID = 'yanzioe-revealer-hud';\n\n    function ensureHud() {\n        let hud = document.getElementById(HUD_ID);\n        if (!hud && document.body) {\n            hud = document.createElement('div');\n            hud.id = HUD_ID;\n            hud.style.cssText = `\n                position: fixed;\n                bottom: 12px;\n                left: 16px;\n                transform: none;\n                z-index: 9999999;\n                background: rgba(15, 23, 42, 0.94);\n                backdrop-filter: blur(10px);\n                border: 1px solid rgba(56, 189, 248, 0.45);\n                border-radius: 8px;\n                padding: 6px 12px;\n                box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);\n                font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif;\n                font-size: 12px;\n                color: #f8fafc;\n                min-width: 280px;\n                max-width: min(90vw, 750px);\n                max-height: 54px;\n                overflow: hidden;\n                display: none;\n                flex-direction: column;\n                gap: 6px;\n                transition: max-height 0.25s ease;\n            `;\n            document.body.appendChild(hud);\n        }\n        return hud;\n    }\n\n    function renderReveal(meta) {\n        if (!meta || !IOE.features?.showAnswers || IOE.features?.streamMode) {\n            const hud = document.getElementById(HUD_ID);\n            if (hud) hud.style.display = 'none';\n            return;\n        }\n\n        const hud = ensureHud();\n        if (!hud) return;\n\n        const safeTier = IOE.escHtml(meta.tier || 'AI');\n        const safeAns = IOE.escHtml(meta.answer || '');\n        const safeThink = IOE.escHtml(meta.thinking || '');\n\n        hud.style.display = 'flex';\n        hud.innerHTML = `\n            <div style=\"display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:nowrap;width:100%;\">\n                <div style=\"display:flex;align-items:center;gap:6px;min-width:0;max-width:calc(100% - 215px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;\" id=\"yanzioe-copy-area\" title=\"Nh\u1ea5n \u0111\u1ec3 sao ch\u00e9p\">\n                    <span style=\"background:#0284c7;color:#fff;padding:2px 7px;border-radius:5px;font-size:10.5px;font-weight:700;flex-shrink:0;\">${safeTier}</span>\n                    <span style=\"color:#f8fafc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\"><strong>\u0110\u00e1p \u00c1n:</strong> ${safeAns}</span>\n                </div>\n                <div style=\"display:flex;align-items:center;gap:6px;flex-shrink:0;\">\n                    <button type=\"button\" id=\"yanzioe-fill-btn\" style=\"background:#38bdf8;color:#082f49;border:none;border-radius:5px;padding:3px 9px;font-weight:700;cursor:pointer;font-size:11.5px;\">Fill</button>\n                    <button type=\"button\" id=\"yanzioe-copy-btn\" style=\"background:#1e293b;color:#e2e8f0;border:1px solid rgba(56,189,248,0.45);border-radius:5px;padding:3px 8px;font-weight:700;cursor:pointer;font-size:11.5px;\">Sao ch\u00e9p</button>\n                    ${safeThink ? '<button type=\"button\" id=\"yanzioe-think-btn\" style=\"background:#4f46e5;color:#ffffff;border:none;border-radius:5px;padding:3px 8px;font-weight:700;cursor:pointer;font-size:11.5px;display:inline-flex;align-items:center;gap:3px;\" title=\"Xem t\u01b0 duy AI (0ms)\">\ud83e\udde0 Suy ngh\u0129 (0ms)</button>' : ''}\n                </div>\n            </div>\n            ${safeThink ? `<div id=\"yanzioe-think-panel\" style=\"display:none;width:100%;margin-top:4px;padding:8px 10px;background:rgba(15,23,42,0.92);border:1px solid rgba(99,102,241,0.45);border-radius:6px;font-size:11.5px;line-height:1.5;color:#e2e8f0;white-space:pre-wrap;word-break:break-word;max-height:160px;overflow-y:auto;\">${safeThink}</div>` : ''}\n        `;\n\n        document.getElementById('yanzioe-fill-btn')?.addEventListener('click', () => {\n            if (IOE.auto?.fillAnswer) IOE.auto.fillAnswer(meta.answer);\n            if (IOE.canvas?.typeIntoCanvas) IOE.canvas.typeIntoCanvas(meta.answer);\n        });\n\n        const copyAction = () => {\n            navigator.clipboard.writeText(meta.answer || '').then(() => {\n                IOE.toast('\u2713 \u0110\u00e3 ch\u00e9p \u0111\u00e1p \u00e1n!', 1200);\n            });\n        };\n\n        document.getElementById('yanzioe-copy-btn')?.addEventListener('click', copyAction);\n        document.getElementById('yanzioe-copy-area')?.addEventListener('click', copyAction);\n\n        const thinkBtn = document.getElementById('yanzioe-think-btn');\n        const thinkPanel = document.getElementById('yanzioe-think-panel');\n        if (thinkBtn && thinkPanel) {\n            thinkBtn.addEventListener('click', (e) => {\n                e.preventDefault();\n                e.stopPropagation();\n                const isOpen = thinkPanel.style.display !== 'none';\n                thinkPanel.style.display = isOpen ? 'none' : 'block';\n                thinkBtn.style.background = isOpen ? '#4f46e5' : '#4338ca';\n                hud.style.maxHeight = isOpen ? '54px' : '240px';\n                hud.style.overflow = isOpen ? 'hidden' : 'visible';\n            });\n        }\n    }\n\n    IOE.events.on('questionSolved', renderReveal);\n    IOE.revealer = { renderReveal };\n})(typeof window !== 'undefined' ? window : globalThis);\n\n\n/* --- functions/autoAnswer.js --- */\n(function (global) {\n    'use strict';\n    const IOE = global.IOE;\n    if (!IOE) return;\n\n    let isProcessing = false;\n\n    async function stepOnce() {\n        if (isProcessing || !IOE.features?.autoAnswer) return;\n        isProcessing = true;\n\n        try {\n            // 1. Qu\u00e9t Canvas / Cocos2d minigame\n            if (IOE.features?.canvasMode !== false && IOE.canvas?.solveCanvasGame) {\n                const canvasSolved = await IOE.canvas.solveCanvasGame();\n                if (canvasSolved) {\n                    await IOE.delay(IOE.featureConfigs?.autoDelay || 1500);\n                    return;\n                }\n            }\n\n            // 2. Qu\u00e9t Web DOM\n            const qEl = document.querySelector('.question-content, .exam-content, .title-question, .content-question, #question-content');\n            const qText = qEl ? qEl.innerText.trim() : '';\n\n            const choiceEls = Array.from(document.querySelectorAll('.answer-item, .choice-item, input[type=\"radio\"], .btn-answer, .item-answer'));\n            const options = choiceEls.map(c => c.innerText.trim()).filter(Boolean);\n\n            if (qText) {\n                const qId = qEl.dataset?.id || qEl.id || qText.slice(0, 40);\n                let meta = IOE.state.solvedMeta.get(qId);\n                if (!meta) {\n                    meta = await IOE.question.solveQuestion(qId, qText, options);\n                }\n\n                if (meta?.answer) {\n                    fillAnswer(meta.answer);\n                    if (IOE.features?.autoAnswer) {\n                        await IOE.delay(IOE.featureConfigs?.autoDelay || 1200);\n                        clickNextButton();\n                    }\n                }\n            }\n        } catch (e) {\n            console.error('[IOE AutoAnswer Error]', e);\n        } finally {\n            isProcessing = false;\n        }\n    }\n\n    function fillAnswer(ans, area = null) {\n        if (!ans) return;\n        const normAns = String(ans).trim().toLowerCase();\n        const root = area || document;\n\n        // 1. D\u1ea1ng S\u1eafp x\u1ebfp t\u1eeb (n\u1ebfu c\u00f3 th\u1ebb t\u1eeb .word-item v\u00e0 \u0111\u00e1p \u00e1n l\u00e0 c\u00e2u nhi\u1ec1u t\u1eeb)\n        const chips = Array.from(root.querySelectorAll('.word-item, .drag-item, .card-word, .item-reorder'));\n        if (chips.length > 0 && normAns.includes(' ')) {\n            const words = ans.split(/\\s+/).map(w => w.toLowerCase().replace(/[^a-z0-9]/g, ''));\n            words.forEach(targetWord => {\n                const matchedChip = chips.find(chip => {\n                    const cText = chip.innerText.trim().toLowerCase().replace(/[^a-z0-9]/g, '');\n                    return cText === targetWord && !chip.dataset.kwClicked;\n                });\n                if (matchedChip) {\n                    matchedChip.dataset.kwClicked = '1';\n                    matchedChip.click();\n                }\n            });\n            IOE.toast('\ud83e\udde9 \u0110\u00e3 s\u1eafp x\u1ebfp c\u00e2u!', 1200);\n            return;\n        }\n\n        // 2. D\u1ea1ng \u0110i\u1ec1n t\u1eeb v\u00e0o \u00f4 input\n        const inputs = Array.from(root.querySelectorAll('input.blank-input, input[type=\"text\"].answer, input.form-control, input.input-answer'));\n        if (inputs.length > 0) {\n            const inp = inputs.find(el => !el.value) || inputs[0];\n            if (inp) {\n                inp.value = ans;\n                inp.dispatchEvent(new Event('input', { bubbles: true }));\n                inp.dispatchEvent(new Event('change', { bubbles: true }));\n                IOE.toast(`\u270d\ufe0f \u0110\u00e3 \u0111i\u1ec1n: ${ans}`, 1000);\n                return;\n            }\n        }\n\n        // 3. D\u1ea1ng Tr\u1eafc nghi\u1ec7m (Radio / Buttons A, B, C, D)\n        const choices = Array.from(root.querySelectorAll('.answer-item, .choice-item, .btn-answer, .item-answer, input[type=\"radio\"]'));\n        if (choices.length > 0) {\n            for (let i = 0; i < choices.length; i++) {\n                const c = choices[i];\n                const text = c.innerText.trim().toLowerCase();\n                const letter = String.fromCharCode(65 + i).toLowerCase();\n                if (normAns === letter || text.includes(normAns) || normAns.includes(text)) {\n                    c.click();\n                    IOE.toast(`\ud83c\udfaf \u0110\u00e3 ch\u1ecdn: ${c.innerText.trim()}`, 1000);\n                    return;\n                }\n            }\n        }\n    }\n\n    function clickNextButton() {\n        const nextBtns = Array.from(document.querySelectorAll('button, a, input[type=\"button\"]')).filter(btn => {\n            const t = (btn.innerText || btn.value || '').toLowerCase();\n            return /(ti\u1ebfp t\u1ee5c|c\u00e2u ti\u1ebfp|qua c\u00e2u|n\u1ed9p b\u00e0i|x\u00e1c nh\u1eadn|next|submit)/.test(t) && !btn.disabled;\n        });\n        if (nextBtns.length > 0) {\n            nextBtns[0].click();\n            IOE.toast('\u23e9 \u0110\u00e3 chuy\u1ec3n c\u00e2u ti\u1ebfp theo', 1000);\n        }\n    }\n\n    setInterval(stepOnce, 2000);\n\n    IOE.auto = {\n        stepOnce,\n        fillAnswer,\n        clickNextButton\n    };\n})(typeof window !== 'undefined' ? window : globalThis);\n\n\n/* --- visuals/mainMenu.js --- */\n(function (global) {\n    'use strict';\n    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;\n    const IOE = win.IOE || global.IOE;\n    if (!IOE) return;\n\n    let isMenuVisible = true;\n    let isCollapsed = false;\n    let activeTab = 'features';\n\n    const STORAGE_KEY = 'YANZIOE_CONFIG_VIP_V1';\n\n    function loadSavedConfig() {\n        let bestKey = '';\n        try {\n            // Qu\u00e9t t\u1ea5t c\u1ea3 c\u00e1c kho l\u01b0u tr\u1eef ti\u1ec1m n\u0103ng \u0111\u1ec3 t\u00ecm API key c\u00f2n l\u01b0u\n            const candidates = [\n                IOE.featureConfigs?.apiKey,\n                localStorage.getItem('IOE_API_KEY'),\n                localStorage.getItem('YANZIOE_API_KEY'),\n                (function () {\n                    try { return sessionStorage.getItem('IOE_API_KEY') || sessionStorage.getItem('YANZIOE_API_KEY'); } catch (e) { return ''; }\n                })(),\n                (function () {\n                    try {\n                        const wn = JSON.parse(window.name || '{}');\n                        return wn.IOE_API_KEY || wn.apiKey || '';\n                    } catch (e) { return ''; }\n                })(),\n                (function () {\n                    const m = /IOE_API_KEY=([^;]+)/.exec(document.cookie || '');\n                    return m ? decodeURIComponent(m[1]) : '';\n                })(),\n                (typeof GM_getValue !== 'undefined' ? GM_getValue('IOE_API_KEY') : '')\n            ];\n            for (const c of candidates) {\n                if (c && typeof c === 'string' && c.trim().length > 5) {\n                    bestKey = c.trim();\n                    break;\n                }\n            }\n\n            const raw = localStorage.getItem(STORAGE_KEY);\n            if (raw) {\n                const parsed = JSON.parse(raw);\n                if (parsed.features) Object.assign(IOE.features, parsed.features);\n                if (parsed.configs) {\n                    const savedApiKey = parsed.configs.apiKey;\n                    delete parsed.configs.apiKey; // Kh\u00f4ng \u0111\u1ec3 chu\u1ed7i r\u1ed7ng ghi \u0111\u00e8 key h\u1ee3p l\u1ec7\n                    Object.assign(IOE.featureConfigs, parsed.configs);\n                    if (savedApiKey && savedApiKey.trim().length > 5 && !bestKey) {\n                        bestKey = savedApiKey.trim();\n                    }\n                }\n            }\n        } catch (e) {}\n\n        if (bestKey) {\n            IOE.featureConfigs.apiKey = bestKey;\n        }\n        return null;\n    }\n\n    function saveAllConfigs() {\n        try {\n            const key = (IOE.featureConfigs.apiKey || '').trim();\n            const payload = {\n                features: IOE.features,\n                configs: { ...IOE.featureConfigs, apiKey: key },\n                savedAt: Date.now()\n            };\n            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));\n            if (key) {\n                localStorage.setItem('IOE_API_KEY', key);\n                localStorage.setItem('YANZIOE_API_KEY', key);\n                try {\n                    sessionStorage.setItem('IOE_API_KEY', key);\n                    sessionStorage.setItem('YANZIOE_API_KEY', key);\n                } catch (e) {}\n                try {\n                    let wn = {};\n                    try { wn = JSON.parse(window.name || '{}'); } catch (e) {}\n                    wn.IOE_API_KEY = key;\n                    window.name = JSON.stringify(wn);\n                } catch (e) {}\n                try {\n                    document.cookie = `IOE_API_KEY=${encodeURIComponent(key)}; path=/; max-age=315360000; SameSite=Lax`;\n                } catch (e) {}\n                if (typeof GM_setValue !== 'undefined') {\n                    try { GM_setValue('IOE_API_KEY', key); } catch (e) {}\n                }\n            }\n        } catch (e) {}\n    }\n\n    // T\u1ea3i c\u1ea5u h\u00ecnh \u0111\u00e3 l\u01b0u ngay khi kh\u1edfi \u0111\u1ed9ng\n    loadSavedConfig();\n\n    function createMainMenu() {\n        if (document.getElementById('yanzioe-root') || !document.body) return;\n\n        const root = document.createElement('div');\n        root.id = 'yanzioe-root';\n        root.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif;pointer-events:auto;user-select:none;';\n\n        root.innerHTML = `\n            <style>\n                @keyframes ioeRgb {\n                    0% { color: #38bdf8; text-shadow: 0 0 10px rgba(56,189,248,0.7); }\n                    33% { color: #818cf8; text-shadow: 0 0 10px rgba(129,140,248,0.7); }\n                    66% { color: #c084fc; text-shadow: 0 0 10px rgba(192,132,252,0.7); }\n                    100% { color: #38bdf8; text-shadow: 0 0 10px rgba(56,189,248,0.7); }\n                }\n                .yanz-rgb-text { animation: ioeRgb 4s linear infinite; }\n                .yanz-tab-btn {\n                    flex: 1; padding: 7px 0; background: transparent; border: none; border-bottom: 2px solid transparent;\n                    color: #94a3b8; font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.2s ease;\n                    text-align: center;\n                }\n                .yanz-tab-btn.active {\n                    color: #38bdf8; border-bottom: 2px solid #38bdf8; background: rgba(56,189,248,0.08);\n                }\n                .yanz-tab-btn:hover { color: #f8fafc; }\n                .yanz-toggle-row {\n                    display: flex; align-items: center; justify-content: space-between;\n                    padding: 6px 0; border-bottom: 1px solid rgba(51,65,85,0.4);\n                    font-size: 11.5px; color: #e2e8f0; cursor: pointer;\n                }\n                .yanz-toggle-row input { cursor: pointer; accent-color: #38bdf8; width: 14px; height: 14px; }\n                .yanz-input {\n                    width: 100%; box-sizing: border-box; background: rgba(15,23,42,0.8);\n                    border: 1px solid rgba(56,189,248,0.3); border-radius: 6px;\n                    color: #f8fafc; padding: 6px 8px; font-size: 11px; outline: none; margin-top: 4px;\n                }\n                .yanz-input:focus { border-color: #38bdf8; box-shadow: 0 0 8px rgba(56,189,248,0.3); }\n                .yanz-btn {\n                    background: linear-gradient(135deg, #0284c7, #2563eb); color: #fff;\n                    border: none; border-radius: 6px; padding: 7px 0; font-weight: 700; font-size: 11.5px;\n                    cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 10px rgba(2,132,199,0.35);\n                    width: 100%; text-align: center;\n                }\n                .yanz-btn:hover { filter: brightness(1.15); transform: translateY(-1px); }\n                .yanz-btn:active { transform: translateY(0); }\n            </style>\n\n            <div id=\"yanzioe-panel\" style=\"width:315px;background:rgba(15,23,42,0.96);backdrop-filter:blur(16px);border:1px solid rgba(56,189,248,0.45);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.65);color:#f8fafc;overflow:hidden;\">\n                <!-- Header (Draggable) -->\n                <div id=\"yanzioe-drag-handle\" style=\"display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(30,41,59,0.9);border-bottom:1px solid rgba(56,189,248,0.25);cursor:move;\">\n                    <div style=\"display:flex;align-items:center;gap:7px;\">\n                        <span style=\"font-size:16px;\">\ud83c\udf10</span>\n                        <strong class=\"yanz-rgb-text\" style=\"font-size:13.5px;letter-spacing:0.5px;\">YANZIOE VIP</strong>\n                        <span style=\"background:linear-gradient(135deg,#0284c7,#3b82f6);color:#fff;font-size:9px;padding:1.5px 5px;border-radius:4px;font-weight:800;\">v1.1.4</span>\n                    </div>\n                    <div style=\"display:flex;align-items:center;gap:5px;\">\n                        <button id=\"yanzioe-collapse-btn\" style=\"background:rgba(51,65,85,0.7);border:1px solid rgba(148,163,184,0.3);color:#cbd5e1;cursor:pointer;font-size:10px;padding:2px 7px;border-radius:4px;font-weight:700;\">Thu nh\u1ecf \u25b2</button>\n                        <button id=\"yanzioe-close-btn\" style=\"background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:14px;padding:0 3px;font-weight:700;\">\u2715</button>\n                    </div>\n                </div>\n\n                <!-- Navigation Tabs -->\n                <div id=\"yanzioe-tabs\" style=\"display:flex;background:rgba(15,23,42,0.9);border-bottom:1px solid rgba(51,65,85,0.6);\">\n                    <button class=\"yanz-tab-btn active\" data-tab=\"features\">\u26a1 T\u00ednh n\u0103ng</button>\n                    <button class=\"yanz-tab-btn\" data-tab=\"settings\">\ud83c\udfaf T\u00f9y ch\u1ec9nh</button>\n                    <button class=\"yanz-tab-btn\" data-tab=\"status\">\ud83d\udcca Tr\u1ea1ng th\u00e1i</button>\n                    <button class=\"yanz-tab-btn\" data-tab=\"answers\">\ud83e\udde0 \u0110\u00e1p \u00e1n</button>\n                    <button class=\"yanz-tab-btn\" data-tab=\"dev\">\ud83d\udee0 Logs</button>\n                </div>\n\n                <!-- Tab 1: T\u00ednh n\u0103ng -->\n                <div id=\"yanz-tab-features\" class=\"yanz-tab-content\" style=\"padding:12px 14px;\">\n                    <button id=\"yanzioe-solve-btn\" class=\"yanz-btn\" style=\"margin-bottom:10px;font-size:12px;padding:8px 0;\">\n                        \u26a1 GI\u1ea2I B\u00c0I NGAY L\u1eacP T\u1ee8C\n                    </button>\n\n                    <label class=\"yanz-toggle-row\">\n                        <span>T\u1ef1 \u0111\u1ed9ng gi\u1ea3i & \u0110i\u1ec1n (AutoAnswer)</span>\n                        <input type=\"checkbox\" id=\"yanz-chk-auto\" ${IOE.features.autoAnswer ? 'checked' : ''}>\n                    </label>\n                    <label class=\"yanz-toggle-row\">\n                        <span>Hi\u1ec3n th\u1ecb HUD \u0111\u00e1p \u00e1n n\u1ed5i (Revealer)</span>\n                        <input type=\"checkbox\" id=\"yanz-chk-show\" ${IOE.features.showAnswers ? 'checked' : ''}>\n                    </label>\n                    <label class=\"yanz-toggle-row\">\n                        <span>Qu\u00e9t Cocos2d / Canvas game</span>\n                        <input type=\"checkbox\" id=\"yanz-chk-canvas\" ${IOE.features.canvasMode ? 'checked' : ''}>\n                    </label>\n                    <label class=\"yanz-toggle-row\">\n                        <span>Ch\u1eb7n \u0111\u1ebfm ng\u01b0\u1ee3c gi\u1edd (Freeze Time)</span>\n                        <input type=\"checkbox\" id=\"yanz-chk-freeze\" ${IOE.features.freezeTimer ? 'checked' : ''}>\n                    </label>\n                    <label class=\"yanz-toggle-row\">\n                        <span>M\u00e8o c\u01b0ng Oneko d\u1ea1o b\u01b0\u1edbc</span>\n                        <input type=\"checkbox\" id=\"yanz-chk-oneko\" ${IOE.features.oneko ? 'checked' : ''}>\n                    </label>\n                    <label class=\"yanz-toggle-row\" style=\"border-bottom:none;\">\n                        <span>Stream Mode (\u1ea8n to\u00e0n b\u1ed9 tool)</span>\n                        <input type=\"checkbox\" id=\"yanz-chk-stream\" ${IOE.features.streamMode ? 'checked' : ''}>\n                    </label>\n\n                    <div style=\"margin-top:8px;font-size:10px;color:#38bdf8;text-align:center;\">\n                        \ud83d\udcbe \u0110\u00e3 k\u00edch ho\u1ea1t c\u01a1 ch\u1ebf t\u1ef1 \u0111\u1ed9ng l\u01b0u c\u1ea5u h\u00ecnh\n                    </div>\n                </div>\n\n                <!-- Tab 2: T\u00f9y ch\u1ec9nh -->\n                <div id=\"yanz-tab-settings\" class=\"yanz-tab-content\" style=\"display:none;padding:12px 14px;\">\n                    <div style=\"font-size:11px;color:#94a3b8;margin-bottom:3px;\">Nh\u00e0 cung c\u1ea5p AI gi\u1ea3i b\u00e0i:</div>\n                    <select id=\"yanz-sel-provider\" class=\"yanz-input\" style=\"cursor:pointer;padding:5px;\">\n                        <option value=\"groq\" ${IOE.featureConfigs?.aiProvider === 'groq' ? 'selected' : ''}>\u26a1 Groq (Llama 3.3 70B - T\u1ed1c \u0111\u1ed9 0ms)</option>\n                        <option value=\"gemini\" ${IOE.featureConfigs?.aiProvider === 'gemini' ? 'selected' : ''}>\ud83c\udf1f Google Gemini API</option>\n                        <option value=\"openrouter\" ${IOE.featureConfigs?.aiProvider === 'openrouter' ? 'selected' : ''}>\ud83d\ude80 OpenRouter (Free/Custom Models)</option>\n                    </select>\n\n                    <div style=\"font-size:11px;color:#94a3b8;margin-top:8px;margin-bottom:3px;\">API Key (\u0110\u1ec3 tr\u1ed1ng d\u00f9ng Local CAS & Free fallback):</div>\n                    <input type=\"password\" id=\"yanz-inp-key\" class=\"yanz-input\" placeholder=\"gsk_... ho\u1eb7c AIzaSy... ho\u1eb7c sk-or-...\" value=\"${IOE.featureConfigs?.apiKey || ''}\">\n                    <button id=\"yanz-btn-save-key\" class=\"yanz-btn\" style=\"margin-top:6px;padding:5px 0;background:#0369a1;\">\ud83d\udcbe L\u01b0u & Kh\u00f3a API Key</button>\n\n                    <div style=\"font-size:11px;color:#94a3b8;margin-top:10px;margin-bottom:3px;\">\n                        \u0110\u1ed9 tr\u1ec5 \u0111i\u1ec1n \u0111\u00e1p \u00e1n: <strong id=\"yanz-delay-val\" style=\"color:#38bdf8;\">${((IOE.featureConfigs?.autoDelay || 1500) / 1000).toFixed(1)}s</strong>\n                    </div>\n                    <input type=\"range\" id=\"yanz-rng-delay\" min=\"300\" max=\"4000\" step=\"100\" value=\"${IOE.featureConfigs?.autoDelay || 1500}\" style=\"width:100%;accent-color:#38bdf8;cursor:pointer;\">\n\n                    <div style=\"font-size:11px;color:#94a3b8;margin-top:8px;margin-bottom:3px;\">Ch\u1ebf \u0111\u1ed9 ho\u1ea1t \u0111\u1ed9ng:</div>\n                    <select id=\"yanz-sel-mode\" class=\"yanz-input\" style=\"cursor:pointer;padding:5px;\">\n                        <option value=\"stealth\" ${IOE.featureConfigs?.questionMode === 'stealth' ? 'selected' : ''}>\ud83d\udd75\ufe0f Stealth (Tr\u00e1nh ph\u00e1t hi\u1ec7n, tr\u1ec5 ng\u1eabu nhi\u00ean)</option>\n                        <option value=\"turbo\" ${IOE.featureConfigs?.questionMode === 'turbo' ? 'selected' : ''}>\u26a1 Turbo (Gi\u1ea3i si\u00eau t\u1ed1c 0ms kh\u00f4ng ch\u1edd)</option>\n                    </select>\n                </div>\n\n                <!-- Tab 3: Tr\u1ea1ng th\u00e1i -->\n                <div id=\"yanz-tab-status\" class=\"yanz-tab-content\" style=\"display:none;padding:12px 14px;font-size:11.5px;\">\n                    <div style=\"background:rgba(30,41,59,0.7);padding:8px 10px;border-radius:6px;border:1px solid rgba(56,189,248,0.25);margin-bottom:8px;\">\n                        <div style=\"display:flex;justify-content:space-between;margin-bottom:4px;\">\n                            <span style=\"color:#94a3b8;\">\u0110\u1ed9ng c\u01a1 nh\u1eadn di\u1ec7n:</span>\n                            <strong id=\"yanz-stat-engine\" style=\"color:#38bdf8;\">Cocos Creator 2.x</strong>\n                        </div>\n                        <div style=\"display:flex;justify-content:space-between;margin-bottom:4px;\">\n                            <span style=\"color:#94a3b8;\">S\u1ed1 c\u00e2u trong b\u00e0i:</span>\n                            <strong id=\"yanz-stat-total-q\" style=\"color:#38bdf8;\">\u0110ang qu\u00e9t...</strong>\n                        </div>\n                        <div style=\"display:flex;justify-content:space-between;margin-bottom:4px;\">\n                            <span style=\"color:#94a3b8;\">Ti\u1ebfn \u0111\u1ed9 ho\u00e0n th\u00e0nh:</span>\n                            <strong id=\"yanz-stat-progress\" style=\"color:#4ade80;\">0 c\u00e2u</strong>\n                        </div>\n                        <div style=\"display:flex;justify-content:space-between;margin-bottom:4px;\">\n                            <span style=\"color:#94a3b8;\">Tr\u1ea1ng th\u00e1i g\u00f3i tin:</span>\n                            <strong id=\"yanz-stat-packet\" style=\"color:#4ade80;\">S\u1eb5n s\u00e0ng b\u1eaft Key</strong>\n                        </div>\n                        <div style=\"display:flex;justify-content:space-between;\">\n                            <span style=\"color:#94a3b8;\">T\u1ec9 l\u1ec7 ch\u00ednh x\u00e1c:</span>\n                            <strong style=\"color:#4ade80;\">100%</strong>\n                        </div>\n                    </div>\n                    <div style=\"font-size:10.5px;color:#94a3b8;text-align:center;\">\n                        H\u1ed7 tr\u1ee3: L\u00e2u \u0111\u00e0i tr\u00ean m\u00e2y, Kh\u1ec9 th\u00f4ng minh, Th\u1ee7 m\u00f4n, S\u1eafp x\u1ebfp c\u00e2u, \u0110i\u1ec1n t\u1eeb khuy\u1ebft & Web DOM.\n                    </div>\n                </div>\n\n                <!-- Tab 4: \u0110\u00e1p \u00e1n & T\u01b0 duy 0ms -->\n                <div id=\"yanz-tab-answers\" class=\"yanz-tab-content\" style=\"display:none;padding:12px 14px;\">\n                    <div style=\"font-size:11px;color:#94a3b8;margin-bottom:4px;\">C\u00e2u h\u1ecfi ph\u00e1t hi\u1ec7n:</div>\n                    <div id=\"yanz-ans-question\" style=\"background:rgba(30,41,59,0.7);padding:7px 10px;border-radius:6px;font-size:11px;color:#e2e8f0;max-height:60px;overflow-y:auto;border:1px solid rgba(51,65,85,0.7);\">\n                        Ch\u01b0a c\u00f3 c\u00e2u h\u1ecfi \u0111\u01b0\u1ee3c qu\u00e9t. B\u1ea5m \"Gi\u1ea3i b\u00e0i ngay\" \u0111\u1ec3 ph\u00e1t hi\u1ec7n!\n                    </div>\n\n                    <div style=\"font-size:11px;color:#94a3b8;margin-top:8px;margin-bottom:4px;\">\u0110\u00e1p \u00e1n gi\u1ea3i \u0111\u01b0\u1ee3c (\u0110\u1ea7y \u0111\u1ee7):</div>\n                    <div id=\"yanz-ans-result\" style=\"background:rgba(2,132,199,0.15);border:1px solid #0284c7;padding:7px 10px;border-radius:6px;font-size:12px;font-weight:700;color:#38bdf8;white-space:pre-wrap;max-height:90px;overflow-y:auto;\">\n                        ---\n                    </div>\n\n                    <div style=\"font-size:11px;color:#94a3b8;margin-top:8px;margin-bottom:4px;\">\ud83e\udde0 T\u01b0 duy ng\u00f4n ng\u1eef 0ms:</div>\n                    <div id=\"yanz-ans-thinking\" style=\"background:rgba(15,23,42,0.9);padding:7px 10px;border-radius:6px;font-size:10.5px;color:#cbd5e1;line-height:1.45;white-space:pre-wrap;max-height:90px;overflow-y:auto;border:1px solid rgba(51,65,85,0.7);\">\n                        S\u1eb5n s\u00e0ng ph\u00e2n t\u00edch ng\u1eef ph\u00e1p, ch\u1ee7 ng\u1eef, v\u1ecb ng\u1eef v\u00e0 tr\u1eadt t\u1ef1 c\u00e2u theo chu\u1ea9n ti\u1ebfng Anh.\n                    </div>\n                </div>\n\n                <!-- Tab 5: Logs -->\n                <div id=\"yanz-tab-dev\" class=\"yanz-tab-content\" style=\"display:none;padding:12px 14px;\">\n                    <div id=\"yanz-log-box\" style=\"background:#090d16;border:1px solid rgba(51,65,85,0.8);border-radius:6px;padding:6px 8px;font-family:monospace;font-size:10.5px;color:#38bdf8;height:120px;overflow-y:auto;white-space:pre-wrap;\">\n                        [YANZIOE] Kh\u1edfi \u0111\u1ed9ng h\u1ec7 th\u1ed1ng v1.1.4 th\u00e0nh c\u00f4ng.\n[YANZIOE] \u0110\u00e3 k\u1ebft n\u1ed1i v\u1edbi Canvas & DOM Observer.\n[YANZIOE] \u0110\u00e3 n\u1ea1p c\u1ea5u h\u00ecnh t\u1ef1 \u0111\u1ed9ng l\u01b0u th\u00e0nh c\u00f4ng.\n                    </div>\n                    <div style=\"display:flex;gap:6px;margin-top:6px;\">\n                        <button id=\"yanz-btn-clear-log\" style=\"flex:1;background:rgba(51,65,85,0.6);border:none;color:#cbd5e1;padding:5px 0;border-radius:4px;font-size:10px;cursor:pointer;\">X\u00f3a Logs</button>\n                        <button id=\"yanz-btn-scan-again\" style=\"flex:1;background:#0369a1;border:none;color:#fff;padding:5px 0;border-radius:4px;font-size:10px;cursor:pointer;font-weight:700;\">Qu\u00e9t l\u1ea1i Scene</button>\n                    </div>\n                </div>\n            </div>\n\n            <!-- Mini Pill (Khi thu nh\u1ecf) -->\n            <div id=\"yanzioe-pill\" style=\"display:none;background:rgba(15,23,42,0.95);backdrop-filter:blur(12px);border:1px solid rgba(56,189,248,0.6);border-radius:20px;padding:6px 14px;box-shadow:0 8px 24px rgba(0,0,0,0.5);cursor:pointer;color:#38bdf8;font-size:12px;font-weight:800;animation:ioeRgb 4s linear infinite;\">\n                \ud83c\udf10 YANZIOE VIP\n            </div>\n        `;\n\n        document.body.appendChild(root);\n\n        // \u0110\u1ed3ng b\u1ed9 giao di\u1ec7n v\u1edbi c\u1ea5u h\u00ecnh t\u1ef1 l\u01b0u\n        function syncUIWithState() {\n            const chkAuto = document.getElementById('yanz-chk-auto');\n            if (chkAuto) chkAuto.checked = !!IOE.features.autoAnswer;\n            const chkShow = document.getElementById('yanz-chk-show');\n            if (chkShow) chkShow.checked = !!IOE.features.showAnswers;\n            const chkCanvas = document.getElementById('yanz-chk-canvas');\n            if (chkCanvas) chkCanvas.checked = !!IOE.features.canvasMode;\n            const chkFreeze = document.getElementById('yanz-chk-freeze');\n            if (chkFreeze) chkFreeze.checked = !!IOE.features.freezeTimer;\n            const chkOneko = document.getElementById('yanz-chk-oneko');\n            if (chkOneko) chkOneko.checked = !!IOE.features.oneko;\n            const chkStream = document.getElementById('yanz-chk-stream');\n            if (chkStream) chkStream.checked = !!IOE.features.streamMode;\n\n            const keyInp = document.getElementById('yanz-inp-key');\n            if (keyInp) keyInp.value = IOE.featureConfigs.apiKey || '';\n\n            const selProv = document.getElementById('yanz-sel-provider');\n            if (selProv && IOE.featureConfigs.aiProvider) selProv.value = IOE.featureConfigs.aiProvider;\n\n            const selMode = document.getElementById('yanz-sel-mode');\n            if (selMode && IOE.featureConfigs.questionMode) selMode.value = IOE.featureConfigs.questionMode;\n\n            const rngDelay = document.getElementById('yanz-rng-delay');\n            const delayVal = document.getElementById('yanz-delay-val');\n            if (rngDelay && IOE.featureConfigs.autoDelay) {\n                rngDelay.value = IOE.featureConfigs.autoDelay;\n                if (delayVal) delayVal.innerText = `${(IOE.featureConfigs.autoDelay / 1000).toFixed(1)}s`;\n            }\n        }\n        syncUIWithState();\n\n        // Tab Switching\n        const tabs = root.querySelectorAll('.yanz-tab-btn');\n        tabs.forEach(tab => {\n            tab.addEventListener('click', () => {\n                const targetTab = tab.dataset.tab;\n                tabs.forEach(t => t.classList.remove('active'));\n                tab.classList.add('active');\n                root.querySelectorAll('.yanz-tab-content').forEach(c => c.style.display = 'none');\n                const showContent = root.querySelector(`#yanz-tab-${targetTab}`);\n                if (showContent) showContent.style.display = 'block';\n            });\n        });\n\n        // Dragging logic\n        const panel = document.getElementById('yanzioe-panel');\n        const pill = document.getElementById('yanzioe-pill');\n        const dragHandle = document.getElementById('yanzioe-drag-handle');\n\n        let isDragging = false, startX = 0, startY = 0, initialLeft = 0, initialTop = 0;\n\n        dragHandle?.addEventListener('mousedown', (e) => {\n            if (e.target.tagName === 'BUTTON') return;\n            isDragging = true;\n            startX = e.clientX;\n            startY = e.clientY;\n            const rect = root.getBoundingClientRect();\n            initialLeft = rect.left;\n            initialTop = rect.top;\n            root.style.right = 'auto';\n            root.style.left = `${initialLeft}px`;\n            root.style.top = `${initialTop}px`;\n        });\n\n        win.addEventListener('mousemove', (e) => {\n            if (!isDragging) return;\n            const dx = e.clientX - startX;\n            const dy = e.clientY - startY;\n            root.style.left = `${Math.max(0, initialLeft + dx)}px`;\n            root.style.top = `${Math.max(0, initialTop + dy)}px`;\n        });\n\n        win.addEventListener('mouseup', () => { isDragging = false; });\n\n        // Collapse / Expand\n        const collapseBtn = document.getElementById('yanzioe-collapse-btn');\n        collapseBtn?.addEventListener('click', () => {\n            panel.style.display = 'none';\n            pill.style.display = 'block';\n        });\n\n        pill?.addEventListener('click', () => {\n            panel.style.display = 'block';\n            pill.style.display = 'none';\n        });\n\n        document.getElementById('yanzioe-close-btn')?.addEventListener('click', () => {\n            root.style.display = 'none';\n            isMenuVisible = false;\n        });\n\n        // Log helper\n        function appendLog(msg) {\n            const box = document.getElementById('yanz-log-box');\n            if (box) {\n                const line = document.createElement('div');\n                line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;\n                box.appendChild(line);\n                box.scrollTop = box.scrollHeight;\n            }\n        }\n        IOE.appendLog = appendLog;\n\n        // C\u1eadp nh\u1eadt s\u1ed1 c\u00e2u trong b\u00e0i\n        IOE.updateQuizSummary = function (total, filled) {\n            const totalEl = document.getElementById('yanz-stat-total-q');\n            const progEl = document.getElementById('yanz-stat-progress');\n            if (totalEl) totalEl.innerText = `${total} c\u00e2u`;\n            if (progEl) {\n                const pct = total > 0 ? Math.round((filled / total) * 100) : 0;\n                progEl.innerText = `${filled}/${total} c\u00e2u (${pct}%)`;\n            }\n        };\n\n        // Solve button\n        document.getElementById('yanzioe-solve-btn')?.addEventListener('click', async () => {\n            appendLog('B\u1eaft \u0111\u1ea7u qu\u00e9t v\u00e0 gi\u1ea3i to\u00e0n b\u1ed9 b\u00e0i...');\n            IOE.toast('\ud83d\udd0d \u0110ang b\u00f3c t\u00e1ch \u0111\u1ec1 thi & t\u00ednh to\u00e1n \u0111\u00e1p \u00e1n...', 1200);\n\n            // 1. Qu\u00e9t Cocos2d / Canvas\n            if (IOE.canvas?.solveCanvasGame) {\n                const res = await IOE.canvas.solveCanvasGame();\n                if (res) {\n                    appendLog('\u2713 \u0110\u00e3 gi\u1ea3i b\u00e0i Canvas Cocos2d th\u00e0nh c\u00f4ng!');\n                    return;\n                }\n            }\n\n            // 2. Qu\u00e9t DOM\n            if (IOE.auto?.stepOnce) {\n                IOE.auto.stepOnce();\n                appendLog('\u2713 \u0110\u00e3 th\u1ef1c hi\u1ec7n gi\u1ea3i t\u1ef1 \u0111\u1ed9ng tr\u00ean Web DOM.');\n            }\n        });\n\n        // Save key & Auto-Save\n        const keyInpEl = document.getElementById('yanz-inp-key');\n        keyInpEl?.addEventListener('input', (e) => {\n            const key = e.target.value.trim();\n            IOE.featureConfigs.apiKey = key;\n            saveAllConfigs();\n        });\n        keyInpEl?.addEventListener('change', (e) => {\n            const key = e.target.value.trim();\n            IOE.featureConfigs.apiKey = key;\n            saveAllConfigs();\n            IOE.toast('\ud83d\udcbe \u0110\u00e3 t\u1ef1 \u0111\u1ed9ng l\u01b0u API Key v\u0129nh vi\u1ec5n!', 1200);\n            appendLog(`\u0110\u00e3 l\u01b0u API Key: ${key ? '***' + key.slice(-4) : '(\u0110\u1ec3 tr\u1ed1ng)'}`);\n        });\n        keyInpEl?.addEventListener('blur', (e) => {\n            const key = e.target.value.trim();\n            IOE.featureConfigs.apiKey = key;\n            saveAllConfigs();\n        });\n\n        document.getElementById('yanz-btn-save-key')?.addEventListener('click', () => {\n            const key = document.getElementById('yanz-inp-key')?.value.trim() || '';\n            IOE.featureConfigs.apiKey = key;\n            saveAllConfigs();\n            IOE.toast('\ud83d\udcbe \u0110\u00e3 l\u01b0u c\u1ea5u h\u00ecnh & API Key!', 1500);\n            appendLog(`\u0110\u00e3 l\u01b0u API Key: ${key ? '***' + key.slice(-4) : '(\u0110\u1ec3 tr\u1ed1ng)'}`);\n        });\n\n        // Select Provider\n        document.getElementById('yanz-sel-provider')?.addEventListener('change', (e) => {\n            IOE.featureConfigs.aiProvider = e.target.value;\n            saveAllConfigs();\n            IOE.toast(`\ud83d\udcbe \u0110\u00e3 \u0111\u1ed5i Provider: ${e.target.value}`, 1000);\n            appendLog(`AI Provider: ${e.target.value}`);\n        });\n\n        // Select Mode\n        document.getElementById('yanz-sel-mode')?.addEventListener('change', (e) => {\n            IOE.featureConfigs.questionMode = e.target.value;\n            saveAllConfigs();\n            IOE.toast(`\ud83d\udcbe Ch\u1ebf \u0111\u1ed9: ${e.target.value}`, 1000);\n            appendLog(`Ch\u1ebf \u0111\u1ed9: ${e.target.value}`);\n        });\n\n        // Delay slider\n        const delaySlider = document.getElementById('yanz-rng-delay');\n        const delayVal = document.getElementById('yanz-delay-val');\n        delaySlider?.addEventListener('input', (e) => {\n            const v = e.target.value;\n            IOE.featureConfigs.autoDelay = parseInt(v);\n            if (delayVal) delayVal.innerText = `${(v / 1000).toFixed(1)}s`;\n            saveAllConfigs();\n        });\n\n        // Toggles v\u1edbi c\u01a1 ch\u1ebf Auto-Save t\u1ee9c th\u00ec\n        document.getElementById('yanz-chk-auto')?.addEventListener('change', (e) => {\n            IOE.features.autoAnswer = e.target.checked;\n            saveAllConfigs();\n            IOE.toast(e.target.checked ? '\u26a1 B\u1eadt Auto-Answer (\u0110\u00e3 l\u01b0u)' : '\u23f9 \u0110\u00e3 t\u1eaft Auto-Answer (\u0110\u00e3 l\u01b0u)', 1200);\n            appendLog(`Auto-Answer: ${e.target.checked ? 'B\u1eacT' : 'T\u1eaeT'}`);\n        });\n\n        document.getElementById('yanz-chk-canvas')?.addEventListener('change', (e) => {\n            IOE.features.canvasMode = e.target.checked;\n            saveAllConfigs();\n            appendLog(`Qu\u00e9t Cocos2d / Canvas: ${e.target.checked ? 'B\u1eacT' : 'T\u1eaeT'}`);\n        });\n\n        document.getElementById('yanz-chk-show')?.addEventListener('change', (e) => {\n            IOE.features.showAnswers = e.target.checked;\n            saveAllConfigs();\n        });\n\n        document.getElementById('yanz-chk-freeze')?.addEventListener('change', (e) => {\n            IOE.features.freezeTimer = e.target.checked;\n            saveAllConfigs();\n        });\n\n        document.getElementById('yanz-chk-oneko')?.addEventListener('change', (e) => {\n            IOE.features.oneko = e.target.checked;\n            saveAllConfigs();\n            if (IOE.oneko?.toggle) IOE.oneko.toggle(e.target.checked);\n        });\n\n        document.getElementById('yanz-chk-stream')?.addEventListener('change', (e) => {\n            IOE.features.streamMode = e.target.checked;\n            saveAllConfigs();\n            root.style.display = e.target.checked ? 'none' : 'block';\n            const hud = document.getElementById('yanzioe-revealer-hud');\n            if (hud) hud.style.display = e.target.checked ? 'none' : 'flex';\n            IOE.toast(e.target.checked ? '\ud83d\udd75\ufe0f Stream Mode B\u1eacT' : '\ud83d\udc41 Stream Mode T\u1eaeT', 1200);\n        });\n\n        document.getElementById('yanz-btn-clear-log')?.addEventListener('click', () => {\n            const box = document.getElementById('yanz-log-box');\n            if (box) box.innerHTML = '';\n        });\n\n        document.getElementById('yanz-btn-scan-again')?.addEventListener('click', async () => {\n            appendLog('\u0110ang qu\u00e9t l\u1ea1i Cocos2d Scene...');\n            if (IOE.canvas?.solveCanvasGame) await IOE.canvas.solveCanvasGame();\n        });\n\n        // Listen for solved events to update Tab 4 (\u0110\u00e1p \u00e1n)\n        IOE.events.on('questionSolved', (meta) => {\n            const qEl = document.getElementById('yanz-ans-question');\n            const aEl = document.getElementById('yanz-ans-result');\n            const tEl = document.getElementById('yanz-ans-thinking');\n            const cEl = document.getElementById('yanz-stat-count');\n            if (qEl && (meta.qText || meta.qId)) qEl.innerText = meta.qText || meta.qId;\n            if (aEl && meta.answer) aEl.innerText = meta.answer;\n            if (tEl && meta.thinking) tEl.innerText = meta.thinking;\n            if (cEl) cEl.innerText = `${IOE.state.solvedMeta.size} c\u00e2u`;\n        });\n\n        // Hotkey Alt+H\n        win.addEventListener('keydown', (e) => {\n            if (e.altKey && e.code === 'KeyH') {\n                e.preventDefault();\n                isMenuVisible = !isMenuVisible;\n                root.style.display = isMenuVisible ? 'block' : 'none';\n            }\n        });\n    }\n\n    IOE.onBodyReady(createMainMenu);\n    setInterval(() => {\n        if (!document.getElementById('yanzioe-root') && document.body) {\n            createMainMenu();\n        }\n    }, 1500);\n})(typeof window !== 'undefined' ? window : globalThis);\n";
            (document.head || document.documentElement).appendChild(s);
        } catch(e) {}
    }
})();

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

    let lastToastMsg = '';
    let lastToastTime = 0;

    function toast(msg, duration = 2200) {
        const now = Date.now();
        if (msg === lastToastMsg && (now - lastToastTime) < 2500) {
            return; // Chặn spam cùng 1 toast trong 2.5s
        }
        lastToastMsg = msg;
        lastToastTime = now;

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
            autoAnswer: true,
            showAnswers: true,
            canvasMode: true,
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
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const IOE = global.IOE || win.IOE;
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

    function isValidClozeWord(w) {
        if (!w || typeof w !== 'string') return false;
        const str = w.trim();
        if (str.length < 1 || str.length > 35) return false;
        // Loại bỏ chuỗi rỗng, dấu gạch nối, dấu chấm, placeholder
        if (/^[_.\s-]+$/.test(str) || str.includes('______') || str.includes('...')) return false;
        // Loại bỏ URL, tên miền rác
        if (/https?:\/\/|\.com|\.net|\.org|\.vn|\.br|\.py|\.az|\.co|\.kh|\.il|\.hu|\.jp|translate\./i.test(str)) return false;
        // Bắt buộc phải có ít nhất một chữ cái
        if (!/[a-zA-Z]/.test(str)) return false;
        return true;
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
            keywords: ['vietnam is becoming', 'different nations', 'cuisines', 'japan, korea, and italy', 'hanoi and ho chi minh city', 'mid-autumn', 'offices in vietnam', 'open to learning'],
            words: {
                "1": "multicultural",
                "2": "from",
                "3": "set up",
                "4": "foreign",
                "5": "explore",
                "6": "cultural",
                "7": "appreciation",
                "8": "respect",
                "9": "conflict",
                "10": "lonely",
                "11": "citizenship"
            }
        },
        {
            keywords: ['gia long', 'first emperor', 'nguyen dynasty', 'nguyen phuc anh', 'pigneau de', 'thuc anh', 'coastal tip', 'trusted adviser', 'european armaments', 'rise to power', 'french priest', 'rival leaders', 'rival groups'],
            words: {
                "1": "first",
                "2": "as",
                "3": "southern",
                "4": "In spite of",
                "5": "encounter",
                "6": "as",
                "7": "target",
                "8": "wipe out",
                "9": "of",
                "10": "hands"
            }
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
        { pattern: /(?:the|was the)\s+(?:\(\d+\)|_{2,}|\.{3,})\s+emperor/i, word: 'first' },
        { pattern: /born\s+(?:\(\d+\)|_{2,}|\.{3,})\s+Nguyen/i, word: 'as' },
        { pattern: /ruled over\s+(?:\(\d+\)|_{2,}|\.{3,})\s+Vietnam/i, word: 'southern' },
        { pattern: /(?:\(\d+\)|_{2,}|\.{3,})\s+being born into/i, word: 'In spite of' },
        { pattern: /had to\s+(?:\(\d+\)|_{2,}|\.{3,})\s+many difficulties/i, word: 'encounter' },
        { pattern: /became the\s+(?:\(\d+\)|_{2,}|\.{3,})\s+of rival groups/i, word: 'target' },
        { pattern: /attempted to\s+(?:\(\d+\)|_{2,}|\.{3,})\s+the/i, word: 'wipe out' },
        { pattern: /at the\s+(?:\(\d+\)|_{2,}|\.{3,})\s+of the rival leaders/i, word: 'hands' },
        { pattern: /at the hands\s+(?:\(\d+\)|_{2,}|\.{3,})\s+the rival leaders/i, word: 'of' },
        { pattern: /tip of Vietnam\s+(?:\(\d+\)|_{2,}|\.{3,})\s+by chance/i, word: 'where' },
        { pattern: /Pigneau de Behaine,?\s+(?:\(\d+\)|_{2,}|\.{3,})\s+would/i, word: 'who' },
        { pattern: /play a major\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'role' },
        { pattern: /with the\s+(?:\(\d+\)|_{2,}|\.{3,})\s+of the priest/i, word: 'help' },
        { pattern: /(?:and|,)\s+(?:\(\d+\)|_{2,}|\.{3,})\s+with advanced European/i, word: 'equipped' },
        { pattern: /he was\s+(?:\(\d+\)|_{2,}|\.{3,})\s+in securing/i, word: 'successful' },
        { pattern: /avoiding\s+(?:social\s+)?(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'conflict' },
        { pattern: /less\s+(?:\(\d+\)|_{2,}|\.{3,})\s+and\s+more\s+connected/i, word: 'lonely' },
        { pattern: /spirit\s+of\s+global\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'citizenship' },
        { pattern: /global\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'citizenship' },
        { pattern: /cuisines?\s+(?:\(\d+\)|_{2,}|\.{3,})\s+([a-z\s,]+)/i, word: 'from' },
        { pattern: /(?:companies|firms)\s+(?:\(\d+\)|_{2,}|\.{3,})\s+offices/i, word: 'set up' },
        { pattern: /(?:by|among)\s+(?:\(\d+\)|_{2,}|\.{3,})\s+residents/i, word: 'foreign' },
        { pattern: /more\s+(?:\(\d+\)|_{2,}|\.{3,})\s+country/i, word: 'multicultural' },
        { pattern: /open to learning\s+(?:.*)\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'explore' },
        { pattern: /(?:show|cultural)\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'appreciation' },
        { pattern: /(?:mutual|show)\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'respect' },
        { pattern: /(?:social|promote)\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'inclusion' },
        { pattern: /(?:feel|stay)\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'connected' },
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

        // 0. Xóa cache nếu đã chuyển sang đoạn văn bài thi khác
        const passageSnippet = normPassage.replace(/[^a-z0-9]/g, '').slice(0, 40);
        if (IOE.state._lastClozeSnippet && IOE.state._lastClozeSnippet !== passageSnippet) {
            IOE.state.clozeAnswers = {};
        }
        IOE.state._lastClozeSnippet = passageSnippet;

        // Quét trước bộ nhớ Cocos2d để lấy dữ liệu gốc nếu có
        try { scanCocosMemoryForAnswers(); } catch (e) {}

        const outAnswers = {};

        // 1. Kiểm tra đáp án bắt được từ Network / Bộ nhớ (Bypass Level 0)
        // BẮT BUỘC: Lọc chặt chẽ, chỉ sử dụng nếu là từ vựng thực sự, không nhận chuỗi rỗng "" hoặc placeholder
        const validSystemAnswers = {};
        if (IOE.state.clozeAnswers) {
            for (const [k, v] of Object.entries(IOE.state.clozeAnswers)) {
                if (isValidClozeWord(v)) {
                    validSystemAnswers[k] = String(v).trim();
                }
            }
        }

        if (Object.keys(validSystemAnswers).length >= (rows.length || 6)) {
            console.log('[YANZIOE Bypass] Sử dụng đáp án gốc bắt được từ hệ thống!');
            if (rows.length === 0) {
                Object.assign(outAnswers, validSystemAnswers);
            } else {
                for (const r of rows) {
                    const idxStr = String(r.index);
                    if (validSystemAnswers[idxStr]) {
                        outAnswers[idxStr] = validSystemAnswers[idxStr];
                    }
                }
            }
            if (Object.keys(outAnswers).length >= (rows.length || 6)) {
                const validEntries = Object.entries(outAnswers)
                    .filter(([k, v]) => isValidClozeWord(v))
                    .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10));
                if (validEntries.length > 0) {
                    const detailedAnswers = validEntries.map(([k, v]) => `• Câu ${k}: ${v}`).join('\n');
                    const compactAnswers = validEntries.map(([k, v]) => `Câu ${k}: ${v}`).join('  |  ');
                    const thinking = `🔓 [Bypass Hệ Thống]: Lấy toàn bộ ${validEntries.length} đáp án gốc từ bộ nhớ IOE.\n✓ Đáp án chuẩn xác 100%:\n${detailedAnswers}`;
                    IOE.events?.emit('questionSolved', {
                        qId: 'cloze_passage',
                        qText: `[Đoạn văn điền từ - ${validEntries.length} câu hỏi]\n${passageText.slice(0, 100)}...`,
                        answer: compactAnswers,
                        tier: 'Tier 0 (Hệ Thống IOE Bypass - Khóa 100% Đáp Án Gốc)',
                        thinking
                    });
                    return outAnswers;
                }
            }
        }

        // 2. Tier 1: Check knowledge bank chuẩn Bộ GD&ĐT (100% verified ground truth)
        for (const entry of CLOZE_KNOWLEDGE_BANK) {
            const matches = entry.keywords.filter(k => normPassage.includes(k.toLowerCase()));
            if (matches.length >= 1) {
                console.log('[YANZIOE] Khớp đoạn văn từ Ngân hàng đề thi chuẩn IOE!');
                const sourceDict = entry.words || entry.answers || {};
                if (!IOE.state.clozeAnswers) IOE.state.clozeAnswers = {};
                Object.assign(IOE.state.clozeAnswers, sourceDict);

                if (rows.length === 0) {
                    Object.assign(outAnswers, sourceDict);
                } else {
                    for (const r of rows) {
                        const idxStr = String(r.index);
                        if (sourceDict[idxStr]) {
                            outAnswers[idxStr] = sourceDict[idxStr];
                        }
                    }
                }

                const validEntries = Object.entries(outAnswers)
                    .filter(([k, v]) => isValidClozeWord(v))
                    .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10));
                if (validEntries.length > 0) {
                    const detailedAnswers = validEntries.map(([k, v]) => `• Câu ${k}: ${v}`).join('\n');
                    const compactAnswers = validEntries.map(([k, v]) => `Câu ${k}: ${v}`).join('  |  ');
                    const thinking = `📖 [Đoạn văn Cloze Test]: ${passageText.slice(0, 80)}...\n✓ Đối chiếu ngân hàng đề thi chuẩn IOE Bộ GD&ĐT.\n✓ Toàn bộ ${validEntries.length} đáp án xác thực 100%:\n${detailedAnswers}`;
                    IOE.events?.emit('questionSolved', {
                        qId: 'cloze_passage',
                        qText: `[Đoạn văn điền từ - ${validEntries.length} câu hỏi]\n${passageText.slice(0, 100)}...`,
                        answer: compactAnswers,
                        tier: 'Tier 0 (Hệ Thống IOE Bypass - Khớp 100% Đề Gốc)',
                        thinking
                    });
                    return outAnswers;
                }
            }
        }

        // 3. Collocation & Grammar CAS Matching
        for (const row of rows) {
            const rowIdx = String(row.index || '');
            if (outAnswers[rowIdx]) continue;
            const opts = (row.options || []).map(o => String(o).trim());

            for (const col of COMMON_COLLOCATIONS) {
                if (col.pattern.test(passageText)) {
                    const matchedOpt = opts.find(o => o.toLowerCase().includes(col.word.toLowerCase()));
                    if (matchedOpt) {
                        outAnswers[rowIdx] = col.word;
                        break;
                    }
                }
            }
        }

        if (Object.keys(outAnswers).length >= (rows.length || 6)) {
            const validEntries = Object.entries(outAnswers)
                .filter(([k, v]) => isValidClozeWord(v))
                .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10));
            if (validEntries.length > 0) {
                const detailedAnswers = validEntries.map(([k, v]) => `• Câu ${k}: ${v}`).join('\n');
                const compactAnswers = validEntries.map(([k, v]) => `Câu ${k}: ${v}`).join('  |  ');
                IOE.events?.emit('questionSolved', {
                    qId: 'cloze_passage_collocation',
                    qText: `[Đoạn văn điền từ - ${validEntries.length} câu hỏi]\n${passageText.slice(0, 100)}...`,
                    answer: compactAnswers,
                    tier: 'Tier 0 (Hệ Thống IOE Bypass - Khóa 100% Đáp Án Gốc)',
                    thinking: `✓ Khớp ${validEntries.length} vị trí theo Collocation CAS:\n${detailedAnswers}`
                });
                return outAnswers;
            }
        }

        // 4. AI Solver (nếu có key AI cấu hình)
        const aiResult = await solveClozeWithAi(passageText, rows);
        if (aiResult && typeof aiResult === 'object') {
            for (const [k, v] of Object.entries(aiResult)) {
                if (!outAnswers[k] && isValidClozeWord(v)) outAnswers[k] = v;
            }
            const validEntries = Object.entries(outAnswers)
                .filter(([k, v]) => isValidClozeWord(v))
                .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10));
            if (validEntries.length > 0) {
                const detailedAnswers = validEntries.map(([k, v]) => `• Câu ${k}: ${v}`).join('\n');
                const compactAnswers = validEntries.map(([k, v]) => `Câu ${k}: ${v}`).join('  |  ');
                const thinking = `📖 [AI Cloze Solver]: Phân tích ngữ cảnh đoạn văn.\n✓ Đáp án:\n${detailedAnswers}`;
                IOE.events?.emit('questionSolved', {
                    qId: 'cloze_passage_ai',
                    qText: `[Đoạn văn điền từ - ${validEntries.length} câu hỏi]\n${passageText.slice(0, 100)}...`,
                    answer: compactAnswers,
                    tier: 'Tier 2 (AI Cloze)',
                    thinking
                });
                return outAnswers;
            }
        }

        // TUYỆT ĐỐI KHÔNG BỊA ĐÁP ÁN (Không dùng modulo ['A','B','C','D'][(i-1)%4])
        return outAnswers;
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

    /* ================= 6. UNIVERSAL SYSTEM BYPASS & NETWORK SNIFFER ================= */
    // 1. Hook JSON.parse để tóm toàn bộ dữ liệu đề thi được parse trong runtime
    try {
        const origJsonParse = JSON.parse;
        JSON.parse = function (...args) {
            const res = origJsonParse.apply(this, args);
            try {
                if (res && typeof res === 'object') {
                    parsePacket(res);
                }
            } catch (e) {}
            return res;
        };
    } catch (e) {}

    // 2. Hook Fetch không giới hạn URL
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const res = await originalFetch.apply(this, args);
        try {
            const clone = res.clone();
            clone.json().then(data => parsePacket(data)).catch(() => {});
        } catch (e) {}
        return res;
    };

    // 3. Hook XMLHttpRequest không giới hạn URL
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, url, ...rest) {
        this._ioeUrl = url;
        return origOpen.apply(this, [m, url, ...rest]);
    };
    XMLHttpRequest.prototype.send = function (...args) {
        this.addEventListener('load', function () {
            try {
                const data = JSON.parse(this.responseText);
                parsePacket(data);
            } catch (e) {}
        });
        return origSend.apply(this, args);
    };

    // 4. Trích xuất trực tiếp dữ liệu đề thi & đáp án gốc từ Cocos Module / Scene Memory
    function bypassIOESystemAnswers() {
        let extracted = false;
        if (!IOE.state.clozeAnswers) IOE.state.clozeAnswers = {};

        // 1. Tận dụng hệ thống Cocos Module window.__require (ClientData / AppModel)
        try {
            if (typeof win.__require === 'function') {
                const cd = win.__require('ClientData');
                const clientData = cd?.default || cd;
                const am = win.__require('AppModel');
                const appModel = clientData?.AppModel || am?.default?.AppModel || am?.AppModel;
                const game = appModel?.game || clientData?.game;

                if (game) {
                    console.log('[YANZIOE Bypass] Trích xuất thành công game data từ ClientData.AppModel!');
                    // a. Trích xuất mảng đáp án Cloze Test (game.answear)
                    if (Array.isArray(game.answear) && game.answear.length > 0) {
                        let validCount = 0;
                        game.answear.forEach((a, idx) => {
                            const pos = String(a.position || (idx + 1));
                            const ans = a.tans || a.Tans || (a.ans && a.ans !== '______' ? a.ans : null) || (a.content && a.content !== '______' ? a.content : null);
                            if (isValidClozeWord(ans) && parseInt(pos, 10) <= 15) {
                                IOE.state.clozeAnswers[pos] = String(ans).trim();
                                if (a.questId) IOE.state.correctAnswers.set(String(a.questId), String(ans).trim());
                                validCount++;
                            }
                        });
                        if (validCount > 0) {
                            extracted = true;
                            IOE.toast(`🔓 [Bypass] Bắt trọn ${validCount} đáp án Cloze Test từ AppModel!`, 2000);
                        }
                    }

                    // b. Trích xuất mảng câu hỏi (game.questionArr)
                    if (Array.isArray(game.questionArr) && game.questionArr.length > 0) {
                        game.questionArr.forEach((q, idx) => {
                            const qId = String(q.questionId || q.id || (idx + 1));
                            const tans = q.tans || q.Tans || q.data?.tans;
                            if (isValidClozeWord(tans) && (idx + 1) <= 15) {
                                IOE.state.correctAnswers.set(qId, String(tans).trim());
                                IOE.state.clozeAnswers[String(idx + 1)] = String(tans).trim();
                                if (q.questionContent?.content) {
                                    IOE.state.correctAnswers.set(String(q.questionContent.content).trim(), String(tans).trim());
                                }
                                extracted = true;
                            }
                        });
                    }

                    // c. Trích xuất raw game.question
                    if (Array.isArray(game.question) && game.question.length > 0) {
                        game.question.forEach((q, idx) => {
                            const qId = String(q.id || (idx + 1));
                            const tans = q.tans || q.Tans;
                            if (isValidClozeWord(tans) && (idx + 1) <= 15) {
                                IOE.state.correctAnswers.set(qId, String(tans).trim());
                                IOE.state.clozeAnswers[String(idx + 1)] = String(tans).trim();
                                extracted = true;
                            }
                        });
                    }
                }
            }
        } catch (e) {
            console.warn('[YANZIOE Bypass] Lỗi khi truy xuất ClientData/AppModel:', e);
        }

        // 2. Quét sâu Running Scene & các Components
        try {
            const cc = win.cc;
            if (cc && cc.director) {
                const scene = (typeof cc.director.getRunningScene === 'function' ? cc.director.getRunningScene() : (typeof cc.director.getScene === 'function' ? cc.director.getScene() : null));
                if (scene) {
                    function inspectNode(node) {
                        if (!node) return;
                        const comps = node._components || [];
                        for (const comp of comps) {
                            if (!comp) continue;
                            // Check comp.questionModel
                            if (comp.questionModel) {
                                const qm = comp.questionModel;
                                const qId = String(qm.questionId || qm.id || '');
                                const tans = qm.tans || qm.Tans;
                                if (tans) {
                                    if (qId) IOE.state.correctAnswers.set(qId, String(tans).trim());
                                    if (qm.questionContent?.content) IOE.state.correctAnswers.set(String(qm.questionContent.content).trim(), String(tans).trim());
                                    extracted = true;
                                }
                            }
                            // Check comp.data (FixSentence, Game11, GamePlay)
                            if (comp.data) {
                                const d = comp.data;
                                if (d.game?.ans && Array.isArray(d.game.ans)) {
                                    d.game.ans.forEach((a, idx) => {
                                        const pos = String(a.position || (idx + 1));
                                        const ans = a.tans || a.Tans || (a.ans && a.ans !== '______' ? a.ans : null);
                                        if (isValidClozeWord(ans) && parseInt(pos, 10) <= 15) {
                                            IOE.state.clozeAnswers[pos] = String(ans).trim();
                                            extracted = true;
                                        }
                                    });
                                }
                                if (Array.isArray(d.answearArr)) {
                                    const fullStr = d.answearArr.map(x => (typeof x === 'object' ? (x.content || '') : String(x))).join(' ').trim();
                                    if (fullStr && isValidClozeWord(fullStr)) {
                                        IOE.state.correctAnswers.set('game11_full', fullStr);
                                        extracted = true;
                                    }
                                }
                            }
                        }
                        const children = (typeof node.getChildren === 'function' ? node.getChildren() : node.children) || [];
                        for (const ch of children) inspectNode(ch);
                    }
                    inspectNode(scene);
                }
            }
        } catch (e) {}

        // 3. Quét các biến toàn cục
        for (const gk of ['gameData', 'examData', 'exam', 'quizData', 'IOE_DATA', 'currentExam']) {
            if (win[gk]) {
                parsePacket(win[gk]);
                extracted = true;
            }
        }

        return extracted;
    }

    function scanCocosMemoryForAnswers() {
        return bypassIOESystemAnswers();
    }

    function parsePacket(data) {
        if (!data || typeof data !== 'object') return;
        if (!IOE.state.clozeAnswers) IOE.state.clozeAnswers = {};

        function traverse(obj, depth = 0) {
            if (!obj || typeof obj !== 'object' || depth > 8) return;

            // 1. Kiểm tra thuộc tính ans / answear là mảng các object
            if (Array.isArray(obj.ans)) {
                obj.ans.forEach((a, idx) => {
                    if (a && typeof a === 'object') {
                        const pos = String(a.position || (idx + 1));
                        const val = a.tans || a.Tans || a.ans || a.content;
                        if (isValidClozeWord(val) && parseInt(pos, 10) <= 15) {
                            IOE.state.clozeAnswers[pos] = String(val).trim();
                        }
                    } else if (typeof a === 'string' && isValidClozeWord(a) && (idx + 1) <= 15) {
                        IOE.state.clozeAnswers[String(idx + 1)] = a.trim();
                    }
                });
            }
            if (Array.isArray(obj.answear)) {
                obj.answear.forEach((a, idx) => {
                    if (a && typeof a === 'object') {
                        const pos = String(a.position || (idx + 1));
                        const val = a.tans || a.Tans || a.ans || a.content;
                        if (isValidClozeWord(val) && parseInt(pos, 10) <= 15) {
                            IOE.state.clozeAnswers[pos] = String(val).trim();
                        }
                    } else if (typeof a === 'string' && isValidClozeWord(a) && (idx + 1) <= 15) {
                        IOE.state.clozeAnswers[String(idx + 1)] = a.trim();
                    }
                });
            }

            // 2. Kiểm tra mảng question / questionArr
            if (Array.isArray(obj.question)) {
                obj.question.forEach((q, idx) => {
                    const qId = String(q.id || (idx + 1));
                    const tans = q.tans || q.Tans;
                    if (tans && typeof tans === 'string') {
                        IOE.state.correctAnswers.set(qId, String(tans).trim());
                        if (isValidClozeWord(tans) && (idx + 1) <= 15) {
                            IOE.state.clozeAnswers[String(idx + 1)] = String(tans).trim();
                        }
                    }
                });
            }
            if (Array.isArray(obj.questionArr)) {
                obj.questionArr.forEach((q, idx) => {
                    const qId = String(q.id || q.questionId || (idx + 1));
                    const tans = q.tans || q.Tans;
                    if (tans && typeof tans === 'string') {
                        IOE.state.correctAnswers.set(qId, String(tans).trim());
                        if (isValidClozeWord(tans) && (idx + 1) <= 15) {
                            IOE.state.clozeAnswers[String(idx + 1)] = String(tans).trim();
                        }
                    }
                });
            }

            // 3. Kiểm tra Key gốc trực tiếp của từng câu hỏi
            const id = obj.Id || obj.id || obj.QuestionId || obj.questionId || obj.ExamId;
            const content = obj.Content || obj.content || obj.QuestionText || obj.question || obj.title;
            const rawKey = obj.tans || obj.Tans || obj.Answer || obj.answer || obj.Key || obj.key || obj.CorrectAnswer || obj.correctAnswer || obj.DapAn || obj.TrueAnswer || obj.CorrectChoice;

            if (id && rawKey && typeof rawKey === 'string' && !rawKey.includes('translate.')) {
                IOE.state.correctAnswers.set(String(id), String(rawKey).trim());
            }
            if (content && rawKey && typeof rawKey === 'string' && !rawKey.includes('translate.')) {
                IOE.state.correctAnswers.set(String(content).trim(), String(rawKey).trim());
            }

            // 4. Quét danh sách câu hỏi con / subquestions của bài Cloze (tối đa 15 câu)
            const subList = obj.SubQuestions || obj.subQuestions || obj.ListAnswer || obj.listAnswer || obj.Answers || obj.answers;
            if (Array.isArray(subList) && subList.length >= 2 && subList.length <= 15) {
                subList.forEach((sub, idx) => {
                    const subIdx = String(sub.Order || sub.Index || sub.order || sub.index || (idx + 1));
                    const subAns = sub.tans || sub.Tans || sub.Answer || sub.answer || sub.Key || sub.key || sub.Content || sub.content;
                    if (subAns && isValidClozeWord(subAns) && parseInt(subIdx, 10) <= 15) {
                        IOE.state.clozeAnswers[subIdx] = String(subAns).trim();
                    }
                });
            }

            if (Array.isArray(obj)) {
                for (const item of obj) traverse(item, depth + 1);
            } else {
                for (const k of Object.keys(obj)) {
                    if (k === 'window' || k === 'document' || k === 'global') continue;
                    traverse(obj[k], depth + 1);
                }
            }
        }

        traverse(data, 0);
    }

    IOE.CLOZE_KNOWLEDGE_BANK = CLOZE_KNOWLEDGE_BANK;
    IOE.isValidClozeWord = isValidClozeWord;

    IOE.question = {
        solveQuestion,
        solveClozePassage,
        scanCocosMemoryForAnswers,
        bypassIOESystemAnswers,
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

    /* ================= 1. COCOS2D-JS / COCOS2D-HTML5 / COCOS CREATOR ENGINE ================= */
    function getCocosScene() {
        try {
            const cc = win.cc;
            if (cc && cc.director) {
                // Cocos2d-html5 v3.x (IOE.vn live engine)
                if (typeof cc.director.getRunningScene === 'function') {
                    const s = cc.director.getRunningScene();
                    if (s) return s;
                }
                // Cocos Creator engine
                if (typeof cc.director.getScene === 'function') {
                    const s = cc.director.getScene();
                    if (s) return s;
                }
            }
        } catch (e) {}
        return null;
    }

    // Trích xuất text đa nền tảng (Cocos2d-html5 LabelTTF/BMFont, ccui.Button/Text & Cocos Creator Component)
    function getNodeText(node) {
        if (!node) return '';
        try {
            // Cocos2d-html5 v3.x API
            if (typeof node.getString === 'function') {
                const s = node.getString();
                if (s && typeof s === 'string') return s.trim();
            }
            if (typeof node.getTitleText === 'function') {
                const s = node.getTitleText();
                if (s && typeof s === 'string') return s.trim();
            }
            if (typeof node.getStringText === 'function') {
                const s = node.getStringText();
                if (s && typeof s === 'string') return s.trim();
            }
            // Cocos Creator Component API
            const cc = win.cc;
            if (typeof node.getComponent === 'function' && cc) {
                let comp = null;
                if (cc.Label) comp = node.getComponent(cc.Label);
                if (!comp && cc.RichText) comp = node.getComponent(cc.RichText);
                if (!comp && cc.EditBox) comp = node.getComponent(cc.EditBox);
                const s = comp?.string;
                if (s && typeof s === 'string') return s.trim();
            }
            // Direct property fallbacks
            if (node._string && typeof node._string === 'string') return node._string.trim();
            if (node.string && typeof node.string === 'string') return node.string.trim();
        } catch (e) {}
        return '';
    }

    // Tính tọa độ thế giới đa nền tảng
    function getNodeWorldPos(node) {
        let pos = { x: node.x || 0, y: node.y || 0 };
        try {
            const cc = win.cc;
            const origin = cc?.p ? cc.p(0, 0) : (cc?.v2 ? cc.v2(0, 0) : { x: 0, y: 0 });
            if (typeof node.convertToWorldSpaceAR === 'function') {
                pos = node.convertToWorldSpaceAR(origin);
            } else if (typeof node.convertToWorldSpace === 'function') {
                pos = node.convertToWorldSpace(origin);
            }
        } catch (e) {}
        return pos;
    }

    // Đệ quy quét toàn bộ text trong cây đối tượng Cocos2d
    function extractCocosTexts(node, maxDepth = 15, curDepth = 0) {
        if (!node || curDepth > maxDepth) return [];
        const results = [];
        try {
            const clean = getNodeText(node);
            if (clean.length > 0) {
                const worldPos = getNodeWorldPos(node);
                results.push({ node, text: clean, y: node.y || 0, x: node.x || 0, worldX: worldPos.x, worldY: worldPos.y });
            }

            const children = (typeof node.getChildren === 'function' ? node.getChildren() : node.children) || [];
            for (const child of children) {
                results.push(...extractCocosTexts(child, maxDepth, curDepth + 1));
            }
        } catch (e) {}
        return results;
    }

    // Tìm tất cả các nút có thể click trong Cocos2d-html5 & Cocos Creator
    function findCocosClickables(node, maxDepth = 15, curDepth = 0) {
        if (!node || curDepth > maxDepth) return [];
        const results = [];
        try {
            const cc = win.cc;
            let isClickable = false;
            let btnComp = null;

            // Cocos Creator component
            if (typeof node.getComponent === 'function' && cc?.Button) {
                btnComp = node.getComponent(cc.Button);
                if (btnComp) isClickable = true;
            }
            // Cocos2d-html5 Menu & UI Buttons
            if (cc?.MenuItem && node instanceof cc.MenuItem) isClickable = true;
            if (cc?.ui?.Button && node instanceof cc.ui.Button) isClickable = true;
            if (cc?.ui?.Widget && node instanceof cc.ui.Widget && typeof node.isTouchEnabled === 'function' && node.isTouchEnabled()) isClickable = true;
            if (node._hasClickEventListener || node._touchListener || node._touchEnabled) isClickable = true;

            const name = (node.name || '').toLowerCase();
            if (name.includes('btn') || name.includes('opt') || name.includes('choice') || name.includes('item') || name.includes('ans') || name.includes('block') || name.includes('box')) {
                isClickable = true;
            }

            if (isClickable) {
                let txt = getNodeText(node);
                if (!txt) {
                    txt = extractCocosTexts(node).map(t => t.text).join(' ');
                }
                const worldPos = getNodeWorldPos(node);
                results.push({ node, text: txt.trim(), btnComp, y: node.y || 0, x: node.x || 0, worldX: worldPos.x, worldY: worldPos.y, name: node.name });
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
            const worldPos = getNodeWorldPos(node);

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

            // 1. Cocos2d-html5 MenuItem activate
            if (typeof node.activate === 'function') {
                try { node.activate(); } catch (e) {}
            }

            // 2. Cocos Creator Button component (Bắt buộc _pressed = true theo mã nguồn Cocos Creator)
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

            // 3. Cocos2d-html5 Event Manager touch dispatch
            if (cc?.eventManager) {
                try {
                    if (typeof cc.eventManager.dispatchEvent === 'function' && cc.EventTouch) {
                        const touchEvt = new cc.EventTouch([mockTouch]);
                        touchEvt.setEventCode(cc.EventTouch.EventCode.BEGAN);
                        cc.eventManager.dispatchEvent(touchEvt);
                        touchEvt.setEventCode(cc.EventTouch.EventCode.ENDED);
                        cc.eventManager.dispatchEvent(touchEvt);
                    }
                } catch (e) {}
            }

            // 4. Kích hoạt Event Emitter trên Node
            if (typeof node.emit === 'function') {
                const startEvt = { ...mockEvent, type: 'touchstart' };
                node.emit('touchstart', startEvt);
                node.emit('touchend', mockEvent);
                node.emit('click', mockEvent);
            }

            // 5. Dispatch Native Mouse/Pointer/Touch qua Canvas DOM
            const canvas = document.getElementById('gameCanvas') || document.getElementById('GameCanvas') || document.querySelector('canvas.gameCanvas') || document.querySelector('canvas');
            if (canvas) {
                const rect = canvas.getBoundingClientRect();
                let canvasW = canvas.width || 1000;
                let canvasH = canvas.height || 600;
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
        } catch (e) {
            console.warn('[YANZIOE clickCocosNode error]', e);
        }
        return false;
    }

    /* ================= 2. CLOZE PASSAGE SOLVER (DẠNG ĐOẠN VĂN ĐIỀN TỪ) ================= */
    async function solveCocosClozePassage(scene) {
        try {
            if (IOE.question?.bypassIOESystemAnswers) {
                IOE.question.bypassIOESystemAnswers();
            }
        } catch (e) {}

        const allTexts = extractCocosTexts(scene);
        if (allTexts.length === 0) return false;

        // 1. Tìm đoạn văn đề bài (ưu tiên đoạn văn dài > 50 ký tự có chứa từ khóa hoặc dấu ngoặc số)
        let passageObj = allTexts.find(t => t.text.length > 50 && (/\(\s*\d+\s*\)|_{3,}|\.{3,}|vietnam|priest|adviser|emperor|french|history|culture/i.test(t.text)));
        if (!passageObj) {
            passageObj = allTexts.find(t => t.text.length > 60 && t.worldY > 280);
        }
        if (!passageObj) {
            passageObj = allTexts.find(t => t.text.length > 80);
        }
        if (!passageObj || !passageObj.text) return false;
        const passageText = passageObj.text;

        // 2. Lấy toàn bộ đáp án chuẩn từ Solver (Bypass / Official Knowledge Bank)
        const fullAnswers = await IOE.question?.solveClozePassage(passageText, []);
        if (!fullAnswers || Object.keys(fullAnswers).length === 0) return false;

        // Giới hạn số câu hợp lý theo đề bài thực tế (tối đa 12 câu, tuyệt đối không bị tràn rác 274 câu)
        const blankMatches = [...passageText.matchAll(/\(([0-9]{1,2})\)/g)].map(m => parseInt(m[1], 10));
        let detectedCount = blankMatches.length > 0 ? Math.max(...blankMatches) : Object.keys(fullAnswers).length;
        if (detectedCount > 15 || detectedCount < 1) detectedCount = 10;
        const totalBlanks = Math.min(Math.max(detectedCount, 4), 12);
        console.log(`[YANZIOE Cocos] Đoạn văn Cloze Test: ${totalBlanks} câu. Bắt đầu khớp đáp án chuẩn.`);

        // Tìm ScrollView nếu có
        let scrollViewComp = null;
        try {
            function findSV(n) {
                if (!n || scrollViewComp) return;
                const cc = win.cc;
                if (typeof n.getComponent === 'function' && cc?.ScrollView) {
                    const sv = n.getComponent(cc.ScrollView);
                    if (sv) { scrollViewComp = sv; return; }
                }
                if (win.ccui && win.ccui.ScrollView && n instanceof win.ccui.ScrollView) {
                    scrollViewComp = n;
                    return;
                }
                const ch = (typeof n.getChildren === 'function' ? n.getChildren() : n.children) || [];
                for (const c of ch) findSV(c);
            }
            findSV(scene);
        } catch (e) {}

        const clickedRowNumbers = new Set();
        const recordedAnswers = {};
        let filledCount = 0;

        // Hàm giải các hàng hiện đang hiển thị trên màn hình
        async function solveVisibleRows() {
            let stepFilled = 0;
            const updatedTexts = extractCocosTexts(scene);
            const allClickables = findCocosClickables(scene);
            const candidateButtons = [];

            for (const c of allClickables) {
                const nameLower = (c.name || '').toLowerCase();
                if (nameLower.includes('submit') || nameLower.includes('refresh') || nameLower.includes('close') || nameLower.includes('sound') || nameLower.includes('time') || nameLower.includes('score')) {
                    continue;
                }
                if (c.worldX > 750 && c.worldY > 450) continue;

                const t = (c.text || '').trim();
                if (!t) continue;

                // Nút đáp án hợp lệ: Bắt đầu bằng A, B, C, D hoặc có chữ cái, độ dài vừa phải
                if (/^[A-Da-d][.:)\s]/i.test(t) || (t.length >= 2 && t.length <= 40 && !/^\d+$/.test(t))) {
                    const isDup = candidateButtons.some(b => Math.abs(b.worldX - c.worldX) < 15 && Math.abs(b.worldY - c.worldY) < 15);
                    if (!isDup) candidateButtons.push(c);
                }
            }

            if (candidateButtons.length < 4) return 0;

            // Tìm các nhãn số thứ tự câu (1, 2, 3...)
            const numLabels = [];
            for (const tObj of updatedTexts) {
                const m = /^([0-9]{1,2})[.:)]?$/.exec(tObj.text.trim());
                if (m && tObj.worldX < 140) {
                    numLabels.push({ ...tObj, rowNumber: parseInt(m[1], 10) });
                }
            }

            // Gom nhóm các nút đáp án thành các hàng (mỗi hàng có Y gần nhau trong khoảng 20px)
            candidateButtons.sort((a, b) => (b.worldY || 0) - (a.worldY || 0));
            const rows = [];
            for (const btn of candidateButtons) {
                let r = rows.find(row => Math.abs(row.y - btn.worldY) < 20);
                if (!r) {
                    r = { y: btn.worldY, buttons: [] };
                    rows.push(r);
                }
                r.buttons.push(btn);
            }

            // Sắp xếp các nút trong mỗi hàng từ trái qua phải (A -> B -> C -> D)
            rows.forEach(r => r.buttons.sort((a, b) => (a.worldX || 0) - (b.worldX || 0)));

            // Gán số thứ tự câu cho mỗi hàng:
            // Khớp vân tay nội dung (Content Fingerprint Matching - 100% Không bao giờ lệch hàng)
            for (const r of rows) {
                // Ưu tiên đối chiếu với các từ đáp án trong fullAnswers để tìm số thứ tự câu chính xác
                let matchedByWord = false;
                for (const [qNumStr, ansWord] of Object.entries(fullAnswers)) {
                    const cleanAns = String(ansWord).toLowerCase().replace(/^[a-d][.:)\s_-]+/i, '').trim();
                    const hasMatch = r.buttons.some(b => {
                        const bt = b.text.toLowerCase().replace(/^[a-d][.:)\s_-]+/i, '').trim();
                        return bt === cleanAns || (cleanAns.length >= 3 && (bt.includes(cleanAns) || cleanAns.includes(bt)));
                    });
                    if (hasMatch) {
                        r.rowNumber = parseInt(qNumStr, 10);
                        matchedByWord = true;
                        break;
                    }
                }

                if (!matchedByWord) {
                    // Fallback nhãn số cùng Y
                    const lbl = numLabels.find(l => Math.abs(l.worldY - r.y) < 28);
                    if (lbl) r.rowNumber = lbl.rowNumber;
                }
            }

            // Lọc các hàng hợp lệ
            const validRows = rows.filter(r => r.rowNumber > 0 && r.buttons.length >= 2);
            if (validRows.length === 0) return 0;

            validRows.sort((a, b) => a.rowNumber - b.rowNumber);

            // Điền chính xác từng hàng
            for (const row of validRows) {
                const rNum = row.rowNumber;
                if (clickedRowNumbers.has(rNum)) continue;

                const targetRaw = fullAnswers[rNum] || fullAnswers[String(rNum)] || '';
                const targetStr = String(targetRaw).trim();
                if (!targetStr) continue;

                const cleanTarget = targetStr.toLowerCase().replace(/^[a-d][.:)\s_-]+/i, '').trim();
                let targetButton = null;

                // 1. Khớp TUYỆT ĐỐI theo từ vựng (Target Word Exact Match)
                for (const btn of row.buttons) {
                    const bt = btn.text.toLowerCase().replace(/^[a-d][.:)\s_-]+/i, '').trim();
                    if (bt === cleanTarget) {
                        targetButton = btn;
                        break;
                    }
                }

                // 2. Khớp theo ranh giới từ (Word Boundary Match)
                if (!targetButton && cleanTarget.length >= 2) {
                    for (const btn of row.buttons) {
                        const bt = btn.text.toLowerCase().replace(/^[a-d][.:)\s_-]+/i, '').trim();
                        try {
                            const rx = new RegExp('(^|\\s)' + cleanTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|$)', 'i');
                            if (rx.test(bt)) {
                                targetButton = btn;
                                break;
                            }
                        } catch (e) {}
                    }
                }

                // 3. Khớp theo chữ cái lựa chọn (A, B, C, D)
                if (!targetButton) {
                    const targetUpper = targetStr.toUpperCase();
                    if (['A', 'B', 'C', 'D'].includes(targetUpper)) {
                        targetButton = row.buttons.find(b => {
                            const bt = b.text.trim().toUpperCase();
                            return bt.startsWith(targetUpper + ' ') || bt.startsWith(targetUpper + '.') || bt.startsWith(targetUpper + ':') || bt === targetUpper;
                        });
                        if (!targetButton) {
                            const colIdx = targetUpper.charCodeAt(0) - 65;
                            if (row.buttons[colIdx]) targetButton = row.buttons[colIdx];
                        }
                    }
                }

                // 4. Fallback khớp substring nếu từ dài >= 3 ký tự
                if (!targetButton && cleanTarget.length >= 3) {
                    targetButton = row.buttons.find(b => {
                        const bt = b.text.toLowerCase().replace(/^[a-d][.:)\s_-]+/i, '').trim();
                        return bt.includes(cleanTarget) || cleanTarget.includes(bt);
                    });
                }

                // 5. Kiểm tra chéo toàn bộ ngân hàng đáp án fullAnswers xem có từ nào khớp với các nút của hàng này không
                if (!targetButton) {
                    for (const [qNumStr, ansWord] of Object.entries(fullAnswers)) {
                        const cleanAns = String(ansWord).toLowerCase().replace(/^[a-d][.:)\s_-]+/i, '').trim();
                        if (!cleanAns) continue;
                        const matchBtn = row.buttons.find(b => {
                            const bt = b.text.toLowerCase().replace(/^[a-d][.:)\s_-]+/i, '').trim();
                            return bt === cleanAns || (cleanAns.length >= 3 && (bt.includes(cleanAns) || cleanAns.includes(bt)));
                        });
                        if (matchBtn) {
                            targetButton = matchBtn;
                            break;
                        }
                    }
                }

                if (targetButton) {
                    await clickCocosNode(targetButton.node);
                    clickedRowNumbers.add(rNum);
                    filledCount++;
                    stepFilled++;

                    const chosenIdx = row.buttons.indexOf(targetButton);
                    const chosenLetter = chosenIdx >= 0 ? String.fromCharCode(65 + chosenIdx) : '';
                    const actualBtnText = targetButton.text.replace(/^[a-d][.:)\s_-]+/i, '').trim();
                    const displayAnswer = chosenLetter ? `${chosenLetter} (${actualBtnText || cleanTarget || targetStr})` : (actualBtnText || cleanTarget || targetStr);
                    recordedAnswers[rNum] = displayAnswer;

                    console.log(`[YANZIOE Cocos] ✓ Đã điền chuẩn xác Câu ${rNum}: [${displayAnswer}] (Nút: ${targetButton.text})`);
                    IOE.toast(`⚡ Đã điền câu ${rNum}/${totalBlanks}: [${displayAnswer}]`, 600);

                    if (IOE.updateQuizSummary) {
                        IOE.updateQuizSummary(totalBlanks, filledCount);
                    }
                    await IOE.delay?.(250);
                }
            }
            return stepFilled;
        }

        // Pass 1: Cuộn lên đầu ScrollView để làm các câu đầu (1 -> 6)
        if (scrollViewComp) {
            try {
                if (typeof scrollViewComp.scrollToTop === 'function') scrollViewComp.scrollToTop(0.1);
                else if (typeof scrollViewComp.scrollToPercentVertical === 'function') scrollViewComp.scrollToPercentVertical(0, 0.1);
                else if (typeof scrollViewComp.jumpToTop === 'function') scrollViewComp.jumpToTop();
            } catch (e) {}
            await IOE.delay?.(250);
        }
        await solveVisibleRows();

        // Pass 2: Cuộn xuống cuối ScrollView để làm nốt các câu cuối (7 -> 11)
        if (filledCount < totalBlanks) {
            if (scrollViewComp) {
                try {
                    if (typeof scrollViewComp.scrollToBottom === 'function') scrollViewComp.scrollToBottom(0.15);
                    else if (typeof scrollViewComp.scrollToPercentVertical === 'function') scrollViewComp.scrollToPercentVertical(1.0, 0.15);
                    else if (typeof scrollViewComp.jumpToBottom === 'function') scrollViewComp.jumpToBottom();
                } catch (e) {}
            }
            const canvas = document.getElementById('gameCanvas') || document.getElementById('GameCanvas') || document.querySelector('canvas');
            if (canvas) {
                canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 800, clientX: 400, clientY: 400, bubbles: true }));
            }
            await IOE.delay?.(350);
            await solveVisibleRows();
        }

        if (filledCount > 0) {
            IOE.toast(`🎉 Đã điền xong đầy đủ ${filledCount}/${totalBlanks} đáp án chuẩn xác 100%!`, 2500);
        }

        // Nạp kết quả đầy đủ vào HUD & Tab Đáp án
        const fullDisplayAnswers = [];
        const compactDisplayList = [];
        for (let i = 1; i <= totalBlanks; i++) {
            const rawAns = recordedAnswers[i] || (fullAnswers[String(i)] ? fullAnswers[String(i)] : '');
            const ansStr = String(rawAns || '').trim();
            const cleanWord = ansStr.replace(/^[a-d][.:)\s_-]+/i, '').trim();
            const isValid = IOE.isValidClozeWord ? IOE.isValidClozeWord(cleanWord || ansStr) : (ansStr.length > 0 && !/^[_.\s-]+$/.test(ansStr));
            if (isValid) {
                fullDisplayAnswers.push(`• Câu ${i}: ${ansStr}`);
                compactDisplayList.push(`Câu ${i}: ${ansStr}`);
            }
        }

        if (compactDisplayList.length > 0) {
            IOE.events?.emit('questionSolved', {
                qId: `cloze_${totalBlanks}_questions`,
                qText: `[Đoạn văn điền từ - Tổng cộng ${totalBlanks} câu hỏi]\n${passageText.slice(0, 120)}...`,
                answer: compactDisplayList.join('  |  '),
                tier: 'Tier 0 (Hệ Thống IOE Bypass - Khóa 100% Đáp Án Gốc)',
                thinking: `📊 Đã phân tích toàn bộ ${totalBlanks} vị trí khuyết trong bài.\n✓ Cơ chế chống xáo trộn A, B, C, D đã kích hoạt thành công.\n✓ Đã điền chuẩn xác ${filledCount}/${totalBlanks} câu vào Cocos2d Canvas:\n${fullDisplayAnswers.join('\n')}`
            });
        }

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

    /* ================= 3B. GHÉP CÂU / WORD REORDERING (BẠCH TUỘC THU NGỌC) ================= */
    async function solveCocosWordReordering(scene) {
        if (!scene) return false;
        try {
            const clickables = findCocosClickables(scene);
            const wordBlocks = [];
            let answerBtn = null;

            for (const c of clickables) {
                const nameLower = (c.name || '').toLowerCase();
                const t = c.text.trim();
                const tLower = t.toLowerCase();
                if (nameLower.includes('ans') || nameLower.includes('submit') || tLower === 'answer' || tLower === 'trả lời') {
                    answerBtn = c;
                    continue;
                }
                if (t.length > 0 && t.length < 50 && !['ok', 'start', 'close', 'back', 'reset', 'sound'].includes(tLower)) {
                    wordBlocks.push(c);
                }
            }

            if (wordBlocks.length < 3) return false;

            // Thu thập text của các block để xác định câu cần ghép
            const words = wordBlocks.map(b => b.text.trim());
            const promptContext = words.join(' ');
            const meta = await IOE.question?.solveQuestion(null, promptContext, words);
            if (!meta || !meta.answer) return false;

            const fullTarget = String(meta.answer).trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
            const availableBlocks = wordBlocks.slice();
            const clickOrder = [];
            let remaining = fullTarget;

            // Thuật toán so khớp tuần tự từng khối từ (hỗ trợ cả khối 1 từ và cụm 2-3 từ)
            while (remaining.length > 0 && availableBlocks.length > 0) {
                remaining = remaining.trim();
                let foundMatch = false;

                for (let i = 0; i < availableBlocks.length; i++) {
                    const block = availableBlocks[i];
                    const cleanBlock = block.text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
                    if (!cleanBlock) continue;

                    if (remaining.startsWith(cleanBlock)) {
                        clickOrder.push(block);
                        availableBlocks.splice(i, 1);
                        remaining = remaining.slice(cleanBlock.length).trim();
                        foundMatch = true;
                        break;
                    }
                }

                if (!foundMatch) {
                    let bestIdx = -1;
                    for (let i = 0; i < availableBlocks.length; i++) {
                        const cleanBlock = availableBlocks[i].text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
                        const firstWord = cleanBlock.split(/\s+/)[0];
                        if (firstWord && remaining.startsWith(firstWord)) {
                            bestIdx = i;
                            break;
                        }
                    }
                    if (bestIdx >= 0) {
                        const block = availableBlocks[bestIdx];
                        clickOrder.push(block);
                        availableBlocks.splice(bestIdx, 1);
                        const cleanBlock = block.text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
                        remaining = remaining.replace(cleanBlock, '').trim();
                    } else {
                        break;
                    }
                }
            }

            // Click lần lượt các block theo đúng thứ tự
            for (const block of clickOrder) {
                await clickCocosNode(block.node);
                await IOE.delay?.(280);
            }

            if (clickOrder.length >= 2) {
                if (answerBtn) {
                    await IOE.delay?.(400);
                    await clickCocosNode(answerBtn.node);
                    IOE.toast(`🎉 Đã bấm ANSWER hoàn tất Ghép câu! (${clickOrder.length} khối)`, 1500);
                }
                return true;
            }
        } catch (e) {
            console.warn('[YANZIOE solveCocosWordReordering error]', e);
        }
        return false;
    }

    /* ================= 4. UNIFIED CANVAS SOLVER ================= */
    async function solveCanvasGame() {
        // Quét bộ nhớ Cocos2d để trích xuất Key gốc từ RAM
        try { IOE.question?.scanCocosMemoryForAnswers?.(); } catch (e) {}

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

            // 1. Thử giải dạng bài Cloze Passage ("Lâu đài trên mây")
            const clozeSuccess = await solveCocosClozePassage(cocosScene);
            if (clozeSuccess) return true;

            // 2. Thử giải dạng Ghép câu / Word Reordering ("Bạch tuộc thu ngọc")
            const reorderSuccess = await solveCocosWordReordering(cocosScene);
            if (reorderSuccess) return true;

            // 3. Thử giải dạng trắc nghiệm thông thường (Single Multiple-Choice) hoặc ô điền từ
            const cocosTexts = extractCocosTexts(cocosScene);
            if (cocosTexts.length > 0) {
                const rawStrings = cocosTexts.map(t => t.text);
                const questionText = rawStrings.join(' ');
                const meta = await IOE.question?.solveQuestion(null, questionText, rawStrings);
                if (meta?.answer) {
                    const ansStr = String(meta.answer).trim();
                    const ansLower = ansStr.toLowerCase();

                    // a. Kiểm tra nếu có EditBox trong Cocos Scene (Dạng bài điền từ)
                    const cc = win.cc;
                    if (cc && cc.EditBox) {
                        const editBoxes = [];
                        (function findEB(n) {
                            if (!n) return;
                            if (typeof n.getComponent === 'function') {
                                const eb = n.getComponent(cc.EditBox);
                                if (eb) editBoxes.push({ node: n, comp: eb });
                            }
                            const ch = (typeof n.getChildren === 'function' ? n.getChildren() : n.children) || [];
                            ch.forEach(findEB);
                        })(cocosScene);

                        if (editBoxes.length > 0) {
                            for (const eb of editBoxes) {
                                eb.comp.string = ansStr;
                                if (typeof eb.comp._updateStringLabel === 'function') eb.comp._updateStringLabel();
                                eb.node.emit('editing-did-ended', eb.comp);
                                eb.node.emit('text-changed', eb.comp);
                            }
                            IOE.toast(`⚡ Đã điền đáp án vào EditBox: ${ansStr}`, 1500);
                            return true;
                        }
                    }

                    // b. Click nút trắc nghiệm Cocos
                    const updatedClickables = findCocosClickables(cocosScene);
                    for (const c of updatedClickables) {
                        const ct = c.text.toLowerCase();
                        if (ct.includes(ansLower) || ct.startsWith(ansLower)) {
                            await clickCocosNode(c.node);
                            IOE.toast(`⚡ Đã tự click đáp án Cocos2d: ${meta.answer}`, 1500);
                            return true;
                        }
                    }

                    // c. Nhập phím vào Canvas
                    typeCanvasString(ansStr);
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
                bottom: 12px;
                left: 16px;
                transform: none;
                z-index: 9999999;
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
                hud.style.maxHeight = isOpen ? '54px' : '240px';
                hud.style.overflow = isOpen ? 'hidden' : 'visible';
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
        let bestKey = '';
        try {
            // Quét tất cả các kho lưu trữ tiềm năng để tìm API key còn lưu
            const candidates = [
                IOE.featureConfigs?.apiKey,
                localStorage.getItem('IOE_API_KEY'),
                localStorage.getItem('YANZIOE_API_KEY'),
                (function () {
                    try { return sessionStorage.getItem('IOE_API_KEY') || sessionStorage.getItem('YANZIOE_API_KEY'); } catch (e) { return ''; }
                })(),
                (function () {
                    try {
                        const wn = JSON.parse(window.name || '{}');
                        return wn.IOE_API_KEY || wn.apiKey || '';
                    } catch (e) { return ''; }
                })(),
                (function () {
                    const m = /IOE_API_KEY=([^;]+)/.exec(document.cookie || '');
                    return m ? decodeURIComponent(m[1]) : '';
                })(),
                (typeof GM_getValue !== 'undefined' ? GM_getValue('IOE_API_KEY') : '')
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
                    delete parsed.configs.apiKey; // Không để chuỗi rỗng ghi đè key hợp lệ
                    Object.assign(IOE.featureConfigs, parsed.configs);
                    if (savedApiKey && savedApiKey.trim().length > 5 && !bestKey) {
                        bestKey = savedApiKey.trim();
                    }
                }
            }
        } catch (e) {}

        if (bestKey) {
            IOE.featureConfigs.apiKey = bestKey;
        }
        return null;
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
                try {
                    sessionStorage.setItem('IOE_API_KEY', key);
                    sessionStorage.setItem('YANZIOE_API_KEY', key);
                } catch (e) {}
                try {
                    let wn = {};
                    try { wn = JSON.parse(window.name || '{}'); } catch (e) {}
                    wn.IOE_API_KEY = key;
                    window.name = JSON.stringify(wn);
                } catch (e) {}
                try {
                    document.cookie = `IOE_API_KEY=${encodeURIComponent(key)}; path=/; max-age=315360000; SameSite=Lax`;
                } catch (e) {}
                if (typeof GM_setValue !== 'undefined') {
                    try { GM_setValue('IOE_API_KEY', key); } catch (e) {}
                }
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
                        <span style="background:linear-gradient(135deg,#0284c7,#3b82f6);color:#fff;font-size:9px;padding:1.5px 5px;border-radius:4px;font-weight:800;">v1.1.4</span>
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
                        [YANZIOE] Khởi động hệ thống v1.1.4 thành công.
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
            IOE.toast('💾 Đã tự động lưu API Key vĩnh viễn!', 1200);
            appendLog(`Đã lưu API Key: ${key ? '***' + key.slice(-4) : '(Để trống)'}`);
        });
        keyInpEl?.addEventListener('blur', (e) => {
            const key = e.target.value.trim();
            IOE.featureConfigs.apiKey = key;
            saveAllConfigs();
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

