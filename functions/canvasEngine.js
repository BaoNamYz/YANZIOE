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

    function extractCocosTexts(node, maxDepth = 12, curDepth = 0) {
        if (!node || curDepth > maxDepth) return [];
        const results = [];
        try {
            let labelComp = null;
            if (typeof node.getComponent === 'function') {
                const cc = win.cc;
                if (cc?.Label) labelComp = node.getComponent(cc.Label);
                if (!labelComp && cc?.RichText) labelComp = node.getComponent(cc.RichText);
                if (!labelComp && cc?.EditBox) labelComp = node.getComponent(cc.EditBox);
            }

            const strVal = labelComp?.string || node._string || node.string;
            if (strVal && typeof strVal === 'string') {
                const clean = strVal.trim();
                if (clean.length > 0) {
                    results.push({ node, text: clean, comp: labelComp });
                }
            }

            const children = (typeof node.getChildren === 'function' ? node.getChildren() : node.children) || [];
            for (const child of children) {
                results.push(...extractCocosTexts(child, maxDepth, curDepth + 1));
            }
        } catch (e) {}
        return results;
    }

    function findCocosClickables(node, maxDepth = 12, curDepth = 0) {
        if (!node || curDepth > maxDepth) return [];
        const results = [];
        try {
            const cc = win.cc;
            let hasBtn = false;
            if (typeof node.getComponent === 'function' && cc?.Button) {
                hasBtn = !!node.getComponent(cc.Button);
            }
            if (hasBtn || node._hasClickEventListener || node._touchListener) {
                const txt = extractCocosTexts(node).map(t => t.text).join(' ');
                results.push({ node, text: txt });
            }

            const children = (typeof node.getChildren === 'function' ? node.getChildren() : node.children) || [];
            for (const child of children) {
                results.push(...findCocosClickables(child, maxDepth, curDepth + 1));
            }
        } catch (e) {}
        return results;
    }

    function clickCocosNode(node) {
        if (!node) return false;
        try {
            const cc = win.cc;
            // 1. Button component
            if (typeof node.getComponent === 'function' && cc?.Button) {
                const btn = node.getComponent(cc.Button);
                if (btn) {
                    if (Array.isArray(btn.clickEvents)) {
                        for (const ev of btn.clickEvents) {
                            if (typeof ev.emit === 'function') ev.emit([ev.customEventData]);
                        }
                    }
                    if (typeof btn._onTouchEnded === 'function') {
                        btn._onTouchEnded({});
                        return true;
                    }
                }
            }

            // 2. Event emitter
            if (typeof node.emit === 'function') {
                node.emit('touchend');
                node.emit('click');
                return true;
            }

            // 3. Canvas coordinates
            const canvas = document.getElementById('GameCanvas') || document.querySelector('canvas.gameCanvas');
            if (canvas && typeof node.convertToWorldSpaceAR === 'function') {
                const worldPos = node.convertToWorldSpaceAR(cc.v2(0, 0));
                const rect = canvas.getBoundingClientRect();
                const clientX = rect.left + worldPos.x;
                const clientY = rect.bottom - worldPos.y;
                dispatchCanvasClick(canvas, clientX, clientY);
                return true;
            }
        } catch (err) {
            console.warn('[YANZIOE Cocos] click error:', err);
        }
        return false;
    }

    /* ================= 2. CREATEJS CANVAS ENGINE ================= */
    function getStageAndRoot() {
        const stage = win.stage || win.exportRoot?.stage || null;
        const root = win.exportRoot || null;
        return { stage, root };
    }

    function extractCreateJSTexts(container, maxDepth = 6, curDepth = 0) {
        if (!container || curDepth > maxDepth) return [];
        const texts = [];
        const children = container.children || [];
        for (const child of children) {
            if (child.text !== undefined && typeof child.text === 'string') {
                const t = child.text.trim();
                if (t && t.length > 1) texts.push({ obj: child, text: t });
            }
            if (child.children && child.children.length > 0) {
                texts.push(...extractCreateJSTexts(child, maxDepth, curDepth + 1));
            }
        }
        return texts;
    }

    function findCreateJSClickables(container, maxDepth = 6, curDepth = 0) {
        if (!container || curDepth > maxDepth) return [];
        const clickables = [];
        const children = container.children || [];
        for (const child of children) {
            if (child.hasEventListener?.('click') || child.hasEventListener?.('mousedown') || child.cursor === 'pointer' || child.buttonMode) {
                const texts = extractCreateJSTexts(child).map(t => t.text).join(' ');
                clickables.push({ obj: child, label: texts });
            }
            if (child.children && child.children.length > 0) {
                clickables.push(...findCreateJSClickables(child, maxDepth, curDepth + 1));
            }
        }
        return clickables;
    }

    function clickCreateJS(obj, stage) {
        if (!obj) return false;
        try {
            if (win.createjs?.MouseEvent) {
                const ev = new win.createjs.MouseEvent('click', true, true, 0, 0, null, 0, true, 0);
                obj.dispatchEvent(ev);
                if (stage && typeof stage.update === 'function') stage.update();
                return true;
            }
        } catch (e) {}
        return false;
    }

    /* ================= 3. DISPATCH CANVAS CLICK & KEYBOARD ================= */
    function dispatchCanvasClick(canvas, x, y) {
        if (!canvas) return;
        const opts = { bubbles: true, cancelable: true, view: win, clientX: x, clientY: y };
        canvas.dispatchEvent(new MouseEvent('mousedown', opts));
        canvas.dispatchEvent(new MouseEvent('mouseup', opts));
        canvas.dispatchEvent(new MouseEvent('click', opts));
    }

    function typeCanvasString(str) {
        const canvas = document.getElementById('GameCanvas') || document.querySelector('canvas');
        const target = canvas || win;
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            const code = char.toUpperCase().charCodeAt(0);
            const keyOpts = { key: char, code: `Key${char.toUpperCase()}`, keyCode: code, which: code, bubbles: true };
            target.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
            target.dispatchEvent(new KeyboardEvent('keypress', keyOpts));
            target.dispatchEvent(new KeyboardEvent('keyup', keyOpts));
        }
    }

    /* ================= 4. UNIFIED CANVAS SOLVER ================= */
    async function solveCanvasGame() {
        // 1. Cocos2d-JS Engine
        const cocosScene = getCocosScene();
        if (cocosScene) {
            const clickables = findCocosClickables(cocosScene);

            // Bắt đầu nhanh nếu gặp nút START / OK / BẮT ĐẦU
            for (const c of clickables) {
                const t = c.text.toLowerCase();
                if (t === 'ok' || t === 'start' || t.includes('bắt đầu') || t.includes('bắt đẩu')) {
                    clickCocosNode(c.node);
                    IOE.toast('🚀 Tự động click bắt đầu bài thi Cocos2d!', 1500);
                    await IOE.delay?.(1000);
                    break;
                }
            }

            const cocosTexts = extractCocosTexts(cocosScene);
            if (cocosTexts.length > 0) {
                const rawStrings = cocosTexts.map(t => t.text);
                const questionText = rawStrings.join(' ');
                IOE.toast(`🎮 Quét được ${cocosTexts.length} phần tử Cocos2d`, 1200);

                const meta = await IOE.question?.solveQuestion(null, questionText, rawStrings);
                if (meta?.answer) {
                    const ansLower = String(meta.answer).trim().toLowerCase();
                    const updatedClickables = findCocosClickables(cocosScene);
                    for (const c of updatedClickables) {
                        if (c.text.toLowerCase().includes(ansLower)) {
                            clickCocosNode(c.node);
                            IOE.toast(`⚡ Đã tự click đáp án Cocos2d: ${meta.answer}`, 1500);
                            return true;
                        }
                    }
                    typeCanvasString(String(meta.answer));
                    return true;
                }
            }
        }

        // 2. CreateJS / EaselJS
        const { stage, root } = getStageAndRoot();
        if (root) {
            const texts = extractCreateJSTexts(root);
            if (texts.length > 0) {
                const fullText = texts.map(t => t.text).join(' ');
                const meta = await IOE.question?.solveQuestion(null, fullText, texts.map(t => t.text));
                if (meta?.answer) {
                    const clickables = findCreateJSClickables(root);
                    for (const c of clickables) {
                        if (c.label.toLowerCase().includes(String(meta.answer).toLowerCase())) {
                            clickCreateJS(c.obj, stage);
                            return true;
                        }
                    }
                    typeCanvasString(String(meta.answer));
                    return true;
                }
            }
        }

        return false;
    }

    IOE.canvas = {
        solveCanvasGame,
        getCocosScene,
        extractCocosTexts,
        findCocosClickables,
        clickCocosNode,
        extractCreateJSTexts,
        findCreateJSClickables,
        clickCreateJS,
        typeCanvasString
    };
})(typeof window !== 'undefined' ? window : globalThis);
