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
            if (hasBtn || node._hasClickEventListener || node._touchListener || node.name?.toLowerCase().includes('btn') || node.name?.toLowerCase().includes('opt') || node.name?.toLowerCase().includes('choice')) {
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

    // Kích hoạt click vào một Node trong Cocos2d với đa cơ chế
    function clickCocosNode(node) {
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

            // 1. Kích hoạt Button component
            if (typeof node.getComponent === 'function' && cc?.Button) {
                const btn = node.getComponent(cc.Button);
                if (btn) {
                    if (Array.isArray(btn.clickEvents) && btn.clickEvents.length > 0) {
                        for (const ev of btn.clickEvents) {
                            if (typeof ev.emit === 'function') ev.emit([ev.customEventData]);
                        }
                    }
                    if (typeof btn._onTouchEnded === 'function') {
                        btn._onTouchEnded(mockEvent);
                    }
                }
            }

            // 2. Kích hoạt Event Emitter trên Node
            if (typeof node.emit === 'function') {
                node.emit('touchstart', mockEvent);
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
                const clientY = rect.bottom - (worldPos.y * scaleY); // Cocos Y từ dưới lên
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

        // 1. Tìm đoạn văn (chứa (1) hoặc ______ hoặc chữ 'country'/'vietnam'/'festival')
        let passageObj = allTexts.find(t => t.text.length > 50 && (/\(\s*1\s*\)|_{3,}|\.{3,}|vietnam/i.test(t.text)));
        if (!passageObj) {
            const upperTexts = allTexts.filter(t => (t.worldY > 400 || t.y > 0) && t.text.length > 25);
            if (upperTexts.length > 0) {
                passageObj = { text: upperTexts.map(t => t.text).join(' ') };
            }
        }
        if (!passageObj || !passageObj.text) return false;

        const passageText = passageObj.text;
        console.log('[YANZIOE Cocos] Phát hiện đoạn văn Cloze Test:', passageText.slice(0, 100) + '...');
        IOE.toast('📖 Phát hiện dạng bài Điền từ vào đoạn văn (Cloze Test)!', 1500);

        // 2. Tìm tất cả các nút có thể click
        const clickables = findCocosClickables(scene);
        const candidates = [];
        for (const c of clickables) {
            const nameLower = (c.name || '').toLowerCase();
            const textLower = (c.text || '').toLowerCase();
            if (nameLower.includes('close') || nameLower.includes('back') || nameLower.includes('sound') || nameLower.includes('audio') || nameLower.includes('home')) {
                continue;
            }
            candidates.push(c);
        }

        if (candidates.length < 4) return false;

        // 3. Gom nhóm theo tọa độ worldY thành các hàng (Rows)
        // Cocos Y lớn ở trên, Y nhỏ ở dưới -> sắp xếp giảm dần (hàng 1 ở trên cùng)
        candidates.sort((a, b) => (b.worldY || 0) - (a.worldY || 0));

        const rows = [];
        const Y_TOLERANCE = 30;
        for (const btn of candidates) {
            let row = rows.find(r => Math.abs(r.y - btn.worldY) < Y_TOLERANCE);
            if (!row) {
                row = { y: btn.worldY, buttons: [] };
                rows.push(row);
            }
            row.buttons.push(btn);
        }

        // Lọc các hàng có từ 3 đến 6 nút
        const validRows = rows.filter(r => r.buttons.length >= 3 && r.buttons.length <= 6);
        if (validRows.length < 2) {
            console.log('[YANZIOE Cocos] Không đủ số hàng hợp lệ cho Cloze Test (tìm thấy ' + validRows.length + ' hàng).');
            return false;
        }

        // Sắp xếp các hàng từ trên xuống dưới
        validRows.sort((a, b) => b.y - a.y);

        // Trong từng hàng, sắp xếp từ trái sang phải theo worldX (A -> B -> C -> D)
        for (const row of validRows) {
            row.buttons.sort((a, b) => (a.worldX || 0) - (b.worldX || 0));
        }

        console.log(`[YANZIOE Cocos] Nhận diện thành công ${validRows.length} hàng đáp án Cloze Test!`);

        // 4. Giải bài: Lấy đáp án từ Cloze Solver
        const rowsPayload = validRows.map((r, idx) => ({
            index: idx + 1,
            options: r.buttons.map(b => b.text)
        }));

        const answers = await IOE.question?.solveClozePassage(passageText, rowsPayload);
        if (!answers || Object.keys(answers).length === 0) return false;

        console.log('[YANZIOE Cocos] Đáp án Cloze Test nhận được:', answers);
        IOE.toast(`⚡ Đang tự động điền ${validRows.length} câu Cloze Test...`, 1500);

        // 5. Click lần lượt từng hàng theo thứ tự A, B, C, D
        for (let rIdx = 0; rIdx < validRows.length; rIdx++) {
            const rowNumber = rIdx + 1;
            const targetAns = String(answers[rowNumber] || answers[String(rowNumber)] || '').trim().toUpperCase();
            if (!targetAns) continue;

            const row = validRows[rIdx];
            let targetButton = null;

            // 1. Khớp theo ký tự cột A, B, C, D
            if (['A', 'B', 'C', 'D'].includes(targetAns)) {
                const colIdx = targetAns.charCodeAt(0) - 65;
                if (row.buttons[colIdx]) {
                    targetButton = row.buttons[colIdx];
                }
            }

            // 2. Khớp theo từ ngữ trong nút
            if (!targetButton) {
                targetButton = row.buttons.find(b => b.text.toLowerCase().includes(targetAns.toLowerCase()));
            }

            // 3. Khớp tiền tố nút
            if (!targetButton) {
                targetButton = row.buttons.find(b => b.text.trim().startsWith(targetAns));
            }

            if (targetButton) {
                clickCocosNode(targetButton.node);
                console.log(`[YANZIOE Cocos] Đã chọn Hàng ${rowNumber} [${targetAns}]: ${targetButton.text}`);
                await IOE.delay?.(280);
            }
        }

        IOE.toast('🎉 Đã tự động điền xong toàn bộ đoạn văn Cloze Test!', 2000);
        return true;
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
        // Gửi phím Enter kết thúc
        target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        target.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    }

    /* ================= 4. UNIFIED CANVAS SOLVER ================= */
    async function solveCanvasGame() {
        const cocosScene = getCocosScene();
        if (cocosScene) {
            const clickables = findCocosClickables(cocosScene);

            // Bấm START / OK nếu đang ở màn hình hướng dẫn ban đầu
            for (const c of clickables) {
                const t = c.text.toLowerCase();
                if (t === 'ok' || t === 'start' || t.includes('bắt đầu')) {
                    clickCocosNode(c.node);
                    IOE.toast('🚀 Bắt đầu bài thi Cocos2d!', 1200);
                    await IOE.delay?.(800);
                    break;
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
