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

    // Đệ quy quét toàn bộ text trong cây đối tượng Cocos2d
    function extractCocosTexts(node, maxDepth = 15, curDepth = 0) {
        if (!node || curDepth > maxDepth) return [];
        const results = [];
        try {
            let labelComp = null;
            const cc = win.cc;
            if (typeof node.getComponent === 'function' && cc) {
                if (cc.Label) labelComp = node.getComponent(cc.Label);
                if (!labelComp && cc.RichText) labelComp = node.getComponent(cc.RichText);
                if (!labelComp && cc.EditBox) labelComp = node.getComponent(cc.EditBox);
            }

            const strVal = labelComp?.string || node._string || node.string;
            if (strVal && typeof strVal === 'string') {
                const clean = strVal.trim();
                if (clean.length > 0) {
                    let worldPos = { x: node.x || 0, y: node.y || 0 };
                    try {
                        if (typeof node.convertToWorldSpaceAR === 'function' && cc?.v2) {
                            worldPos = node.convertToWorldSpaceAR(cc.v2(0, 0));
                        }
                    } catch (e) {}
                    results.push({ node, text: clean, comp: labelComp, y: node.y, x: node.x, worldX: worldPos.x, worldY: worldPos.y });
                }
            }

            const children = (typeof node.getChildren === 'function' ? node.getChildren() : node.children) || [];
            for (const child of children) {
                results.push(...extractCocosTexts(child, maxDepth, curDepth + 1));
            }
        } catch (e) {}
        return results;
    }

    // Tìm tất cả các nút có thể click trong Cocos2d
    function findCocosClickables(node, maxDepth = 15, curDepth = 0) {
        if (!node || curDepth > maxDepth) return [];
        const results = [];
        try {
            const cc = win.cc;
            let hasBtn = false;
            let btnComp = null;
            if (typeof node.getComponent === 'function' && cc?.Button) {
                btnComp = node.getComponent(cc.Button);
                hasBtn = !!btnComp;
            }
            if (hasBtn || node._hasClickEventListener || node._touchListener || node.name?.toLowerCase().includes('btn') || node.name?.toLowerCase().includes('opt') || node.name?.toLowerCase().includes('choice') || node.name?.toLowerCase().includes('item') || node.name?.toLowerCase().includes('ans')) {
                const txt = extractCocosTexts(node).map(t => t.text).join(' ');
                let worldPos = { x: node.x || 0, y: node.y || 0 };
                try {
                    if (typeof node.convertToWorldSpaceAR === 'function' && cc?.v2) {
                        worldPos = node.convertToWorldSpaceAR(cc.v2(0, 0));
                    }
                } catch (e) {}
                results.push({ node, text: txt, btnComp, y: node.y, x: node.x, worldX: worldPos.x, worldY: worldPos.y, name: node.name });
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
            let worldPos = { x: node.x || 0, y: node.y || 0 };
            try {
                if (typeof node.convertToWorldSpaceAR === 'function' && cc?.v2) {
                    worldPos = node.convertToWorldSpaceAR(cc.v2(0, 0));
                }
            } catch (e) {}

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

            // 1. Kích hoạt Button component (Bắt buộc _pressed = true theo mã nguồn Cocos Creator)
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

            // 2. Kích hoạt Event Emitter trên Node
            if (typeof node.emit === 'function') {
                const startEvt = { ...mockEvent, type: 'touchstart' };
                node.emit('touchstart', startEvt);
                node.emit('touchend', mockEvent);
                node.emit('click', mockEvent);
            }

            // 3. Dispatch Native Mouse/Pointer/Touch qua Canvas DOM
            const canvas = document.getElementById('GameCanvas') || document.querySelector('canvas.gameCanvas') || document.querySelector('canvas');
            if (canvas) {
                const rect = canvas.getBoundingClientRect();
                let canvasW = canvas.width;
                let canvasH = canvas.height;
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
        } catch (err) {
            console.warn('[YANZIOE Cocos] click error:', err);
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

        // Đếm chính xác số chỗ khuyết trong đề bài bằng regex: (1), (2), (3)...
        const blankMatches = [...passageText.matchAll(/\((\d+)\)/g)].map(m => parseInt(m[1], 10));
        let totalBlanks = blankMatches.length > 0 ? Math.max(...blankMatches) : 6;
        totalBlanks = Math.min(Math.max(totalBlanks, 4), 8); // Giới hạn thực tế: từ 4 đến 8 câu, chuẩn là 6

        console.log(`[YANZIOE Cocos] Phát hiện bài thi Cloze Test. Tổng số câu hỏi chuẩn: ${totalBlanks} câu.`);

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

        // Khóa cứng: đúng totalBlanks hàng (không có hàng ảo 7..11)
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
        let filledCount = 0;

        // 5. Click lần lượt từng hàng - Mỗi hàng duy nhất 1 lần
        for (const row of validRows) {
            const rNum = row.rowNumber;
            if (clickedRowNumbers.has(rNum)) continue;

            const targetAns = String(answers[rNum] || answers[String(rNum)] || '').trim().toUpperCase();
            if (!targetAns) continue;

            let targetButton = null;

            // a. Khớp theo vị trí cột chữ cái A, B, C, D (0, 1, 2, 3)
            if (['A', 'B', 'C', 'D'].includes(targetAns)) {
                const colIdx = targetAns.charCodeAt(0) - 65;
                if (row.buttons[colIdx]) {
                    targetButton = row.buttons[colIdx];
                }
            }

            // b. Khớp theo tiền tố chữ cái A, B, C, D trong text nút
            if (!targetButton) {
                targetButton = row.buttons.find(b => b.text.trim().toUpperCase().startsWith(targetAns));
            }

            // c. Khớp theo từ ngữ tiếng Anh trong nút
            if (!targetButton) {
                targetButton = row.buttons.find(b => b.text.toLowerCase().includes(targetAns.toLowerCase()));
            }

            // d. Fallback theo vị trí cột
            if (!targetButton && row.buttons.length > 0) {
                const fallbackCol = ['A', 'B', 'C', 'D'].indexOf(targetAns);
                targetButton = row.buttons[fallbackCol >= 0 ? fallbackCol : 0];
            }

            if (targetButton) {
                await clickCocosNode(targetButton.node);
                clickedRowNumbers.add(rNum);
                filledCount++;
                console.log(`[YANZIOE Cocos] ✓ Đã chọn Câu ${rNum} [${targetAns}]: ${targetButton.text}`);
                IOE.toast(`⚡ Đã điền câu ${rNum}/${validRows.length}: [${targetAns}]`, 800);
                if (IOE.updateQuizSummary) {
                    IOE.updateQuizSummary(validRows.length, filledCount);
                }
                // Giãn cách an toàn 400ms để Cocos lưu trạng thái
                await IOE.delay?.(400);
            }
        }

        IOE.toast(`🎉 Đã điền xong đầy đủ ${filledCount}/${validRows.length} đáp án!`, 2500);

        // Phát sự kiện cập nhật giao diện
        const detailedAnswers = Object.entries(answers)
            .filter(([k]) => parseInt(k, 10) <= validRows.length)
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

    /* ================= 4. UNIFIED CANVAS SOLVER ================= */
    async function solveCanvasGame() {
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

            // 1. Thử giải dạng bài Cloze Passage trước
            const clozeSuccess = await solveCocosClozePassage(cocosScene);
            if (clozeSuccess) return true;

            // 2. Thử giải dạng trắc nghiệm thông thường (Single Multiple-Choice)
            const cocosTexts = extractCocosTexts(cocosScene);
            if (cocosTexts.length > 0) {
                const rawStrings = cocosTexts.map(t => t.text);
                const questionText = rawStrings.join(' ');
                const meta = await IOE.question?.solveQuestion(null, questionText, rawStrings);
                if (meta?.answer) {
                    const ansLower = String(meta.answer).trim().toLowerCase();
                    const updatedClickables = findCocosClickables(cocosScene);
                    for (const c of updatedClickables) {
                        const ct = c.text.toLowerCase();
                        if (ct.includes(ansLower) || ct.startsWith(ansLower)) {
                            await clickCocosNode(c.node);
                            IOE.toast(`⚡ Đã tự click đáp án Cocos2d: ${meta.answer}`, 1500);
                            return true;
                        }
                    }
                    typeCanvasString(String(meta.answer));
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
