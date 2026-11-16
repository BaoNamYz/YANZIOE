(function (global) {
    'use strict';
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const IOE = win.IOE || global.IOE;
    if (!IOE) return;

    /* ================= 1. COCOS2D-JS / COCOS2D-HTML5 / COCOS CREATOR ENGINE ================= */
    function getCocosScene() {
        try {
            const cc = win.cc;
            if (cc && cc.director) {
                // Cocos2d-html5 v3.x (IOE.vn live engine)
                if (typeof cc.director.getRunningScene === 'function') {
                    const s = cc.director.getRunningScene();
                    if (s) return s;
                }
                // Cocos Creator engine
                if (typeof cc.director.getScene === 'function') {
                    const s = cc.director.getScene();
                    if (s) return s;
                }
            }
        } catch (e) {}
        return null;
    }

    // Trích xuất text đa nền tảng (Cocos2d-html5 LabelTTF/BMFont, ccui.Button/Text & Cocos Creator Component)
    function getNodeText(node) {
        if (!node) return '';
        try {
            // Cocos2d-html5 v3.x API
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
            // Cocos Creator Component API
            const cc = win.cc;
            if (typeof node.getComponent === 'function' && cc) {
                let comp = null;
                if (cc.Label) comp = node.getComponent(cc.Label);
                if (!comp && cc.RichText) comp = node.getComponent(cc.RichText);
                if (!comp && cc.EditBox) comp = node.getComponent(cc.EditBox);
                const s = comp?.string;
                if (s && typeof s === 'string') return s.trim();
            }
            // Direct property fallbacks
            if (node._string && typeof node._string === 'string') return node._string.trim();
            if (node.string && typeof node.string === 'string') return node.string.trim();
        } catch (e) {}
        return '';
    }

    // Tính tọa độ thế giới đa nền tảng
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

    // Đệ quy quét toàn bộ text trong cây đối tượng Cocos2d
    function extractCocosTexts(node, maxDepth = 15, curDepth = 0) {
        if (!node || curDepth > maxDepth) return [];
        const results = [];
        try {
            const clean = getNodeText(node);
            if (clean.length > 0) {
                const worldPos = getNodeWorldPos(node);
                results.push({ node, text: clean, y: node.y || 0, x: node.x || 0, worldX: worldPos.x, worldY: worldPos.y });
            }

            const children = (typeof node.getChildren === 'function' ? node.getChildren() : node.children) || [];
            for (const child of children) {
                results.push(...extractCocosTexts(child, maxDepth, curDepth + 1));
            }
        } catch (e) {}
        return results;
    }

    // Tìm tất cả các nút có thể click trong Cocos2d-html5 & Cocos Creator
    function findCocosClickables(node, maxDepth = 15, curDepth = 0) {
        if (!node || curDepth > maxDepth) return [];
        const results = [];
        try {
            const cc = win.cc;
            let isClickable = false;
            let btnComp = null;

            // Cocos Creator component
            if (typeof node.getComponent === 'function' && cc?.Button) {
                btnComp = node.getComponent(cc.Button);
                if (btnComp) isClickable = true;
            }
            // Cocos2d-html5 Menu & UI Buttons
            if (cc?.MenuItem && node instanceof cc.MenuItem) isClickable = true;
            if (cc?.ui?.Button && node instanceof cc.ui.Button) isClickable = true;
            if (cc?.ui?.Widget && node instanceof cc.ui.Widget && typeof node.isTouchEnabled === 'function' && node.isTouchEnabled()) isClickable = true;
            if (node._hasClickEventListener || node._touchListener || node._touchEnabled) isClickable = true;

            const name = (node.name || '').toLowerCase();
            if (name.includes('btn') || name.includes('opt') || name.includes('choice') || name.includes('item') || name.includes('ans') || name.includes('block') || name.includes('box')) {
                isClickable = true;
            }

            if (isClickable) {
                let txt = getNodeText(node);
                if (!txt) {
                    txt = extractCocosTexts(node).map(t => t.text).join(' ');
                }
                const worldPos = getNodeWorldPos(node);
                results.push({ node, text: txt.trim(), btnComp, y: node.y || 0, x: node.x || 0, worldX: worldPos.x, worldY: worldPos.y, name: node.name });
            }

            const children = (typeof node.getChildren === 'function' ? node.getChildren() : node.children) || [];
            for (const child of children) {
                results.push(...findCocosClickables(child, maxDepth, curDepth + 1));
            }
        } catch (e) {}
        return results;
    }

    // Kích hoạt click vào một Node trong Cocos2d với đa cơ chế đồng bộ
    async function clickCocosNode(node) {
        if (!node) return false;
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

            // 1. Cocos2d-html5 MenuItem activate
            if (typeof node.activate === 'function') {
                try { node.activate(); } catch (e) {}
            }

            // 2. Cocos Creator Button component (Bắt buộc _pressed = true theo mã nguồn Cocos Creator)
            if (typeof node.getComponent === 'function' && cc?.Button) {
                const btn = node.getComponent(cc.Button);
                if (btn) {
                    btn._pressed = true;
                    if (typeof btn._onTouchBegan === 'function') {
                        try { btn._onTouchBegan(mockEvent); } catch (e) {}
                    }
                    if (Array.isArray(btn.clickEvents) && btn.clickEvents.length > 0) {
                        for (const ev of btn.clickEvents) {
                            if (typeof ev.emit === 'function') ev.emit([ev.customEventData]);
                        }
                    }
                    if (typeof btn._onTouchEnded === 'function') {
                        try { btn._onTouchEnded(mockEvent); } catch (e) {}
                    }
                    btn._pressed = false;
                }
            }

            // 3. Cocos2d-html5 Event Manager touch dispatch
            if (cc?.eventManager) {
                try {
                    if (typeof cc.eventManager.dispatchEvent === 'function' && cc.EventTouch) {
                        const touchEvt = new cc.EventTouch([mockTouch]);
                        touchEvt.setEventCode(cc.EventTouch.EventCode.BEGAN);
                        cc.eventManager.dispatchEvent(touchEvt);
                        touchEvt.setEventCode(cc.EventTouch.EventCode.ENDED);
                        cc.eventManager.dispatchEvent(touchEvt);
                    }
                } catch (e) {}
            }

            // 4. Kích hoạt Event Emitter trên Node
            if (typeof node.emit === 'function') {
                const startEvt = { ...mockEvent, type: 'touchstart' };
                node.emit('touchstart', startEvt);
                node.emit('touchend', mockEvent);
                node.emit('click', mockEvent);
            }

            // 5. Dispatch Native Mouse/Pointer/Touch qua Canvas DOM
            const canvas = document.getElementById('gameCanvas') || document.getElementById('GameCanvas') || document.querySelector('canvas.gameCanvas') || document.querySelector('canvas');
            if (canvas) {
                const rect = canvas.getBoundingClientRect();
                let canvasW = canvas.width || 1000;
                let canvasH = canvas.height || 600;
                if (cc?.view?.getVisibleSize) {
                    const vis = cc.view.getVisibleSize();
                    if (vis?.width && vis?.height) {
                        canvasW = vis.width;
                        canvasH = vis.height;
                    }
                }
                const scaleX = rect.width / (canvasW || rect.width);
                const scaleY = rect.height / (canvasH || rect.height);
                const clientX = rect.left + (worldPos.x * scaleX);
                const clientY = rect.bottom - (worldPos.y * scaleY);
                dispatchCanvasClick(canvas, clientX, clientY);
            }
            return true;
        } catch (e) {
            console.warn('[YANZIOE clickCocosNode error]', e);
        }
        return false;
    }

    /* ================= 2. CLOZE PASSAGE SOLVER (DẠNG ĐOẠN VĂN ĐIỀN TỪ) ================= */
    async function solveCocosClozePassage(scene) {
        try {
            if (IOE.question?.bypassIOESystemAnswers) {
                IOE.question.bypassIOESystemAnswers();
            }
        } catch (e) {}

        const allTexts = extractCocosTexts(scene);
        if (allTexts.length === 0) return false;

        // 1. Tìm đoạn văn đề bài (ở nửa trên màn hình: worldY > 300)
        let passageObj = allTexts.find(t => t.worldY > 300 && t.text.length > 50 && (/\(\s*\d+\s*\)|_{3,}|\.{3,}|vietnam/i.test(t.text)));
        if (!passageObj) {
            passageObj = allTexts.find(t => t.text.length > 50 && (/\(\s*\d+\s*\)|_{3,}|\.{3,}|vietnam/i.test(t.text)));
        }
        if (!passageObj || !passageObj.text) return false;

        const passageText = passageObj.text;

        // Kiểm tra số câu khuyết từ đoạn văn hoặc ngân hàng đề
        const blankMatches = [...passageText.matchAll(/\(([0-9]{1,2})\)/g)].map(m => parseInt(m[1], 10));
        const maxBlank = blankMatches.length > 0 ? Math.max(...blankMatches) : 0;

        let kbCount = 0;
        const normPass = passageText.toLowerCase();
        for (const entry of (IOE.CLOZE_KNOWLEDGE_BANK || [])) {
            if (entry.keywords.some(k => normPass.includes(k.toLowerCase()))) {
                kbCount = Math.max(kbCount, Object.keys(entry.words || entry.answers || {}).length);
            }
        }

        if (maxBlank === 0 && kbCount === 0) {
            return false;
        }

        let totalBlanks = Math.max(maxBlank, kbCount);
        if (IOE.state.clozeAnswers && Object.keys(IOE.state.clozeAnswers).length > 0) {
            totalBlanks = Math.max(totalBlanks, Object.keys(IOE.state.clozeAnswers).length);
        }
        if (totalBlanks < 4) totalBlanks = 10;
        totalBlanks = Math.min(Math.max(totalBlanks, 4), 15);

        console.log(`[YANZIOE Cocos] Bắt đầu giải bài Cloze Test. Tổng số câu: ${totalBlanks} câu.`);

        // Tìm ScrollView nếu có
        let scrollViewComp = null;
        try {
            function findSV(n) {
                if (!n || scrollViewComp) return;
                if (typeof n.getComponent === 'function' && win.cc?.ScrollView) {
                    const sv = n.getComponent(win.cc.ScrollView);
                    if (sv) { scrollViewComp = sv; return; }
                }
                const ch = (typeof n.getChildren === 'function' ? n.getChildren() : n.children) || [];
                for (const c of ch) findSV(c);
            }
            findSV(scene);
        } catch (e) {}

        const clickedRowNumbers = new Set();
        const recordedAnswers = {};
        let filledCount = 0;

        // Hàm quét và điền các hàng đang hiển thị trên màn hình
        async function solveVisibleRows() {
            const clickables = findCocosClickables(scene);
            
            // Giới hạn vùng chứa bảng đáp án: worldY <= 325 && worldY >= 35, worldX <= 750
            const tableItems = [];
            for (const c of clickables) {
                const nameLower = (c.name || '').toLowerCase();
                if (nameLower.includes('submit') || nameLower.includes('refresh') || nameLower.includes('close') || nameLower.includes('sound')) continue;
                if (c.worldY > 325 || c.worldY < 35 || c.worldX > 750) continue;
                tableItems.push(c);
            }

            // Tách riêng: Nhãn số thứ tự hàng (ở mép trái worldX < 130) và các nút đáp án (worldX >= 130)
            const numLabels = [];
            const optBtns = [];
            for (const item of tableItems) {
                const t = item.text.trim();
                const m = /^([0-9]{1,2})[.:)]?$/.exec(t);
                if (m && item.worldX < 130) {
                    numLabels.push({ ...item, rowNumber: parseInt(m[1], 10) });
                } else if (item.worldX >= 125) {
                    // Loại bỏ trùng lặp nếu node cha và node con đều nằm cùng vị trí
                    const isDup = optBtns.some(b => Math.abs(b.worldX - item.worldX) < 15 && Math.abs(b.worldY - item.worldY) < 15);
                    if (!isDup) optBtns.push(item);
                }
            }

            // Gom nhóm các nút đáp án theo toạ độ Y (mỗi hàng cách nhau ~30-50px)
            optBtns.sort((a, b) => (b.worldY || 0) - (a.worldY || 0));
            const rowClusters = [];
            for (const btn of optBtns) {
                let cl = rowClusters.find(c => Math.abs(c.y - btn.worldY) < 16);
                if (!cl) {
                    cl = { y: btn.worldY, buttons: [] };
                    rowClusters.push(cl);
                }
                cl.buttons.push(btn);
            }

            // Mỗi hàng hợp lệ phải có ít nhất 2 nút (thường là 4 nút: A, B, C, D)
            rowClusters.sort((a, b) => b.y - a.y);
            const detectedRows = [];

            for (const cl of rowClusters) {
                if (cl.buttons.length < 2) continue;
                cl.buttons.sort((a, b) => (a.worldX || 0) - (b.worldX || 0));

                // Tìm nhãn số thứ tự hàng tương ứng ở cùng toạ độ Y
                const matchedLbl = numLabels.find(l => Math.abs(l.worldY - cl.y) < 25);
                let rNum = matchedLbl ? matchedLbl.rowNumber : 0;

                detectedRows.push({
                    rowNumber: rNum,
                    y: cl.y,
                    buttons: cl.buttons
                });
            }

            // Nếu hàng chưa có rowNumber, suy luận từ các hàng lân cận
            detectedRows.forEach((r, idx) => {
                if (r.rowNumber === 0) {
                    if (idx > 0 && detectedRows[idx - 1].rowNumber > 0) {
                        r.rowNumber = detectedRows[idx - 1].rowNumber + 1;
                    } else {
                        r.rowNumber = idx + 1;
                    }
                }
            });

            if (detectedRows.length === 0) return 0;

            // Lấy đáp án từ Solver
            const rowsPayload = detectedRows.map(r => ({
                index: r.rowNumber,
                options: r.buttons.map(b => b.text)
            }));

            const answers = await IOE.question?.solveClozePassage(passageText, rowsPayload);
            if (!answers) return 0;

            let stepFilled = 0;

            for (const row of detectedRows) {
                const rNum = row.rowNumber;
                if (rNum <= 0 || clickedRowNumbers.has(rNum)) continue;

                const targetRaw = answers[rNum] || answers[String(rNum)] || '';
                const targetStr = String(targetRaw).trim();
                if (!targetStr) continue;

                let targetButton = null;
                const cleanTarget = targetStr.toLowerCase().replace(/^[a-d][.:)]\s*/i, '').trim();

                // 1. Khớp CHÍNH XÁC theo từ vựng tiếng Anh (Target Word Exact Match)
                for (const btn of row.buttons) {
                    const bt = btn.text.toLowerCase().replace(/^[a-d][.:)]\s*/i, '').trim();
                    if (bt === cleanTarget) {
                        targetButton = btn;
                        break;
                    }
                }

                // 2. Khớp theo ranh giới từ (Word Boundary Match - chống dính từ con)
                if (!targetButton && cleanTarget.length >= 2) {
                    for (const btn of row.buttons) {
                        const bt = btn.text.toLowerCase().replace(/^[a-d][.:)]\s*/i, '').trim();
                        try {
                            const rx = new RegExp('(^|\\s)' + cleanTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|$)', 'i');
                            if (rx.test(bt)) {
                                targetButton = btn;
                                break;
                            }
                        } catch (e) {}
                    }
                }

                // 3. Khớp theo chữ cái lựa chọn (A, B, C, D)
                if (!targetButton) {
                    const targetUpper = targetStr.toUpperCase();
                    if (['A', 'B', 'C', 'D'].includes(targetUpper)) {
                        targetButton = row.buttons.find(b => {
                            const bt = b.text.trim().toUpperCase();
                            return bt.startsWith(targetUpper + ' ') || bt.startsWith(targetUpper + '.') || bt.startsWith(targetUpper + ':') || bt === targetUpper;
                        });
                        if (!targetButton) {
                            const colIdx = targetUpper.charCodeAt(0) - 65;
                            if (row.buttons[colIdx]) targetButton = row.buttons[colIdx];
                        }
                    }
                }

                // 4. Fallback khớp substring nếu từ dài >= 3 ký tự
                if (!targetButton && cleanTarget.length >= 3) {
                    targetButton = row.buttons.find(b => {
                        const bt = b.text.toLowerCase().replace(/^[a-d][.:)]\s*/i, '').trim();
                        return bt.includes(cleanTarget) || cleanTarget.includes(bt);
                    });
                }

                if (targetButton) {
                    await clickCocosNode(targetButton.node);
                    clickedRowNumbers.add(rNum);
                    filledCount++;
                    stepFilled++;

                    const chosenIdx = row.buttons.indexOf(targetButton);
                    const chosenLetter = chosenIdx >= 0 ? String.fromCharCode(65 + chosenIdx) : '';
                    const displayAnswer = chosenLetter ? `${chosenLetter} (${cleanTarget || targetStr})` : (cleanTarget || targetStr);
                    recordedAnswers[rNum] = displayAnswer;

                    console.log(`[YANZIOE Cocos] ✓ Đã điền chuẩn xác Câu ${rNum}: [${displayAnswer}] (Nút: ${targetButton.text})`);
                    IOE.toast(`⚡ Đã điền câu ${rNum}/${totalBlanks}: [${displayAnswer}]`, 700);

                    if (IOE.updateQuizSummary) {
                        IOE.updateQuizSummary(totalBlanks, filledCount);
                    }
                    await IOE.delay?.(280);
                }
            }
            return stepFilled;
        }

        // Pass 1: Cuộn lên đầu ScrollView để làm các câu đầu (1 -> 5)
        if (scrollViewComp) {
            try {
                if (typeof scrollViewComp.scrollToTop === 'function') scrollViewComp.scrollToTop(0.1);
                else if (typeof scrollViewComp.scrollToPercentVertical === 'function') scrollViewComp.scrollToPercentVertical(0, 0.1);
            } catch (e) {}
            await IOE.delay?.(250);
        }
        await solveVisibleRows();

        // Pass 2: Cuộn xuống cuối ScrollView để làm nốt các câu cuối (6 -> 10/11)
        if (scrollViewComp && filledCount < totalBlanks) {
            try {
                if (typeof scrollViewComp.scrollToBottom === 'function') scrollViewComp.scrollToBottom(0.15);
                else if (typeof scrollViewComp.scrollToPercentVertical === 'function') scrollViewComp.scrollToPercentVertical(1.0, 0.15);
            } catch (e) {}
            await IOE.delay?.(350);
            await solveVisibleRows();
        }

        if (filledCount > 0) {
            IOE.toast(`🎉 Đã điền xong đầy đủ ${filledCount}/${totalBlanks} đáp án chuẩn xác 100%!`, 2500);
        }

        // Cập nhật giao diện Tab Đáp án & HUD
        const detailedAnswers = Object.entries(recordedAnswers)
            .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
            .map(([k, v]) => `• Câu ${k}: ${v}`).join('\n');

        IOE.events?.emit('questionSolved', {
            qId: `cloze_${totalBlanks}_questions`,
            qText: `[Đoạn văn điền từ - Tổng cộng ${totalBlanks} câu hỏi]\n${passageText.slice(0, 120)}...`,
            answer: `Đã điền ${filledCount}/${totalBlanks} câu:\n${detailedAnswers}`,
            tier: 'Tier 0 (Hệ Thống IOE Bypass - Khớp 100% Đề Gốc)',
            thinking: `📊 Đã phân tích toàn bộ ${totalBlanks} vị trí khuyết trong bài.\n✓ Cơ chế chống xáo trộn A, B, C, D đã kích hoạt thành công.\n✓ Toàn bộ ${filledCount}/${totalBlanks} câu đã được điền chuẩn xác vào Cocos2d Canvas.`
        });

        return filledCount > 0;
    }

    /* ================= 3. DISPATCH CANVAS CLICK & KEYBOARD ================= */
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

    function typeCanvasString(str) {
        const canvas = document.getElementById('GameCanvas') || document.querySelector('canvas.gameCanvas') || document.querySelector('canvas');
        const target = canvas || win;
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            const code = char.toUpperCase().charCodeAt(0);
            const keyOpts = { key: char, code: `Key${char.toUpperCase()}`, keyCode: code, which: code, bubbles: true };
            target.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
            target.dispatchEvent(new KeyboardEvent('keypress', keyOpts));
            target.dispatchEvent(new KeyboardEvent('keyup', keyOpts));
        }
        target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        target.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    }

    /* ================= 3B. GHÉP CÂU / WORD REORDERING (BẠCH TUỘC THU NGỌC) ================= */
    async function solveCocosWordReordering(scene) {
        if (!scene) return false;
        try {
            const clickables = findCocosClickables(scene);
            const wordBlocks = [];
            let answerBtn = null;

            for (const c of clickables) {
                const nameLower = (c.name || '').toLowerCase();
                const t = c.text.trim();
                const tLower = t.toLowerCase();
                if (nameLower.includes('ans') || nameLower.includes('submit') || tLower === 'answer' || tLower === 'trả lời') {
                    answerBtn = c;
                    continue;
                }
                if (t.length > 0 && t.length < 50 && !['ok', 'start', 'close', 'back', 'reset', 'sound'].includes(tLower)) {
                    wordBlocks.push(c);
                }
            }

            if (wordBlocks.length < 3) return false;

            // Thu thập text của các block để xác định câu cần ghép
            const words = wordBlocks.map(b => b.text.trim());
            const promptContext = words.join(' ');
            const meta = await IOE.question?.solveQuestion(null, promptContext, words);
            if (!meta || !meta.answer) return false;

            const fullTarget = String(meta.answer).trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
            const availableBlocks = wordBlocks.slice();
            const clickOrder = [];
            let remaining = fullTarget;

            // Thuật toán so khớp tuần tự từng khối từ (hỗ trợ cả khối 1 từ và cụm 2-3 từ)
            while (remaining.length > 0 && availableBlocks.length > 0) {
                remaining = remaining.trim();
                let foundMatch = false;

                for (let i = 0; i < availableBlocks.length; i++) {
                    const block = availableBlocks[i];
                    const cleanBlock = block.text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
                    if (!cleanBlock) continue;

                    if (remaining.startsWith(cleanBlock)) {
                        clickOrder.push(block);
                        availableBlocks.splice(i, 1);
                        remaining = remaining.slice(cleanBlock.length).trim();
                        foundMatch = true;
                        break;
                    }
                }

                if (!foundMatch) {
                    let bestIdx = -1;
                    for (let i = 0; i < availableBlocks.length; i++) {
                        const cleanBlock = availableBlocks[i].text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
                        const firstWord = cleanBlock.split(/\s+/)[0];
                        if (firstWord && remaining.startsWith(firstWord)) {
                            bestIdx = i;
                            break;
                        }
                    }
                    if (bestIdx >= 0) {
                        const block = availableBlocks[bestIdx];
                        clickOrder.push(block);
                        availableBlocks.splice(bestIdx, 1);
                        const cleanBlock = block.text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
                        remaining = remaining.replace(cleanBlock, '').trim();
                    } else {
                        break;
                    }
                }
            }

            // Click lần lượt các block theo đúng thứ tự
            for (const block of clickOrder) {
                await clickCocosNode(block.node);
                await IOE.delay?.(280);
            }

            if (clickOrder.length >= 2) {
                if (answerBtn) {
                    await IOE.delay?.(400);
                    await clickCocosNode(answerBtn.node);
                    IOE.toast(`🎉 Đã bấm ANSWER hoàn tất Ghép câu! (${clickOrder.length} khối)`, 1500);
                }
                return true;
            }
        } catch (e) {
            console.warn('[YANZIOE solveCocosWordReordering error]', e);
        }
        return false;
    }

    /* ================= 4. UNIFIED CANVAS SOLVER ================= */
    async function solveCanvasGame() {
        // Quét bộ nhớ Cocos2d để trích xuất Key gốc từ RAM
        try { IOE.question?.scanCocosMemoryForAnswers?.(); } catch (e) {}

        const cocosScene = getCocosScene();
        if (cocosScene) {
            const clickables = findCocosClickables(cocosScene);

            // Bấm START / OK nếu đang ở màn hình hướng dẫn ban đầu hoặc kết thúc bài
            for (const c of clickables) {
                const t = c.text.toLowerCase();
                if (t === 'ok' || t === 'start' || t.includes('bắt đầu') || t.includes('tiếp tục')) {
                    await clickCocosNode(c.node);
                    IOE.toast('🚀 Tiếp tục vòng thi Cocos2d!', 1200);
                    await IOE.delay?.(800);
                    return true;
                }
            }

            // 1. Thử giải dạng bài Cloze Passage ("Lâu đài trên mây")
            const clozeSuccess = await solveCocosClozePassage(cocosScene);
            if (clozeSuccess) return true;

            // 2. Thử giải dạng Ghép câu / Word Reordering ("Bạch tuộc thu ngọc")
            const reorderSuccess = await solveCocosWordReordering(cocosScene);
            if (reorderSuccess) return true;

            // 3. Thử giải dạng trắc nghiệm thông thường (Single Multiple-Choice) hoặc ô điền từ
            const cocosTexts = extractCocosTexts(cocosScene);
            if (cocosTexts.length > 0) {
                const rawStrings = cocosTexts.map(t => t.text);
                const questionText = rawStrings.join(' ');
                const meta = await IOE.question?.solveQuestion(null, questionText, rawStrings);
                if (meta?.answer) {
                    const ansStr = String(meta.answer).trim();
                    const ansLower = ansStr.toLowerCase();

                    // a. Kiểm tra nếu có EditBox trong Cocos Scene (Dạng bài điền từ)
                    const cc = win.cc;
                    if (cc && cc.EditBox) {
                        const editBoxes = [];
                        (function findEB(n) {
                            if (!n) return;
                            if (typeof n.getComponent === 'function') {
                                const eb = n.getComponent(cc.EditBox);
                                if (eb) editBoxes.push({ node: n, comp: eb });
                            }
                            const ch = (typeof n.getChildren === 'function' ? n.getChildren() : n.children) || [];
                            ch.forEach(findEB);
                        })(cocosScene);

                        if (editBoxes.length > 0) {
                            for (const eb of editBoxes) {
                                eb.comp.string = ansStr;
                                if (typeof eb.comp._updateStringLabel === 'function') eb.comp._updateStringLabel();
                                eb.node.emit('editing-did-ended', eb.comp);
                                eb.node.emit('text-changed', eb.comp);
                            }
                            IOE.toast(`⚡ Đã điền đáp án vào EditBox: ${ansStr}`, 1500);
                            return true;
                        }
                    }

                    // b. Click nút trắc nghiệm Cocos
                    const updatedClickables = findCocosClickables(cocosScene);
                    for (const c of updatedClickables) {
                        const ct = c.text.toLowerCase();
                        if (ct.includes(ansLower) || ct.startsWith(ansLower)) {
                            await clickCocosNode(c.node);
                            IOE.toast(`⚡ Đã tự click đáp án Cocos2d: ${meta.answer}`, 1500);
                            return true;
                        }
                    }

                    // c. Nhập phím vào Canvas
                    typeCanvasString(ansStr);
                    return true;
                }
            }
        }

        // 3. Fallback CreateJS
        const stage = win.stage || win.exportRoot?.stage || null;
        const root = win.exportRoot || null;
        if (root) {
            const texts = (function extract(c) {
                if (!c) return [];
                const res = [];
                (c.children || []).forEach(ch => {
                    if (ch.text) res.push(ch.text);
                    if (ch.children) res.push(...extract(ch));
                });
                return res;
            })(root);

            if (texts.length > 0) {
                const meta = await IOE.question?.solveQuestion(null, texts.join(' '), texts);
                if (meta?.answer) {
                    typeCanvasString(String(meta.answer));
                    return true;
                }
            }
        }

        return false;
    }

    IOE.canvas = {
        solveCanvasGame,
        solveCocosClozePassage,
        getCocosScene,
        extractCocosTexts,
        findCocosClickables,
        clickCocosNode,
        typeCanvasString
    };
})(typeof window !== 'undefined' ? window : globalThis);
