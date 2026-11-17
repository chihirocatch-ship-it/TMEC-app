import { state } from './state.js';

let recognition = null;
let speakingTimeout = null;

export function initSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
        if (state.mode !== 'practice') return;
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            const out = document.getElementById('recognizedText');
            if (event.results[i].isFinal) out.innerText = "🗣️ " + transcript;
            else out.innerText = "🎙️ " + interimTranscript + transcript;
        }
        state.isSpeakingNow = true;
        clearTimeout(speakingTimeout);
        speakingTimeout = setTimeout(() => { state.isSpeakingNow = false; }, 1200);
    };

    recognition.onerror = (e) => console.log("音声認識エラー:", e);
    recognition.onend = () => {
        if (state.mode === 'practice') {
            try { recognition.start(); } catch (e) {}
        }
    };
}

export function startSpeech() {
    if (recognition) {
        try { recognition.start(); } catch (e) {}
    }
}

export function stopSpeech() {
    if (recognition) {
        try { recognition.stop(); } catch (e) {}
    }
}