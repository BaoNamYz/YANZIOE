(function (global) {
    'use strict';
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const IOE = win.IOE || global.IOE;
    if (!IOE) return;

    /* ================= CREATEJS / ADOBE ANIMATE CANVAS ENGINE ================= */
    function getStageAndRoot() {
        const stage = win.stage || win.exportRoot?.stage || null;
        const root = win.exportRoot || null;
        return { stage, root };
    }

    // Đệ quy quét toàn bộ text hiển thị trong Canvas
    function extractCanvasTexts(container, maxDepth = 6, curDepth = 0) {
        if (!container || curDepth > maxDepth) return [];
        const texts = [];
        const children = container.children || [];
        for (const child of children) {
            if (child.text !== undefined && typeof child.text === 'string') {
                const t = child.text.trim();
                if (t && t.length > 1) texts.push({ obj: child, text: t });
            }
            if (child.children && child.children.length > 0) {
                texts.push(...extractCanvasTexts(child, maxDepth, curDepth + 1));
            }
        }
        return texts;
    }

    // Đệ quy tìm các nút bấm (MovieClip có event click hoặc mouseEnabled)
    function findCanvasClickables(container, maxDepth = 6, curDepth = 0) {
        if (!container || curDepth > maxDepth) return [];
        const buttons = [];
        const children = container.children || [];
        for (const child of children) {
            const hasListeners = child._listeners && (child._listeners.click || child._listeners.mousedown);
            const isClickable = child.mouseEnabled || child.cursor === 'pointer' || hasListeners || /btn|choice|ans|opt/i.test(child.name || '');
            if (isClickable) {
                const innerTexts = extractCanvasTexts(child, 2).map(t => t.text).join(' ');
                buttons.push({ obj: child, name: child.name || '', label: innerTexts });
            }
            if (child.children && child.children.length > 0) {
                buttons.push(...findCanvasClickables(child, maxDepth, curDepth + 1));
            }
        }
        return buttons;
    }

    // Kích hoạt click trên Canvas MovieClip / Button
    function clickCanvasObject(obj) {
        if (!obj) return false;
        try {
            if (win.createjs?.MouseEvent) {
                const evtDown = new win.createjs.MouseEvent('mousedown', true, true, obj.x || 0, obj.y || 0, null, 0, true, 0);
                const evtClick = new win.createjs.MouseEvent('click', true, true, obj.x || 0, obj.y || 0, null, 0, true, 0);
                const evtUp = new win.createjs.MouseEvent('pressup', true, true, obj.x || 0, obj.y || 0, null, 0, true, 0);
                obj.dispatchEvent(evtDown);
                obj.dispatchEvent(evtClick);
                obj.dispatchEvent(evtUp);
            } else {
                obj.dispatchEvent('mousedown');
                obj.dispatchEvent('click');
                obj.dispatchEvent('pressup');
            }
            return true;
        } catch (e) {
            try {
                if (typeof obj.onClick === 'function') obj.onClick();
            } catch (err) {}
            return false;
        }
    }

    // Tự gõ đáp án vào Canvas Game bằng Keyboard Event
    function typeIntoCanvas(ansStr) {
        if (!ansStr) return;
        const target = win.document.querySelector('canvas') || win;
        for (let i = 0; i < ansStr.length; i++) {
            const ch = ansStr[i];
            const code = `Key${ch.toUpperCase()}`;
            const keyEventProps = {
                key: ch,
                code: code,
                charCode: ch.charCodeAt(0),
                keyCode: ch.charCodeAt(0),
                which: ch.charCodeAt(0),
                bubbles: true,
                cancelable: true
            };
            target.dispatchEvent(new KeyboardEvent('keydown', keyEventProps));
            target.dispatchEvent(new KeyboardEvent('keypress', keyEventProps));
            target.dispatchEvent(new KeyboardEvent('keyup', keyEventProps));
        }
        IOE.toast(`✍️ Đã gõ Canvas: ${ansStr}`, 1200);
    }

    // Quét câu hỏi và tự động giải trên Canvas
    async function solveCanvasGame() {
        const { root, stage } = getStageAndRoot();
        if (!root && !stage) return false;

        const texts = extractCanvasTexts(root || stage);
        if (!texts.length) return false;

        // Lọc câu hỏi dài nhất
        const questionObj = texts.reduce((max, cur) => cur.text.length > max.text.length ? cur : max, texts[0]);
        const qText = questionObj.text;
        if (qText.length < 5) return false;

        const buttons = findCanvasClickables(root || stage);
        const options = buttons.map(b => b.label || b.name).filter(Boolean);

        const qId = `canvas_${qText.slice(0, 30)}`;
        let meta = IOE.state.solvedMeta.get(qId);
        if (!meta) {
            meta = await IOE.question.solveQuestion(qId, qText, options);
        }

        if (meta?.answer) {
            const ans = meta.answer.trim().toLowerCase();
            // Nếu có các nút trắc nghiệm trong Canvas
            if (buttons.length > 0) {
                const matchedBtn = buttons.find(b => {
                    const l = (b.label || '').toLowerCase();
                    const n = (b.name || '').toLowerCase();
                    return l.includes(ans) || ans.includes(l) || n.includes(ans) || (ans === 'a' && /a\b|opt0|btn1/i.test(n));
                });
                if (matchedBtn) {
                    clickCanvasObject(matchedBtn.obj);
                    IOE.toast(`🎯 Canvas Click: ${matchedBtn.label || matchedBtn.name}`, 1200);
                    return true;
                }
            }
            // Nếu là dạng điền từ
            typeIntoCanvas(meta.answer);
            return true;
        }
        return false;
    }

    IOE.canvas = {
        getStageAndRoot,
        extractCanvasTexts,
        findCanvasClickables,
        clickCanvasObject,
        typeIntoCanvas,
        solveCanvasGame
    };
})(typeof window !== 'undefined' ? window : globalThis);
