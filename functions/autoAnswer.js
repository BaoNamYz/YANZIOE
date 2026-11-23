(function (global) {
    'use strict';
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const IOE = global.IOE || win.IOE;
    if (!IOE) return;

    const nativeSetInterval = IOE.timers?.setInterval || win.setInterval.bind(win);

    /* ================= 1. SAFE FREEZE EXAM TIMER ================= */
    let frozenTickCount = 0;
    if (!win.__YANZIOE_TIMER_HOOKED__) {
        win.__YANZIOE_TIMER_HOOKED__ = true;
        const rawSetInterval = win.setInterval.bind(win);
        win.setInterval = function (fn, ms, ...args) {
            const delayMs = Number(ms || 0);
            let fnSrc = '';
            try { fnSrc = typeof fn === 'function' ? Function.prototype.toString.call(fn) : String(fn || ''); } catch (e) {}
            const isCountdownTick = delayMs >= 850 && delayMs <= 1200 &&
                /(time|timer|second|sec|countdown|remain|left|demnguoc|clock|minutes?|phut|giay)/i.test(fnSrc) &&
                !fnSrc.includes('yanzioe');

            if (isCountdownTick && typeof fn === 'function') {
                const wrapped = function (...wArgs) {
                    if (IOE.features?.freezeTimer && IOE.license?.verifySeal?.('93e7d590b85d867a')) {
                        frozenTickCount++;
                        return;
                    }
                    return fn.apply(this, wArgs);
                };
                return rawSetInterval(wrapped, delayMs, ...args);
            }
            return rawSetInterval(fn, ms, ...args);
        };
    }

    function computeStepDelay() {
        const mode = IOE.featureConfigs?.questionMode || 'stealth';
        if (mode === 'turbo') return 220;
        const cfgDelay = Number(IOE.featureConfigs?.autoDelay || 3000);
        const floor = IOE.features?.humanPacing !== false ? Math.max(cfgDelay, 2600) : cfgDelay;
        return Math.round(floor * (0.85 + Math.random() * 0.40));
    }

    let isProcessing = false;
    let processingStartedAt = 0;

    function isElVisible(el) {
        if (!el || el.closest('#yanzioe-root, #yanzioe-license-modal, #yanzioe-revealer-hud, nav, header, footer')) return false;
        const st = win.getComputedStyle ? win.getComputedStyle(el) : null;
        if (st && (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity || '1') <= 0.02)) return false;
        return el.offsetParent !== null || (st && st.position === 'fixed');
    }

    function isActionChromeText(txt) {
        const s = String(txt || '').trim().toLowerCase();
        return !s || /^(nộp bài|thoát|bỏ qua|tiếp tục|câu tiếp|câu sau|nghe lại|submit|next|skip|close|back|exit|ok|start|replay|play)$/.test(s);
    }

    function isLobbyNavigationText(txt) {
        const s = String(txt || '').trim().toLowerCase();
        return /^(vào thi|vào tự luyện|làm bài|xem lại|xem kết quả|thể lệ|chi tiết|bảng xếp hạng|đăng nhập|đăng ký|nâng cấp|mua gói|bắt đầu ngay|khám phá|tìm hiểu thêm|trở về|trang chủ)/.test(s);
    }

    function isLobbyDashboardPage() {
        try {
            const path = String(location.pathname || '').toLowerCase();
            if (!/^\/($|trang-chu|hoc-sinh(\/tu-luyen|\/ket-qua|\/lich-su|\/bang-xep-hang|\/tai-khoan)?|tin-tuc|gioi-thieu|huong-dan)\/?$/.test(path)) return false;
            return !document.querySelector('.question-content, .exam-content, .ioe-exam-card, #question-content, .quiz-question');
        } catch (e) { return false; }
    }

    function extractGenericDomQuestion() {
        if (isLobbyDashboardPage()) return null;
        const containers = Array.from(document.querySelectorAll('[class*="exam" i], [class*="question" i], [class*="quiz" i], [class*="card" i], main, #root, section, article'))
            .filter(isElVisible);
        const optSelector = 'button, [role="button"], label, [class*="option" i], [class*="choice" i], [class*="answer" i], [class*="btn" i]';

        for (const box of containers) {
            const rawChoices = Array.from(box.querySelectorAll(optSelector)).filter(el =>
                isElVisible(el) && !el.closest('#yanzioe-root, #yanzioe-license-modal, #yanzioe-revealer-hud') && !isActionChromeText(el.innerText || el.textContent)
            );
            const dedupChoices = rawChoices.filter((el, idx) => !rawChoices.some((other, oIdx) => oIdx !== idx && other.contains(el) && (other.innerText || '').trim() === (el.innerText || '').trim()));
            const inputs = Array.from(box.querySelectorAll('input[type="text"], input:not([type]), textarea'))
                .filter(el => isElVisible(el) && !el.closest('#yanzioe-root, #yanzioe-license-modal, #yanzioe-revealer-hud'));
            const chips = Array.from(box.querySelectorAll('.word-item, .drag-item, .card-word, .item-reorder, [class*="word" i][class*="item" i]'))
                .filter(isElVisible);

            if (dedupChoices.length < 2 && inputs.length === 0 && chips.length < 3) continue;
            const lobbyChoiceCount = dedupChoices.filter(c => isLobbyNavigationText(c.innerText || c.textContent)).length;
            if (dedupChoices.length > 0 && lobbyChoiceCount * 2 >= dedupChoices.length) continue;

            const choiceSet = new Set(dedupChoices);
            const stemNodes = Array.from(box.querySelectorAll('h1, h2, h3, h4, p, div, span')).filter(el => {
                if (!isElVisible(el) || choiceSet.has(el)) return false;
                if (dedupChoices.some(c => el.contains(c) || c.contains(el))) return false;
                const t = (el.innerText || el.textContent || '').trim();
                return t.length >= 6 && !/^\d{1,2}:\d{2}$/.test(t);
            });
            const stemEl = stemNodes.find(el => !stemNodes.some(other => other !== el && el.contains(other) && (other.innerText || '').trim().length >= 6)) || stemNodes[0];
            const qText = (stemEl ? (stemEl.innerText || stemEl.textContent) : '').trim();
            if (qText.length >= 6 && !/^(vòng tự luyện|cấp (trường|xã|phường|huyện|tỉnh|quốc gia)|hành trình cuộc thi|bảng xếp hạng|danh sách vòng)\b/i.test(qText)) {
                return { qEl: stemEl, scopeRoot: box, qText, choiceEls: dedupChoices, chips };
            }
        }
        return null;
    }

    async function stepOnce(forceRun = false) {
        const lastAlive = Math.max(processingStartedAt, IOE.state?.lastPacingHeartbeat || 0);
        if (isProcessing && (Date.now() - lastAlive < 25000)) return false;
        if (!forceRun && !IOE.features?.autoAnswer) return false;
        if (!IOE.license?.verifySeal?.('93e7d590b85d867a')) return false;
        isProcessing = true;
        processingStartedAt = Date.now();

        try {
            // 1. Canvas / Cocos2d / CreateJS minigame
            if (IOE.features?.canvasMode !== false && IOE.canvas?.solveCanvasGame) {
                const canvasSolved = await IOE.canvas.solveCanvasGame();
                if (canvasSolved) {
                    IOE.events?.emit?.('frameSolved', { engine: IOE.state.lastEngine || 'Canvas' });
                    await IOE.delay(computeStepDelay());
                    return true;
                }
            }

            // 2. Web DOM Question Extraction (legacy selectors -> generic React DOM fallback)
            const qSelectors = '.question-content, .exam-content, .title-question, .content-question, #question-content, .ques-content, .quiz-question';
            const qEls = Array.from(document.querySelectorAll(qSelectors)).filter(isElVisible);
            let qEl = qEls[0] || null;
            let qText = qEl ? (qEl.innerText || qEl.textContent || '').trim() : '';
            let scopeRoot = qEl ? (qEl.closest('.question-container, .question-box, .quiz-item, .exam-item') || document) : document;
            let choiceEls = [];
            let chips = [];

            if (qText) {
                choiceEls = Array.from(scopeRoot.querySelectorAll('.answer-item, .choice-item, .btn-answer, .item-answer, label'))
                    .filter(el => !el.closest('#yanzioe-root') && !el.closest('#yanzioe-license-modal'));
                chips = Array.from(scopeRoot.querySelectorAll('.word-item, .drag-item, .card-word, .item-reorder'));
            } else {
                const fallbackDom = extractGenericDomQuestion();
                if (fallbackDom) {
                    qEl = fallbackDom.qEl;
                    qText = fallbackDom.qText;
                    scopeRoot = fallbackDom.scopeRoot;
                    choiceEls = fallbackDom.choiceEls;
                    chips = fallbackDom.chips;
                }
            }

            if (qText) {
                IOE.state.lastEngine = 'Web DOM';
                const options = choiceEls.map(c => (c.innerText || c.textContent || '').trim()).filter(Boolean);
                const isDomReorder = chips.length >= 3 && !options.length;
                const taskOpts = isDomReorder ? chips.map(c => (c.innerText || c.textContent || '').trim()).filter(Boolean) : options;
                const qId = qEl?.dataset?.id || qEl?.id || qText.slice(0, 48);

                let meta = IOE.state.solvedMeta.get(qId);
                if (!meta) {
                    meta = await IOE.question.solveQuestion(qId, qText, taskOpts, isDomReorder ? 'reorder' : '');
                }

                if (meta?.answer) {
                    const filled = fillAnswer(meta.answer, scopeRoot === document ? null : scopeRoot);
                    if (filled && IOE.features?.autoAnswer) {
                        await IOE.delay(computeStepDelay());
                        clickNextButton();
                    }
                    return true;
                }
            } else if (forceRun) {
                const diag = IOE.canvas?.getSceneDiagnostics ? IOE.canvas.getSceneDiagnostics() : {};
                IOE.appendLog?.(`[Debug] Không phát hiện câu hỏi ở frame hiện tại: ${JSON.stringify({ href: location.href, top: win === win.top, ...diag })}`);
                IOE.toast('⚠️ Không thấy câu hỏi trên trang (xem tab 🛠 Logs -> Soi trang)', 2500);
            }
        } catch (e) {
            console.error('[IOE AutoAnswer Error]', e);
            if (forceRun) IOE.toast(`⚠️ Lỗi AutoAnswer: ${e?.message || e}`, 2500);
        } finally {
            isProcessing = false;
        }
        return false;
    }

    function setNativeInputValue(inp, val) {
        if (!inp) return;
        const proto = inp.tagName === 'TEXTAREA' ? win.HTMLTextAreaElement?.prototype : win.HTMLInputElement?.prototype;
        const desc = proto && Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && typeof desc.set === 'function') desc.set.call(inp, val);
        else inp.value = val;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function stripPrefix(s) {
        return String(s || '').replace(/^[A-Da-d][.:)\]\s_-]+/, '').trim();
    }

    function fillAnswer(ans, area = null) {
        if (!ans) return false;
        const rawAns = String(ans).trim();
        const normAns = rawAns.toLowerCase();
        const cleanAns = stripPrefix(rawAns).toLowerCase();
        const root = area || document;

        // 1. Word Reordering chips
        const chips = Array.from(root.querySelectorAll('.word-item, .drag-item, .card-word, .item-reorder'));
        if (chips.length > 0 && cleanAns.includes(' ')) {
            chips.forEach(c => { delete c.dataset.kwClicked; });
            const words = rawAns.split(/\s+/).map(w => w.toLowerCase().replace(/[^a-z0-9']/g, '')).filter(Boolean);
            let hits = 0;
            words.forEach(targetWord => {
                const matchedChip = chips.find(chip => {
                    const cText = (chip.innerText || chip.textContent || '').trim().toLowerCase().replace(/[^a-z0-9']/g, '');
                    return cText === targetWord && !chip.dataset.kwClicked;
                });
                if (matchedChip) {
                    matchedChip.dataset.kwClicked = '1';
                    matchedChip.click();
                    hits++;
                }
            });
            if (words.length > 0 && hits >= words.length) {
                IOE.toast('🧩 Đã sắp xếp câu!', 1200);
                return true;
            }
            return false;
        }

        // 2. Fill-in-the-blank input
        const inputs = Array.from(root.querySelectorAll('input.blank-input, input[type="text"].answer, input.form-control, input.input-answer, textarea.answer'))
            .filter(el => !el.closest('#yanzioe-root') && !el.closest('#yanzioe-license-modal') && !el.closest('#yanzioe-revealer-hud'));
        if (inputs.length > 0) {
            const inp = inputs.find(el => !el.value) || inputs[0];
            if (inp) {
                setNativeInputValue(inp, rawAns);
                IOE.toast(`✍️ Đã điền: ${rawAns}`, 1000);
                return true;
            }
        }

        // 3. Multiple Choice buttons / radios (strict match, no single-letter substring collision)
        let choices = Array.from(root.querySelectorAll('.answer-item, .choice-item, .btn-answer, .item-answer, input[type="radio"]'))
            .filter(el => !el.closest('#yanzioe-root') && !el.closest('#yanzioe-license-modal'));
        if (choices.length === 0) {
            choices = Array.from(root.querySelectorAll('button, [role="button"], label, [class*="option" i], [class*="choice" i], [class*="answer" i], [class*="btn" i]'))
                .filter(el => !el.closest('#yanzioe-root') && !el.closest('#yanzioe-license-modal') && !isActionChromeText(el.innerText || el.textContent));
        }
        if (choices.length > 0) {
            // Pass 1: exact text match
            let matched = choices.find(c => {
                const ct = stripPrefix(c.innerText || c.textContent || c.value || '').toLowerCase();
                return ct && ct === cleanAns;
            });
            // Pass 2: word-boundary match (>= 2 chars)
            if (!matched && cleanAns.length >= 2) {
                const esc = cleanAns.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const rx = new RegExp(`(^|\\s)${esc}(\\s|$)`, 'i');
                matched = choices.find(c => rx.test(stripPrefix(c.innerText || c.textContent || c.value || '')));
            }
            // Pass 3: explicit letter A/B/C/D
            if (!matched && /^[a-d]\.?$/.test(normAns)) {
                const letIdx = normAns.charCodeAt(0) - 97;
                if (choices[letIdx]) matched = choices[letIdx];
            }
            if (matched) {
                if (matched.tagName === 'INPUT') matched.checked = true;
                matched.click();
                IOE.toast(`🎯 Đã chọn: ${(matched.innerText || matched.textContent || matched.value || rawAns).trim()}`, 1000);
                return true;
            }
        }
        return false;
    }

    function clickNextButton() {
        const nextBtns = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]')).filter(btn => {
            if (btn.closest('#yanzioe-root') || btn.closest('#yanzioe-revealer-hud') || btn.closest('#yanzioe-license-modal')) return false;
            if (btn.disabled) return false;
            const style = win.getComputedStyle ? win.getComputedStyle(btn) : null;
            if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
            const t = (btn.innerText || btn.value || '').toLowerCase().trim();
            return /^(tiếp tục|câu tiếp|câu sau|qua câu|nộp bài|xác nhận|next|next question|submit|continue)/.test(t);
        });
        if (nextBtns.length > 0) {
            nextBtns[0].click();
            IOE.toast('⏩ Đã chuyển câu tiếp theo', 900);
            return true;
        }
        return false;
    }

    nativeSetInterval(() => { stepOnce(false); }, 1800);

    IOE.auto = {
        stepOnce,
        fillAnswer,
        clickNextButton,
        extractGenericDomQuestion,
        getFreezeTicks: () => frozenTickCount
    };
})(typeof window !== 'undefined' ? window : globalThis);
