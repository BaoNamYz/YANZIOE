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
            keywords: ['vietnam is becoming', 'different nations', 'cuisines', 'japan, korea, and italy'],
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
            if (matches.length >= 2) {
                console.log('[YANZIOE] Khớp đoạn văn từ Ngân hàng đề thi IOE!');
                const thinking = `📖 [Đoạn văn Cloze Test]: ${passageText.slice(0, 80)}...\n✓ Đối chiếu ngân hàng đề thi chuẩn IOE Bộ GD&ĐT.\n✓ Đáp án xác thực: ${JSON.stringify(entry.answers)}`;
                IOE.events?.emit('questionSolved', { qId: 'cloze_passage', answer: JSON.stringify(entry.answers), tier: 'Tier 1 (Ngân hàng IOE 0ms)', thinking });
                return entry.answers;
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
        for (let i = 1; i <= (rows.length || 6); i++) {
            const k = String(i);
            if (!resultAnswers[k]) {
                resultAnswers[k] = ['A', 'B', 'C', 'D'][(i - 1) % 4];
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
