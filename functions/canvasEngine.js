(function (global) {
    'use strict';
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const IOE = win.IOE || global.IOE;
    if (!IOE) return;

    function isLicensed() {
        return !!(IOE.state?.licensed || IOE.license?.isLicensed?.());
    }

    function stripOptPrefix(s) {
        return String(s || '').replace(/^[A-Da-d][.:)\]\s_-]+/, '').trim();
    }

    function getCanvasEl() {
        return document.getElementById('gameCanvas') ||
            document.getElementById('GameCanvas') ||
            document.querySelector('canvas.gameCanvas') ||
            document.querySelector('canvas');
    }

    /* ================= 1. COCOS2D-JS / COCOS CREATOR ENGINE ================= */
    function getCocosScene() {
        try {
            const cc = win.cc;
            if (cc && cc.director) {
                if (typeof cc.director.getRunningScene === 'function') {
                    const s = cc.director.getRunningScene();
                    if (s) { IOE.state.lastEngine = 'Cocos2d-html5'; return s; }
                }
                if (typeof cc.director.getScene === 'function') {
                    const s = cc.director.getScene();
                    if (s) { IOE.state.lastEngine = 'Cocos Creator'; return s; }
                }
            }
        } catch (e) {}
        return null;
    }

    function getLogicalCanvasSize() {
        try {
            const cc = win.cc;
            const vis = cc?.winSize || (typeof cc?.director?.getWinSize === 'function' ? cc.director.getWinSize() : null);
            if (vis && vis.width > 100 && vis.height > 100) return { width: vis.width, height: vis.height };
            const v2 = cc?.view?.getVisibleSize?.();
            if (v2 && v2.width > 100 && v2.height > 100) return { width: v2.width, height: v2.height };
        } catch (e) {}
        return { width: 960, height: 640 };
    }

    function canTraverseNode(node) {
        if (!node) return false;
        try {
            if (node.active === false || node.activeInHierarchy === false) return false;
            if (node.visible === false) return false;
            if (typeof node.isVisible === 'function' && !node.isVisible()) return false;
            if (node.scaleX === 0 || node.scaleY === 0) return false;
        } catch (e) {}
        return true;
    }

    function isSelfOpaque(node) {
        if (!node) return false;
        try {
            if (typeof node.opacity === 'number' && node.opacity <= 8) return false;
            if (typeof node.getOpacity === 'function' && node.getOpacity() <= 8) return false;
            if (node._uiProps && typeof node._uiProps.localOpacity === 'number' && node._uiProps.localOpacity <= 0.03) return false;
        } catch (e) {}
        return true;
    }

    function isNodeVisible(node) {
        return canTraverseNode(node) && isSelfOpaque(node);
    }

    function getNodeText(node) {
        if (!node) return '';
        try {
            if (typeof node.getString === 'function') {
                const s = node.getString();
                if (s && typeof s === 'string') return s.trim();
            }
            if (typeof node.getTitleText === 'function') {
                const s = node.getTitleText();
                if (s && typeof s === 'string') return s.trim();
            }
            if (typeof node.getStringText === 'function') {
                const s = node.getStringText();
                if (s && typeof s === 'string') return s.trim();
            }
            const cc = win.cc;
            if (typeof node.getComponent === 'function' && cc) {
                let comp = null;
                if (cc.Label) comp = node.getComponent(cc.Label);
                if (!comp && cc.RichText) comp = node.getComponent(cc.RichText);
                if (!comp && cc.EditBox) comp = node.getComponent(cc.EditBox);
                if (!comp) comp = node.getComponent('cc.Label') || node.getComponent('cc.RichText');
                const s = comp?.string ?? comp?.text;
                if (s && typeof s === 'string') return s.replace(/<[^>]+>/g, '').trim();
            }
            if (Array.isArray(node._components)) {
                for (const comp of node._components) {
                    const s = comp?.string ?? comp?._string ?? comp?.text;
                    if (s && typeof s === 'string' && s.trim()) {
                        return s.replace(/<[^>]+>/g, '').trim();
                    }
                }
            }
            if (node._string && typeof node._string === 'string') return node._string.trim();
            if (node.string && typeof node.string === 'string') return node.string.trim();
        } catch (e) {}
        return '';
    }

    function getNodeWorldPos(node) {
        let pos = { x: node.x || 0, y: node.y || 0 };
        try {
            const cc = win.cc;
            const origin = cc?.p ? cc.p(0, 0) : (cc?.v2 ? cc.v2(0, 0) : { x: 0, y: 0 });
            if (typeof node.convertToWorldSpaceAR === 'function') {
                pos = node.convertToWorldSpaceAR(origin);
            } else if (typeof node.convertToWorldSpace === 'function') {
                pos = node.convertToWorldSpace(origin);
            }
        } catch (e) {}
        return pos;
    }

    function extractCocosTexts(node, maxDepth = 24, curDepth = 0) {
        if (!node || curDepth > maxDepth || !canTraverseNode(node)) return [];
        const results = [];
        try {
            if (isSelfOpaque(node)) {
                const clean = getNodeText(node);
                if (clean.length > 0) {
                    const worldPos = getNodeWorldPos(node);
                    results.push({ node, text: clean, y: node.y || 0, x: node.x || 0, worldX: worldPos.x, worldY: worldPos.y });
                }
            }
            const children = (typeof node.getChildren === 'function' ? node.getChildren() : node.children) || [];
            for (const child of children) {
                results.push(...extractCocosTexts(child, maxDepth, curDepth + 1));
            }
        } catch (e) {}
        return results;
    }

    function extractSceneSpriteClues(node, maxDepth = 16, curDepth = 0, out = []) {
        if (!node || curDepth > maxDepth || !canTraverseNode(node)) return out;
        try {
            if (isSelfOpaque(node)) {
                const cc = win.cc;
                let rawName = '';
                if (typeof node.getComponent === 'function' && cc?.Sprite) {
                    const sp = node.getComponent(cc.Sprite);
                    rawName = sp?.spriteFrame?._name || sp?._spriteFrame?.name || '';
                }
                if (!rawName && node._spriteFrame) {
                    rawName = node._spriteFrame._name || node._spriteFrame.name || '';
                }
                if (rawName && typeof rawName === 'string') {
                    const clean = rawName.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim();
                    const lower = clean.toLowerCase();
                    if (clean.length >= 3 && clean.length <= 32 && /[a-z]/i.test(clean) &&
                        !/^(bg|btn|button|panel|frame|border|icon|bar|box|popup|dialog|mask|cloud|star|coin|heart|sound|audio|close|next|back|ok|start|sprite|default|avatar|logo|arrow|line|dot|check|tick|cross|white|black)/i.test(lower) &&
                        !out.includes(clean)) {
                        out.push(clean);
                    }
                }
            }
            const ch = (typeof node.getChildren === 'function' ? node.getChildren() : node.children) || [];
            for (const c of ch) extractSceneSpriteClues(c, maxDepth, curDepth + 1, out);
        } catch (e) {}
        return out;
    }

    function hasEventListeners(node) {
        const pools = [node._bubblingListeners, node._capturingListeners, node._eventTarget?._bubblingListeners];
        for (const pool of pools) {
            if (pool && typeof pool === 'object' && Object.keys(pool).length > 0) return true;
        }
        return false;
    }

    function findCocosClickables(node, maxDepth = 24, curDepth = 0) {
        if (!node || curDepth > maxDepth || !canTraverseNode(node)) return [];
        const results = [];
        try {
            const cc = win.cc;
            let isClickable = false;
            let btnComp = null;

            if (typeof node.getComponent === 'function') {
                btnComp = (cc?.Button && node.getComponent(cc.Button)) || node.getComponent('cc.Button') || null;
                if (btnComp && btnComp.interactable !== false && btnComp.enabled !== false) isClickable = true;
            }
            if (cc?.MenuItem && node instanceof cc.MenuItem && (typeof node.isEnabled !== 'function' || node.isEnabled())) isClickable = true;
            if (cc?.ui?.Button && node instanceof cc.ui.Button && (typeof node.isEnabled !== 'function' || node.isEnabled())) isClickable = true;
            if (cc?.ui?.Widget && node instanceof cc.ui.Widget && typeof node.isTouchEnabled === 'function' && node.isTouchEnabled()) isClickable = true;
            if (node._hasClickEventListener || node._touchListener || node._touchEnabled || hasEventListeners(node)) isClickable = true;

            const name = (node.name || '').toLowerCase();
            if (name.includes('btn') || name.includes('opt') || name.includes('choice') || name.includes('item') || name.includes('ans') || name.includes('block') || name.includes('word')) {
                isClickable = true;
            }

            if (isClickable) {
                let txt = isSelfOpaque(node) ? getNodeText(node) : '';
                if (!txt) {
                    txt = extractCocosTexts(node, 5).map(t => t.text).join(' ');
                }
                if (isSelfOpaque(node) || txt.trim() || btnComp) {
                    const worldPos = getNodeWorldPos(node);
                    results.push({ node, text: txt.trim(), btnComp, y: node.y || 0, x: node.x || 0, worldX: worldPos.x, worldY: worldPos.y, name: node.name || '' });
                }
            }

            const children = (typeof node.getChildren === 'function' ? node.getChildren() : node.children) || [];
            for (const child of children) {
                results.push(...findCocosClickables(child, maxDepth, curDepth + 1));
            }
        } catch (e) {}
        return results;
    }

    async function clickCocosNode(node) {
        if (!node || !canTraverseNode(node)) return false;
        try {
            const cc = win.cc;
            const worldPos = getNodeWorldPos(node);

            const mockTouch = {
                getLocation: () => ({ x: worldPos.x, y: worldPos.y }),
                getPreviousLocation: () => ({ x: worldPos.x, y: worldPos.y }),
                getDelta: () => ({ x: 0, y: 0 }),
                getID: () => 0
            };

            const mockEvent = {
                type: 'touchend',
                target: node,
                currentTarget: node,
                touch: mockTouch,
                bubbles: true,
                stopPropagation: () => {},
                isStopped: () => false
            };

            if (typeof node.activate === 'function') {
                try { node.activate(); } catch (e) {}
            }

            if (typeof node.getComponent === 'function' && cc?.Button) {
                const btn = node.getComponent(cc.Button);
                if (btn && btn.interactable !== false) {
                    btn._pressed = true;
                    if (typeof btn._onTouchBegan === 'function') { try { btn._onTouchBegan(mockEvent); } catch (e) {} }
                    if (Array.isArray(btn.clickEvents) && btn.clickEvents.length > 0) {
                        for (const ev of btn.clickEvents) {
                            if (typeof ev.emit === 'function') ev.emit([ev.customEventData]);
                        }
                    }
                    if (typeof btn._onTouchEnded === 'function') { try { btn._onTouchEnded(mockEvent); } catch (e) {} }
                    btn._pressed = false;
                }
            }

            if (cc?.eventManager && typeof cc.eventManager.dispatchEvent === 'function' && cc.EventTouch) {
                try {
                    const touchEvt = new cc.EventTouch([mockTouch]);
                    touchEvt.setEventCode(cc.EventTouch.EventCode.BEGAN);
                    cc.eventManager.dispatchEvent(touchEvt);
                    touchEvt.setEventCode(cc.EventTouch.EventCode.ENDED);
                    cc.eventManager.dispatchEvent(touchEvt);
                } catch (e) {}
            }

            if (typeof node.emit === 'function') {
                node.emit('touchstart', { ...mockEvent, type: 'touchstart' });
                node.emit('touchend', mockEvent);
                node.emit('click', mockEvent);
            }

            const canvas = getCanvasEl();
            if (canvas) {
                const rect = canvas.getBoundingClientRect();
                const { width: canvasW, height: canvasH } = getLogicalCanvasSize();
                const scaleX = rect.width / (canvasW || rect.width);
                const scaleY = rect.height / (canvasH || rect.height);
                const clientX = rect.left + (worldPos.x * scaleX);
                const clientY = rect.bottom - (worldPos.y * scaleY);
                dispatchCanvasClick(canvas, clientX, clientY);
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    function matchCocosButton(buttons, ansStr) {
        if (!Array.isArray(buttons) || !buttons.length || !ansStr) return null;
        const cleanAns = stripOptPrefix(ansStr).toLowerCase();
        const ansUpper = String(ansStr).trim().toUpperCase();

        // 1. Exact clean text equality
        let match = buttons.find(b => stripOptPrefix(b.text).toLowerCase() === cleanAns);
        if (match) return match;

        // 2. Word-boundary exact match (only length >= 2 to prevent single-char "a" matching "apple")
        if (cleanAns.length >= 2) {
            const esc = cleanAns.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const rx = new RegExp(`(^|\\s)${esc}(\\s|$)`, 'i');
            match = buttons.find(b => rx.test(stripOptPrefix(b.text)));
            if (match) return match;
        }

        // 3. Explicit single option letter A/B/C/D -> prefix match or sorted index
        const mLet = /^([A-D])\.?$/.exec(ansUpper);
        if (mLet) {
            const letCh = mLet[1];
            match = buttons.find(b => {
                const up = b.text.trim().toUpperCase();
                return up === letCh || up.startsWith(letCh + '.') || up.startsWith(letCh + ')') || up.startsWith(letCh + ':') || up.startsWith(letCh + ' ');
            });
            if (match) return match;
            const idx = letCh.charCodeAt(0) - 65;
            if (buttons[idx]) return buttons[idx];
        }

        // 4. Safe substring match for >= 3 chars
        if (cleanAns.length >= 3) {
            match = buttons.find(b => {
                const bt = stripOptPrefix(b.text).toLowerCase();
                return bt.length >= 3 && (bt.includes(cleanAns) || cleanAns.includes(bt));
            });
            if (match) return match;
        }
        return null;
    }

    /* ================= 2. CLOZE PASSAGE SOLVER (COCOS2D) ================= */
    async function solveCocosClozePassage(scene) {
        try { IOE.question?.bypassIOESystemAnswers?.(); } catch (e) {}
        const allTexts = extractCocosTexts(scene);
        if (allTexts.length === 0) return false;

        const { width: W, height: H } = getLogicalCanvasSize();

        let passageObj = allTexts.find(t => t.text.length > 50 && (/\(\s*\d+\s*\)|_{3,}|\.{3,}/i.test(t.text)));
        if (!passageObj) passageObj = allTexts.find(t => t.text.length > 85 && t.worldY > H * 0.42);
        if (!passageObj || !passageObj.text) return false;
        const passageText = passageObj.text;

        function extractRowsFromScene() {
            const curTexts = extractCocosTexts(scene);
            const clickables = findCocosClickables(scene);
            const candBtns = [];
            for (const c of clickables) {
                const nl = (c.name || '').toLowerCase();
                if (/(submit|refresh|close|sound|time|score|back|exit|mute|help)/.test(nl)) continue;
                if (c.worldX > W * 0.78 && c.worldY > H * 0.72) continue;
                const t = (c.text || '').trim();
                if (!t || /^(ok|start|tiếp tục|nộp bài|submit)$/i.test(t)) continue;
                if (/^[A-Da-d][.:)\s]/i.test(t) || (t.length >= 1 && t.length <= 42 && !/^\d+$/.test(t))) {
                    if (!candBtns.some(b => Math.abs(b.worldX - c.worldX) < 15 && Math.abs(b.worldY - c.worldY) < 15)) {
                        candBtns.push(c);
                    }
                }
            }
            if (candBtns.length < 4) return [];

            candBtns.sort((a, b) => b.worldY - a.worldY);
            const rows = [];
            for (const btn of candBtns) {
                let r = rows.find(row => Math.abs(row.y - btn.worldY) < 22);
                if (!r) { r = { y: btn.worldY, buttons: [] }; rows.push(r); }
                r.buttons.push(btn);
            }
            rows.forEach(r => r.buttons.sort((a, b) => a.worldX - b.worldX));

            const numLabels = [];
            for (const tObj of curTexts) {
                const m = /^([0-9]{1,2})[.:)]?$/.exec(tObj.text.trim());
                if (m && tObj.worldX < W * 0.20) {
                    numLabels.push({ ...tObj, rowNumber: parseInt(m[1], 10) });
                }
            }
            rows.forEach((r, idx) => {
                const lbl = numLabels.find(l => Math.abs(l.worldY - r.y) < 30);
                r.rowNumber = (lbl && lbl.rowNumber > 0) ? lbl.rowNumber : (idx + 1);
            });
            return rows.filter(r => r.rowNumber > 0 && r.buttons.length >= 2).sort((a, b) => a.rowNumber - b.rowNumber);
        }

        const initialRowsRaw = extractRowsFromScene();
        if (initialRowsRaw.length === 0 && !/\(\s*\d+\s*\)/.test(passageText)) return false;

        const initialRows = initialRowsRaw.map(r => ({
            index: r.rowNumber,
            rowNumber: r.rowNumber,
            options: r.buttons.map(b => stripOptPrefix(b.text)).filter(Boolean)
        }));

        let fullAnswers = await IOE.question?.solveClozePassage(passageText, initialRows);
        if (!fullAnswers || Object.keys(fullAnswers).length === 0) return false;

        const blankMatches = [...passageText.matchAll(/\(([0-9]{1,2})\)/g)].map(m => parseInt(m[1], 10));
        let detectedCount = blankMatches.length > 0 ? Math.max(...blankMatches) : Object.keys(fullAnswers).length;
        if (detectedCount > 15 || detectedCount < 1) detectedCount = Math.min(Object.keys(fullAnswers).length, 10);
        const totalBlanks = Math.min(Math.max(detectedCount, 2), 12);

        let scrollViewComp = null;
        try {
            (function findSV(n) {
                if (!n || scrollViewComp) return;
                const cc = win.cc;
                if (typeof n.getComponent === 'function' && cc?.ScrollView) {
                    const sv = n.getComponent(cc.ScrollView);
                    if (sv) { scrollViewComp = sv; return; }
                }
                if (win.ccui?.ScrollView && n instanceof win.ccui.ScrollView) { scrollViewComp = n; return; }
                const ch = (typeof n.getChildren === 'function' ? n.getChildren() : n.children) || [];
                for (const c of ch) findSV(c);
            })(scene);
        } catch (e) {}

        const clickedRowNumbers = new Set();
        const recordedAnswers = {};
        let filledCount = 0;

        async function solveVisibleRows() {
            let stepFilled = 0;
            const validRows = extractRowsFromScene();
            for (const row of validRows) {
                const rNum = row.rowNumber;
                if (clickedRowNumbers.has(rNum)) continue;
                const targetRaw = fullAnswers[rNum] || fullAnswers[String(rNum)] || '';
                const targetStr = String(targetRaw).trim();
                if (!targetStr) continue;

                const targetButton = matchCocosButton(row.buttons, targetStr);
                if (targetButton) {
                    await clickCocosNode(targetButton.node);
                    clickedRowNumbers.add(rNum);
                    filledCount++;
                    stepFilled++;
                    const chosenIdx = row.buttons.indexOf(targetButton);
                    const chosenLetter = chosenIdx >= 0 ? String.fromCharCode(65 + chosenIdx) : '';
                    const cleanBtnTxt = stripOptPrefix(targetButton.text);
                    recordedAnswers[rNum] = chosenLetter ? `${chosenLetter} (${cleanBtnTxt || targetStr})` : (cleanBtnTxt || targetStr);
                    IOE.updateQuizSummary?.(totalBlanks, filledCount);
                    await IOE.delay?.(220);
                }
            }
            return stepFilled;
        }

        if (scrollViewComp) {
            try {
                if (typeof scrollViewComp.scrollToTop === 'function') scrollViewComp.scrollToTop(0.1);
                else if (typeof scrollViewComp.scrollToPercentVertical === 'function') scrollViewComp.scrollToPercentVertical(0, 0.1);
            } catch (e) {}
            await IOE.delay?.(220);
        }
        await solveVisibleRows();

        if (filledCount < totalBlanks) {
            if (scrollViewComp) {
                try {
                    if (typeof scrollViewComp.scrollToBottom === 'function') scrollViewComp.scrollToBottom(0.15);
                    else if (typeof scrollViewComp.scrollToPercentVertical === 'function') scrollViewComp.scrollToPercentVertical(1.0, 0.15);
                } catch (e) {}
            }
            const canvas = getCanvasEl();
            if (canvas) canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 800, clientX: 400, clientY: 400, bubbles: true }));
            await IOE.delay?.(320);
            await solveVisibleRows();
        }

        if (filledCount > 0) {
            IOE.toast(`🎉 Đã điền ${filledCount}/${totalBlanks} đáp án Cloze Test!`, 2400);
        }
        return filledCount > 0;
    }

    /* ================= 3. DISPATCH CANVAS CLICK, KEYBOARD & EDITBOX ================= */
    function dispatchCanvasClick(canvas, x, y) {
        if (!canvas) return;
        const opts = { bubbles: true, cancelable: true, view: win, clientX: x, clientY: y, pageX: x, pageY: y };
        try {
            if (typeof PointerEvent !== 'undefined') {
                canvas.dispatchEvent(new PointerEvent('pointerdown', opts));
                canvas.dispatchEvent(new PointerEvent('pointerup', opts));
            }
            canvas.dispatchEvent(new MouseEvent('mousedown', opts));
            canvas.dispatchEvent(new MouseEvent('mouseup', opts));
            canvas.dispatchEvent(new MouseEvent('click', opts));
        } catch (e) {}
    }

    function setDomInputValue(el, value) {
        if (!el) return;
        try {
            const proto = el.tagName === 'TEXTAREA' ? win.HTMLTextAreaElement?.prototype : win.HTMLInputElement?.prototype;
            const desc = proto && Object.getOwnPropertyDescriptor(proto, 'value');
            if (desc && typeof desc.set === 'function') desc.set.call(el, value);
            else el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {}
    }

    function keyInfoForChar(ch) {
        if (ch === ' ') return { key: ' ', code: 'Space', keyCode: 32 };
        if (ch === "'") return { key: "'", code: 'Quote', keyCode: 222 };
        if (ch === '.') return { key: '.', code: 'Period', keyCode: 190 };
        if (ch === ',') return { key: ',', code: 'Comma', keyCode: 188 };
        if (ch === '-') return { key: '-', code: 'Minus', keyCode: 189 };
        if (ch === '?') return { key: '?', code: 'Slash', keyCode: 191 };
        const up = ch.toUpperCase();
        const isDigit = ch >= '0' && ch <= '9';
        return {
            key: ch,
            code: isDigit ? `Digit${ch}` : `Key${up}`,
            keyCode: up.charCodeAt(0)
        };
    }

    function typeCanvasString(str) {
        const cleanStr = String(str || '').trim();
        if (!cleanStr) return false;

        // 1. Check active Cocos DOM EditBox input overlay first
        const domInputs = Array.from(document.querySelectorAll('input.cocosEditBox, textarea.cocosEditBox, input[type="text"], input:not([type])'))
            .filter(el => el.offsetParent !== null && !el.closest('#yanzioe-root') && !el.closest('#yanzioe-license-modal'));
        if (domInputs.length > 0) {
            const tgt = domInputs.find(el => el === document.activeElement) || domInputs[0];
            tgt.focus();
            setDomInputValue(tgt, cleanStr);
            tgt.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            tgt.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            return true;
        }

        // 2. Fallback Canvas keyboard events
        const target = getCanvasEl() || win;
        for (let i = 0; i < cleanStr.length; i++) {
            const info = keyInfoForChar(cleanStr[i]);
            const keyOpts = { key: info.key, code: info.code, keyCode: info.keyCode, which: info.keyCode, bubbles: true };
            target.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
            target.dispatchEvent(new KeyboardEvent('keypress', keyOpts));
            target.dispatchEvent(new KeyboardEvent('keyup', keyOpts));
        }
        target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        target.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        return true;
    }

    /* ================= 3B. WORD REORDERING (COCOS2D) ================= */
    async function solveCocosWordReordering(scene) {
        if (!scene) return false;
        try {
            const clickables = findCocosClickables(scene);
            const wordBlocks = [];
            let answerBtn = null;

            for (const c of clickables) {
                const nl = (c.name || '').toLowerCase();
                const t = (c.text || '').trim();
                const tl = t.toLowerCase();
                if (!t) continue;
                if (nl.includes('submit') || tl === 'answer' || tl === 'trả lời' || tl === 'nộp bài') {
                    answerBtn = c;
                    continue;
                }
                if (t.length > 0 && t.length < 48 && !/^(ok|start|close|back|reset|sound|skip|replay)$/i.test(tl) && !/^[A-D][.:)]/i.test(t)) {
                    wordBlocks.push(c);
                }
            }

            // Reorder scenes usually show >= 4 clickable word pills with a prompt or without A/B/C/D options
            if (wordBlocks.length < 4) return false;
            const looksLikeMC = wordBlocks.every(w => /^[A-D][.:)]/i.test(w.text));
            if (looksLikeMC) return false;

            const words = wordBlocks.map(b => b.text.trim());
            const texts = extractCocosTexts(scene).map(x => x.text).filter(t => !words.includes(t));
            const stem = texts.join(' ');
            const promptContext = `Arrange words: ${words.join(' | ')}${stem ? ' (' + stem + ')' : ''}`;
            const meta = await IOE.question?.solveQuestion(null, promptContext, words, 'reorder');
            if (!meta || !meta.answer) return false;

            const fullTarget = String(meta.answer).trim().toLowerCase().replace(/[^a-z0-9\s']/g, '').replace(/\s+/g, ' ');
            const availableBlocks = wordBlocks.slice();
            const clickOrder = [];
            let remaining = fullTarget;

            while (remaining.length > 0 && availableBlocks.length > 0) {
                remaining = remaining.trim();
                let foundIdx = availableBlocks.findIndex(block => {
                    const cb = block.text.toLowerCase().replace(/[^a-z0-9\s']/g, '').trim();
                    return cb && (remaining === cb || remaining.startsWith(cb + ' '));
                });
                if (foundIdx < 0) {
                    foundIdx = availableBlocks.findIndex(block => {
                        const cb = block.text.toLowerCase().replace(/[^a-z0-9\s']/g, '').trim();
                        return cb && remaining.startsWith(cb);
                    });
                }
                if (foundIdx < 0) break;
                const chosen = availableBlocks.splice(foundIdx, 1)[0];
                const cb = chosen.text.toLowerCase().replace(/[^a-z0-9\s']/g, '').trim();
                clickOrder.push(chosen);
                remaining = remaining.slice(cb.length).trim();
            }

            if (clickOrder.length < 3) return false;
            for (const block of clickOrder) {
                await clickCocosNode(block.node);
                await IOE.delay?.(240);
            }
            if (answerBtn) {
                await IOE.delay?.(320);
                await clickCocosNode(answerBtn.node);
            }
            IOE.toast(`🧩 Đã ghép ${clickOrder.length} khối từ!`, 1500);
            return true;
        } catch (e) {
            return false;
        }
    }

    /* ================= 4. CREATEJS / ADOBE ANIMATE ENGINE ================= */
    function isCreateJSVisible(obj) {
        if (!obj) return false;
        if (obj.visible === false) return false;
        if (typeof obj.alpha === 'number' && obj.alpha <= 0.05) return false;
        return true;
    }

    function extractCreateJSData(root) {
        const texts = [];
        const clickables = [];
        const seen = new WeakSet();

        function walk(obj, depth = 0) {
            if (!obj || depth > 14 || !isCreateJSVisible(obj) || seen.has(obj)) return;
            seen.add(obj);

            if (typeof obj.text === 'string' && obj.text.trim()) {
                let gx = obj.x || 0, gy = obj.y || 0;
                try {
                    if (typeof obj.localToGlobal === 'function') {
                        const gp = obj.localToGlobal(0, 0);
                        gx = gp.x; gy = gp.y;
                    }
                } catch (e) {}
                texts.push({ obj, text: obj.text.trim(), x: gx, y: gy });
            }

            const hasListener = !!(obj._listeners?.click || obj._listeners?.mousedown || obj.cursor === 'pointer');
            const nameLower = (obj.name || '').toLowerCase();
            const isNamedBtn = /(btn|opt|choice|ans|item|next|submit|start|ok)/.test(nameLower);
            if (obj.mouseEnabled !== false && (hasListener || isNamedBtn) && obj.children) {
                const subTexts = [];
                (obj.children || []).forEach(c => {
                    if (isCreateJSVisible(c) && typeof c.text === 'string' && c.text.trim()) subTexts.push(c.text.trim());
                });
                const label = subTexts.join(' ').trim();
                let gx = obj.x || 0, gy = obj.y || 0;
                try {
                    if (typeof obj.localToGlobal === 'function') {
                        const gp = obj.localToGlobal(0, 0);
                        gx = gp.x; gy = gp.y;
                    }
                } catch (e) {}
                if (label || isNamedBtn) {
                    clickables.push({ obj, text: label, x: gx, y: gy, name: obj.name || '' });
                }
            }

            if (Array.isArray(obj.children)) {
                for (const ch of obj.children) walk(ch, depth + 1);
            }
        }

        walk(root, 0);
        return { texts, clickables };
    }

    function clickCreateJSObj(item, canvas) {
        if (!item?.obj) return false;
        try {
            const obj = item.obj;
            if (typeof obj.dispatchEvent === 'function') {
                obj.dispatchEvent('mousedown');
                obj.dispatchEvent('pressup');
                obj.dispatchEvent('click');
            }
            if (canvas && (canvas.width || 1) > 0) {
                const rect = canvas.getBoundingClientRect();
                const cx = rect.left + (item.x / canvas.width) * rect.width;
                const cy = rect.top + (item.y / canvas.height) * rect.height;
                dispatchCanvasClick(canvas, cx, cy);
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    async function solveCreateJSGame() {
        const stage = win.stage || win.exportRoot?.stage || null;
        const root = win.exportRoot || stage;
        if (!root) return false;
        IOE.state.lastEngine = 'CreateJS / Animate';

        const canvas = getCanvasEl();
        const { texts, clickables } = extractCreateJSData(root);
        if (texts.length === 0 && clickables.length === 0) return false;

        // Filter non-chrome texts
        const btnTextSet = new Set(clickables.map(c => c.text).filter(Boolean));
        const optionBtns = clickables.filter(c => c.text && !/^(score|time|sound|mute|back|exit|\d+:\d+)$/i.test(c.text));
        const optStrings = optionBtns.map(c => c.text);
        const stemParts = texts
            .map(t => t.text)
            .filter(t => !btnTextSet.has(t) && !/^(score|điểm|time|0?\d:\d\d|\d+\/\d+)$/i.test(t));

        const qText = (stemParts.length ? stemParts : texts.map(t => t.text)).join(' ').trim();
        if (!qText) return false;

        const meta = await IOE.question?.solveQuestion(null, qText, optStrings);
        if (!meta?.answer) return false;

        if (optionBtns.length > 0) {
            const matched = matchCocosButton(optionBtns, meta.answer);
            if (matched && clickCreateJSObj(matched, canvas)) {
                IOE.toast(`⚡ [CreateJS] Chọn: ${matched.text || meta.answer}`, 1400);
                return true;
            }
        }
        typeCanvasString(String(meta.answer));
        return true;
    }

    /* ================= 5. UNIFIED CANVAS SOLVER ================= */
    function isHudChromeText(t) {
        const s = String(t || '').trim();
        return /^(score|điểm|time|timer|thời gian|\d{1,2}:\d{2}|câu\s*\d+(\/\d+)?|question\s*\d+(\/\d+)?|\d+\/\d+)$/i.test(s);
    }

    async function solveCanvasGame() {
        if (!isLicensed()) return false;
        try { IOE.question?.scanCocosMemoryForAnswers?.(); } catch (e) {}

        const cocosScene = getCocosScene();
        if (cocosScene) {
            const clickables = findCocosClickables(cocosScene);

            // Only auto-press OK / Start if it's an intro/transition screen (<= 3 clickable buttons total)
            if (clickables.length > 0 && clickables.length <= 3) {
                for (const c of clickables) {
                    const tl = c.text.toLowerCase();
                    if (tl === 'ok' || tl === 'start' || tl === 'bắt đầu' || tl === 'tiếp tục') {
                        await clickCocosNode(c.node);
                        IOE.toast('🚀 Tiếp tục màn Cocos2d!', 1100);
                        await IOE.delay?.(700);
                        return true;
                    }
                }
            }

            // 1. Cloze Passage ("Lâu đài trên mây")
            if (await solveCocosClozePassage(cocosScene)) return true;

            // 2. Word Reordering ("Bạch tuộc thu ngọc")
            if (await solveCocosWordReordering(cocosScene)) return true;

            // 3. Multiple Choice / Fill-in-the-blank (separate prompt stem vs option buttons + image clues)
            const cocosTexts = extractCocosTexts(cocosScene);
            if (cocosTexts.length > 0) {
                const optBtns = clickables.filter(c => {
                    const t = (c.text || '').trim();
                    const nl = (c.name || '').toLowerCase();
                    return t && !isHudChromeText(t) && !/(submit|next|skip|close|sound|back|reset|hint)/.test(nl) &&
                        !/^(nộp bài|trả lời|tiếp tục|bỏ qua|nghe lại|submit|next|ok|start)$/i.test(t);
                });
                const optSet = new Set(optBtns.map(b => b.text.trim()));
                const stemTexts = cocosTexts
                    .map(x => x.text.trim())
                    .filter(t => !isHudChromeText(t) && !optSet.has(t));

                const spriteClues = extractSceneSpriteClues(cocosScene);
                let qPrompt = stemTexts.join(' ').trim() || cocosTexts.map(x => x.text).join(' ').trim();
                if (spriteClues.length > 0) {
                    qPrompt += ` [Image hints: ${spriteClues.slice(0, 5).join(', ')}]`;
                }

                const optStrings = optBtns.map(b => b.text);
                const meta = await IOE.question?.solveQuestion(null, qPrompt, optStrings);
                if (meta?.answer) {
                    const ansStr = String(meta.answer).trim();

                    // a. Check Cocos EditBox + visible DOM input overlay
                    const cc = win.cc;
                    if (cc && cc.EditBox) {
                        const editBoxes = [];
                        (function findEB(n) {
                            if (!n || !canTraverseNode(n)) return;
                            if (typeof n.getComponent === 'function') {
                                const eb = n.getComponent(cc.EditBox) || n.getComponent('cc.EditBox');
                                if (eb) editBoxes.push({ node: n, comp: eb });
                            }
                            const ch = (typeof n.getChildren === 'function' ? n.getChildren() : n.children) || [];
                            ch.forEach(findEB);
                        })(cocosScene);

                        if (editBoxes.length > 0) {
                            for (const eb of editBoxes) {
                                eb.comp.string = ansStr;
                                if (eb.comp._impl?._elem) setDomInputValue(eb.comp._impl._elem, ansStr);
                                if (typeof eb.comp._updateStringLabel === 'function') eb.comp._updateStringLabel();
                                eb.node.emit?.('editing-did-ended', eb.comp);
                                eb.node.emit?.('text-changed', eb.comp);
                            }
                            IOE.toast(`✍️ Đã điền EditBox: ${ansStr}`, 1400);
                            const submitBtn = clickables.find(c => /(submit|trả lời|nộp bài|xác nhận|ok|next)/i.test(c.text + ' ' + c.name));
                            if (submitBtn) {
                                await IOE.delay?.(250);
                                await clickCocosNode(submitBtn.node);
                            }
                            return true;
                        }
                    }

                    // b. Click matched multiple-choice button cleanly
                    if (optBtns.length > 0) {
                        const matchedBtn = matchCocosButton(optBtns, ansStr);
                        if (matchedBtn) {
                            await clickCocosNode(matchedBtn.node);
                            IOE.toast(`⚡ [Cocos2d] Chọn: ${matchedBtn.text || ansStr}`, 1400);
                            return true;
                        }
                    }

                    // c. Keyboard/DOM typing fallback
                    typeCanvasString(ansStr);
                    return true;
                }
            }
        }

        // Fallback: CreateJS / Adobe Animate Canvas
        return await solveCreateJSGame();
    }

    function getSceneDiagnostics() {
        const sc = getCocosScene();
        const texts = sc ? extractCocosTexts(sc) : [];
        const clicks = sc ? findCocosClickables(sc) : [];
        return {
            ccPresent: !!win.cc,
            sceneFound: !!sc,
            canvasCount: document.querySelectorAll('canvas').length,
            cocosTextCount: texts.length,
            cocosClickableCount: clicks.length,
            sampleTexts: texts.slice(0, 6).map(t => t.text),
            createJsRoot: !!(win.exportRoot || win.stage)
        };
    }

    IOE.canvas = {
        solveCanvasGame,
        solveCocosClozePassage,
        solveCocosWordReordering,
        solveCreateJSGame,
        getCocosScene,
        canTraverseNode,
        isNodeVisible,
        getSceneDiagnostics,
        extractCocosTexts,
        extractSceneSpriteClues,
        findCocosClickables,
        matchCocosButton,
        clickCocosNode,
        typeCanvasString,
        typeIntoCanvas: typeCanvasString,
        setDomInputValue
    };
})(typeof window !== 'undefined' ? window : globalThis);
