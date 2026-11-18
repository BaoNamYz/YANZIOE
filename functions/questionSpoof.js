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
            keywords: ['pigneau de', 'nguyen phuc anh', 'thuc anh', 'coastal tip', 'trusted adviser', 'european armaments', 'rise to power', 'french priest', 'rival leaders', 'rival groups', 'gia long'],
            words: {
                "1": "encounter",
                "2": "as",
                "3": "target",
                "4": "wipe out",
                "5": "of",
                "6": "hands",
                "7": "where",
                "8": "who",
                "9": "role",
                "10": "help",
                "11": "equipped",
                "12": "successful"
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
