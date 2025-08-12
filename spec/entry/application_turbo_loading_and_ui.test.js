// spec/javascripts/entry/application_turbo_loading_and_ui.test.js
/**
 * 対象: app/javascript/application.js（そのまま）
 * 目的:
 *  - Turboイベントで #loading-overlay の表示/非表示が正しく動く
 *  - turbo:frame-load や MutationObserver の保険でローダーが消える
 *  - おすすめボタンの正常(HPあり)/異常(HPなし)遷移
 *  - Push購読の二重防止（DOMContetLoaded + turbo:load）
 *  - registerServiceWorker が呼ばれる
 *
 * 注意:
 *  - import前にモジュールモック/DOM準備を済ませる
 */

import { JSDOM } from "jsdom";

jest.mock("../../../app/javascript/custom/register_service_worker", () => ({
  registerServiceWorker: jest.fn(),
}));

jest.mock("../../../app/javascript/custom/push_subscription", () => ({
  subscribeToPushNotifications: jest.fn().mockResolvedValue(undefined),
}));

// alertのモック
const alertSpy = jest.spyOn(global, "alert").mockImplementation(() => {});

// bootstrap.Modal の最低限モック
beforeAll(() => {
  global.window.bootstrap = {
    Modal: class {
      static getInstance() { return null; }
      static getOrCreateInstance() { return { show: jest.fn(), hide: jest.fn() }; }
    }
  };
});

describe("application.js - Turboローディング & UI", () => {
  let registerServiceWorker;
  let subscribeToPushNotifications;

  beforeEach(async () => {
    jest.resetModules();

    // DOM初期化
    document.body.innerHTML = `
      <div id="loading-overlay" class="view-hidden"></div>
      <button id="show-recommendations-btn" type="button">おすすめ</button>

      <!-- モバイル検索モーダル(保険関数の対象) -->
      <div id="mobile-super-search-modal" class="modal"></div>
    `;

    // isLoggedInとlocation初期化
    window.isLoggedIn = true;
    delete window.location;
    window.location = new URL("https://example.com/");

    // モック参照取得（import後でも使えるように）
    ({ registerServiceWorker } = require("../../../app/javascript/custom/register_service_worker"));
    ({ subscribeToPushNotifications } = require("../../../app/javascript/custom/push_subscription"));

    // application.js を実際に読み込む（副作用起動）
    await import("../../../app/javascript/application.js");

    // DOMContentLoaded を発火（requestPushOnceが走る）
    document.dispatchEvent(new Event("DOMContentLoaded", { bubbles: true }));
  });

  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  function fire(name, target = document, detail = {}) {
    const ev = new CustomEvent(name, { bubbles: true, cancelable: true, detail });
    target.dispatchEvent(ev);
  }

  test("registerServiceWorker が1回呼ばれる", () => {
    expect(registerServiceWorker).toHaveBeenCalledTimes(1);
  });

  test("Push購読: DOMContentLoaded+turbo:load の二重イベントでも1回だけ", () => {
    expect(subscribeToPushNotifications).toHaveBeenCalledTimes(1); // DOMContentLoaded

    fire("turbo:load");
    // ここでも requestPushOnce() が走るが二重防止される
    expect(subscribeToPushNotifications).toHaveBeenCalledTimes(1);
  });

  test("turbo:visit で表示 → turbo:load で非表示", () => {
    const loader = document.getElementById("loading-overlay");
    expect(loader).toHaveClass("view-hidden");

    fire("turbo:visit");
    expect(loader.classList.contains("view-hidden")).toBe(false);

    fire("turbo:load");
    expect(loader).toHaveClass("view-hidden");
  });

  test("turbo:frame-load でローダーが隠れる（turbo:load 内でハンドラ登録される）", () => {
    const loader = document.getElementById("loading-overlay");

    // まず訪問で表示
    fire("turbo:visit");
    expect(loader.classList.contains("view-hidden")).toBe(false);

    // turbo:load により view-hidden、かつ frame-load ハンドラが仕込まれる
    fire("turbo:load");

    // 再度表示させてから frame-load を発火
    loader.classList.remove("view-hidden");
    fire("turbo:frame-load");
    expect(loader).toHaveClass("view-hidden");
  });

  test("MutationObserver（turbo:load 内）でモーダル要素追加→ローダーを強制非表示", () => {
    const loader = document.getElementById("loading-overlay");

    fire("turbo:visit");
    expect(loader.classList.contains("view-hidden")).toBe(false);

    // turbo:load で observer 設置
    fire("turbo:load");

    // いったん表示してから .modal.show と .modal-content を挿入
    loader.classList.remove("view-hidden");
    const modal = document.createElement("div");
    modal.className = "modal show";
    const content = document.createElement("div");
    content.className = "modal-content";
    document.body.appendChild(modal);
    document.body.appendChild(content);

    // observer により view-hidden 付与が期待される
    expect(loader).toHaveClass("view-hidden");
  });

  test("グローバルの modalContentObserver でもモーダル挿入でローダー非表示", () => {
    const loader = document.getElementById("loading-overlay");

    // あえて表示状態に
    loader.classList.remove("view-hidden");

    const modal = document.createElement("div");
    modal.className = "modal show";
    const content = document.createElement("div");
    content.className = "modal-content";
    document.body.appendChild(modal);
    document.body.appendChild(content);

    expect(loader).toHaveClass("view-hidden");
  });

  test("おすすめボタン: HPあり→ /emotion_logs?hp=XX に遷移", () => {
    localStorage.setItem("hpPercentage", "42");

    const btn = document.getElementById("show-recommendations-btn");
    btn.click();

    expect(window.location.href).toBe("https://example.com/emotion_logs?hp=42");
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test("おすすめボタン: HPなし→ alert が出る", () => {
    localStorage.removeItem("hpPercentage");

    const btn = document.getElementById("show-recommendations-btn");
    btn.click();

    expect(alertSpy).toHaveBeenCalledWith(
      "HPゲージの値が取得できませんでした（localStorageに保存されていません）"
    );
  });
});
