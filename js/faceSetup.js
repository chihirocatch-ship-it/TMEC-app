import { state } from './state.js';

let faceDetector = null;

export async function loadFaceModel(onLoaded) {
    faceDetector = await window.blazeface.load();
    if (onLoaded) onLoaded();
}

export function loadImageElement(imgEl, url) {
    return new Promise((resolve) => {
        if (imgEl.src === url && imgEl.complete && imgEl.naturalWidth > 0) {
            resolve();
            return;
        }
        imgEl.onload = () => resolve();
        imgEl.src = url;
    });
}

export function getImageRenderRect(imgEl, containerEl) {
    const cRect = containerEl.getBoundingClientRect();
    const imgW = imgEl.naturalWidth || cRect.width;
    const imgH = imgEl.naturalHeight || cRect.height;
    const imgRatio = imgW / imgH;
    const cRatio = cRect.width / cRect.height;

    let renderW, renderH, offsetX, offsetY;
    if (imgRatio > cRatio) {
        renderW = cRect.width;
        renderH = cRect.width / imgRatio;
        offsetX = 0;
        offsetY = (cRect.height - renderH) / 2;
    } else {
        renderH = cRect.height;
        renderW = cRect.height * imgRatio;
        offsetX = (cRect.width - renderW) / 2;
        offsetY = 0;
    }
    return { renderW, renderH, offsetX, offsetY, imgW, imgH };
}

export async function runFaceDetection(setupImg, setupStage, setupTargetsLayer) {
    const badge = document.getElementById('faceCountBadge');
    badge.innerText = "🔍 AIで顔を抽出中...";
    state.targetBoxes = [];
    renderSetupBoxes(setupImg, setupStage, setupTargetsLayer);

    await new Promise(r => setTimeout(r, 100));
    const imgW = setupImg.naturalWidth;
    const imgH = setupImg.naturalHeight;

    try {
        const predictions = await faceDetector.estimateFaces(setupImg, false);
        predictions.forEach(p => {
            const [x1, y1] = p.topLeft;
            const [x2, y2] = p.bottomRight;
            const fw = x2 - x1;
            const fh = y2 - y1;
            const nx = Math.max(0, (x1 - fw * 0.25) / imgW);
            const ny = Math.max(0, (y1 - fh * 0.35) / imgH);
            const nw = Math.min(1 - nx, (fw * 1.5) / imgW);
            const nh = Math.min(1 - ny, (fh * 1.9) / imgH);
            state.targetBoxes.push({ nx, ny, nw, nh });
        });
    } catch (e) {
        console.error("顔検出エラー:", e);
    }

    renderSetupBoxes(setupImg, setupStage, setupTargetsLayer);
}

export function clearAllTargets(setupImg, setupStage, setupTargetsLayer) {
    state.targetBoxes = [];
    renderSetupBoxes(setupImg, setupStage, setupTargetsLayer);
}

export function renderSetupBoxes(setupImg, setupStage, setupTargetsLayer) {
    setupTargetsLayer.innerHTML = '';
    const r = getImageRenderRect(setupImg, setupStage);

    state.targetBoxes.forEach((b, idx) => {
        const el = document.createElement('div');
        el.className = 'person-box editable';
        el.style.left = `${r.offsetX + b.nx * r.renderW}px`;
        el.style.top = `${r.offsetY + b.ny * r.renderH}px`;
        el.style.width = `${Math.max(45, b.nw * r.renderW)}px`;
        el.style.height = `${Math.max(60, b.nh * r.renderH)}px`;

        el.addEventListener('click', (e) => {
            e.stopPropagation();
            state.targetBoxes.splice(idx, 1);
            renderSetupBoxes(setupImg, setupStage, setupTargetsLayer);
        });
        setupTargetsLayer.appendChild(el);
    });

    document.getElementById('faceCountBadge').innerText = `現在 ${state.targetBoxes.length}人 を設定中`;
    document.getElementById('toStep4Btn').disabled = (state.targetBoxes.length === 0);
}

export function bindSetupLayerClick(setupImg, setupStage, setupTargetsLayer) {
    setupTargetsLayer.addEventListener('click', (e) => {
        const rect = setupTargetsLayer.getBoundingClientRect();
        const r = getImageRenderRect(setupImg, setupStage);
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        if (clickX >= r.offsetX && clickX <= r.offsetX + r.renderW && clickY >= r.offsetY && clickY <= r.offsetY + r.renderH) {
            const nw = 0.09, nh = 0.16;
            const nx = Math.max(0, Math.min(1 - nw, (clickX - r.offsetX) / r.renderW - nw / 2));
            const ny = Math.max(0, Math.min(1 - nh, (clickY - r.offsetY) / r.renderH - nh / 2));
            state.targetBoxes.push({ nx, ny, nw, nh });
            renderSetupBoxes(setupImg, setupStage, setupTargetsLayer);
        }
    });
}