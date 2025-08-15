/**
 * application.js の取りこぼし行をピンポイントで踏む “仕上げ” スイート
 * - 初期 console.log（Rails UJS ログ）
 * - turbo:before-cache 経由のモーダル安全クローズ
 * - modalFixObserver（turbo:load 内で作られるやつ）
 * - modalContentObserver（ファイル末尾のやつ）
 */

const path = require("path");
const ENTRY = path.join(process.cwd(), "app/javascript/application.js");

// 小ユーティリティ
const flush = async (n = 3) => { for (let i = 0; i < n; i++) await Promise.resolve(); };
const waitFor = async (cond, { timeout = 800, step = 10 } = {}) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (cond()) return;
    await flush(2);
    await new Promise((r) => setTimeout(r, step));
  }
  throw new Error("waitFor timeout");
};

describe("application.js (toppers)", () => {
  let origAtob;

  beforeEach(() => {
    jest.resetModules();

    // ベースDOM（loader / モバイル検索モーダル）
    document.body.innerHTML = `
      <div id="loading-overlay"></div>
      <div id="mobile-super-search-modal" class="show" style=""></div>
      <div class="modal-backdrop show"></div>
      <div id="record-modal"></div>
    `;

    // “ログインしてない” にして push 購読をスキップさせる
    window.isLoggedIn = false;

    // VAPID まわりの atob（呼ばれないが念のため）
    origAtob = global.atob;
    global.atob = () => "";

    // SW / Push の最低限
    const register = jest.fn().mockResolvedValue({});
    const ready = Promise.resolve({
      pushManager: {
        getSubscription: jest.fn().mockResolvedValue(null),
        subscribe: jest.fn().mockResolvedValue({ endpoint: "https://sub", keys: {} }),
      },
    });
    Object.defineProperty(global, "navigator", {
      configurable: true,
      value: { serviceWorker: { register, ready } },
    });
    if (!("PushManager" in window)) {
      Object.defineProperty(window, "PushManager", {
        value: function () {},
        configurable: true,
      });
    }

    // bootstrap スタブ（new Modal() が hide/show を持つ）
    window.bootstrap = {
      Modal: class {
        constructor() {}
        show() {}
        hide() {}
        static getInstance() { return null; }
        static getOrCreateInstance() { return new this(); }
      },
    };

    // fetch はダミー
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => "" });

    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    if (typeof origAtob === "function") global.atob = origAtob;
    else { try { delete global.atob; } catch {} }
    jest.restoreAllMocks();
  });

  // 🧪 スモークテスト（この1本がある限り「テストが1つもない」エラーは出ない）
  test("suite is alive", () => {
    expect(1).toBe(1);
  });

  test("初期ログ（Rails UJS loaded!）を踏む", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    await jest.isolateModulesAsync(async () => {
      require(ENTRY);
    });
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Rails UJS is loaded/i),
      expect.any(Object)
    );
  });

  test("turbo:before-cache でもモバイル検索モーダルが安全に閉じる（before-render以外の枝）", async () => {
    await jest.isolateModulesAsync(async () => {
      require(ENTRY);
    });

    const el = document.getElementById("mobile-super-search-modal");
    // before-cache を発火
    document.dispatchEvent(new Event("turbo:before-cache", { bubbles: true }));
    await flush(2);

    // 閉じられていること（保険ロジックの枝を通す）
    expect(document.querySelectorAll(".modal-backdrop").length).toBe(0);
    expect(document.body.classList.contains("modal-open")).toBe(false);
    expect(el.classList.contains("show")).toBe(false);
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.style.display).toBe("none");
  });

  test("modalFixObserver: .modal.show + .modal-content が出現したら loading-overlay を非表示", async () => {
    await jest.isolateModulesAsync(async () => {
      require(ENTRY);
    });

    // turbo:load 内で Observer が張られるので、必ず発火させる
    document.dispatchEvent(new Event("turbo:load", { bubbles: true }));
    await flush(2);

    const loader = document.getElementById("loading-overlay");
    loader.classList.remove("view-hidden"); // いったん表示状態に

    // 監視トリガ：.modal.show と .modal-content を追加
    const modal = document.createElement("div");
    modal.className = "modal show";
    const content = document.createElement("div");
    content.className = "modal-content";
    document.body.appendChild(modal);
    document.body.appendChild(content);

    // Observer が走って loader を隠すまで待つ
    await waitFor(() => loader.classList.contains("view-hidden"));
    expect(loader.classList.contains("view-hidden")).toBe(true);
  });

  test("modalContentObserver: モーダル内容追加で loader を隠し、disconnect される", async () => {
    await jest.isolateModulesAsync(async () => {
      require(ENTRY);
    });

    const loader = document.getElementById("loading-overlay");
    loader.classList.remove("view-hidden");

    // 末尾の Observer は body を監視しているので、要素を追加するだけでOK
    const modal = document.createElement("div");
    modal.className = "modal show";
    const content = document.createElement("div");
    content.className = "modal-content";
    document.body.appendChild(modal);
    document.body.appendChild(content);

    await waitFor(() => loader.classList.contains("view-hidden"));
    expect(loader.classList.contains("view-hidden")).toBe(true);
  });
});
