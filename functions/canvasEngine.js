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
        const allTexts = extractCocosTexts(scene);
        if (allTexts.length === 0) return false;

        // 1. Tìm đoạn văn đề bài (chứa các chỗ khuyết (1), (2) hoặc ______ hoặc từ khóa)
        let passageObj = allTexts.find(t => t.text.length > 50 && (/\(\s*\d+\s*\)|_{3,}|\.{3,}|vietnam/i.test(t.text)));
        if (!passageObj) {
            const upperTexts = allTexts.filter(t => (t.worldY > 350 || t.y > 0) && t.text.length > 25);
            if (upperTexts.length > 0) {
                passageObj = { text: upperTexts.map(t => t.text).join(' ') };
            }
        }
        if (!passageObj || !passageObj.text) return false;

        const passageText = passageObj.text;

        // 2. Tìm tất cả các ứng viên nút bấm
        const clickables = findCocosClickables(scene);
        const rawCandidates = [];
        for (const c of clickables) {
            const nameLower = (c.name || '').toLowerCase();
            if (nameLower.includes('close') || nameLower.includes('back') || nameLower.includes('sound') || nameLower.includes('audio') || nameLower.includes('home')) {
                continue;
            }
            rawCandidates.push(c);
        }

        if (rawCandidates.length < 4) return false;

        // Quét tìm tất cả các số thứ tự hàng từ các nút/nhãn số
        const candidateNumbers = [];
        for (const c of rawCandidates) {
            const t = c.text.trim();
            const m = /^([0-9]{1,2})[.:)]?$/.exec(t);
            if (m) {
                const n = parseInt(m[1], 10);
                if (n >= 1 && n <= 30) candidateNumbers.push(n);
            }
        }
        const maxCandidateNum = candidateNumbers.length > 0 ? Math.max(...candidateNumbers) : 0;

        // Đếm số chỗ khuyết trong đề bài bằng regex: (1), (2), (3)...
        const blankMatches = [...passageText.matchAll(/\((\d+)\)/g)].map(m => parseInt(m[1], 10));
        const maxBlank = blankMatches.length > 0 ? Math.max(...blankMatches) : 0;

        // Quét ngân hàng kiến thức chuẩn
        let kbCount = 0;
        const normPass = passageText.toLowerCase();
        for (const entry of (IOE.CLOZE_KNOWLEDGE_BANK || [])) {
            if (entry.keywords.some(k => normPass.includes(k.toLowerCase()))) {
                kbCount = Math.max(kbCount, Object.keys(entry.words || entry.answers || {}).length);
            }
        }

        let interceptedCount = 0;
        if (IOE.state.clozeAnswers) {
            interceptedCount = Object.keys(IOE.state.clozeAnswers).length;
        }

        // Động thái xác định đúng số câu hỏi (Hỗ trợ 10 câu, lên tới 25 câu - Không giới hạn ở 8)
        let totalBlanks = Math.max(maxCandidateNum, maxBlank, kbCount, interceptedCount, 10);
        totalBlanks = Math.min(Math.max(totalBlanks, 4), 25);

        console.log(`[YANZIOE Cocos] Phát hiện bài thi Cloze Test. Tổng số câu hỏi xác định: ${totalBlanks} câu.`);

        // 3. Tách nhãn số thứ tự câu (1 đến totalBlanks) và nút đáp án (A, B, C, D)
        const rowLabels = [];
        const optionButtons = [];

        for (const c of rawCandidates) {
            const t = c.text.trim();
            // Chỉ coi là nhãn hàng nếu là số nguyên từ 1 đến totalBlanks
            const isPureNumber = /^[0-9]{1,2}[.:)]?$/.test(t) && !/[a-zA-Z]/.test(t);
            if (isPureNumber) {
                const num = parseInt(t, 10);
                if (num >= 1 && num <= totalBlanks) {
                    rowLabels.push({ ...c, rowNumber: num });
                    continue;
                }
            }
            // Không phải nhãn số -> là nút đáp án
            optionButtons.push(c);
        }

        // Khử trùng lặp nhãn hàng, lấy nhãn ở mép trái nhất (worldX nhỏ nhất)
        const uniqueLabels = [];
        for (let num = 1; num <= totalBlanks; num++) {
            const matching = rowLabels.filter(l => l.rowNumber === num);
            if (matching.length > 0) {
                matching.sort((a, b) => (a.worldX || 0) - (b.worldX || 0));
                uniqueLabels.push(matching[0]);
            }
        }

        const rows = [];
        const Y_TOLERANCE = 35;

        if (uniqueLabels.length >= 2) {
            for (const lbl of uniqueLabels) {
                const rowBtns = optionButtons.filter(b => Math.abs(b.worldY - lbl.worldY) < Y_TOLERANCE);
                rowBtns.sort((a, b) => (a.worldX || 0) - (b.worldX || 0));
                rows.push({
                    rowNumber: lbl.rowNumber,
                    y: lbl.worldY,
                    buttons: rowBtns
                });
            }
        } else {
            optionButtons.sort((a, b) => (b.worldY || 0) - (a.worldY || 0));
            const clustered = [];
            for (const btn of optionButtons) {
                let r = clustered.find(cl => Math.abs(cl.y - btn.worldY) < Y_TOLERANCE);
                if (!r) {
                    r = { y: btn.worldY, buttons: [] };
                    clustered.push(r);
                }
                r.buttons.push(btn);
            }
            clustered.sort((a, b) => b.y - a.y);
            const takeRows = clustered.slice(0, totalBlanks);
            takeRows.forEach((cl, idx) => {
                cl.buttons.sort((a, b) => (a.worldX || 0) - (b.worldX || 0));
                rows.push({
                    rowNumber: idx + 1,
                    y: cl.y,
                    buttons: cl.buttons
                });
            });
        }

        // Lấy toàn bộ hàng hợp lệ (Hỗ trợ đầy đủ 10/10 hàng)
        const validRows = rows.filter(r => r.buttons.length >= 2).slice(0, totalBlanks);
        if (validRows.length < 2) {
            console.log(`[YANZIOE Cocos] Chỉ tìm thấy ${validRows.length} hàng hợp lệ, không phải Cloze Test.`);
            return false;
        }

        console.log(`[YANZIOE Cocos] Nhận diện chuẩn xác ${validRows.length}/${totalBlanks} hàng câu hỏi Cloze Test.`);
        IOE.toast(`📊 Bài thi gồm đúng ${validRows.length} câu hỏi. Đang tự động điền...`, 1800);

        if (IOE.updateQuizSummary) {
            IOE.updateQuizSummary(validRows.length, 0);
        }

        // 4. Giải bài: Lấy đáp án từ Cloze Solver
        const rowsPayload = validRows.map(r => ({
            index: r.rowNumber,
            options: r.buttons.map(b => b.text)
        }));

        const answers = await IOE.question?.solveClozePassage(passageText, rowsPayload);
        if (!answers || Object.keys(answers).length === 0) return false;

        console.log('[YANZIOE Cocos] Đáp án nhận được:', answers);

        const clickedRowNumbers = new Set();
        const recordedAnswers = {};
        let filledCount = 0;

        // 5. Click lần lượt từng hàng - Khớp theo Target Word chuẩn để chống xáo trộn A, B, C, D
        for (const row of validRows) {
            const rNum = row.rowNumber;
            if (clickedRowNumbers.has(rNum)) continue;

            const targetRaw = answers[rNum] || answers[String(rNum)] || '';
            const targetStr = String(targetRaw).trim();
            if (!targetStr) continue;

            let targetButton = null;

            // 1. Khớp ưu tiên 1: THEO TỪ NGỮ TIẾNG ANH (Word Matching)
            // Miễn nhiễm 100% với việc hệ thống IOE tráo đổi ngẫu nhiên thứ tự A, B, C, D
            const cleanWord = targetStr.toLowerCase().replace(/^[a-d][.:)]\s*/i, '').trim();
            if (cleanWord.length >= 2 && !['a', 'b', 'c', 'd'].includes(cleanWord)) {
                targetButton = row.buttons.find(b => b.text.toLowerCase().includes(cleanWord));
            }

            // 2. Khớp ưu tiên 2: THEO CHỮ CÁI LỰA CHỌN (A, B, C, D)
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

            // 3. Fallback: Khớp từ ngữ
            if (!targetButton && cleanWord.length >= 2) {
                targetButton = row.buttons.find(b => b.text.toLowerCase().includes(cleanWord));
            }

            if (targetButton) {
                await clickCocosNode(targetButton.node);
                clickedRowNumbers.add(rNum);
                filledCount++;

                const chosenIdx = row.buttons.indexOf(targetButton);
                const chosenLetter = chosenIdx >= 0 ? String.fromCharCode(65 + chosenIdx) : '';
                const displayAnswer = chosenLetter ? `${chosenLetter} (${cleanWord || targetStr})` : (cleanWord || targetStr);
                recordedAnswers[rNum] = displayAnswer;

                console.log(`[YANZIOE Cocos] ✓ Đã chọn Câu ${rNum} [${displayAnswer}]: ${targetButton.text}`);
                IOE.toast(`⚡ Đã điền câu ${rNum}/${validRows.length}: [${displayAnswer}]`, 800);
                if (IOE.updateQuizSummary) {
                    IOE.updateQuizSummary(validRows.length, filledCount);
                }
                // Giãn cách an toàn 350ms để Cocos Creator cập nhật state
                await IOE.delay?.(350);
            }
        }

        IOE.toast(`🎉 Đã điền xong đầy đủ ${filledCount}/${validRows.length} đáp án chuẩn xác!`, 2500);

        // Phát sự kiện cập nhật giao diện
        const detailedAnswers = Object.entries(recordedAnswers)
            .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
            .map(([k, v]) => `• Câu ${k}: ${v}`).join('\n');

        IOE.events?.emit('questionSolved', {
            qId: `cloze_${validRows.length}_questions`,
            qText: `[Đoạn văn điền từ - Tổng cộng ${validRows.length} câu hỏi]\n${passageText.slice(0, 120)}...`,
            answer: `Đã điền ${filledCount}/${validRows.length} câu:\n${detailedAnswers}`,
            tier: 'Tier 1 (Ngân hàng IOE + Collocation CAS)',
            thinking: `📊 Đã phân tích toàn bộ ${validRows.length} vị trí khuyết trong bài.\n✓ Hoàn tất điền tự động ${filledCount}/${validRows.length} câu vào Cocos2d Canvas.`
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

            const targetWords = String(meta.answer).trim().split(/\s+/);
            const usedBlocks = new Set();
            let clickedCount = 0;

            for (const tw of targetWords) {
                const cleanTarget = tw.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (!cleanTarget) continue;

                const block = wordBlocks.find(b => {
                    if (usedBlocks.has(b)) return false;
                    const cleanBlock = b.text.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return cleanBlock === cleanTarget;
                });

                if (block) {
                    await clickCocosNode(block.node);
                    usedBlocks.add(block);
                    clickedCount++;
                    await IOE.delay?.(250);
                }
            }

            if (clickedCount >= 3) {
                if (answerBtn) {
                    await IOE.delay?.(350);
                    await clickCocosNode(answerBtn.node);
                    IOE.toast('🎉 Đã bấm ANSWER hoàn tất Ghép câu!', 1500);
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
