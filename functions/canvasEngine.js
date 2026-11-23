(function (global) {
    'use strict';
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const IOE = win.IOE || global.IOE;
    if (!IOE) return;

    function isLicensed() {
        return !!IOE.license?.verifySeal?.('93e7d590b85d867a');
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
            if (node.activeInHierarchy === false) return false;
            if (node.activeInHierarchy === undefined && node.active === false) return false;
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

    function findComp(node, ccClass, typeName) {
        if (!node) return null;
        if (typeof node.getComponent === 'function') {
            const c = (ccClass && node.getComponent(ccClass)) || node.getComponent(typeName);
            if (c) return c;
        }
        if (Array.isArray(node._components)) {
            for (const c of node._components) {
                if (c && ((ccClass && c instanceof ccClass) || c.__classname__ === typeName)) return c;
            }
        }
        return null;
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
                    const s = comp?.string ?? comp?._string ?? comp?.text ?? comp?.btnTxt ?? comp?.btnContent;
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
            const cc = win.cc;
            const hasRichText = !!findComp(node, cc?.RichText, 'cc.RichText');
            if (isSelfOpaque(node)) {
                const clean = getNodeText(node);
                if (clean.length > 0) {
                    const worldPos = getNodeWorldPos(node);
                    results.push({ node, text: clean, y: node.y || 0, x: node.x || 0, worldX: worldPos.x, worldY: worldPos.y });
                }
            }
            if (!hasRichText) {
                const children = (typeof node.getChildren === 'function' ? node.getChildren() : node.children) || [];
                for (const child of children) {
                    if (child?.name === 'RICHTEXT_CHILD') continue;
                    results.push(...extractCocosTexts(child, maxDepth, curDepth + 1));
                }
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

            const isNonButtonWidget = !!(
                findComp(node, cc?.ScrollView, 'cc.ScrollView') ||
                findComp(node, cc?.Scrollbar, 'cc.Scrollbar') ||
                findComp(node, cc?.RichText, 'cc.RichText') ||
                findComp(node, cc?.Mask, 'cc.Mask')
            );

            if (!isNonButtonWidget) {
                btnComp = findComp(node, cc?.Button, 'cc.Button') || findComp(node, cc?.Toggle, 'cc.Toggle') || null;
                if (btnComp && btnComp.interactable !== false && btnComp.enabled !== false) isClickable = true;
                if (cc?.MenuItem && node instanceof cc.MenuItem && (typeof node.isEnabled !== 'function' || node.isEnabled())) isClickable = true;
                if (cc?.ui?.Button && node instanceof cc.ui.Button && (typeof node.isEnabled !== 'function' || node.isEnabled())) isClickable = true;
                if (cc?.ui?.Widget && node instanceof cc.ui.Widget && typeof node.isTouchEnabled === 'function' && node.isTouchEnabled()) isClickable = true;
                if (node._hasClickEventListener || node._touchListener || node._touchEnabled || hasEventListeners(node)) isClickable = true;

                const name = (node.name || '').toLowerCase();
                if (name.includes('btn') || name.includes('opt') || name.includes('choice') || name.includes('item') || name.includes('ans') || name.includes('block') || name.includes('word') || name.includes('apple')) {
                    isClickable = true;
                }
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

            const hasRichText = !!findComp(node, cc?.RichText, 'cc.RichText');
            if (!hasRichText) {
                const children = (typeof node.getChildren === 'function' ? node.getChildren() : node.children) || [];
                for (const child of children) {
                    if (child?.name === 'RICHTEXT_CHILD') continue;
                    results.push(...findCocosClickables(child, maxDepth, curDepth + 1));
                }
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

            let firedClickEvents = false;
            let btnComp = null;
            const toggleComp = findComp(node, cc?.Toggle, 'cc.Toggle');
            if (toggleComp && toggleComp.interactable !== false) {
                btnComp = toggleComp;
                toggleComp.isChecked = true;
                const tEvs = (Array.isArray(toggleComp.checkEvents) && toggleComp.checkEvents.length > 0)
                    ? toggleComp.checkEvents
                    : (Array.isArray(toggleComp.clickEvents) ? toggleComp.clickEvents : []);
                if (tEvs.length > 0) {
                    if (typeof cc?.Component?.EventHandler?.emitEvents === 'function') {
                        try { cc.Component.EventHandler.emitEvents(tEvs, mockEvent); firedClickEvents = true; } catch (e) {}
                    } else {
                        for (const ev of tEvs) {
                            if (typeof ev?.emit === 'function') { try { ev.emit([mockEvent, ev.customEventData]); firedClickEvents = true; } catch (e) {} }
                        }
                    }
                }
                if (!firedClickEvents && typeof toggleComp.check === 'function') {
                    try { toggleComp.check(); firedClickEvents = true; } catch (e) {}
                }
                if (typeof node.emit === 'function') node.emit('toggle', toggleComp);
            }

            if (!btnComp) {
                btnComp = findComp(node, cc?.Button, 'cc.Button');
                if (btnComp && btnComp.interactable !== false) {
                    btnComp._pressed = true;
                    if (Array.isArray(btnComp.clickEvents) && btnComp.clickEvents.length > 0) {
                        if (typeof cc?.Component?.EventHandler?.emitEvents === 'function') {
                            try {
                                cc.Component.EventHandler.emitEvents(btnComp.clickEvents, mockEvent);
                                firedClickEvents = true;
                            } catch (e) {}
                        } else {
                            for (const ev of btnComp.clickEvents) {
                                if (typeof ev?.emit === 'function') {
                                    try { ev.emit([mockEvent, ev.customEventData]); firedClickEvents = true; } catch (e) {}
                                }
                            }
                        }
                    }
                    if (!firedClickEvents && typeof btnComp._onTouchEnded === 'function') {
                        try { btnComp._onTouchEnded(mockEvent); firedClickEvents = true; } catch (e) {}
                    }
                    btnComp._pressed = false;
                }
            }

            if (!firedClickEvents) {
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
                    node.emit('click', btnComp || mockEvent);
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
            } else if (typeof node.emit === 'function') {
                node.emit('click', btnComp || mockEvent);
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
        const { clozeComp } = inspectIoeGameComponents(scene);

        let passageObj = clozeComp?.txtQuestion
            ? { text: getNodeText(clozeComp.txtQuestion.node || clozeComp.txtQuestion) || String(clozeComp.questData || '') }
            : allTexts.find(t => t.text.length > 50 && (/\(\s*\d+\s*\)|_{3,}|\.{3,}/i.test(t.text)));
        if (!passageObj) passageObj = allTexts.find(t => t.text.length > 85 && t.worldY > H * 0.42);
        if (!passageObj || !passageObj.text) return false;
        const passageText = passageObj.text;

        function extractRowsFromScene() {
            if (clozeComp?.contentAnswer?.children?.length) {
                const cRows = [];
                clozeComp.contentAnswer.children.forEach((rowNode, idx) => {
                    if (!canTraverseNode(rowNode)) return;
                    const cont = (typeof rowNode.getChildByName === 'function' ? rowNode.getChildByName('container') : null) ||
                        (rowNode.children || []).find(ch => /container/i.test(ch.name || '')) || rowNode;
                    const optNodes = (cont.children || []).filter(canTraverseNode);
                    const btns = optNodes.map(n => {
                        const ansTxt = String(n.dataAnswer?.answer || getNodeText(n) || extractCocosTexts(n, 3).map(t => t.text).join(' ')).trim();
                        return { node: n, text: ansTxt, name: n.name || '', worldX: n.x || 0, worldY: n.y || 0 };
                    }).filter(b => b.text);
                    const rowIdx = optNodes[0]?.dataAnswer?.questIdx || (idx + 1);
                    if (btns.length >= 2) cRows.push({ rowNumber: rowIdx, buttons: btns, y: 0 });
                });
                if (cRows.length > 0) return cRows.sort((a, b) => a.rowNumber - b.rowNumber);
            }

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
        if (!clozeComp && initialRowsRaw.length < 2 && !/\(\s*\d+\s*\)|_{3,}/.test(passageText)) return false;

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
    function isAncestorNamed(node, pattern) {
        let p = node?.parent || node?._parent;
        let guard = 0;
        while (p && guard++ < 12) {
            if (pattern.test(String(p.name || ''))) return true;
            p = p.parent || p._parent;
        }
        return false;
    }

    function inspectIoeGameComponents(scene) {
        let gamePlayComp = null;
        let reorderComp = null;
        let matchComp = null;
        let clozeComp = null;
        let textComp = null;
        const seen = new WeakSet();
        (function walk(n, d = 0) {
            if (!n || d > 16 || seen.has(n) || !canTraverseNode(n)) return;
            seen.add(n);
            for (const c of (n._components || [])) {
                if (!c) continue;
                if (!gamePlayComp && (c.btnSubmit || c.quest || typeof c.findQuestModel === 'function')) gamePlayComp = c;
                if (!reorderComp && Array.isArray(c.listText) && (Array.isArray(c.listAnswer) || typeof c._enableClick === 'boolean')) reorderComp = c;
                if (!matchComp && c.ctnCross && (c.rootGame || c.data?.game?.question)) matchComp = c;
                if (!clozeComp && c.contentAnswer && c.txtQuestion) clozeComp = c;
                if (!textComp && c.questionModel && Array.isArray(c.buttons) && c.node?.activeInHierarchy !== false) textComp = c;
            }
            const ch = (typeof n.getChildren === 'function' ? n.getChildren() : n.children) || [];
            for (const x of ch) walk(x, d + 1);
        })(scene, 0);
        return { gamePlayComp, reorderComp, matchComp, clozeComp, textComp };
    }

    async function solveCocosMatchingPairs(scene) {
        if (!scene) return false;
        let matchCompRef = null;
        try {
            const cc = win.cc;
            const { gamePlayComp, matchComp } = inspectIoeGameComponents(scene);
            if (!matchComp || !matchComp.ctnCross || matchComp._yanzBusy) return false;
            matchCompRef = matchComp;
            matchCompRef._yanzBusy = true;
            const rootGame = matchComp.rootGame || gamePlayComp;
            if (rootGame?.isEndGame) return false;

            const cardNodes = (matchComp.ctnCross.children || []).filter(n => {
                if (!canTraverseNode(n)) return false;
                if (typeof n.opacity === 'number' && n.opacity <= 8) return false;
                const btn = typeof n.getComponent === 'function' ? ((cc?.Button && n.getComponent(cc.Button)) || n.getComponent('cc.Button')) : null;
                return !(btn && btn.interactable === false);
            });
            if (cardNodes.length < 2) return false;

            // If user had 1 card half-selected, clear it before pairing cleanly
            if (matchComp.selectCross1) {
                await clickCocosNode(matchComp.selectCross1);
                await IOE.delay?.(120);
            }

            const pairsToClick = [];
            const usedNodes = new WeakSet();
            const qList = matchComp.data?.game?.question || [];

            // Tier 0 (RAM / ClientData.AppModel exact pairs - supports text, IPA & image cards!)
            if (qList.length > 0 || typeof rootGame?.findQuestModel === 'function') {
                const leftCards = cardNodes.filter(n => n.dataAnswer && (n.dataAnswer.content?.content || (typeof n.dataAnswer.content === 'string' && !n.dataAnswer.ans)));
                for (const leftNode of leftCards) {
                    if (usedNodes.has(leftNode)) continue;
                    const i = String(leftNode.dataAnswer?.content?.content ?? leftNode.dataAnswer?.content ?? '').trim();
                    if (!i) continue;
                    const qModel = rootGame?.findQuestModel?.(i);
                    let targetAns = qModel?.answearArr?.[0]?.content;
                    if (!targetAns) {
                        const rawQ = qList.find(q => String(q.content?.content ?? q.content ?? '').trim() === i);
                        targetAns = rawQ?.ans?.[0]?.content ?? rawQ?.answearArr?.[0]?.content;
                    }
                    if (!targetAns) continue;
                    const targetNorm = String(targetAns).replace(/\.(PNG|JPG|JPEG|GIF)$/i, m => m.toLowerCase()).trim();

                    const rightNode = cardNodes.find(n => {
                        if (n === leftNode || usedNodes.has(n) || !n.dataAnswer) return false;
                        const a = typeof n.dataAnswer.ans === 'string' ? n.dataAnswer.ans : '';
                        const aNorm = a.replace(/\.(PNG|JPG|JPEG|GIF)$/i, m => m.toLowerCase()).trim();
                        return a && (a.trim() === String(targetAns).trim() || aNorm === targetNorm);
                    });
                    if (rightNode) {
                        usedNodes.add(leftNode);
                        usedNodes.add(rightNode);
                        pairsToClick.push([leftNode, rightNode, `${i} ↔ ${targetNorm}`]);
                    }
                }
            }

            // Tier 2 Fallback (AI Batch Pair Matching if dataAnswer RAM not bound)
            if (pairsToClick.length === 0) {
                const cardsWithText = cardNodes.map(n => ({
                    node: n,
                    text: (getNodeText(n) || extractCocosTexts(n, 3).map(t => t.text).join(' ')).trim()
                })).filter(c => c.text);
                if (cardsWithText.length >= 2) {
                    const qPrompt = getNodeText(matchComp.txtQuestion?.node || matchComp.txtQuestion) || 'Match the exact pairs';
                    const meta = await IOE.question?.solveQuestion(null, qPrompt, cardsWithText.map(c => c.text), 'pairs');
                    let pairsArr = null;
                    try { pairsArr = meta?.answer ? JSON.parse(meta.answer) : null; } catch (e) {}
                    if (Array.isArray(pairsArr)) {
                        for (const pair of pairsArr) {
                            if (!Array.isArray(pair) || pair.length < 2) continue;
                            const cardA = cardsWithText.find(c => !usedNodes.has(c.node) && c.text.toLowerCase() === String(pair[0]).trim().toLowerCase());
                            const cardB = cardsWithText.find(c => c !== cardA && !usedNodes.has(c.node) && c.text.toLowerCase() === String(pair[1]).trim().toLowerCase());
                            if (cardA && cardB) {
                                usedNodes.add(cardA.node);
                                usedNodes.add(cardB.node);
                                pairsToClick.push([cardA.node, cardB.node, `${cardA.text} ↔ ${cardB.text}`]);
                            }
                        }
                    }
                }
            }

            if (pairsToClick.length === 0) return false;
            IOE.state.lastEngine = 'Cocos2d (Ghép Cặp)';
            const pacingOn = IOE.pacing?.isHumanPacingActive?.();
            const totalPairs = Math.max(qList.length || 0, pairsToClick.length);
            let solvedPairs = 0;
            for (let idx = 0; idx < pairsToClick.length; idx++) {
                const [n1, n2, label] = pairsToClick[idx];
                if (rootGame?.isEndGame) break;
                if (pacingOn) {
                    if (idx === 0) {
                        await IOE.delay?.(1800 + Math.floor(Math.random() * 900));
                    } else {
                        IOE.state.lastPacingHeartbeat = Date.now();
                        await IOE.delay?.(2400 + Math.floor(Math.random() * 1400));
                    }
                    if (idx === pairsToClick.length - 1 && IOE.pacing?.waitUntilMinElapsed) {
                        await IOE.pacing.waitUntilMinElapsed(IOE.pacing.getMinExamSeconds(totalPairs), 'đọc bài Ghép Cặp');
                    }
                }
                let waitMs = 0;
                while (matchComp.mask?.active && waitMs < 4000) {
                    await IOE.delay?.(80);
                    waitMs += 80;
                }
                if (typeof n1.opacity === 'number' && n1.opacity <= 8) continue;
                if (typeof n2.opacity === 'number' && n2.opacity <= 8) continue;
                await clickCocosNode(n1);
                await IOE.delay?.(pacingOn ? (380 + Math.floor(Math.random() * 260)) : 160);
                await clickCocosNode(n2);
                solvedPairs++;
                IOE.toast(`🧩 Ghép cặp (${solvedPairs}/${pairsToClick.length}): ${label}`, 1200);
                await IOE.delay?.(pacingOn ? 450 : 260);
            }
            return solvedPairs > 0;
        } catch (e) {
            return false;
        } finally {
            if (matchCompRef) matchCompRef._yanzBusy = false;
        }
    }

    async function solveCocosWordReordering(scene) {
        if (!scene) return false;
        try {
            const { width: W, height: H } = getLogicalCanvasSize();
            const { gamePlayComp, reorderComp, matchComp, clozeComp, textComp } = inspectIoeGameComponents(scene);
            if (!reorderComp && (matchComp || clozeComp || textComp)) return false;
            if (reorderComp && reorderComp._enableClick === false) return false;

            const clickables = findCocosClickables(scene);
            let wordBlocks = [];
            let answerBtn = gamePlayComp?.btnSubmit ? { node: gamePlayComp.btnSubmit.node || gamePlayComp.btnSubmit, text: 'ANSWER', name: 'btnSubmit' } : null;

            if (reorderComp && reorderComp.listText.length >= 4) {
                const filledSlots = Array.isArray(reorderComp.listAnswer) ? reorderComp.listAnswer.filter(Boolean).length : 0;
                for (const tileNode of reorderComp.listText) {
                    if (!canTraverseNode(tileNode)) continue;
                    if (typeof tileNode.opacity === 'number' && tileNode.opacity <= 8) continue;
                    const txt = getNodeText(tileNode) || extractCocosTexts(tileNode, 4).map(x => x.text).join(' ');
                    if (txt.trim()) {
                        wordBlocks.push({ node: tileNode, text: txt.trim(), name: tileNode.name || '' });
                    }
                }
                if (filledSlots === 0 && wordBlocks.length < reorderComp.listText.length) return false;
            } else {
                const sceneHasLongPassage = extractCocosTexts(scene).some(x => x.text.length > 90);
                if (sceneHasLongPassage) return false;
                const lowerClickTexts = clickables.map(c => (c.text || '').trim().toLowerCase());
                if (lowerClickTexts.includes('true') && lowerClickTexts.includes('false')) return false;

                for (const c of clickables) {
                    const nl = (c.name || '').toLowerCase();
                    const t = (c.text || '').trim();
                    const tl = t.toLowerCase();
                    if (c.worldX > W * 0.72 && c.worldY > H * 0.65) continue;
                    if (nl.includes('submit') || nl.includes('answer') || nl.includes('traloi') || tl === 'answer' || tl === 'trả lời' || tl === 'nộp bài' || tl === 'submit') {
                        if (!answerBtn) answerBtn = c;
                        continue;
                    }
                    if (!t || /^\d{1,2}$/.test(t) || /^\d+\s+\d+$/.test(t)) continue;
                    if (isAncestorNamed(c.node, /ctnAnwser|ctnAnswer|profile|header/i)) continue;
                    if (typeof c.node?.opacity === 'number' && c.node.opacity <= 8) continue;
                    if (t.length > 0 && t.length < 48 && !isHudChromeText(t) && !/^(ok|start|close|back|reset|sound|skip|replay|score|round:.*|true|false)$/i.test(tl) && !/^[A-D][.:)]/i.test(t)) {
                        wordBlocks.push(c);
                    }
                }
            }

            // Reorder scenes usually show >= 4 clickable word pills with a prompt or without A/B/C/D options
            if (wordBlocks.length < 4) return false;
            const looksLikeMC = wordBlocks.every(w => /^[A-D][.:)]/i.test(w.text));
            if (looksLikeMC) return false;

            const words = wordBlocks.map(b => b.text.trim());
            const texts = extractCocosTexts(scene)
                .filter(x => !(x.worldX > W * 0.72 && x.worldY > H * 0.65))
                .map(x => x.text.trim())
                .filter(t => !words.includes(t) && !isHudChromeText(t) && !/^(id:|round:|score|\d+(\.\d+)?)$/i.test(t));
            const stem = texts.join(' ');
            const promptContext = `Arrange words: ${words.join(' | ')}${stem ? ' (' + stem + ')' : ''}`;
            const meta = await IOE.question?.solveQuestion(null, promptContext, words, 'reorder');
            if (!meta || !meta.answer) return false;

            const normReo = s => String(s || '').toLowerCase()
                .replace(/[\u2018\u2019`]/g, "'")
                .replace(/[^a-z0-9\s']/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            const fullTarget = normReo(meta.answer);
            const availableBlocks = wordBlocks.slice();
            const clickOrder = [];
            let remaining = fullTarget;
            let missingInsertIdx = -1;

            while (remaining.length > 0 && availableBlocks.length > 0) {
                remaining = remaining.trim();
                let foundIdx = availableBlocks.findIndex(block => {
                    const cb = normReo(block.text);
                    return cb && (remaining === cb || remaining.startsWith(cb + ' '));
                });
                if (foundIdx < 0) {
                    foundIdx = availableBlocks.findIndex(block => {
                        const cb = normReo(block.text);
                        return cb && remaining.startsWith(cb);
                    });
                }
                if (foundIdx < 0) {
                    let bestPos = Infinity, bestIdx = -1, bestLen = 0;
                    availableBlocks.forEach((block, i) => {
                        const cb = normReo(block.text);
                        if (!cb) return;
                        const esc = cb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const m = new RegExp(`(?:^|\\s)${esc}(?:\\s|$)`).exec(remaining);
                        const pos = m ? (m[0].startsWith(' ') ? m.index + 1 : m.index) : remaining.indexOf(cb);
                        if (pos >= 0 && (pos < bestPos || (pos === bestPos && cb.length > bestLen))) {
                            bestPos = pos; bestIdx = i; bestLen = cb.length;
                        }
                    });
                    if (bestIdx >= 0 && bestPos < 36) {
                        if (missingInsertIdx < 0) missingInsertIdx = clickOrder.length;
                        const chosen = availableBlocks.splice(bestIdx, 1)[0];
                        clickOrder.push(chosen);
                        remaining = remaining.slice(bestPos + bestLen).trim();
                        continue;
                    }
                    if (missingInsertIdx < 0) missingInsertIdx = clickOrder.length;
                    remaining = remaining.replace(/^\S+\s*/, '');
                    continue;
                }
                const chosen = availableBlocks.splice(foundIdx, 1)[0];
                const cb = normReo(chosen.text);
                clickOrder.push(chosen);
                remaining = remaining.slice(cb.length).trim();
            }

            if (availableBlocks.length === 1 && clickOrder.length >= 2) {
                const lastBlk = availableBlocks.pop();
                const idxAt = (missingInsertIdx >= 0 && missingInsertIdx <= clickOrder.length) ? missingInsertIdx : clickOrder.length;
                clickOrder.splice(idxAt, 0, lastBlk);
            }

            if (clickOrder.length < Math.max(3, wordBlocks.length)) {
                IOE.toast(`⚠️ Chưa ghép đủ từ (${clickOrder.length}/${wordBlocks.length}) — tạm dừng nộp để tránh sót!`, 2000);
                return false;
            }
            const totalReorderQ = IOE.state?.totalExamQuestions || gamePlayComp?.quest?.data?.questionArr?.length || 10;
            const curKey = `${promptContext.slice(0, 48)}`;
            if (IOE.state.currentQuestKey !== curKey) {
                IOE.state.currentQuestKey = curKey;
                IOE.state.questStartedAt = Date.now();
            }
            const pacingOn = IOE.pacing?.isHumanPacingActive?.();
            for (const block of clickOrder) {
                await clickCocosNode(block.node);
                await IOE.delay?.(pacingOn ? (340 + Math.floor(Math.random() * 220)) : 240);
            }
            if (reorderComp?.listText?.length) {
                const getUnplaced = () => reorderComp.listText.filter(t => canTraverseNode(t) && (typeof t.opacity !== 'number' || t.opacity > 10));
                const missed = getUnplaced();
                if (missed.length > 0) {
                    await IOE.delay?.(220);
                    for (const mNode of missed) {
                        await clickCocosNode(mNode);
                        await IOE.delay?.(240);
                    }
                    await IOE.delay?.(200);
                }
                if (getUnplaced().length > 0) {
                    IOE.toast('⚠️ Còn ô từ chưa lên khung — tạm hoãn nhấn Submit!', 1800);
                    return false;
                }
            }
            if (pacingOn && IOE.pacing?.waitQuestionReadTime) {
                await IOE.pacing.waitQuestionReadTime(3000, false);
                if (typeof gamePlayComp?.currentQuestIdx === 'number' && gamePlayComp.currentQuestIdx >= totalReorderQ - 1 && IOE.pacing?.waitUntilMinElapsed) {
                    await IOE.pacing.waitUntilMinElapsed(IOE.pacing.getMinExamSeconds(totalReorderQ), 'nộp bài cuối');
                }
            }
            if (answerBtn?.node && clickOrder.length >= wordBlocks.length) {
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

            // Recover cleanly if "Bạn chưa chọn hết các từ" popup is blocking the screen
            const modalTexts = extractCocosTexts(cocosScene).map(t => t.text).join(' ');
            if (/(bạn chưa chọn hết|chọn hết các từ)/i.test(modalTexts)) {
                const okBtn = clickables.find(c => /^(ok|đồng ý|tiếp tục)$/i.test((c.text || '').trim()));
                if (okBtn) {
                    await clickCocosNode(okBtn.node);
                    await IOE.delay?.(400);
                    return true;
                }
            }

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

            // 1B. Matching Pairs ("Ghép Cặp" / Game12)
            if (await solveCocosMatchingPairs(cocosScene)) return true;

            // 2. Word Reordering ("Bạch tuộc thu ngọc")
            if (await solveCocosWordReordering(cocosScene)) return true;

            // 3. Multiple Choice / True-False / Reading Comprehension / Fill-in-the-blank
            const { width: W, height: H } = getLogicalCanvasSize();
            const { gamePlayComp, textComp } = inspectIoeGameComponents(cocosScene);
            if (textComp && textComp.canClick === false) return false;

            const cocosTexts = extractCocosTexts(cocosScene);
            if (cocosTexts.length > 0 || textComp) {
                const tabBtns = [];
                let separateSubmitNode = gamePlayComp?.btnSubmit?.node || gamePlayComp?.btnSubmit || null;
                let optBtns = [];

                for (const c of clickables) {
                    if (c.worldX > W * 0.72 && c.worldY > H * 0.65) continue;
                    const t = (c.text || '').trim();
                    const nl = (c.name || '').toLowerCase();
                    if (!t) continue;
                    if (/^\d{1,2}$/.test(t) && c.worldY > H * 0.60) {
                        const num = parseInt(t, 10);
                        if (num >= 1 && num <= 20 && !tabBtns.some(x => x.num === num)) {
                            tabBtns.push({ num, node: c.node, worldX: c.worldX });
                        }
                        continue;
                    }
                    if (/^(nộp bài|trả lời|xác nhận|submit|answer)$/i.test(t) || /(submit|btnanswer)/.test(nl)) {
                        if (!separateSubmitNode) separateSubmitNode = c.node;
                        continue;
                    }
                    if (isHudChromeText(t) || /^\d+\s+\d+$/.test(t) || /(next|skip|close|sound|back|reset|hint|scroll)/.test(nl)) continue;
                    if (/^(tiếp tục|bỏ qua|nghe lại|next|ok|start|score|\d+(\.\d+)?)$/i.test(t)) continue;
                    optBtns.push(c);
                }
                tabBtns.sort((a, b) => a.num - b.num);

                let optionImageUrls = [];
                if (textComp?.buttons?.length) {
                    const activeBtns = textComp.buttons.filter(b => b?.node && canTraverseNode(b.node) && b.btnIdx !== 6);
                    const isTfButtons = activeBtns.filter(b => (b.btnIdx === 0 || b.btnIdx === 1) && !(b.btnTxt || b.btnContent || getNodeText(b.node))).length === 2;
                    const compBtns = activeBtns
                        .map(b => {
                            let txt = String(b.btnTxt || b.btnContent || getNodeText(b.node) || '').replace(/<[^>]+>/g, '').trim();
                            if (!txt && isTfButtons) txt = b.btnIdx === 1 ? 'True' : (b.btnIdx === 0 ? 'False' : '');
                            else if (!txt && b.btnUrl) {
                                optionImageUrls.push(String(b.btnUrl));
                                txt = `[Image: ${String(b.btnUrl).split('/').pop()}]`;
                            }
                            return { node: b.node, text: txt, btnComp: b, name: b.node.name || '' };
                        })
                        .filter(b => b.text);
                    if (compBtns.length >= 2) optBtns = compBtns;
                }

                const optSet = new Set(optBtns.map(b => b.text.trim()));
                const tabNumSet = new Set(tabBtns.map(t => String(t.num)));
                const stemTexts = [];
                for (const x of cocosTexts) {
                    if (x.worldX > W * 0.72 && x.worldY > H * 0.65) continue;
                    const t = x.text.trim();
                    if (!t || isHudChromeText(t) || optSet.has(t) || tabNumSet.has(t)) continue;
                    if (/^(id:|round:|score|submit|answer|\d+\s+\d+|\d+(\.\d+)?)$/i.test(t)) continue;
                    if (!stemTexts.includes(t)) stemTexts.push(t);
                }

                const qModel = textComp?.questionModel;
                const descPart = qModel?.questionDescription;
                const contPart = qModel?.questionContent;
                const isUrlStr = (s) => /^https?:\/\//i.test(String(s || '').trim());
                const modelText = [
                    (descPart && !descPart.hasAudio && !descPart.hasImage && !isUrlStr(descPart.content)) ? descPart.content : '',
                    (contPart && !contPart.hasAudio && !contPart.hasImage && !isUrlStr(contPart.content)) ? contPart.content : ''
                ].filter(Boolean).join(' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

                const longPassages = stemTexts.filter(t => t.length >= 60 && (!modelText || !modelText.includes(t)));
                const spriteClues = extractSceneSpriteClues(cocosScene);
                let qPrompt = modelText
                    ? (longPassages.length ? `[Passage]: ${longPassages.join(' ')}\nQuestion: ${modelText}` : modelText)
                    : (stemTexts.join('\n').trim() || cocosTexts.map(x => x.text).join(' ').trim());
                if (spriteClues.length > 0) {
                    qPrompt += ` [Image hints: ${spriteClues.slice(0, 5).join(', ')}]`;
                }

                const audioUrl = String(textComp?.remoteSound || (descPart?.hasAudio && descPart.content) || (contPart?.hasAudio && contPart.content) || '').replace(/\.MP3$/i, '.mp3').trim();
                const imageUrl = String((descPart?.hasImage && descPart.content) || (contPart?.hasImage && contPart.content) || '').trim();
                const maxInput = Number(contPart?.maxInput || 0);

                const qId = qModel?.questionId ?? null;
                const qKey = String(qId || `${qPrompt.slice(0, 96)}#${qPrompt.slice(-64)}:${qPrompt.length}`);
                if (IOE.state.currentQuestKey !== qKey) {
                    IOE.state.currentQuestKey = qKey;
                    IOE.state.questStartedAt = Date.now();
                }
                const optStrings = optBtns.map(b => b.text);
                const meta = await IOE.question?.solveQuestion(qId, qPrompt, optStrings, maxInput > 0 ? 'blank' : '', { audioUrl, imageUrl, optionImageUrls, maxInput });
                if (meta?.answer) {
                    const ansStr = String(meta.answer).trim();
                    if (IOE.pacing?.isHumanPacingActive?.()) {
                        await IOE.pacing.waitQuestionReadTime(longPassages.length ? 3400 : 2800, !!audioUrl);
                        const totalQ = Number(tabBtns.length || IOE.state?.totalExamQuestions || 10);
                        const curNum = Number(textComp?.currentQuestionNumber || (typeof gamePlayComp?.currentQuestIdx === 'number' ? gamePlayComp.currentQuestIdx + 1 : 0));
                        if (curNum > 0 && curNum >= totalQ && IOE.pacing?.waitUntilMinElapsed) {
                            await IOE.pacing.waitUntilMinElapsed(IOE.pacing.getMinExamSeconds(totalQ), audioUrl ? 'nghe kỹ bài cuối' : 'đọc kỹ câu cuối');
                        }
                    }

                    // a0. Native IOE ContentComponent fill-in-the-blank (inputTxt + maxInput + btnIdx 6)
                    if (maxInput > 0 && typeof textComp?.inputTxt === 'string') {
                        const rawLetters = ansStr.replace(/[^a-zA-Z0-9']/g, '');
                        const finalTyped = (rawLetters.length === maxInput ? rawLetters : ansStr.trim()).slice(0, maxInput);
                        textComp.inputTxt = finalTyped;
                        try { textComp.updateQuestContent?.(); } catch (e) {}
                        IOE.toast(`✍️ Đã điền đáp án (${finalTyped.length}/${maxInput}): ${finalTyped}`, 1400);
                        if (finalTyped.length < maxInput) return false;
                        const submitBtnComp = textComp.buttons?.find?.(b => b.btnIdx === 6 && b.node && canTraverseNode(b.node));
                        await IOE.delay?.(220);
                        if (submitBtnComp?.node) {
                            await clickCocosNode(submitBtnComp.node);
                        } else if (typeof textComp.onKeyEnterPress === 'function') {
                            textComp.onKeyEnterPress();
                        }
                        return true;
                    }

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
                                if (cc?.Component?.EventHandler?.emitEvents) {
                                    if (Array.isArray(eb.comp.textChanged)) cc.Component.EventHandler.emitEvents(eb.comp.textChanged, ansStr, eb.comp);
                                    if (Array.isArray(eb.comp.editingDidEnded)) cc.Component.EventHandler.emitEvents(eb.comp.editingDidEnded, eb.comp);
                                }
                                eb.node.emit?.('text-changed', eb.comp);
                                eb.node.emit?.('editing-did-ended', eb.comp);
                            }
                            IOE.toast(`✍️ Đã điền EditBox: ${ansStr}`, 1400);
                            const submitNode = gamePlayComp?.btnSubmit?.node || gamePlayComp?.btnSubmit ||
                                textComp?.buttons?.find?.(b => b.btnIdx === 6)?.node ||
                                clickables.find(c => /(submit|answer|trả lời|nộp bài|xác nhận|ok|next)/i.test(c.text + ' ' + c.name))?.node;
                            if (submitNode) {
                                await IOE.delay?.(250);
                                await clickCocosNode(submitNode);
                            }
                            return true;
                        }
                    }

                    // b. Click matched multiple-choice / True-False button cleanly (+ tab advance or separate Submit)
                    if (optBtns.length > 0) {
                        const matchedBtn = matchCocosButton(optBtns, ansStr);
                        if (matchedBtn) {
                            await clickCocosNode(matchedBtn.node);
                            IOE.toast(`⚡ [Cocos2d] Chọn: ${matchedBtn.text || ansStr}`, 1400);

                            const hasSeparateSubmit = separateSubmitNode && separateSubmitNode !== matchedBtn.node && !textComp;
                            if (tabBtns.length >= 2) {
                                if (!IOE.state._visitedTabs) IOE.state._visitedTabs = new Set();
                                IOE.state._visitedTabs.add(qKey);
                                await IOE.delay?.(320);
                                const getStemSig = () => extractCocosTexts(cocosScene)
                                    .filter(x => !(x.worldX > W * 0.72 && x.worldY > H * 0.65))
                                    .map(x => x.text.trim())
                                    .filter(t => t && !isHudChromeText(t) && !optSet.has(t) && !tabNumSet.has(t) && !/^(id:|round:|score|submit|answer|\d+:\d+|\d+\s+\d+|\d+(\.\d+)?)$/i.test(t))
                                    .join('|');
                                const prevStemSig = stemTexts.filter(t => !/^\d+:\d+$/.test(t)).join('|');
                                if (getStemSig() === prevStemSig) {
                                    const nextTab = tabBtns.find((_, idx) => idx >= IOE.state._visitedTabs.size);
                                    if (nextTab) {
                                        await clickCocosNode(nextTab.node);
                                        await IOE.delay?.(260);
                                    } else if (hasSeparateSubmit) {
                                        if (IOE.pacing?.isHumanPacingActive?.() && IOE.pacing?.waitUntilMinElapsed) {
                                            await IOE.pacing.waitUntilMinElapsed(IOE.pacing.getMinExamSeconds(tabBtns.length), 'nộp bài Đọc hiểu');
                                        }
                                        await clickCocosNode(separateSubmitNode);
                                        IOE.state._visitedTabs.clear();
                                    }
                                }
                            } else if (hasSeparateSubmit) {
                                await IOE.delay?.(320);
                                await clickCocosNode(separateSubmitNode);
                            }
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
            sceneActive: sc?.active,
            sceneActiveInHierarchy: sc?.activeInHierarchy,
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
        solveCocosMatchingPairs,
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
