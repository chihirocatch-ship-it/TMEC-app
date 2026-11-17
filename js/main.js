import { state } from './state.js';
import {
    loadFaceModel,
    loadImageElement,
    runFaceDetection,
    clearAllTargets,
    renderSetupBoxes,
    bindSetupLayerClick
} from './faceSetup.js';
import { initGazeTracker, startCameraIfNeeded } from './gazeTracker.js';
import { initSpeech, startSpeech, stopSpeech } from './speech.js';
import {
    initAudienceMembers,
    positionPracticeBoxes,
    startAttentionLoop,
    stopAttentionLoop
} from './attention.js';

// DOM参照
const step2PreviewImg = document.getElementById('step2PreviewImg');
const setupImg = document.getElementById('setupImg');
const setupStage = document.getElementById('setupStage');
const setupTargetsLayer = document.getElementById('setupTargetsLayer');
const audienceImg = document.getElementById('audienceImg');
const stageArea = document.getElementById('stageArea');
const targetsContainer = document.getElementById('targetsContainer');
const videoElement = document.getElementById('videoElement');
const calibVideo = document.getElementById('calibVideo');
const gazePointer = document.getElementById('gazePointer');
const toStep3Btn = document.getElementById('toStep3Btn');

// --- 初期化 ---
initGazeTracker(videoElement, calibVideo, gazePointer, startPractice);
initSpeech();
bindSetupLayerClick(setupImg, setupStage, setupTargetsLayer);

loadFaceModel(() => {
    toStep3Btn.disabled = false;
    toStep3Btn.innerText = "次へ（AIで顔を設定） ▶";
});

// --- ステップ遷移 ---
async function goToStep(stepNum) {
    if (stepNum === 4 && state.targetBoxes.length === 0) {
        alert("少なくとも1人は観客の枠を設定してください（写真をクリックすると追加できます）。");
        return;
    }

    state.currentStep = stepNum;
    for (let i = 1; i <= 4; i++) {
        document.getElementById(`step-${i}`).classList.toggle('active', i === stepNum);
        const ind = document.getElementById(`ind-${i}`);
        ind.classList.remove('active', 'done');
        if (i === stepNum) ind.classList.add('active');
        else if (i < stepNum) ind.classList.add('done');
    }

    if (stepNum === 3) {
        state.mode = 'wizard';
        gazePointer.style.display = 'none';
        await loadImageElement(setupImg, state.selectedImgUrl);
        if (state.targetBoxes.length === 0) {
            await runFaceDetection(setupImg, setupStage, setupTargetsLayer);
        } else {
            renderSetupBoxes(setupImg, setupStage, setupTargetsLayer);
        }
    } else if (stepNum === 4) {
        state.mode = 'calib';
        document.getElementById('sumChars').innerText = document.getElementById('inputScript').value.trim().length;
        document.getElementById('sumPeople').innerText = state.targetBoxes.length;
        startCameraIfNeeded(videoElement, calibVideo);
    } else {
        state.mode = 'wizard';
        gazePointer.style.display = 'none';
    }
}

// --- 本番開始＆終了 ---
async function startPractice() {
    if (state.mode === 'starting' || state.mode === 'practice') return; // 追加
    state.mode = 'starting'; // 追加
    
    document.getElementById('scriptText').innerText = document.getElementById('inputScript').value;
    document.getElementById('wizardContainer').style.display = 'none';
    document.getElementById('topBar').style.display = 'flex';
    document.getElementById('stageArea').style.display = 'block';
    document.getElementById('prompter').style.display = 'block';

    await loadImageElement(audienceImg, state.selectedImgUrl);
    initAudienceMembers(audienceImg, stageArea, targetsContainer);

    state.mode = 'practice';
    state.rescueCount = 0;
    state.attentionSum = 0;
    state.attentionTicks = 0;

    startAttentionLoop();
    startSpeech();
}

function finishPractice() {
    state.mode = 'result';
    stopAttentionLoop();
    stopSpeech();

    document.getElementById('topBar').style.display = 'none';
    document.getElementById('stageArea').style.display = 'none';
    gazePointer.style.display = 'none';

    const finalAvg = state.attentionTicks > 0 ? Math.round(state.attentionSum / state.attentionTicks) : 0;

    let rank = 'C', feedback = '', color = '#ff3939';
    if (finalAvg >= 80 && state.rescueCount >= 3) {
        rank = 'S'; color = '#39ff14';
        feedback = '圧巻の会場掌握力です！退屈になりそうな観客を素早く察知し、常に高い集中度を維持できていました。';
    } else if (finalAvg >= 70) {
        rank = 'A'; color = '#ffd700';
        feedback = '素晴らしいアイコンタクトです。会場全体にまんべんなく視線が届いており、引き戻しもスムーズでした。';
    } else if (finalAvg >= 50) {
        rank = 'B'; color = '#ff9900';
        feedback = 'まずまずの安定感です！赤く点滅する前の「黄色（そわそわ）」の段階で視線を配ると、さらにプロらしくなります。';
    } else {
        feedback = '一部のエリアや原稿に視線が偏ってしまったようです。退屈そうな人を見つけてこまめに視線を配る練習を続けましょう！';
    }

    const rankEl = document.getElementById('resultRank');
    rankEl.innerText = rank;
    rankEl.style.color = color;
    document.getElementById('resultStats').innerHTML =
        `会場の平均集中度: <strong style="color:${color};">${finalAvg}%</strong><br>` +
        `退屈から引き戻した人数: <strong style="color:#39ff14;">${state.rescueCount}人</strong>`;
    document.getElementById('resultFeedback').innerText = feedback;
    document.getElementById('resultScreen').style.display = 'flex';
}

// --- スライダー同期 ---
function syncSliders(sx, sy, sm) {
    state.sensX = sx;
    state.sensY = sy;
    state.smoothingFactor = sm / 100;

    ['calibSensX', 'sensXSlider'].forEach(id => document.getElementById(id).value = sx);
    ['calibSensXVal', 'sensXValue'].forEach(id => document.getElementById(id).innerText = sx.toFixed(1));
    ['calibSensY', 'sensYSlider'].forEach(id => document.getElementById(id).value = sy);
    ['calibSensYVal', 'sensYValue'].forEach(id => document.getElementById(id).innerText = sy.toFixed(1));
    ['calibSmooth', 'smoothSlider'].forEach(id => document.getElementById(id).value = sm);
    ['calibSmoothVal', 'smoothValue'].forEach(id => document.getElementById(id).innerText = sm);
}

// --- イベント登録 ---
document.querySelectorAll('[data-goto-step]').forEach(btn => {
    btn.addEventListener('click', () => goToStep(Number(btn.dataset.gotoStep)));
});

document.getElementById('bgImageInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        state.selectedImgUrl = URL.createObjectURL(file);
        step2PreviewImg.src = state.selectedImgUrl;
        state.targetBoxes = [];
    }
});

document.getElementById('redetectBtn').addEventListener('click', () => {
    runFaceDetection(setupImg, setupStage, setupTargetsLayer);
});
document.getElementById('clearTargetsBtn').addEventListener('click', () => {
    clearAllTargets(setupImg, setupStage, setupTargetsLayer);
});
document.getElementById('startPracticeBtn').addEventListener('click', startPractice);
document.getElementById('finishBtn').addEventListener('click', finishPractice);
document.getElementById('restartBtn').addEventListener('click', () => location.reload());

['calibSensX', 'sensXSlider'].forEach(id => {
    document.getElementById(id).addEventListener('input', e =>
        syncSliders(parseFloat(e.target.value), state.sensY, Math.round(state.smoothingFactor * 100))
    );
});
['calibSensY', 'sensYSlider'].forEach(id => {
    document.getElementById(id).addEventListener('input', e =>
        syncSliders(state.sensX, parseFloat(e.target.value), Math.round(state.smoothingFactor * 100))
    );
});
['calibSmooth', 'smoothSlider'].forEach(id => {
    document.getElementById(id).addEventListener('input', e =>
        syncSliders(state.sensX, state.sensY, parseInt(e.target.value))
    );
});

window.addEventListener('resize', () => {
    if (state.currentStep === 3 && state.mode === 'wizard') {
        renderSetupBoxes(setupImg, setupStage, setupTargetsLayer);
    }
    if (state.mode === 'practice') {
        positionPracticeBoxes(audienceImg, stageArea);
    }
});