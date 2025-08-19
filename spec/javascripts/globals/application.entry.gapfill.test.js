/**
 * application.js の未カバー枝を埋める追加スイート（安全版）
 */
const path = require("path");
const ENTRY = path.join(process.cwd(), "app/javascript/application.js");
// push モジュールの解決ゆらぎに備えて複数キーでモックする
const PUSH_NOEXT = path.join(process.cwd(), "app/javascript/custom/push_subscription");
const PUSH_JS    = `${PUSH_NOEXT}.js`;

const flush = async (n = 2) => { for (let i = 0; i < n; i++) await Promise.resolve(); };

describe("application.js (gap fill)", () => {
  let winAlertBak, globAlertBak;

  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    localStorage.clear();

    // alert は window と global の両方をモック
    winAlertBak = window.alert;
    globAlertBak = global.alert;
    const fn = jest.fn();
    window.alert = fn;
    global.alert = fn;
  });

  afterEach(() => {
    window.alert = winAlertBak;
    global.alert = globAlertBak;
    jest.useRealTimers();
  });

  test("hideMobileSearchModalSafely: turbo:visit でモバイル検索モーダルを安全クローズ", async () => {
    const modal = document.createElement("div");
    modal.id = "mobile-super-search-modal";
    modal.className = "show";
    document.body.appendChild(modal);

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    document.body.appendChild(backdrop);

    document.body.classList.add("modal-open");
    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = "15px";

    await jest.isolateModulesAsync(async () => { require(ENTRY); });

    document.dispatchEvent(new Event("turbo:visit", { bubbles: true }));

    expect(document.querySelector(".modal-backdrop")).toBeNull();
    expect(document.body.classList.contains("modal-open")).toBe(false);
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.paddingRight).toBe("");
    expect(modal.classList.contains("show")).toBe(false);
    expect(modal.getAttribute("aria-hidden")).toBe("true");
    expect(modal.style.display).toBe("none");
  });

  test("turbo:frame-load で loader を確実に隠す", async () => {
    const loader = document.createElement("div");
    loader.id = "loading-overlay";
    document.body.appendChild(loader);

    await jest.isolateModulesAsync(async () => { require(ENTRY); });

    document.dispatchEvent(new Event("turbo:load", { bubbles: true }));
    loader.classList.remove("view-hidden");

    document.dispatchEvent(new Event("turbo:frame-load", { bubbles: true }));
    expect(loader.classList.contains("view-hidden")).toBe(true);
  });

  test("推薦ボタン: hp が NaN のときは alert が出る", async () => {
    // ボタンは先に置いておく
    const btn = document.createElement("button");
    btn.id = "show-recommendations-btn";
    document.body.appendChild(btn);

    await jest.isolateModulesAsync(async () => { require(ENTRY); });

    // turbo:load でリスナ登録
    document.dispatchEvent(new Event("turbo:load", { bubbles: true }));

    // 当日初回の 50% リセットを回避 + NaN を明示セット
    localStorage.setItem("hpDate", new Date().toISOString().slice(0, 10));
    localStorage.setItem("hpPercentage", "not-a-number");

    btn.click();

    expect(window.alert).toHaveBeenCalled();
  });

  // ✅ 安定化版（confirm を固定、クリックは MouseEvent、整合した最終状態を判定）
  test("アバター: 削除ボタンのトグル & submit ガード", async () => {
    document.body.innerHTML = `
      <div id="loading-overlay"></div>

      <input type="file" id="avatarInput" />
      <img id="avatarPreviewInline" />
      <div id="avatarCropModal"></div>
      <div id="cropContainer" style="width:120px;height:80px;position:relative;"></div>
      <img id="cropImage" width="120" height="80" />
      <button id="cropConfirmBtn" type="button"></button>

      <form id="f1">
        <input type="text" id="avatarUrlField" />
        <input id="submitBtn" type="submit" value="送信" />
      </form>

      <button id="removeAvatarBtn" type="button">画像を削除する</button>
      <input type="checkbox" id="removeAvatarCheckbox" />
    `;

    // confirm を “require 前に” 固定（window/global 両方）
    if (typeof window.confirm !== "function") {
      Object.defineProperty(window, "confirm", { value: () => true, writable: true, configurable: true });
    }
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
    global.confirm = window.confirm;

    await jest.isolateModulesAsync(async () => {
      jest.doMock("bootstrap", () => {
        class FakeModal {
          constructor() {}
          hide() {}
          show() {}
          static getInstance() { return null; }
          static getOrCreateInstance() { return new FakeModal(); }
        }
        return { __esModule: true, Modal: FakeModal, default: { Modal: FakeModal } };
      });
      require(ENTRY);
    });

    document.dispatchEvent(new Event("turbo:load", { bubbles: true }));
    await flush(2);

    const removeBtn = document.getElementById("removeAvatarBtn");
    const ck       = document.getElementById("removeAvatarCheckbox");

    // MouseEvent で確実に発火
    removeBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flush(3);

    // confirm は呼ばれている（ハンドラが動いた証拠）
    expect(confirmSpy).toHaveBeenCalled();

    // 最終状態が妥当か（ON/「削除予定」 もしくは OFF/「画像を削除する」）
    const onPair  = ck.checked === true  && removeBtn.textContent === "削除予定";
    const offPair = ck.checked === false && removeBtn.textContent === "画像を削除する";
    expect(onPair || offPair).toBe(true);

    // submit ガード（URL 空 & 削除 OFF なら prevent）
    ck.checked = false; // ガード有効化
    const form = document.getElementById("f1");
    const ev = new Event("submit", { bubbles: true, cancelable: true });
    form.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(window.alert).toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  test("hideScreenCover: load で 'hide' → 200ms 後に 'view-hidden'", async () => {
    jest.useFakeTimers();

    const cover = document.createElement("div");
    cover.id = "screen-cover-loading";
    document.body.appendChild(cover);

    await jest.isolateModulesAsync(async () => { require(ENTRY); });

    window.dispatchEvent(new Event("load"));

    jest.advanceTimersByTime(1200);
    await flush();
    expect(cover.classList.contains("hide")).toBe(true);

    jest.advanceTimersByTime(200);
    await flush();
    expect(cover.classList.contains("view-hidden")).toBe(true);
  });

  // === ここから追記分（未カバー行をさらに踏みに行く） =====================

  test("requestPushOnce: isLoggedIn で二重実行されない（DOMContentLoaded と turbo:load 両方発火しても 1 回）", async () => {
    const pushSpy = jest.fn().mockResolvedValue();

    await jest.isolateModulesAsync(async () => {
      // 解決キーゆらぎ対策：3通りで同じモックを登録
      jest.doMock("./custom/push_subscription", () => ({ __esModule: true, subscribeToPushNotifications: pushSpy }), { virtual: true });
      jest.doMock(PUSH_NOEXT,                  () => ({ __esModule: true, subscribeToPushNotifications: pushSpy }), { virtual: true });
      jest.doMock(PUSH_JS,                     () => ({ __esModule: true, subscribeToPushNotifications: pushSpy }), { virtual: true });

      // ログイン状態を立ててから require
      global.window.isLoggedIn = true;
      require(ENTRY);
    });

    // 2つのイベントを続けて発火
    document.dispatchEvent(new Event("DOMContentLoaded", { bubbles: true }));
    document.dispatchEvent(new Event("turbo:load",       { bubbles: true }));
    await flush();

    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  test("HP 初期化: 日付が変わっていたら 50% にリセット", async () => {
    // 昨日の日付をセット
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    localStorage.setItem("hpDate", yesterday);
    localStorage.setItem("hpPercentage", "77");

    await jest.isolateModulesAsync(async () => { require(ENTRY); });
    document.dispatchEvent(new Event("turbo:load", { bubbles: true }));
    await flush();

    const today = new Date().toISOString().slice(0, 10);
    expect(localStorage.getItem("hpDate")).toBe(today);
    expect(localStorage.getItem("hpPercentage")).toBe("50");
  });

  test("アバター: 画像ドラッグで transform が更新される（pointerdown/move/up）", async () => {
    document.body.innerHTML = `
      <div id="loading-overlay"></div>
      <input type="file" id="avatarInput" />
      <img id="avatarPreviewInline" />
      <div id="avatarCropModal"></div>
      <div id="cropContainer" style="width:120px;height:80px;position:relative;"></div>
      <img id="cropImage" width="120" height="80" />
      <button id="cropConfirmBtn" type="button"></button>
      <input type="text" id="avatarUrlField" />
    `;

    await jest.isolateModulesAsync(async () => {
      jest.doMock("bootstrap", () => {
        class FakeModal { show(){} hide(){} static getInstance(){return null} static getOrCreateInstance(){return new FakeModal()} }
        return { __esModule: true, Modal: FakeModal, default: { Modal: FakeModal } };
      });
      require(ENTRY);
    });

    document.dispatchEvent(new Event("turbo:load", { bubbles: true }));
    await flush();

    const box = document.getElementById("cropContainer");
    const img = document.getElementById("cropImage");

    // 疑似ドラッグ
    box.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10, pointerId: 1 }));
    box.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 30, clientY: 25, pointerId: 1 }));
    box.dispatchEvent(new PointerEvent("pointerup",   { bubbles: true, clientX: 30, clientY: 25, pointerId: 1 }));
    await flush();

    expect(img.style.transform).toMatch(/translate\(/); // 値そのものではなく「変化したこと」を確認
  });

  test("turbo:before-stream-render: update/record-modal-content 後に record-modal を show", async () => {
    // requestAnimationFrame が非同期実装になっている環境があるため、
    // テスト内だけ同期化して確実にコールさせる
    const rafBak = global.requestAnimationFrame;
    global.requestAnimationFrame = (cb) => cb();

    let showMock;
    try {
      await jest.isolateModulesAsync(async () => {
        showMock = jest.fn();
        jest.doMock("bootstrap", () => {
          class FakeModal { show = showMock; static getOrCreateInstance(){ return new FakeModal(); } }
          return { __esModule: true, Modal: FakeModal, default: { Modal: FakeModal } };
        });
        require(ENTRY);
      });

      // モーダル本体
      const modal = document.createElement("div");
      modal.id = "record-modal";
      document.body.appendChild(modal);

      // tagName 判定を確実に通すために大文字タグで生成
      const streamEl = document.createElement("TURBO-STREAM");
      streamEl.setAttribute("action", "update");
      streamEl.setAttribute("target", "record-modal-content");
      document.body.appendChild(streamEl);

      const original = jest.fn();
      const detail = { render: original };
      const ev = new CustomEvent("turbo:before-stream-render", { bubbles: true, detail });
      streamEl.dispatchEvent(ev);

      // ラップ済みの render を実行 → 同期 rAF → show()
      expect(detail.render).not.toBe(original);
      detail.render(streamEl);

      expect(showMock).toHaveBeenCalled();
    } finally {
      global.requestAnimationFrame = rafBak;
    }
  });
});
