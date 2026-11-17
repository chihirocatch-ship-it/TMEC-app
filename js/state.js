export const CONFIG = {
    DEFAULT_IMG_URL: "https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=1920&q=80",
    BORED_LABELS: ["😪 よそ見中！", "📱 退屈そう...", "🥱 あくび中...", "💭 ぼーっと..."],
    NEAR_RADIUS_RATIO: 0.22,
    FARTHEST_PENALTY: 1.5,
    DEADZONE: 0.008,
    DWELL_START_MS: 1200,
    RECOVER_DIRECT_SPEAKING: 9.6,
    RECOVER_DIRECT_SILENT: 6.4,
    RECOVER_NEAR_SPEAKING: 2.4,
    RECOVER_NEAR_SILENT: 1.6
};

export const state = {
    currentStep: 1,
    mode: 'wizard', // 'wizard' | 'calib' | 'practice' | 'result'
    selectedImgUrl: CONFIG.DEFAULT_IMG_URL,

    // 正規化座標 [{ nx, ny, nw, nh }]
    targetBoxes: [],
    // 本番用の観客データ
    audienceMembers: [],

    // スコア集計
    rescueCount: 0,
    attentionSum: 0,
    attentionTicks: 0,

    // 音声状態
    isSpeakingNow: false,

    // 視線・感度パラメータ
    sensX: 4.5,
    sensY: 10.0,
    smoothingFactor: 0.85,
    smoothedX: 0.5,
    smoothedY: 0.5,
    pointerX: null,
    pointerY: null
};