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
                    if (IOE.features?.freezeTimer && (IOE.state?.licensed || IOE.license?.isLicensed?.())) {
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
        const base = Number(IOE.featureConfigs?.autoDelay || 1400);
        return Math.round(base * (0.78 + Math.random() * 0.44));
    }

    let isProcessing = false;

    async function stepOnce(forceRun = false) {
        if (isProcessing) return false;
        if (!forceRun && !IOE.features?.autoAnswer) return false;
        if (!(IOE.state?.licensed || IOE.license?.isLicensed?.())) return false;
        isProcessing = true;

        try {
            // 1. Canvas / Cocos2d / CreateJS minigame
            if (IOE.features?.canvasMode !== false && IOE.canvas?.solveCanvasGame) {
                const canvasSolved = await IOE.canvas.solveCanvasGame();
                if (canvasSolved) {
                    await IOE.delay(computeStepDelay());
                    return true;
                }
            }

            // 2. Web DOM Question Extraction
            const qSelectors = '.question-content, .exam-content, .title-question, .content-question, #question-content, .ques-content, .quiz-question';
            const qEls = Array.from(document.querySelectorAll(qSelectors))
                .filter(el => el.offsetParent !== null && !el.closest('#yanzioe-root') && !el.closest('#yanzioe-license-modal'));
            const qEl = qEls[0] || document.querySelector('.question-content, .exam-content, #question-content');
            const qText = qEl ? (qEl.innerText || qEl.textContent || '').trim() : '';

            if (qText) {
                IOE.state.lastEngine = 'Web DOM';
                const scopeRoot = qEl.closest('.question-container, .question-box, .quiz-item, .exam-item') || document;
                const choiceEls = Array.from(scopeRoot.querySelectorAll('.answer-item, .choice-item, .btn-answer, .item-answer, label'))
                    .filter(el => !el.closest('#yanzioe-root') && !el.closest('#yanzioe-license-modal'));
                const options = choiceEls.map(c => (c.innerText || c.textContent || '').trim()).filter(Boolean);

                const chips = Array.from(scopeRoot.querySelectorAll('.word-item, .drag-item, .card-word, .item-reorder'));
                const isDomReorder = chips.length >= 3 && !options.length;
                const taskOpts = isDomReorder ? chips.map(c => c.innerText.trim()).filter(Boolean) : options;
                const qId = qEl.dataset?.id || qEl.id || qText.slice(0, 48);

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
            }
        } catch (e) {
            console.error('[IOE AutoAnswer Error]', e);
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
            const words = rawAns.split(/\s+/).map(w => w.toLowerCase().replace(/[^a-z0-9']/g, ''));
            let hits = 0;
            words.forEach(targetWord => {
                if (!targetWord) return;
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
            if (hits > 0) {
                IOE.toast('🧩 Đã sắp xếp câu!', 1200);
                return true;
            }
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
        const choices = Array.from(root.querySelectorAll('.answer-item, .choice-item, .btn-answer, .item-answer, input[type="radio"]'))
            .filter(el => !el.closest('#yanzioe-root') && !el.closest('#yanzioe-license-modal'));
        if (choices.length > 0) {
            // Pass 1: exact text match
            let matched = choices.find(c => {
                const ct = stripPrefix(c.innerText || c.value || '').toLowerCase();
                return ct && ct === cleanAns;
            });
            // Pass 2: word-boundary match (>= 2 chars)
            if (!matched && cleanAns.length >= 2) {
                const esc = cleanAns.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const rx = new RegExp(`(^|\\s)${esc}(\\s|$)`, 'i');
                matched = choices.find(c => rx.test(stripPrefix(c.innerText || c.value || '')));
            }
            // Pass 3: explicit letter A/B/C/D
            if (!matched && /^[a-d]\.?$/.test(normAns)) {
                const letIdx = normAns.charCodeAt(0) - 97;
                if (choices[letIdx]) matched = choices[letIdx];
            }
            if (matched) {
                if (matched.tagName === 'INPUT') matched.checked = true;
                matched.click();
                IOE.toast(`🎯 Đã chọn: ${(matched.innerText || matched.value || rawAns).trim()}`, 1000);
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
        getFreezeTicks: () => frozenTickCount
    };
})(typeof window !== 'undefined' ? window : globalThis);
