import { CONFIG, state } from './state.js';

let isCameraStarted = false;
let faceMesh = null;
let onStartTriggerCallback = null;
let dwellStartTime = null;

export function initGazeTracker(videoElement, calibVideo, gazePointer, onStartTrigger) {
    onStartTriggerCallback = onStartTrigger;
    faceMesh = new window.FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });
    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    faceMesh.onResults((results) => handleFaceResults(results, gazePointer));
}

export function startCameraIfNeeded(videoElement, calibVideo) {
    if (isCameraStarted) return;
    isCameraStarted = true;

    const camera = new window.Camera(videoElement, {
        onFrame: async () => { await faceMesh.send({ image: videoElement }); },
        width: 1280,
        height: 720
    });
    camera.start().then(() => {
        calibVideo.srcObject = videoElement.srcObject;
        document.getElementById('sumCamera').innerText = "✅ 準備OK（トラッキング中）";
    });
}

function resetStartButtonDwell() {
    dwellStartTime = null;
    const startBtn = document.getElementById('startPracticeBtn');
    if (startBtn) {
        startBtn.style.setProperty('--dwell-progress', '0%');
        startBtn.classList.remove('gaze-hover');
    }
}

function handleStartButtonDwell(screenX, screenY) {
    const startBtn = document.getElementById('startPracticeBtn');
    if (!startBtn) return;

    const rect = startBtn.getBoundingClientRect();
    const isHit = (
        screenX >= rect.left &&
        screenX <= rect.right &&
        screenY >= rect.top &&
        screenY <= rect.bottom
    );

    if (isHit) {
        if (dwellStartTime === null) {
            dwellStartTime = performance.now();
        }
        const elapsed = performance.now() - dwellStartTime;
        const progress = Math.min(100, (elapsed / CONFIG.DWELL_START_MS) * 100);

        startBtn.style.setProperty('--dwell-progress', `${progress}%`);
        startBtn.classList.add('gaze-hover');

        if (elapsed >= CONFIG.DWELL_START_MS) {
            resetStartButtonDwell();
            if (onStartTriggerCallback) onStartTriggerCallback();
        }
    } else {
        resetStartButtonDwell();
    }
}

function handleFaceResults(results, gazePointer) {
    if (state.mode !== 'calib' && state.mode !== 'practice') return;

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        const leftEye = landmarks[33], rightEye = landmarks[263], nose = landmarks[1];
        const topHead = landmarks[10], bottomChin = landmarks[152];

        const faceWidth = Math.abs(rightEye.x - leftEye.x);
        const faceHeight = Math.abs(bottomChin.y - topHead.y);
        const midEyeX = (leftEye.x + rightEye.x) / 2;
        const midEyeY = (leftEye.y + rightEye.y) / 2;

        const ratioX = (nose.x - midEyeX) / faceWidth;
        const ratioY = (nose.y - midEyeY) / faceHeight;

        const rawX = Math.max(0, Math.min(1, 0.5 - (ratioX * state.sensX)));
        const rawY = Math.max(0, Math.min(1, 0.5 + ((ratioY - 0.25) * state.sensY)));

        const alpha = 1.0 - state.smoothingFactor;
        if (Math.abs(rawX - state.smoothedX) > CONFIG.DEADZONE) {
            state.smoothedX += (rawX - state.smoothedX) * alpha;
        }
        if (Math.abs(rawY - state.smoothedY) > CONFIG.DEADZONE) {
            state.smoothedY += (rawY - state.smoothedY) * alpha;
        }

        const screenX = state.smoothedX * window.innerWidth;
        const screenY = state.smoothedY * window.innerHeight;
        state.pointerX = screenX;
        state.pointerY = screenY;

        gazePointer.style.display = "block";
        gazePointer.style.left = `${screenX}px`;
        gazePointer.style.top = `${screenY}px`;

        if (state.mode === 'calib') {
            handleStartButtonDwell(screenX, screenY);
        } else if (state.mode === 'practice') {
            state.audienceMembers.forEach(m => {
                const rect = m.el.getBoundingClientRect();
                const hit = (screenX >= rect.left && screenX <= rect.right && screenY >= rect.top && screenY <= rect.bottom);
                m.isLookedAt = hit;
                m.el.classList.toggle('looking-at', hit);
            });
        }
    } else if (state.mode === 'calib') {
        resetStartButtonDwell();
    } else if (state.mode === 'practice') {
        state.audienceMembers.forEach(m => {
            m.isLookedAt = false;
            m.el.classList.remove('looking-at');
        });
    }
}