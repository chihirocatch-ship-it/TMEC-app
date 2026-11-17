import { CONFIG, state } from './state.js';
import { getImageRenderRect } from './faceSetup.js';

let attentionLoopTimer = null;

export function initAudienceMembers(audienceImg, stageArea, targetsContainer) {
    targetsContainer.innerHTML = '';
    state.audienceMembers = [];

    state.targetBoxes.forEach((b, idx) => {
        const el = document.createElement('div');
        el.className = 'person-box state-engaged';

        const badgeEl = document.createElement('div');
        badgeEl.className = 'mood-badge';
        badgeEl.innerText = "🙂 集中";

        const barWrap = document.createElement('div');
        barWrap.className = 'attention-bar-wrap';
        const barEl = document.createElement('div');
        barEl.className = 'attention-bar';
        barWrap.appendChild(barEl);

        el.appendChild(badgeEl);
        el.appendChild(barWrap);
        targetsContainer.appendChild(el);

        const initialAtt = 65 + Math.random() * 35;
        const baseDecay = Math.max(1.8, 4.2 - state.targetBoxes.length * 0.15);
        const decayRate = baseDecay + Math.random() * 1.8;

        state.audienceMembers.push({
            box: b,
            el,
            badgeEl,
            barEl,
            attention: initialAtt,
            decayRate,
            wasBored: false,
            isLookedAt: false,
            boredLabel: CONFIG.BORED_LABELS[idx % CONFIG.BORED_LABELS.length]
        });
    });

    positionPracticeBoxes(audienceImg, stageArea);
}

export function positionPracticeBoxes(audienceImg, stageArea) {
    const r = getImageRenderRect(audienceImg, stageArea);
    state.audienceMembers.forEach(m => {
        m.el.style.left = `${r.offsetX + m.box.nx * r.renderW}px`;
        m.el.style.top = `${r.offsetY + m.box.ny * r.renderH}px`;
        m.el.style.width = `${Math.max(60, m.box.nw * r.renderW)}px`;
        m.el.style.height = `${Math.max(75, m.box.nh * r.renderH)}px`;
    });
}

export function startAttentionLoop() {
    stopAttentionLoop();
    attentionLoopTimer = setInterval(updateAttentionLoop, 100);
}

export function stopAttentionLoop() {
    clearInterval(attentionLoopTimer);
}

function updateAttentionLoop() {
    if (state.mode !== 'practice' || state.audienceMembers.length === 0) return;

    const statusText = document.getElementById('statusText');
    let totalAtt = 0;
    let boredCount = 0;
    const nearRadius = window.innerWidth * CONFIG.NEAR_RADIUS_RATIO;

    let farthestMember = null;
    let maxDist = -1;

    const distances = state.audienceMembers.map(m => {
        if (state.pointerX === null || state.pointerY === null) return Infinity;
        const rect = m.el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.hypot(cx - state.pointerX, cy - state.pointerY);

        if (!m.isLookedAt && dist > nearRadius && dist > maxDist) {
            maxDist = dist;
            farthestMember = m;
        }
        return dist;
    });

    state.audienceMembers.forEach((m, idx) => {
        const dist = distances[idx];
        const isNear = !m.isLookedAt && dist <= nearRadius;

        if (m.isLookedAt) {
            const recoverSpeed = state.isSpeakingNow ? CONFIG.RECOVER_DIRECT_SPEAKING : CONFIG.RECOVER_DIRECT_SILENT;
            m.attention = Math.min(100, m.attention + recoverSpeed);

            if (m.wasBored && m.attention >= 85) {
                m.wasBored = false;
                state.rescueCount++;
                statusText.innerText = `🎯 視線で引き戻し成功！ (計 ${state.rescueCount}人)`;
                statusText.style.background = "rgba(57, 255, 20, 0.35)";
            }
        } else if (isNear) {
            const nearRecover = state.isSpeakingNow ? CONFIG.RECOVER_NEAR_SPEAKING : CONFIG.RECOVER_NEAR_SILENT;
            m.attention = Math.min(100, m.attention + nearRecover);
        } else {
            const penalty = (m === farthestMember) ? CONFIG.FARTHEST_PENALTY : 1.0;
            m.attention = Math.max(0, m.attention - (m.decayRate * penalty * 0.1));
            if (m.attention < 40) m.wasBored = true;
        }

        totalAtt += m.attention;

        m.el.classList.remove('state-engaged', 'state-fading', 'state-bored');
        m.barEl.style.width = `${Math.round(m.attention)}%`;

        if (m.isLookedAt) {
            m.el.classList.add('state-engaged');
            m.badgeEl.innerText = m.attention >= 85 ? "😊 注目中！" : "👀 こっちを見た！";
            m.barEl.style.backgroundColor = "#39ff14";
        } else if (isNear) {
            m.el.classList.add('state-engaged');
            m.badgeEl.innerText = "🙂 じわじわ回復";
            m.barEl.style.backgroundColor = "#7dff66";
        } else if (m.attention >= 70) {
            m.el.classList.add('state-engaged');
            m.badgeEl.innerText = "🙂 集中";
            m.barEl.style.backgroundColor = "#39ff14";
        } else if (m.attention >= 40) {
            m.el.classList.add('state-fading');
            m.badgeEl.innerText = "😐 そわそわ...";
            m.barEl.style.backgroundColor = "#ffcc00";
        } else {
            m.el.classList.add('state-bored');
            m.badgeEl.innerText = m.boredLabel;
            m.barEl.style.backgroundColor = "#ff3b3b";
            boredCount++;
        }
    });

    const avgAtt = Math.round(totalAtt / state.audienceMembers.length);
    state.attentionSum += avgAtt;
    state.attentionTicks++;

    const fill = document.getElementById('roomMeterFill');
    const text = document.getElementById('roomMeterText');
    fill.style.width = `${avgAtt}%`;
    text.innerText = `${avgAtt}%`;
    fill.style.backgroundColor = avgAtt >= 70 ? "#39ff14" : (avgAtt >= 45 ? "#ffcc00" : "#ff3b3b");

    if (boredCount > 0 && !state.audienceMembers.some(m => m.isLookedAt && m.wasBored)) {
        statusText.innerText = `⚠️ ${boredCount}人が退屈そうにしています！視線を向けよう`;
        statusText.style.background = "rgba(255, 59, 59, 0.35)";
    } else if (boredCount === 0) {
        statusText.innerText = `✨ 全員が集中しています！ (引き戻し: ${state.rescueCount}人)`;
        statusText.style.background = "rgba(255, 255, 255, 0.1)";
    }
}