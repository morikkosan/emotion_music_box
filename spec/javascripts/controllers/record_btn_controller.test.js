// spec/javascripts/controllers/record_btn_controller.test.js
/**
 * 目的:
 *  - application.js のローディング制御やイベント (turbo:visit / turbo:load / MutationObserver)
 *    と、record_btn_controller（Stimulus）の挙動が一緒に動いても競合しないことを検証。
 *  - コントローラは「hide() で d-none 付与」「hidden.bs.modal / turbo:load で d-none 除去」
 *    を実装している前提（あなたの実装のまま）。
 *
 * 注意:
 *  - プロダクションの controller にテスト用コードは一切いりません。
 *    ここ（テスト側）で import して、手動でインスタンス化して connect() します。
 */

// ---- 外部依存を安全側でモック（ESM由来のエラー回避）----

// ★ ここが今回の修正ポイント：Stimulus の Application.start をモックして返す
jest.mock("@hotwired/stimulus", () => {
  const register = jest.fn();
  const fakeApp = { register };
  return {
    __esModule: true,
    Controller: class {},
    Application: {
      start: jest.fn(() => fakeApp),
    },
  };
});

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

// 相対URLを絶対に直す location スタブ（JSDOM向け）
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

describe("integration: application.js × record_btn_controller", () => {
  let ControllerClass;
  let controllerInstance;
  let targetEl;

  beforeEach(async () => {
    jest.resetModules();

    document.body.innerHTML = `
      <div id="loading-overlay" class="view-hidden"></div>
      <!-- Stimulusコントローラを当てる対象要素（初期は非表示にしておく想定） -->
      <div id="record-btn-target" class="d-none"></div>
    `;

    stubLocationWithBase("https://example.com");
    window.isLoggedIn = false;     // Push購読は今回不要
    window.alert = jest.fn();      // 念のため alert をモック

    // application.js を副作用読み込み（イベントリスナ等が登録される）
    await import("../../../app/javascript/application.js");

    // ★ あなたの実ファイルパスに合わせてこの import を確認してください
    //    例: app/javascript/controllers/record_btn_controller.js（そのままでOKなら変更不要）
    ControllerClass = (await import("../../../app/javascript/controllers/record_btn_controller.js")).default;

    // Stimulus アプリは使わず、手動でコントローラを接続
    targetEl = document.getElementById("record-btn-target");
    controllerInstance = new ControllerClass();
    controllerInstance.element = targetEl;
    controllerInstance.connect();
  });

  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    document.body.innerHTML = "";
  });

  function fire(name, target = document) {
    const ev = new CustomEvent(name, { bubbles: true, cancelable: true });
    target.dispatchEvent(ev);
  }

  test("turbo:load で application.js がローダー非表示、コントローラは d-none を外す", () => {
    const loader = document.getElementById("loading-overlay");
    expect(loader).toHaveClass("view-hidden");

    // visit で一旦ローダー表示
    fire("turbo:visit");
    expect(loader.classList.contains("view-hidden")).toBe(false);

    // 対象は d-none スタート
    expect(targetEl.classList.contains("d-none")).toBe(true);

    // turbo:load → ローダーは hidden、コントローラは d-none を外す
    fire("turbo:load");
    expect(loader).toHaveClass("view-hidden");
    expect(targetEl.classList.contains("d-none")).toBe(false);
  });

  test("hidden.bs.modal でコントローラが d-none を外す（application.js と競合しない）", () => {
    // 一旦隠しておく
    targetEl.classList.add("d-none");
    expect(targetEl.classList.contains("d-none")).toBe(true);

    fire("hidden.bs.modal");
    expect(targetEl.classList.contains("d-none")).toBe(false);
  });

  test("コントローラの hide() で d-none が付与される（手動アクション想定）", () => {
    // 表示状態にしてから hide()
    targetEl.classList.remove("d-none");
    expect(targetEl.classList.contains("d-none")).toBe(false);

    controllerInstance.hide();
    expect(targetEl.classList.contains("d-none")).toBe(true);
  });

  test("application.js の MutationObserver（モーダル挿入）でローダーが消えても、対象要素には影響しない", async () => {    const loader = document.getElementById("loading-overlay");

    // visit で表示 → load で observer 設置
    fire("turbo:visit");
    expect(loader.classList.contains("view-hidden")).toBe(false);
    fire("turbo:load");

    // わざと表示に戻してから .modal.show / .modal-content を挿入
    loader.classList.remove("view-hidden");
    const modal = document.createElement("div");
    modal.className = "modal show";
    const content = document.createElement("div");
    content.className = "modal-content";
    document.body.appendChild(modal);
    document.body.appendChild(content);

    await new Promise(r => setTimeout(r, 0));

    // ローダーは隠れるが、対象要素の表示状態は変わらない
    expect(loader).toHaveClass("view-hidden");
    expect(targetEl.classList.contains("d-none")).toBe(false);
  });
});
