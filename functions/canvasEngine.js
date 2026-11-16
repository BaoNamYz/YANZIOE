(function (global) {
    'use strict';
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const IOE = win.IOE || global.IOE;
    if (!IOE) return;

    /* ================= 1. COCOS2D-JS / COCOS CREATOR ENGINE ================= */
    // IOE games like "Lâu đài trên mây", "Thủ môn bắt bóng", v.v. sử dụng Cocos2d-JS
    function getCocosScene() {
        try {
            const cc = win.cc;
            if (cc && cc.director && typeof cc.director.getScene === 'function') {
                return cc.director.getScene();
            }
        } catch (e) {}
        return null;
    }

    // Đệ quy quét toàn bộ text trong cây đối tượng Cocos2d
    function extractCocosTexts(node, maxDepth = 10, curDepth = 0) {
        if (!node || curDepth > maxDepth) return [];
        const results = [];
        try {
            // 1. Kiểm tra Label Component
            let labelComp = null;
            if (typeof node.getComponent === 'function') {
                const cc = win.cc;
                if (cc && cc.Label) labelComp = node.getComponent(cc.Label);
                if (!labelComp && cc && cc.RichText) labelComp = node.getComponent(cc.RichText);
                if (!labelComp && cc && cc.EditBox) labelComp = node.getComponent(cc.EditBox);
            }

            const strVal = labelComp?.string || node._string || node.string;
            if (strVal && typeof strVal === 'string') {
                const clean = strVal.trim();
                if (clean.length > 0) {
                    results.push({ node, text: clean, comp: labelComp });
                }
            }

            // 2. Quét các node con
            const children = (typeof node.getChildren === 'function' ? node.getChildren() : node.children) || [];
            for (const child of children) {
                results.push(...extractCocosTexts(child, maxDepth, curDepth + 1));
            }
        } catch (e) {}
        return results;
    }

    // Tìm các nút bấm có thể click được trong Cocos2d
    function findCocosClickables(node, maxDepth = 10, curDepth = 0) {
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

    // Kích hoạt click vào một Node trong Cocos2d
    function clickCocosNode(node) {
        if (!node) return false;
        try {
            const cc = win.cc;
            // Cách 1: Kích hoạt Button component
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

            // Cách 2: Bắn Event TOUCH_END trên Node
            if (typeof node.emit === 'function') {
                node.emit('touchend');
                node.emit('click');
                return true;
            }

            // Cách 3: Dispatch native touch / mouse qua canvas
            const canvas = document.getElementById('GameCanvas') || document.querySelector('canvas.gameCanvas');
            if (canvas && typeof node.convertToWorldSpaceAR === 'function') {
                const worldPos = node.convertToWorldSpaceAR(cc.v2(0, 0));
                const rect = canvas.getBoundingClientRect();
                const clientX = rect.left + worldPos.x;
                const clientY = rect.bottom - worldPos.y; // Cocos trục Y từ dưới lên
                dispatchCanvasClick(canvas, clientX, clientY);
                return true;
            }
        } catch (err) {
            console.warn('[YANZIOE Cocos] clickCocosNode error:', err);
        }
        return false;
    }

    /* ================= 2. CREATEJS / EASELJS CANVAS ENGINE ================= */
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

    /* ================= 3. DISPATCH CANVAS CLICK / KEYBOARD ================= */
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
        // 1. Kiểm tra Cocos2d-JS Engine
        const cocosScene = getCocosScene();
        if (cocosScene) {
            const cocosTexts = extractCocosTexts(cocosScene);
            if (cocosTexts.length > 0) {
                const rawStrings = cocosTexts.map(t => t.text);
                console.log('[YANZIOE Cocos] Scanned texts:', rawStrings);
                const questionText = rawStrings.join(' ');
                IOE.toast(`🎮 Bắt được Minigame Cocos2d: ${rawStrings[0]}`, 1500);

                const meta = await IOE.question?.solveQuestion(null, questionText, rawStrings);
                if (meta?.answer) {
                    const clickables = findCocosClickables(cocosScene);
                    for (const c of clickables) {
                        if (c.text.toLowerCase().includes(String(meta.answer).toLowerCase())) {
                            clickCocosNode(c.node);
                            IOE.toast(`⚡ Đã tự click đáp án: ${meta.answer}`, 1500);
                            return true;
                        }
                    }
                    typeCanvasString(String(meta.answer));
                    return true;
                }
            }
        }

        // 2. Kiểm tra CreateJS / EaselJS
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
