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

    /* ================= 4. TIER 2: AI SOLVER (AUTO-DISCOVERING GEMINI / GROQ / OPENROUTER) ================= */
    let lastAiError = '';
    const discoveredModelsCache = new Map();

    async function extRequestJson(endpoint, method = 'POST', headers = {}, payloadObj = null, timeoutMs = 8500) {
        const reqExt = IOE.net?.requestExternal;
        const bodyStr = (method === 'GET' || payloadObj === null) ? undefined : JSON.stringify(payloadObj);
        if (reqExt) {
            return await reqExt(endpoint, { method, headers, body: bodyStr, timeoutMs });
        }
        const ctrl = new AbortController();
        const tm = IOE.timers?.setTimeout ? IOE.timers.setTimeout(() => ctrl.abort(), timeoutMs) : setTimeout(() => ctrl.abort(), timeoutMs);
        try {
            const init = { method, headers, signal: ctrl.signal };
            if (bodyStr !== undefined) init.body = bodyStr;
            const res = await fetch(endpoint, init);
            return { ok: res.ok, status: res.status, text: await res.text() };
        } finally {
            if (IOE.timers?.clearTimeout) IOE.timers.clearTimeout(tm); else clearTimeout(tm);
        }
    }

    async function discoverLiveModels(provider, apiKey) {
        const cacheKey = `${provider}:${String(apiKey || '').slice(0, 10)}`;
        const cached = discoveredModelsCache.get(cacheKey);
        if (cached && (Date.now() - cached.ts < 600000)) return cached.models;

        let found = [];
        try {
            if (provider === 'gemini') {
                const r = await extRequestJson(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`, 'GET', {}, null, 6000);
                if (r?.ok && r.text) {
                    const j = JSON.parse(r.text);
                    found = (j.models || [])
                        .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
                        .map(m => String(m.name || '').replace(/^models\//, ''))
                        .filter(n => /flash/i.test(n) && !/(tts|live|image|audio|embedding|vision)/i.test(n))
                        .sort((a, b) => b.localeCompare(a))
                        .slice(0, 5);
                }
            } else if (provider === 'groq') {
                const r = await extRequestJson('https://api.groq.com/openai/v1/models', 'GET', { 'Authorization': `Bearer ${apiKey}` }, null, 6000);
                if (r?.ok && r.text) {
                    const j = JSON.parse(r.text);
                    const allIds = (j.data || [])
                        .map(m => String(m.id || ''))
                        .filter(id => id && !/(whisper|tts|guard|safeguard|orpheus|embed)/i.test(id));
                    const prio = (id) => (/llama-3\.3|gpt-oss-120b/.test(id) ? 0 : /gpt-oss|qwen|llama-3/.test(id) ? 1 : 2);
                    found = allIds.sort((a, b) => prio(a) - prio(b)).slice(0, 6);
                }
            } else if (provider === 'openrouter') {
                const r = await extRequestJson('https://openrouter.ai/api/v1/models', 'GET', {}, null, 6000);
                if (r?.ok && r.text) {
                    const j = JSON.parse(r.text);
                    found = (j.data || [])
                        .map(m => String(m.id || ''))
                        .filter(id => id.endsWith(':free') && !/(embed|whisper|tts)/i.test(id))
                        .slice(0, 5);
                }
            }
        } catch (e) {}

        if (found.length > 0) {
            discoveredModelsCache.set(cacheKey, { ts: Date.now(), models: found });
        }
        return found;
    }

    async function callGeminiApi(apiKey, prompt, expectJson = true, inlineParts = []) {
        const cacheKey = `gemini:${String(apiKey || '').slice(0, 10)}`;
        const initialModels = discoveredModelsCache.get(cacheKey)?.models || [
            'gemini-3.8-flash',
            'gemini-3.5-flash-lite',
            'gemini-3.6-flash',
            'gemini-2.5-flash',
            'gemini-2.5-flash-lite'
        ];

        const contentParts = [{ text: prompt }, ...(Array.isArray(inlineParts) ? inlineParts : [])];

        async function tryList(models) {
            let authFatal = false;
            for (const m of models) {
                try {
                    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(apiKey)}`;
                    const genCfg = { temperature: 0.1, maxOutputTokens: 1000 };
                    if (expectJson) genCfg.responseMimeType = 'application/json';
                    const r = await extRequestJson(endpoint, 'POST', { 'Content-Type': 'application/json' }, {
                        contents: [{ parts: contentParts }],
                        generationConfig: genCfg
                    }, 8500);

                    if (r && r.ok && r.text) {
                        const j = JSON.parse(r.text);
                        const txt = j?.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (txt) { lastAiError = ''; return { txt }; }
                    } else if (r) {
                        lastAiError = `Gemini ${m}: HTTP ${r.status} ${(r.text || r.error || '').slice(0, 120)}`;
                        if (r.status === 401 || r.status === 403 || (r.status === 400 && /API key/i.test(r.text || ''))) {
                            authFatal = true;
                            break;
                        }
                    }
                } catch (e) {
                    lastAiError = `Gemini ${m}: ${e?.message || e}`;
                }
            }
            return { txt: null, authFatal };
        }

        const first = await tryList(initialModels);
        if (first.txt) return first.txt;
        if (!first.authFatal) {
            const live = await discoverLiveModels('gemini', apiKey);
            const unseen = live.filter(m => !initialModels.includes(m));
            if (unseen.length > 0) {
                const retry = await tryList(unseen);
                if (retry.txt) return retry.txt;
            }
        }
        return null;
    }

    async function callOpenAiCompat(endpoint, apiKey, defaultModels, prompt, useJsonFormat = true, providerTag = 'groq') {
        const cacheKey = `${providerTag}:${String(apiKey || '').slice(0, 10)}`;
        const initialModels = discoveredModelsCache.get(cacheKey)?.models || defaultModels;

        async function tryList(models) {
            let authFatal = false;
            for (const model of models) {
                let wantJson = useJsonFormat && !/gemma|free/i.test(model);
                for (let pass = 0; pass < 2; pass++) {
                    try {
                        const bodyObj = {
                            model,
                            messages: [{ role: 'user', content: prompt }],
                            temperature: 0.1
                        };
                        if (wantJson) bodyObj.response_format = { type: 'json_object' };
                        const r = await extRequestJson(endpoint, 'POST', {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        }, bodyObj, 8500);

                        if (r && r.ok && r.text) {
                            const j = JSON.parse(r.text);
                            const txt = j?.choices?.[0]?.message?.content || '';
                            if (txt) { lastAiError = ''; return { txt }; }
                        } else if (r) {
                            lastAiError = `${model}: HTTP ${r.status} ${(r.text || r.error || '').slice(0, 120)}`;
                            if (r.status === 400 && wantJson && /response_format|json/i.test(r.text || '')) {
                                wantJson = false;
                                continue;
                            }
                            if (r.status === 401 || r.status === 403) { authFatal = true; break; }
                        }
                    } catch (e) {
                        lastAiError = `${model}: ${e?.message || e}`;
                    }
                    break;
                }
                if (authFatal) break;
            }
            return { txt: null, authFatal };
        }

        const first = await tryList(initialModels);
        if (first.txt) return first.txt;
        if (!first.authFatal) {
            const live = await discoverLiveModels(providerTag, apiKey);
            const unseen = live.filter(m => !initialModels.includes(m));
            if (unseen.length > 0) {
                const retry = await tryList(unseen);
                if (retry.txt) return retry.txt;
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

    async function fetchMediaBase64(url) {
        if (!url || !IOE.net?.requestExternal) return null;
        try {
            const r = await IOE.net.requestExternal(url, { method: 'GET', responseType: 'base64', timeoutMs: 12000 });
            if (r?.ok && r.base64) return { base64: r.base64, contentType: r.contentType || '' };
        } catch (e) {}
        return null;
    }

    async function transcribeAudioWithGroq(apiKey, audioBase64) {
        if (!audioBase64 || !IOE.net?.requestExternal) return '';
        try {
            const r = await IOE.net.requestExternal('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}` },
                multipartAudioBase64: audioBase64,
                whisperModel: 'whisper-large-v3-turbo',
                timeoutMs: 12000
            });
            if (r?.ok && r.text) {
                const j = JSON.parse(r.text);
                return String(j?.text || '').trim();
            }
        } catch (e) {}
        return '';
    }

    async function callAiRaw(prompt, inlineParts = []) {
        const apiKey = (IOE.featureConfigs?.apiKey || '').trim();
        if (!apiKey) { lastAiError = 'Chưa nhập API Key'; return null; }
        const provider = detectProvider(apiKey);
        if (provider === 'gemini') {
            return await callGeminiApi(apiKey, prompt, true, inlineParts);
        }
        if (provider === 'groq') {
            return await callOpenAiCompat('https://api.groq.com/openai/v1/chat/completions', apiKey, [
                'llama-3.3-70b-versatile',
                'openai/gpt-oss-120b',
                'openai/gpt-oss-20b',
                'qwen/qwen3-32b',
                'llama-3.1-8b-instant'
            ], prompt, true, 'groq');
        }
        return await callOpenAiCompat('https://openrouter.ai/api/v1/chat/completions', apiKey, [
            'openrouter/free',
            'google/gemma-4-31b-it:free',
            'google/gemma-4-26b-a4b-it:free',
            'nvidia/nemotron-3.5-super-vl:free'
        ], prompt, true, 'openrouter');
    }

    function resolveOptionAnswer(rawAns, options = []) {
        let ans = String(rawAns || '').trim();
        if (!ans || !Array.isArray(options) || options.length === 0) return ans;
        const cleanOpts = options.map(stripOptionPrefix);
        // Handle True/False normalization when options are explicitly True & False
        if (cleanOpts.length === 2 && cleanOpts.some(o => /^true$/i.test(o)) && cleanOpts.some(o => /^false$/i.test(o))) {
            const lo = ans.toLowerCase();
            if (/^(true|đúng|yes|1|t)$/i.test(lo) || (cleanOpts[0].toLowerCase() === 'true' && /^a\.?$/i.test(lo)) || (cleanOpts[1].toLowerCase() === 'true' && /^b\.?$/i.test(lo))) {
                return cleanOpts.find(o => /^true$/i.test(o)) || 'True';
            }
            if (/^(false|sai|no|0|f)$/i.test(lo) || (cleanOpts[0].toLowerCase() === 'false' && /^a\.?$/i.test(lo)) || (cleanOpts[1].toLowerCase() === 'false' && /^b\.?$/i.test(lo))) {
                return cleanOpts.find(o => /^false$/i.test(o)) || 'False';
            }
        }
        // Handle single option letter "A", "B", "C", "D" or "A."
        const mLet = /^([A-Da-d])\.?$/.exec(ans);
        if (mLet) {
            const idx = mLet[1].toUpperCase().charCodeAt(0) - 65;
            if (cleanOpts[idx]) return cleanOpts[idx];
        }
        return ans;
    }

    async function solveWithAi(qId, qText, options = [], taskHint = '', mediaOpts = null) {
        const apiKey = (IOE.featureConfigs?.apiKey || '').trim();
        if (!apiKey) return null;
        const provider = detectProvider(apiKey);

        const wrongList = getWrongAnswers(qId);
        const wrongNote = wrongList.length ? `\nKnown WRONG options (NEVER pick these): ${wrongList.join(', ')}` : '';
        const cleanOpts = (options || []).map(o => stripOptionPrefix(o)).filter(Boolean);
        const optsText = cleanOpts.length
            ? `\nOptions:\n${cleanOpts.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n')}`
            : '';

        const inlineParts = [];
        let audioTranscriptNote = '';
        if (mediaOpts?.audioUrl) {
            const media = await fetchMediaBase64(mediaOpts.audioUrl);
            if (media?.base64) {
                if (provider === 'gemini') {
                    inlineParts.push({ inlineData: { mimeType: media.contentType || 'audio/mpeg', data: media.base64 } });
                } else if (provider === 'groq') {
                    const tr = await transcribeAudioWithGroq(apiKey, media.base64);
                    if (tr) audioTranscriptNote = `\nListening Audio Transcript: "${tr}"`;
                }
            }
        }
        if (mediaOpts?.imageUrl && provider === 'gemini') {
            const img = await fetchMediaBase64(mediaOpts.imageUrl);
            if (img?.base64) {
                inlineParts.push({ inlineData: { mimeType: img.contentType || 'image/jpeg', data: img.base64 } });
            }
        }

        const isTrueFalse = cleanOpts.length === 2 && cleanOpts.some(o => /^true$/i.test(o)) && cleanOpts.some(o => /^false$/i.test(o));
        let instruction = '';
        if (taskHint === 'reorder') {
            instruction = `Task: Reorder ALL given word/phrase blocks into ONE grammatically correct English sentence.\nBlocks: ${cleanOpts.join(' | ')}\nRules: Return exact sentence using only those blocks.`;
        } else if (taskHint === 'pairs') {
            instruction = `Task: Match ALL ${cleanOpts.length} cards below into ${Math.floor(cleanOpts.length / 2)} exact pairs.\nCards:\n${cleanOpts.map((c, i) => `${i}: ${c}`).join('\n')}\nRules: Return ONLY raw JSON {"answer": [["card1", "card2"], ...]} with exact card texts.`;
        } else if (taskHint === 'blank' && mediaOpts?.maxInput > 0) {
            instruction = `Task: Fill the missing letter(s) represented by underscores ("_").\nRequired character length: EXACTLY ${mediaOpts.maxInput} character(s).\nIf the whole word is underscores (e.g. ____), return the full ${mediaOpts.maxInput}-letter English word; if partial letters exist (e.g. t_m_rrow), return ONLY the ${mediaOpts.maxInput} missing letter(s) in order.`;
        } else if (isTrueFalse) {
            instruction = `Task: Decide whether the statement is True or False (use the Listening Audio or Audio Transcript if provided, otherwise verify the factual/grammar statement).\nRules: Answer MUST be strictly "True" or "False". NEVER repeat the statement sentence.`;
        } else {
            instruction = `Solve this Vietnamese Olympic English (IOE) question accurately.\nIf multiple choice, return the exact winning option text (NOT just letter A/B/C/D if text is shown).\nIf fill in the blank, return ONLY the missing word or phrase.\nIf word reordering, return ONLY the full reordered English sentence.`;
        }

        const prompt = `${instruction}\nReturn ONLY raw JSON: {"answer": "..."} with NO markdown.\nQuestion: ${qText}${audioTranscriptNote}${optsText}${wrongNote}`;

        try {
            const raw = await callAiRaw(prompt, inlineParts);
            if (!raw) return null;
            const m = /\{[\s\S]*"answer"[\s\S]*\}/.exec(raw);
            let extracted = '';
            if (m) {
                try {
                    const parsed = JSON.parse(m[0]);
                    const v = parsed.answer;
                    extracted = Array.isArray(v) ? JSON.stringify(v) : String(v || '').trim();
                } catch (e) {}
            }
            if (!extracted) {
                extracted = raw.replace(/```json|```/gi, '').replace(/^[\s"'{}]+|[\s"'{}]+$/g, '').trim();
            }
            return (taskHint === 'reorder' || taskHint === 'pairs') ? extracted : resolveOptionAnswer(extracted, cleanOpts);
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
    async function solveQuestion(qId, qText, options = [], taskHint = '', mediaOpts = null) {
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
        const aiAns = await solveWithAi(qId, qText, options, taskHint, mediaOpts);
        if (aiAns && !isAnswerWrong(qId, aiAns)) {
            const thinking = generate0msThinking(qText, aiAns, 'Tier 2 (AI)');
            const meta = { qId, qText, answer: aiAns, tier: 'Tier 2 (AI)', thinking };
            IOE.state.solvedMeta.set(qId || normKey(qText), meta);
            IOE.events.emit('questionSolved', meta);
            return meta;
        } else if (lastAiError) {
            IOE.appendLog?.(`❌ Lỗi AI: ${lastAiError}`);
            const now = Date.now();
            if (!IOE.state._lastAiToastAt || (now - IOE.state._lastAiToastAt) > 6000) {
                IOE.state._lastAiToastAt = now;
                IOE.toast(`⚠️ AI lỗi: ${lastAiError.slice(0, 75)}`, 2800);
            }
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

    function extractAnswerString(val) {
        if (val === undefined || val === null) return '';
        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
        if (Array.isArray(val)) {
            const parts = val.map(x => extractAnswerString(x)).filter(Boolean);
            return parts.join(' ').trim();
        }
        if (typeof val === 'object') {
            const inner = val.tans ?? val.Tans ?? val.content ?? val.Content ?? val.text ?? val.ans ?? val.value;
            return inner !== undefined ? extractAnswerString(inner) : '';
        }
        return '';
    }

    function storeQuestionAnswer(qObj, fallbackId) {
        if (!qObj || typeof qObj !== 'object') return false;
        let hit = false;
        const id = qObj.questionId ?? qObj.QuestionId ?? qObj.id ?? qObj.Id ?? qObj.questId ?? fallbackId;
        const contentRaw = qObj.content ?? qObj.Content ?? qObj.questionContent?.content ?? qObj.QuestionText ?? qObj.question ?? qObj.title ?? '';
        const contentClean = typeof contentRaw === 'string' ? contentRaw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';

        let rawAns = qObj.tans ?? qObj.Tans ?? qObj.trueAns ?? qObj.TrueAns ?? qObj.correctAnswer ?? qObj.CorrectAnswer ?? qObj.TrueAnswer ?? qObj.DapAn ?? qObj.RightAnswer;
        if ((rawAns === undefined || rawAns === null || rawAns === '') && (typeof qObj.answer === 'string' || typeof qObj.Answer === 'string' || Array.isArray(qObj.answer))) {
            rawAns = qObj.answer ?? qObj.Answer;
        }
        let strAns = extractAnswerString(rawAns);

        const optArr = qObj.ans ?? qObj.Ans ?? qObj.answearArr ?? qObj.options ?? qObj.Options ?? qObj.listAnswer ?? qObj.ListAnswer ?? qObj.answers ?? qObj.Answers;
        if (Array.isArray(optArr) && optArr.length > 0) {
            if (strAns && /^\d+$/.test(strAns.trim())) {
                const nIdx = parseInt(strAns.trim(), 10);
                const byId = optArr.find(o => o && typeof o === 'object' && Number(o.id ?? o.Id ?? o.position ?? o.Order) === nIdx);
                const chosen = byId || optArr[nIdx] || optArr[nIdx - 1];
                const txt = extractAnswerString(chosen);
                if (txt && txt.trim() !== '______') strAns = txt.trim();
            }
            if (!strAns || strAns.trim() === '______') {
                const trueOpt = optArr.find(o => o && typeof o === 'object' && (o.isTrue === true || o.IsTrue === true || o.true === 1 || o.True === 1 || o.isCorrect === true || Number(o.point ?? o.Point ?? 0) > 0));
                const txt = extractAnswerString(trueOpt);
                if (txt && txt.trim() !== '______') strAns = txt.trim();
            }
        }

        if (strAns) {
            const ansClean = strAns.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
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
                        if (!this.responseType || this.responseType === 'text') {
                            if (this.responseText) parsePacket(this.responseText);
                        } else if (this.responseType === 'json') {
                            if (this.response) parsePacket(this.response);
                        }
                    } catch (e) {}
                });
                return origSend.apply(this, args);
            };
        } catch (e) {}

        try {
            if (win.Response?.prototype?.json) {
                const origRespJson = win.Response.prototype.json;
                win.Response.prototype.json = async function () {
                    const data = await origRespJson.apply(this, arguments);
                    try { if (data && typeof data === 'object') parsePacket(data); } catch (e) {}
                    return data;
                };
            }
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
                            if (comp.data && comp.data !== comp && parsePacket(comp.data)) extracted = true;
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
