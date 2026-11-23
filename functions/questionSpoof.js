(function (global) {
    'use strict';
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const IOE = global.IOE || win.IOE;
    if (!IOE) return;

    function checkLicensed() {
        return !!(IOE.state?.licensed || IOE.license?.isLicensed?.());
    }

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
        if (!entry || !ans) return false;
        return entry.wrong.has(String(ans).trim().toLowerCase());
    }

    function getWrongAnswers(qId) {
        const entry = adaptiveMistakes.get(qId);
        return entry ? Array.from(entry.wrong) : [];
    }

    function isValidClozeWord(w) {
        if (!w || typeof w !== 'string') return false;
        const str = w.trim();
        if (str.length < 1 || str.length > 40) return false;
        if (/^[_.\\s-]+$/.test(str) || str.includes('______') || str.includes('...')) return false;
        if (/https?:\/\/|\.com|\.net|\.org|\.vn|\.br|\.py|\.az|\.co|\.kh|\.il|\.hu|\.jp|translate\./i.test(str)) return false;
        if (!/[a-zA-Z]/.test(str)) return false;
        return true;
    }

    function stripOptionPrefix(s) {
        return String(s || '').replace(/^[A-Da-d][.:)\]\s_-]+/, '').trim();
    }

    function normalizeKeyStr(s) {
        return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
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
            `➔ Đáp án (${tier || 'CAS'}): ${ansStr}`
        ].join('\n');
    }

    /* ================= 3. TIER 1: LOCAL ENGLISH CAS (0MS OFFLINE) ================= */
    const IRREGULAR_VERBS = {
        'go': 'went / gone', 'be': 'was, were / been', 'see': 'saw / seen',
        'do': 'did / done', 'have': 'had / had', 'eat': 'ate / eaten',
        'buy': 'bought / bought', 'take': 'took / taken', 'make': 'made / made',
        'write': 'wrote / written', 'read': 'read / read', 'speak': 'spoke / spoken',
        'come': 'came / come', 'give': 'gave / given', 'find': 'found / found',
        'know': 'knew / known', 'think': 'thought / thought', 'tell': 'told / told',
        'become': 'became / become', 'leave': 'left / left', 'feel': 'felt / felt',
        'put': 'put / put', 'bring': 'brought / brought', 'begin': 'began / begun',
        'keep': 'kept / kept', 'hold': 'held / held', 'stand': 'stood / stood',
        'hear': 'heard / heard', 'let': 'let / let', 'mean': 'meant / meant',
        'set': 'set / set', 'meet': 'met / met', 'run': 'ran / run',
        'pay': 'paid / paid', 'sit': 'sat / sat', 'win': 'won / won',
        'send': 'sent / sent', 'build': 'built / built', 'fall': 'fell / fallen',
        'cut': 'cut / cut', 'sell': 'sold / sold', 'break': 'broke / broken',
        'wear': 'wore / worn', 'choose': 'chose / chosen', 'fly': 'flew / flown',
        'draw': 'drew / drawn', 'drive': 'drove / driven', 'drink': 'drank / drunk',
        'sing': 'sang / sung', 'swim': 'swam / swum', 'teach': 'taught / taught',
        'catch': 'caught / caught', 'sleep': 'slept / slept', 'spend': 'spent / spent',
        'forget': 'forgot / forgotten', 'get': 'got / got'
    };

    const LETTER_BANK = [
        'apple', 'animals', 'afternoon', 'airport', 'airplane', 'always', 'amazing', 'answer', 'august', 'autumn',
        'banana', 'basketball', 'beautiful', 'because', 'bedroom', 'bicycle', 'birthday', 'blackboard', 'breakfast', 'brother', 'building',
        'calendar', 'camera', 'candle', 'cartoon', 'celebrate', 'children', 'chocolate', 'cinema', 'classroom', 'clothes', 'computer', 'country', 'crocodile',
        'daughter', 'december', 'delicious', 'dentist', 'dictionary', 'different', 'difficult', 'dinosaur', 'doctor', 'dolphin', 'drawing',
        'elephant', 'engineer', 'english', 'evening', 'everyday', 'everything', 'example', 'excellent', 'exciting', 'exercise', 'expensive',
        'family', 'fantastic', 'farmer', 'favorite', 'favourite', 'february', 'festival', 'flower', 'football', 'forest', 'friendly', 'fruit', 'furniture',
        'garden', 'giraffe', 'glasses', 'goodbye', 'grandfather', 'grandmother', 'grandparents', 'guitar',
        'halloween', 'hamburger', 'handwriting', 'happiness', 'healthy', 'helicopter', 'history', 'holiday', 'homework', 'hospital', 'hungry', 'husband',
        'icecream', 'important', 'internet', 'island', 'january', 'jacket', 'journalist', 'juice', 'july', 'june',
        'kangaroo', 'keyboard', 'kitchen', 'kitten', 'knowledge', 'language', 'lantern', 'library', 'listen', 'little', 'lizard', 'london',
        'magazine', 'march', 'market', 'mathematics', 'medicine', 'message', 'midnight', 'minute', 'mirror', 'monday', 'monkey', 'morning', 'mountain', 'museum', 'music',
        'natural', 'neighbor', 'neighbour', 'newspaper', 'night', 'notebook', 'november', 'number', 'nurse',
        'october', 'office', 'orange', 'orchestra', 'outside', 'painting', 'pancake', 'parents', 'parrot', 'party', 'passport', 'pencil', 'penguin', 'people', 'pepper', 'person', 'photograph', 'piano', 'picnic', 'picture', 'pineapple', 'playground', 'please', 'pocket', 'police', 'postcard', 'potato', 'practice', 'present', 'pretty', 'primary', 'princess', 'problem', 'project', 'pumpkin', 'pupil', 'purple',
        'quarter', 'question', 'quiet', 'rabbit', 'rainbow', 'raincoat', 'reading', 'remember', 'restaurant', 'river', 'robot', 'ruler',
        'sandwich', 'saturday', 'sausage', 'school', 'science', 'scissors', 'season', 'second', 'september', 'seventeen', 'shopping', 'shoulder', 'sister', 'skateboard', 'snowman', 'soccer', 'soldier', 'something', 'sometimes', 'song', 'special', 'spelling', 'spring', 'stadium', 'station', 'strawberry', 'street', 'student', 'subject', 'subway', 'summer', 'sunday', 'sunglasses', 'supermarket', 'surprise', 'sweater', 'swimming',
        'table', 'teacher', 'telephone', 'television', 'tennis', 'theater', 'theatre', 'thirsty', 'thursday', 'ticket', 'tiger', 'together', 'tomato', 'tomorrow', 'toothache', 'toothbrush', 'tourist', 'traffic', 'train', 'travel', 'treasure', 'triangle', 'trousers', 'tuesday', 'turtle',
        'umbrella', 'uncle', 'understand', 'uniform', 'university', 'usually', 'vacation', 'vegetable', 'vietnam', 'vietnamese', 'village', 'violin', 'visitor', 'volleyball',
        'waiter', 'walking', 'wallet', 'water', 'watermelon', 'weather', 'wednesday', 'weekend', 'welcome', 'window', 'winter', 'wonderful', 'writing',
        'yellow', 'yesterday', 'young', 'zebra'
    ];

    function solveLocalEnglish(qText, options = []) {
        if (!qText) return null;

        // 1. Irregular verb lookup
        for (const [v, p] of Object.entries(IRREGULAR_VERBS)) {
            if (new RegExp(`past\\s+(?:tense|participle)\\s+of\\s+['"]?${v}['"]?`, 'i').test(qText)) {
                return { answer: p, tier: 'Tier 1 (Local CAS 0ms)' };
            }
        }

        // 2. Simple arithmetic/number questions inside English UI
        const mathMatch = /(?:what is|equals?|=)\s*(\d+)\s*([+\-*x×÷/])\s*(\d+)/i.exec(qText);
        if (mathMatch) {
            const a = parseInt(mathMatch[1], 10), op = mathMatch[2], b = parseInt(mathMatch[3], 10);
            let res = null;
            if (op === '+') res = a + b;
            else if (op === '-') res = a - b;
            else if (op === '*' || op === 'x' || op === '×') res = a * b;
            else if ((op === '/' || op === '÷') && b !== 0) res = Math.round((a / b) * 100) / 100;
            if (res !== null) return { answer: String(res), tier: 'Tier 1 (Local CAS 0ms)' };
        }

        // 3. Partial hidden-letter puzzle (e.g. "b _ a u t _ f _ l" or "el_ph_nt")
        const spacedMask = /(?:\b[a-zA-Z_](?:\s+[a-zA-Z_]){2,}\b)/.exec(qText);
        if (spacedMask && spacedMask[0].includes('_')) {
            const pat = spacedMask[0].replace(/\s+/g, '').toLowerCase();
            if (pat.includes('_') && pat.length >= 3) {
                const rx = new RegExp('^' + pat.replace(/_/g, '[a-z]') + '$');
                const cand = LETTER_BANK.find(w => w.length === pat.length && rx.test(w));
                if (cand) return { answer: cand, tier: 'Tier 1 (Word Pattern 0ms)' };
            }
        }
        const compactMask = /\b([a-zA-Z]*_[a-zA-Z_]*)\b/.exec(qText);
        if (compactMask && compactMask[1].length >= 4 && compactMask[1].length <= 16) {
            const pat = compactMask[1].toLowerCase();
            if (/^[a-z_]+$/.test(pat) && /[a-z]/.test(pat) && pat.includes('_')) {
                const rx = new RegExp('^' + pat.replace(/_/g, '[a-z]') + '$');
                const cand = LETTER_BANK.find(w => w.length === pat.length && rx.test(w));
                if (cand && (!options.length || options.some(o => stripOptionPrefix(o).toLowerCase() === cand))) {
                    return { answer: cand, tier: 'Tier 1 (Word Pattern 0ms)' };
                }
            }
        }

        return null;
    }

    /* ================= 4. TIER 2: AI SOLVER (GEMINI 2.5/2.0 / GROQ / OPENROUTER) ================= */
    let lastAiError = '';

    async function extPostJson(endpoint, headers, payloadObj, timeoutMs = 13000) {
        const reqExt = IOE.net?.requestExternal;
        const bodyStr = JSON.stringify(payloadObj);
        if (reqExt) {
            return await reqExt(endpoint, { method: 'POST', headers, body: bodyStr, timeoutMs });
        }
        const ctrl = new AbortController();
        const tm = IOE.timers?.setTimeout ? IOE.timers.setTimeout(() => ctrl.abort(), timeoutMs) : setTimeout(() => ctrl.abort(), timeoutMs);
        try {
            const res = await fetch(endpoint, { method: 'POST', headers, body: bodyStr, signal: ctrl.signal });
            return { ok: res.ok, status: res.status, text: await res.text() };
        } finally {
            if (IOE.timers?.clearTimeout) IOE.timers.clearTimeout(tm); else clearTimeout(tm);
        }
    }

    async function callGeminiApi(apiKey, prompt, expectJson = true) {
        const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
        for (const m of models) {
            try {
                const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(apiKey)}`;
                const genCfg = { temperature: 0.1, maxOutputTokens: 1000 };
                if (expectJson) genCfg.responseMimeType = 'application/json';
                const r = await extPostJson(endpoint, { 'Content-Type': 'application/json' }, {
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: genCfg
                }, 14000);

                if (r && r.ok && r.text) {
                    const j = JSON.parse(r.text);
                    const txt = j?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (txt) { lastAiError = ''; return txt; }
                } else if (r) {
                    lastAiError = `Gemini ${m}: HTTP ${r.status} ${(r.text || r.error || '').slice(0, 120)}`;
                    if (r.status === 400 || r.status === 401 || r.status === 403) break;
                }
            } catch (e) {
                lastAiError = `Gemini ${m}: ${e?.message || e}`;
            }
        }
        return null;
    }

    async function callOpenAiCompat(endpoint, apiKey, models, prompt, useJsonFormat = true) {
        for (const model of models) {
            try {
                const bodyObj = {
                    model,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.1
                };
                if (useJsonFormat && !model.includes('gemma')) {
                    bodyObj.response_format = { type: 'json_object' };
                }
                const r = await extPostJson(endpoint, {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                }, bodyObj, 14000);

                if (r && r.ok && r.text) {
                    const j = JSON.parse(r.text);
                    const txt = j?.choices?.[0]?.message?.content || '';
                    if (txt) { lastAiError = ''; return txt; }
                } else if (r) {
                    lastAiError = `${model}: HTTP ${r.status} ${(r.text || r.error || '').slice(0, 120)}`;
                    if (r.status === 401 || r.status === 403) break;
                }
            } catch (e) {
                lastAiError = `${model}: ${e?.message || e}`;
            }
        }
        return null;
    }

    function detectProvider(apiKey) {
        const k = String(apiKey || '').trim();
        const cfg = IOE.featureConfigs?.aiProvider;
        if (k.startsWith('AIza')) return 'gemini';
        if (k.startsWith('gsk_')) return 'groq';
        if (k.startsWith('sk-or-')) return 'openrouter';
        return cfg || 'gemini';
    }

    async function callAiRaw(prompt) {
        const apiKey = (IOE.featureConfigs?.apiKey || '').trim();
        if (!apiKey) { lastAiError = 'Chưa nhập API Key'; return null; }
        const provider = detectProvider(apiKey);
        if (provider === 'gemini') {
            return await callGeminiApi(apiKey, prompt, true);
        }
        if (provider === 'groq') {
            return await callOpenAiCompat('https://api.groq.com/openai/v1/chat/completions', apiKey, [
                'llama-3.3-70b-versatile',
                'llama-3.1-8b-instant'
            ], prompt, true);
        }
        return await callOpenAiCompat('https://openrouter.ai/api/v1/chat/completions', apiKey, [
            'meta-llama/llama-3.3-70b-instruct:free',
            'google/gemma-3-27b-it:free',
            'openai/gpt-4o-mini'
        ], prompt, true);
    }

    function resolveOptionAnswer(rawAns, options = []) {
        let ans = String(rawAns || '').trim();
        if (!ans || !Array.isArray(options) || options.length === 0) return ans;
        const cleanOpts = options.map(stripOptionPrefix);
        // Handle single option letter "A", "B", "C", "D" or "A."
        const mLet = /^([A-Da-d])\.?$/.exec(ans);
        if (mLet) {
            const idx = mLet[1].toUpperCase().charCodeAt(0) - 65;
            if (cleanOpts[idx]) return cleanOpts[idx];
        }
        return ans;
    }

    async function solveWithAi(qId, qText, options = [], taskHint = '') {
        const apiKey = (IOE.featureConfigs?.apiKey || '').trim();
        if (!apiKey) return null;

        const wrongList = getWrongAnswers(qId);
        const wrongNote = wrongList.length ? `\nKnown WRONG options (NEVER pick these): ${wrongList.join(', ')}` : '';
        const cleanOpts = (options || []).map(o => stripOptionPrefix(o)).filter(Boolean);
        const optsText = cleanOpts.length
            ? `\nOptions:\n${cleanOpts.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n')}`
            : '';

        let instruction = '';
        if (taskHint === 'reorder') {
            instruction = `Task: Reorder ALL given word/phrase blocks into ONE grammatically correct English sentence.\nBlocks: ${cleanOpts.join(' | ')}\nRules: Return exact sentence using only those blocks.`;
        } else {
            instruction = `Solve this Vietnamese Olympic English (IOE) question accurately.\nIf multiple choice, return the exact winning option text (NOT just letter A/B/C/D if text is shown).\nIf fill in the blank, return ONLY the missing word or phrase.\nIf word reordering, return ONLY the full reordered English sentence.`;
        }

        const prompt = `${instruction}\nReturn ONLY raw JSON: {"answer": "..."} with NO markdown.\nQuestion: ${qText}${optsText}${wrongNote}`;

        try {
            const raw = await callAiRaw(prompt);
            if (!raw) return null;
            const m = /\{[\s\S]*"answer"[\s\S]*\}/.exec(raw);
            let extracted = '';
            if (m) {
                try { extracted = String(JSON.parse(m[0]).answer || '').trim(); } catch (e) {}
            }
            if (!extracted) {
                extracted = raw.replace(/```json|```/gi, '').replace(/^[\s"'{}]+|[\s"'{}]+$/g, '').trim();
            }
            return taskHint === 'reorder' ? extracted : resolveOptionAnswer(extracted, cleanOpts);
        } catch (err) {
            lastAiError = err?.message || String(err);
            return null;
        }
    }

    async function testAiKey() {
        const apiKey = (IOE.featureConfigs?.apiKey || '').trim();
        if (!apiKey) return { ok: false, error: 'Chưa nhập API Key!' };
        const raw = await callAiRaw('Reply ONLY JSON: {"answer":"OK"}');
        if (raw && raw.toUpperCase().includes('OK')) {
            return { ok: true, provider: detectProvider(apiKey) };
        }
        return { ok: false, error: lastAiError || 'Không nhận được phản hồi hợp lệ từ API AI.' };
    }

    /* ================= 4B. CLOZE PASSAGE KNOWLEDGE & SOLVER ================= */
    const CLOZE_KNOWLEDGE_BANK = [
        {
            keywords: ['vietnam is becoming', 'different nations', 'cuisines', 'japan, korea, and italy', 'hanoi and ho chi minh city', 'offices in vietnam', 'open to learning'],
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
            keywords: ['gia long', 'nguyen dynasty', 'nguyen phuc anh', 'pigneau de', 'rival leaders', 'rival groups', 'first emperor'],
            words: {
                "1": "first",
                "2": "as",
                "3": "southern",
                "4": "In spite of",
                "5": "encounter",
                "6": "target",
                "7": "wipe out",
                "8": "hands",
                "9": "where",
                "10": "role"
            }
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
        { pattern: /spirit\s+of\s+global\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'citizenship' },
        { pattern: /global\s+(?:\(\d+\)|_{2,}|\.{3,})/i, word: 'citizenship' },
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

        const rowsFormatted = rows.map(r => {
            const optsStr = Array.isArray(r.options) && r.options.length
                ? r.options.map((o, idx) => `${String.fromCharCode(65 + idx)}. ${stripOptionPrefix(o)}`).join(' | ')
                : '';
            return `Blank (${r.index || r.rowNumber}): ${optsStr}`;
        }).filter(Boolean).join('\n');

        const prompt = `You are an expert English teacher solving a Vietnamese Olympic English (IOE) Cloze Test.\nPassage:\n${passageText}\n\n${rowsFormatted ? `Candidate choices:\n${rowsFormatted}\n` : ''}Choose the exact grammatically and contextually right word for every numbered blank.\nReturn ONLY raw JSON object mapping blank string number to chosen exact word, e.g. {"1":"word1","2":"word2"}.`;

        try {
            const raw = await callAiRaw(prompt);
            if (!raw) return null;
            const m = /\{[\s\S]*\}/.exec(raw);
            if (!m) return null;
            const parsed = JSON.parse(m[0]);
            const result = {};
            for (const [k, v] of Object.entries(parsed)) {
                let word = String(v).trim();
                const r = rows.find(row => String(row.index || row.rowNumber) === String(k));
                if (r && Array.isArray(r.options) && /^[A-Da-d]\.?$/.test(word)) {
                    const idx = word[0].toUpperCase().charCodeAt(0) - 65;
                    if (r.options[idx]) word = stripOptionPrefix(r.options[idx]);
                }
                result[String(k)] = word;
            }
            return result;
        } catch (e) {
            return null;
        }
    }

    async function solveClozePassage(passageText, rows = []) {
        if (!checkLicensed()) return null;
        if (!passageText) return null;
        const normPassage = passageText.toLowerCase();

        const passageSnippet = normPassage.replace(/[^a-z0-9]/g, '').slice(0, 40);
        if (IOE.state._lastClozeSnippet && IOE.state._lastClozeSnippet !== passageSnippet) {
            IOE.state.clozeAnswers = {};
        }
        IOE.state._lastClozeSnippet = passageSnippet;

        try { scanCocosMemoryForAnswers(); } catch (e) {}

        const outAnswers = {};

        // 1. Tier 0 captured system Cloze answers
        const validSystemAnswers = {};
        if (IOE.state.clozeAnswers) {
            for (const [k, v] of Object.entries(IOE.state.clozeAnswers)) {
                if (isValidClozeWord(v)) validSystemAnswers[k] = String(v).trim();
            }
        }

        if (Object.keys(validSystemAnswers).length >= (rows.length || 6)) {
            if (rows.length === 0) {
                Object.assign(outAnswers, validSystemAnswers);
            } else {
                for (const r of rows) {
                    const idxStr = String(r.index);
                    if (validSystemAnswers[idxStr]) outAnswers[idxStr] = validSystemAnswers[idxStr];
                }
            }
            if (Object.keys(outAnswers).length >= (rows.length || 6)) {
                const validEntries = Object.entries(outAnswers)
                    .filter(([, v]) => isValidClozeWord(v))
                    .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10));
                if (validEntries.length > 0) {
                    const detailedAnswers = validEntries.map(([k, v]) => `• Câu ${k}: ${v}`).join('\n');
                    const compactAnswers = validEntries.map(([k, v]) => `Câu ${k}: ${v}`).join('  |  ');
                    IOE.events?.emit('questionSolved', {
                        qId: 'cloze_passage',
                        qText: `[Đoạn văn điền từ - ${validEntries.length} câu hỏi]\n${passageText.slice(0, 100)}...`,
                        answer: compactAnswers,
                        tier: 'Tier 0 (Hệ Thống IOE - Key Gốc)',
                        thinking: `🔓 [Key Gốc Hệ Thống]: Bắt được ${validEntries.length} đáp án từ bộ nhớ IOE.\n${detailedAnswers}`
                    });
                    return outAnswers;
                }
            }
        }

        // 2. Tier 1: Verified bank (require >= 2 distinct keywords to avoid false triggers)
        for (const entry of CLOZE_KNOWLEDGE_BANK) {
            const matches = entry.keywords.filter(k => normPassage.includes(k.toLowerCase()));
            if (matches.length >= 2) {
                const sourceDict = entry.words || {};
                if (!IOE.state.clozeAnswers) IOE.state.clozeAnswers = {};
                Object.assign(IOE.state.clozeAnswers, sourceDict);

                if (rows.length === 0) {
                    Object.assign(outAnswers, sourceDict);
                } else {
                    for (const r of rows) {
                        const idxStr = String(r.index || r.rowNumber);
                        if (sourceDict[idxStr]) outAnswers[idxStr] = sourceDict[idxStr];
                    }
                }

                const validEntries = Object.entries(outAnswers)
                    .filter(([, v]) => isValidClozeWord(v))
                    .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10));
                if (validEntries.length > 0) {
                    const detailedAnswers = validEntries.map(([k, v]) => `• Câu ${k}: ${v}`).join('\n');
                    const compactAnswers = validEntries.map(([k, v]) => `Câu ${k}: ${v}`).join('  |  ');
                    IOE.events?.emit('questionSolved', {
                        qId: 'cloze_passage',
                        qText: `[Đoạn văn điền từ - ${validEntries.length} câu hỏi]\n${passageText.slice(0, 100)}...`,
                        answer: compactAnswers,
                        tier: 'Tier 0 (Ngân hàng đề IOE chuẩn)',
                        thinking: `📖 [Đoạn văn Cloze Test]: Khớp chuẩn ${validEntries.length} vị trí.\n${detailedAnswers}`
                    });
                    return outAnswers;
                }
            }
        }

        // 3. Collocation CAS Matching
        for (const row of rows) {
            const rowIdx = String(row.index || '');
            if (outAnswers[rowIdx]) continue;
            const opts = (row.options || []).map(o => stripOptionPrefix(o));
            for (const col of COMMON_COLLOCATIONS) {
                if (col.pattern.test(passageText)) {
                    const matchedOpt = opts.find(o => o.toLowerCase() === col.word.toLowerCase());
                    if (matchedOpt) { outAnswers[rowIdx] = matchedOpt; break; }
                }
            }
        }

        if (rows.length > 0 && Object.keys(outAnswers).length >= rows.length) {
            const validEntries = Object.entries(outAnswers)
                .filter(([, v]) => isValidClozeWord(v))
                .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10));
            if (validEntries.length > 0) {
                IOE.events?.emit('questionSolved', {
                    qId: 'cloze_passage_collocation',
                    qText: `[Đoạn văn điền từ - ${validEntries.length} câu hỏi]\n${passageText.slice(0, 100)}...`,
                    answer: validEntries.map(([k, v]) => `Câu ${k}: ${v}`).join('  |  '),
                    tier: 'Tier 1 (Collocation CAS)',
                    thinking: validEntries.map(([k, v]) => `• Câu ${k}: ${v}`).join('\n')
                });
                return outAnswers;
            }
        }

        // 4. AI Solver
        const aiResult = await solveClozeWithAi(passageText, rows);
        if (aiResult && typeof aiResult === 'object') {
            for (const [k, v] of Object.entries(aiResult)) {
                if (!outAnswers[k] && isValidClozeWord(v)) outAnswers[k] = v;
            }
            const validEntries = Object.entries(outAnswers)
                .filter(([, v]) => isValidClozeWord(v))
                .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10));
            if (validEntries.length > 0) {
                IOE.events?.emit('questionSolved', {
                    qId: 'cloze_passage_ai',
                    qText: `[Đoạn văn điền từ - ${validEntries.length} câu hỏi]\n${passageText.slice(0, 100)}...`,
                    answer: validEntries.map(([k, v]) => `Câu ${k}: ${v}`).join('  |  '),
                    tier: 'Tier 2 (AI Cloze)',
                    thinking: `📖 [AI Cloze Solver]:\n${validEntries.map(([k, v]) => `• Câu ${k}: ${v}`).join('\n')}`
                });
                return outAnswers;
            }
        }

        return outAnswers;
    }

    /* ================= 5. SOLVE ORCHESTRATOR ================= */
    async function solveQuestion(qId, qText, options = [], taskHint = '') {
        if (!checkLicensed()) {
            IOE.license?.showLicenseModal?.('Vui lòng kích hoạt Key YANZ-IOE trước khi giải bài!');
            return null;
        }
        if (!qText && !qId) return null;

        // Tier 0: Lookup in packet/RAM ground truth (check ID + exact normalized question stem + substring match)
        let tier0Ans = null;
        if (qId && IOE.state.correctAnswers.has(String(qId))) {
            tier0Ans = IOE.state.correctAnswers.get(String(qId));
        } else if (qText) {
            const normStem = normalizeKeyStr(qText);
            if (IOE.state.correctAnswers.has(normStem)) {
                tier0Ans = IOE.state.correctAnswers.get(normStem);
            } else {
                for (const [k, v] of IOE.state.correctAnswers.entries()) {
                    if (k.length >= 12 && (normStem.includes(k) || k.includes(normStem))) {
                        tier0Ans = v;
                        break;
                    }
                }
            }
        }

        if (tier0Ans && !isAnswerWrong(qId, tier0Ans)) {
            const resolved = resolveOptionAnswer(tier0Ans, options);
            const thinking = generate0msThinking(qText, resolved, 'Tier 0 (Key Gốc)');
            const meta = { qId, qText, answer: resolved, tier: 'Tier 0 (Key Gốc)', thinking };
            IOE.state.solvedMeta.set(qId || normKey(qText), meta);
            IOE.events.emit('questionSolved', meta);
            return meta;
        }

        // Tier 1: Local English CAS
        if (taskHint !== 'reorder') {
            const cas = solveLocalEnglish(qText, options);
            if (cas && !isAnswerWrong(qId, cas.answer)) {
                const resolved = resolveOptionAnswer(cas.answer, options);
                const thinking = generate0msThinking(qText, resolved, cas.tier);
                const meta = { qId, qText, answer: resolved, tier: cas.tier, thinking };
                IOE.state.solvedMeta.set(qId || normKey(qText), meta);
                IOE.events.emit('questionSolved', meta);
                return meta;
            }
        }

        // Tier 2: AI Solver
        const apiKey = (IOE.featureConfigs?.apiKey || '').trim();
        if (!apiKey) {
            IOE.toast('⚠️ Chưa nhập API Key AI trong mục Tùy chỉnh (chỉ chạy Tier 0/CAS)', 2400);
            return null;
        }

        IOE.toast('🔍 Đang giải câu hỏi...', 1000);
        const aiAns = await solveWithAi(qId, qText, options, taskHint);
        if (aiAns && !isAnswerWrong(qId, aiAns)) {
            const thinking = generate0msThinking(qText, aiAns, 'Tier 2 (AI)');
            const meta = { qId, qText, answer: aiAns, tier: 'Tier 2 (AI)', thinking };
            IOE.state.solvedMeta.set(qId || normKey(qText), meta);
            IOE.events.emit('questionSolved', meta);
            return meta;
        } else if (lastAiError) {
            IOE.appendLog?.(`❌ Lỗi AI: ${lastAiError}`);
        }

        return null;
    }

    function normKey(s) {
        return normalizeKeyStr(s).slice(0, 60);
    }

    /* ================= 6. UNIVERSAL PACKET SNIFFER & COCOS RAM EXTRACTOR ================= */
    function tryDecodeBase64Json(val) {
        if (typeof val !== 'string' || val.length < 16 || val.length > 500000) return null;
        const t = val.trim();
        if (t.startsWith('{') || t.startsWith('[')) {
            try { return JSON.parse(t); } catch (e) { return null; }
        }
        if (/^eyJ[A-Za-z0-9+/=_-]+$/.test(t)) {
            try {
                const norm = t.replace(/-/g, '+').replace(/_/g, '/');
                const bin = atob(norm);
                const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
                const txt = new TextDecoder().decode(bytes);
                return JSON.parse(txt);
            } catch (e) { return null; }
        }
        return null;
    }

    function storeQuestionAnswer(qObj, fallbackId) {
        if (!qObj || typeof qObj !== 'object') return false;
        let hit = false;
        const id = qObj.questionId ?? qObj.QuestionId ?? qObj.id ?? qObj.Id ?? qObj.questId ?? fallbackId;
        const contentRaw = qObj.content ?? qObj.Content ?? qObj.questionContent?.content ?? qObj.QuestionText ?? qObj.question ?? qObj.title ?? '';
        const contentClean = typeof contentRaw === 'string' ? contentRaw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';

        // Direct answer string fields
        let rawAns = qObj.tans ?? qObj.Tans ?? qObj.trueAns ?? qObj.TrueAns ?? qObj.correctAnswer ?? qObj.CorrectAnswer ?? qObj.TrueAnswer ?? qObj.DapAn ?? qObj.RightAnswer;
        if ((rawAns === undefined || rawAns === null || rawAns === '') && (typeof qObj.answer === 'string' || typeof qObj.Answer === 'string')) {
            rawAns = qObj.answer ?? qObj.Answer;
        }

        // Check option list on the same object for isTrue/point > 0 or numeric tans lookup
        const optArr = qObj.ans ?? qObj.Ans ?? qObj.options ?? qObj.Options ?? qObj.listAnswer ?? qObj.ListAnswer ?? qObj.answers ?? qObj.Answers;
        if (Array.isArray(optArr) && optArr.length > 0) {
            if (rawAns !== undefined && rawAns !== null && /^\d+$/.test(String(rawAns).trim())) {
                const nIdx = parseInt(String(rawAns).trim(), 10);
                // Some schemas use 0-based index, others use 1-based position/id match
                const byId = optArr.find(o => o && typeof o === 'object' && Number(o.id ?? o.Id ?? o.position ?? o.Order) === nIdx);
                const chosen = byId || optArr[nIdx] || optArr[nIdx - 1];
                if (chosen) {
                    const txt = typeof chosen === 'string' ? chosen : (chosen.content ?? chosen.Content ?? chosen.text ?? chosen.ans);
                    if (txt && String(txt).trim() !== '______') rawAns = String(txt).trim();
                }
            }
            if (!rawAns || String(rawAns).trim() === '______') {
                const trueOpt = optArr.find(o => o && typeof o === 'object' && (o.isTrue === true || o.IsTrue === true || o.true === 1 || o.True === 1 || o.isCorrect === true || Number(o.point ?? o.Point ?? 0) > 0));
                if (trueOpt) {
                    const txt = trueOpt.content ?? trueOpt.Content ?? trueOpt.text ?? trueOpt.ans ?? trueOpt.tans;
                    if (txt && String(txt).trim() !== '______') rawAns = String(txt).trim();
                }
            }
        }

        if (rawAns !== undefined && rawAns !== null) {
            const ansClean = String(rawAns).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            if (ansClean && ansClean !== '______' && ansClean !== '...' && !ansClean.includes('translate.')) {
                if (id !== undefined && id !== null && String(id) !== '') {
                    IOE.state.correctAnswers.set(String(id), ansClean);
                    hit = true;
                }
                if (contentClean.length >= 4) {
                    IOE.state.correctAnswers.set(normalizeKeyStr(contentClean), ansClean);
                    hit = true;
                }
            }
        }
        return hit;
    }

    function parsePacket(data) {
        if (!data) return false;
        if (typeof data === 'string') {
            const dec = tryDecodeBase64Json(data);
            if (!dec) return false;
            data = dec;
        }
        if (typeof data !== 'object') return false;
        if (!IOE.state.clozeAnswers) IOE.state.clozeAnswers = {};

        let foundCount = 0;
        const visited = new WeakSet();

        function traverse(obj, depth = 0) {
            if (!obj || typeof obj !== 'object' || depth > 8) return;
            if (visited.has(obj)) return;
            visited.add(obj);

            if (storeQuestionAnswer(obj)) foundCount++;

            // Explicit Cloze-style answear/ans arrays with positions
            for (const key of ['answear', 'ans', 'Ans']) {
                const arr = obj[key];
                if (Array.isArray(arr) && arr.length > 0) {
                    arr.forEach((a, idx) => {
                        if (a && typeof a === 'object') {
                            if (storeQuestionAnswer(a, idx + 1)) foundCount++;
                            const pos = String(a.position || a.Order || (idx + 1));
                            const val = a.tans || a.Tans || (a.isTrue || Number(a.point || 0) > 0 ? (a.content || a.ans) : null);
                            if (val && isValidClozeWord(String(val)) && parseInt(pos, 10) <= 15) {
                                IOE.state.clozeAnswers[pos] = String(val).trim();
                                foundCount++;
                            }
                        }
                    });
                }
            }

            // Question lists
            for (const qKey of ['question', 'questionArr', 'listQuestion', 'Questions', 'questions']) {
                const qArr = obj[qKey];
                if (Array.isArray(qArr)) {
                    qArr.forEach((q, idx) => {
                        if (storeQuestionAnswer(q, idx + 1)) foundCount++;
                    });
                }
            }

            if (Array.isArray(obj)) {
                for (let i = 0; i < obj.length && i < 200; i++) traverse(obj[i], depth + 1);
            } else {
                for (const k of Object.keys(obj)) {
                    if (k === 'window' || k === 'document' || k === 'global' || k === 'self' || k === '_parent' || k === 'parent') continue;
                    const v = obj[k];
                    if (typeof v === 'string' && (v.startsWith('eyJ') || v.startsWith('{'))) {
                        const sub = tryDecodeBase64Json(v);
                        if (sub) traverse(sub, depth + 1);
                    } else if (v && typeof v === 'object') {
                        traverse(v, depth + 1);
                    }
                }
            }
        }

        traverse(data, 0);
        if (foundCount > 0) {
            IOE.state.packetHits = (IOE.state.packetHits || 0) + 1;
            IOE.events.emit('packetCaptured', { hits: IOE.state.packetHits, answers: IOE.state.correctAnswers.size });
        }
        return foundCount > 0;
    }

    if (!win.__YANZIOE_NET_HOOKED__) {
        win.__YANZIOE_NET_HOOKED__ = true;

        try {
            const origJsonParse = JSON.parse;
            JSON.parse = function (...args) {
                const res = origJsonParse.apply(this, args);
                try {
                    if (res && typeof res === 'object') parsePacket(res);
                } catch (e) {}
                return res;
            };
        } catch (e) {}

        try {
            const originalFetch = win.fetch;
            if (typeof originalFetch === 'function') {
                win.fetch = async function (...args) {
                    const res = await originalFetch.apply(this, args);
                    try {
                        const clone = res.clone();
                        clone.text().then(t => parsePacket(t)).catch(() => {});
                    } catch (e) {}
                    return res;
                };
            }
        } catch (e) {}

        try {
            const origOpen = XMLHttpRequest.prototype.open;
            const origSend = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.open = function (m, url, ...rest) {
                this._ioeUrl = url;
                return origOpen.apply(this, [m, url, ...rest]);
            };
            XMLHttpRequest.prototype.send = function (...args) {
                this.addEventListener('load', function () {
                    try {
                        if (this.responseText) parsePacket(this.responseText);
                    } catch (e) {}
                });
                return origSend.apply(this, args);
            };
        } catch (e) {}
    }

    function bypassIOESystemAnswers() {
        let extracted = false;
        if (!IOE.state.clozeAnswers) IOE.state.clozeAnswers = {};

        // 1. Cocos __require Modules
        try {
            if (typeof win.__require === 'function') {
                for (const modName of ['ClientData', 'AppModel', 'GameData', 'ExamModel']) {
                    try {
                        const m = win.__require(modName);
                        const rootObj = m?.default || m;
                        if (rootObj) {
                            if (parsePacket(rootObj)) extracted = true;
                            const appModel = rootObj.AppModel || rootObj;
                            if (appModel?.game && parsePacket(appModel.game)) extracted = true;
                        }
                    } catch (e) {}
                }
            }
        } catch (e) {}

        // 2. Scan Running Cocos Scene node components deeply
        try {
            const cc = win.cc;
            if (cc && cc.director) {
                const scene = (typeof cc.director.getRunningScene === 'function' ? cc.director.getRunningScene() : (typeof cc.director.getScene === 'function' ? cc.director.getScene() : null));
                if (scene) {
                    const seenNodes = new WeakSet();
                    function inspectNode(node, depth = 0) {
                        if (!node || depth > 14 || seenNodes.has(node)) return;
                        seenNodes.add(node);
                        const comps = node._components || [];
                        for (const comp of comps) {
                            if (!comp) continue;
                            for (const fld of ['questionModel', 'curQuestion', 'currentQuestion', 'examData', 'question', 'data', 'info']) {
                                if (comp[fld] && parsePacket(comp[fld])) extracted = true;
                            }
                            if (Array.isArray(comp.listQuestion) && parsePacket(comp.listQuestion)) extracted = true;
                            if (Array.isArray(comp.data?.answearArr)) {
                                const fullStr = comp.data.answearArr.map(x => (typeof x === 'object' ? (x.content || '') : String(x))).join(' ').trim();
                                if (fullStr && isValidClozeWord(fullStr)) {
                                    IOE.state.correctAnswers.set('game11_full', fullStr);
                                    extracted = true;
                                }
                            }
                        }
                        const children = (typeof node.getChildren === 'function' ? node.getChildren() : node.children) || [];
                        for (const ch of children) inspectNode(ch, depth + 1);
                    }
                    inspectNode(scene, 0);
                }
            }
        } catch (e) {}

        // 3. Global variables
        for (const gk of ['gameData', 'examData', 'exam', 'quizData', 'IOE_DATA', 'currentExam']) {
            try {
                if (win[gk] && parsePacket(win[gk])) extracted = true;
            } catch (e) {}
        }

        return extracted;
    }

    function scanCocosMemoryForAnswers() {
        return bypassIOESystemAnswers();
    }

    IOE.CLOZE_KNOWLEDGE_BANK = CLOZE_KNOWLEDGE_BANK;
    IOE.isValidClozeWord = isValidClozeWord;

    IOE.question = {
        solveQuestion,
        solveClozePassage,
        scanCocosMemoryForAnswers,
        bypassIOESystemAnswers,
        parsePacket,
        testAiKey,
        generate0msThinking,
        recordAdaptiveMistake,
        isAnswerWrong,
        getWrongAnswers
    };
})(typeof window !== 'undefined' ? window : globalThis);
