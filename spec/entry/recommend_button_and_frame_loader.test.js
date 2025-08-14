// spec/javascripts/entry/recommend_button_and_frame_loader.test.js
/**
 * 対象: app/javascript/application.js
 * 確認:
 *  - #show-recommendations-btn クリックで localStorage.hpPercentage が数値なら /emotion_logs?hp=xx に遷移
 *  - hp が NaN/未設定なら alert が出る
 *  - turbo:frame-load で #loading-overlay が非表示になる
 */

jest.mock("../../../app/javascript/custom/register_service_worker", () => ({
  registerServiceWorker: jest.fn(),
}));
jest.mock("../../../app/javascript/custom/push_subscription", () => ({
  subscribeToPushNotifications: jest.fn().mockResolvedValue(undefined),
}));

// ESM由来のエラー回避モック
jest.mock("@hotwired/turbo-rails", () => ({}), { virtual: true });
jest.mock("@rails/ujs", () => ({ __esModule: true, default: { start: () => {} } }));
jest.mock("bootstrap", () => ({
  __esModule: true,
  Modal: class {
    static getInstance() { return null; }
    static getOrCreateInstance() { return { show() {}, hide() {}, dispose() {} }; }
  }
}));

// 相対URL→絶対URLへ直す location スタブ（JSDOM用）
function stubLocationWithBase(base = "https://example.com") {
  let _href = `${base}/`;
  const loc = {
    get href() { return _href; },
    set href(val) {
      if (typeof val === "string" && /^https?:\/\//i.test(val)) _href = val;
      else if (typeof val === "string" && val.startsWith("/")) _href = `${base}${val}`;
      else _href = `${base}/${val || ""}`;
    },
    assign(val) { this.href = val; },
    replace(val) { this.href = val; },
    reload: jest.fn(),
    toString() { return this.href; },
    origin: base,
  };
  Object.defineProperty(window, "location", { value: loc, writable: true });
}

describe("application.js - おすすめボタン & frame-loader", () => {
  beforeEach(async () => {
    jest.resetModules();
    document.body.innerHTML = `
      <button id="show-recommendations-btn" type="button">おすすめ</button>
      <div id="loading-overlay" class="view-hidden"></div>
      <!-- Turbo Frame が読み込まれるイメージ（DOMは特に不要だが、イベント発火のため一応） -->
      <turbo-frame id="dummy-frame"></turbo-frame>
    `;
    stubLocationWithBase("https://example.com");
    window.isLoggedIn = false; // このテストではPush購読は無関係
    jest.spyOn(window, "alert").mockImplementation(() => {});
    await import("../../../app/javascript/application.js");
  });

  afterEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    document.body.innerHTML = "";
  });

  test("#show-recommendations-btn クリック: hpがあれば /emotion_logs?hp=xx へ", () => {
    localStorage.setItem("hpPercentage", "64");
    const btn = document.getElementById("show-recommendations-btn");
    btn.click();
    expect(window.location.href).toBe("https://example.com/emotion_logs?hp=64");
    expect(window.alert).not.toHaveBeenCalled();
  });

  test("#show-recommendations-btn クリック: hpがNaN/未設定なら alert", () => {
    localStorage.setItem("hpPercentage", "not-a-number");
    const btn = document.getElementById("show-recommendations-btn");
    btn.click();
    expect(window.alert).toHaveBeenCalledWith(
      "HPゲージの値が取得できませんでした（localStorageに保存されていません）"
    );
  });

  test("turbo:frame-load で loading-overlay を非表示にする", () => {
    const loader = document.getElementById("loading-overlay");
    // まず表示状態にしておく
    loader.classList.remove("view-hidden");

    // application.js は document に turbo:frame-load を登録しているので、発火させる
    const ev = new CustomEvent("turbo:frame-load", { bubbles: true, cancelable: true });
    document.dispatchEvent(ev);

    expect(loader).toHaveClass("view-hidden");
  });
});
