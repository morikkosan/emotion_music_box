// spec/javascripts/globals/go_to_recommended_and_hpbar.test.js
/**
 * 対象:
 *  - window.goToRecommended (application.js内のグローバル)
 *  - （任意）window.updateHPBar (custom/gages_test にあるなら import して検証)
 *
 * 注意:
 *  - application.js の ESM依存（@hotwired/turbo-rails 等）はスタブに差し替える
 *  - JSDOMでは window.location.href に相対パスを代入すると Invalid URL になるため、
 *    テスト内で location の setter を相対→絶対へ変換するスタブを用意する
 */

// ---- 外部依存のスタブ（moduleNameMapper 済みでも安全のためここでも重ねておく）----
jest.mock("@hotwired/turbo-rails", () => ({}), { virtual: true });
jest.mock("@rails/ujs", () => ({ __esModule: true, default: { start: () => {} } }));
jest.mock("bootstrap", () => ({
  __esModule: true,
  Modal: class {
    static getInstance() { return null; }
    static getOrCreateInstance() { return { show() {}, hide() {} }; }
  }
}));

jest.mock("../../../app/javascript/custom/register_service_worker", () => ({
  registerServiceWorker: jest.fn(),
}));
jest.mock("../../../app/javascript/custom/push_subscription", () => ({
  subscribeToPushNotifications: jest.fn().mockResolvedValue(undefined),
}));

// 相対URLを絶対に直す location スタブ
function stubLocationWithBase(base = "https://example.com") {
  let _href = `${base}/`;
  const loc = {
    get href() { return _href; },
    set href(val) {
      if (typeof val === "string" && /^https?:\/\//i.test(val)) {
        _href = val;
      } else if (typeof val === "string" && val.startsWith("/")) {
        _href = `${base}${val}`;
      } else {
        _href = `${base}/${val || ""}`;
      }
    },
    assign(val) { this.href = val; },
    replace(val) { this.href = val; },
    reload: jest.fn(),
    toString() { return this.href; },
    origin: base,
  };
  Object.defineProperty(window, "location", { value: loc, writable: true });
}

describe("window.goToRecommended / window.updateHPBar", () => {
  beforeEach(async () => {
    jest.resetModules();

    // DOMセットアップ
    document.body.innerHTML = `
      <div id="loading-overlay" class="view-hidden"></div>

      <!-- HPバー関連（実装に合わせて増減OK） -->
      <div id="hp-bar" data-width=""></div>
      <p id="hp-status-text"></p>
      <span id="bar-width-display"></span>
      <span id="bar-width-display-mobile"></span>
    `;

    // 相対URL代入で落ちないように location をスタブ
    stubLocationWithBase("https://example.com");

    // Push二重呼び出しを避けるため isLoggedIn=false（このテストでは不要）
    window.isLoggedIn = false;

    // ★ ここが重要：毎テストで window.alert をモック（JSDOMで安定）
    window.alert = jest.fn();

    // application.js を読み込む（上のモック＆locationスタブが効いた状態で）
    await import("../../../app/javascript/application.js");
  });

  afterEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test("goToRecommended: localStorageにhpがあると /emotion_logs/recommended?hp=xx へ遷移", () => {
    localStorage.setItem("hpPercentage", "55");
    expect(typeof window.goToRecommended).toBe("function");

    window.goToRecommended();

    expect(window.location.href).toBe("https://example.com/emotion_logs/recommended?hp=55");
    expect(window.alert).not.toHaveBeenCalled();
  });

  test("goToRecommended: hpが無い/NaNなら alert", () => {
    // NaNケース
    localStorage.setItem("hpPercentage", "not-a-number");

    window.goToRecommended();

    expect(window.alert).toHaveBeenCalledWith(
      "HPゲージの値が取得できませんでした（localStorageに保存されていません）"
    );
  });

  /**
   * （任意）updateHPBar の検証
   * 実装が app/javascript/custom/gages_test.js にある前提。
   * ここでは幅やテキストが更新されることを確認する最小テスト。
   * 色や文言の厳密な期待値は、あなたの実装に合わせて追加してください。
   */
  test("updateHPBar: 幅・表示テキストが反映される（最小確認）", async () => {
    let mod;
    try {
      mod = await import("../../../app/javascript/custom/gages_test");
    } catch {
      return; // 実装が無ければスキップ
    }

    localStorage.setItem("hpPercentage", "50");
    expect(typeof window.updateHPBar).toBe("function");

    window.updateHPBar();

    const hpBar = document.getElementById("hp-bar");
    const w1 = document.getElementById("bar-width-display");
    const w2 = document.getElementById("bar-width-display-mobile");

    expect(hpBar.style.width).toBe("50%");
    expect(hpBar.dataset.width).toBe("50%");
    if (w1) expect(w1.textContent).toBe("50%");
    if (w2) expect(w2.textContent).toBe("50%");
  });
});
