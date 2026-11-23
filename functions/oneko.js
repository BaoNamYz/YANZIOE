(function (global) {
    'use strict';
    let nekoEl = null;
    let nekoX = 32, nekoY = 32, mouseX = 0, mouseY = 0, frameCount = 0;

    function initOneko() {
        if (nekoEl) return;
        nekoEl = document.createElement('div');
        nekoEl.id = 'yanz-oneko';
        nekoEl.style.cssText = 'width:32px;height:32px;position:fixed;pointer-events:none;z-index:9999998;image-rendering:pixelated;display:none;';
        nekoEl.innerHTML = '<span style="font-size:24px;">🐱</span>';
        document.body.appendChild(nekoEl);

        window.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        function frame() {
            if (global.IOE?.features?.oneko && nekoEl) {
                nekoEl.style.display = 'block';
                const diffX = mouseX - nekoX;
                const diffY = mouseY - nekoY;
                const dist = Math.hypot(diffX, diffY);
                if (dist > 10) {
                    nekoX += (diffX / dist) * 4;
                    nekoY += (diffY / dist) * 4;
                }
                nekoEl.style.left = `${nekoX - 16}px`;
                nekoEl.style.top = `${nekoY - 16}px`;
            } else if (nekoEl) {
                nekoEl.style.display = 'none';
            }
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    if (global.IOE?.onBodyReady) {
        global.IOE.onBodyReady(initOneko);
    } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initOneko);
    } else {
        initOneko();
    }
})(typeof window !== 'undefined' ? window : globalThis);
