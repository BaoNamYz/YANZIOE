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
