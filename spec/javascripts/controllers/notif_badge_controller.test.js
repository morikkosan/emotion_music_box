/**
 * notif_badge_controller のユニットテスト（ブランチ完全版・実装準拠）
 * - Stimulusスタブは values/hasValues を自動生成しないため、テスト側で両方を手動で与える
 * - openModal まわりは HTML 分岐（Turboなし/あり）を両方検証
 * - jsdom の限界に合わせて、必要な箇所はテスト側で API をモックして枝を確実に通す
 */

jest.mock("bootstrap", () => {
  const mockModalShow = jest.fn();
  const mockModalHide = jest.fn();
  const mockModalDispose = jest.fn();

  const mockGetInstance = jest.fn().mockReturnValue(null);
  const mockGetOrCreateInstance = jest.fn((el) => ({
    show: mockModalShow,
    hide: mockModalHide,
    dispose: mockModalDispose,
    _el: el,
  }));

  return {
    Modal: {
      getInstance: mockGetInstance,
      getOrCreateInstance: mockGetOrCreateInstance,
    },
    __m: {
      mockModalShow,
      mockModalHide,
      mockModalDispose,
      mockGetInstance,
      mockGetOrCreateInstance,
    },
  };
});

import { Application } from "@hotwired/stimulus";
import ControllerClass from "../../../app/javascript/controllers/notif_badge_controller";

// ---- 必要ポリフィル（jsdom向け） ----
if (!global.requestAnimationFrame) {
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
} else {
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
}
if (!global.cancelAnimationFrame) {
  global.cancelAnimationFrame = () => {};
}

const waitTick = () => new Promise((r) => setTimeout(r, 0));
const waitMicro = () => Promise.resolve();

describe("notif_badge_controller", () => {
  let app, button, badgeSpan, controller;

  const bootstrapMock = jest.requireMock("bootstrap");
  const M = bootstrapMock.__m;

  // ログを静かに
  let logSpy, warnSpy, errSpy;
  beforeAll(() => {
    logSpy  = jest.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    errSpy  = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterAll(() => {
    try { logSpy?.mockRestore(); } catch {}
    try { warnSpy?.mockRestore(); } catch {}
    try { errSpy?.mockRestore(); } catch {}
  });

  beforeEach(() => {
    if (window.Turbo) delete window.Turbo;

    document.body.innerHTML = `
      <div id="app">
        <button
          id="notif-button"
          type="button"
          data-controller="notif-badge"
          data-notif-badge-endpoint-value="/notifications/unread_count.json"
          data-notif-badge-poll-interval-value="30000"
          data-notif-badge-modal-url-value="/notifications/modal.turbo_stream"
          data-notif-badge-modal-container-id-value="notifications-modal-container"
          aria-label="通知ボタン">
          通知
          <span class="notif-count-badge" data-notif-badge-target="badge" hidden>0</span>
        </button>
      </div>
    `;
    button = document.getElementById("notif-button");
    badgeSpan = button.querySelector("[data-notif-badge-target='badge']");

    app = Application.start();
    app.register("notif-badge", ControllerClass);

    global.fetch = jest.fn();

    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });

    jest.spyOn(window, "setInterval").mockImplementation(() => 123456);
    jest.spyOn(window, "clearInterval").mockImplementation(() => {});

    M.mockModalShow.mockClear();
    M.mockModalHide.mockClear();
    M.mockModalDispose.mockClear();
    M.mockGetInstance.mockClear();
    M.mockGetOrCreateInstance.mockClear();

    controller = app.getControllerForElementAndIdentifier(button, "notif-badge");
  });

  afterEach(() => {
    try { app?.stop(); } catch {}
    jest.clearAllMocks();
    document.body.innerHTML = "";
  });

  // ★ values/hasValues を両方与える
  function wireValues(c, extra = {}) {
    // values
    c.endpointValue = "/notifications/unread_count.json";
    c.pollIntervalValue = 30000;
    c.pauseOnHiddenValue = true;

    c.modalUrlValue = "/notifications/modal.turbo_stream";
    c.modalContainerIdValue = "notifications-modal-container";

    c.modalZValue = 1000000;
    c.backdropZValue = 999995;
    c.demoteBelowZValue = 999994;

    // hasValues
    c.hasEndpointValue = true;
    c.hasPollIntervalValue = true;
    c.hasPauseOnHiddenValue = true;

    c.hasModalUrlValue = true;
    c.hasModalContainerIdValue = true;

    c.hasModalZValue = true;
    c.hasBackdropZValue = true;
    c.hasDemoteBelowZValue = true;

    // 追加オプション
    for (const k of Object.keys(extra)) {
      c[k] = extra[k];
    }
  }

  // ========= 基本テスト =========

  test("初回 update() 実行と setInterval 開始（values を手動配線）", async () => {
    wireValues(controller);

    setInterval.mockClear();

    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ unread_count: 5 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    await controller.update();
    controller.startTimer();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "/notifications/unread_count.json",
      expect.objectContaining({ credentials: "include" })
    );

    await waitMicro();

    expect(badgeSpan.hidden).toBe(false);
    expect(badgeSpan.textContent).toBe("5");
    expect(badgeSpan.getAttribute("aria-label")).toBe("未読通知 5件");

    expect(setInterval).toHaveBeenCalledTimes(1);
  });

  test("バッジ更新：0件なら非表示、>0なら表示", async () => {
    wireValues(controller);

    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ unread_count: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    await controller.update();
    await waitMicro();
    expect(badgeSpan.hidden).toBe(true);
    expect(badgeSpan.textContent).toBe("0");
    expect(badgeSpan.hasAttribute("aria-label")).toBe(false);

    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ unread_count: 12 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    await controller.update();
    await waitMicro();
    expect(badgeSpan.hidden).toBe(false);
    expect(badgeSpan.textContent).toBe("12");
    expect(badgeSpan.getAttribute("aria-label")).toBe("未読通知 12件");
  });

  test("update() 失敗時：0 件にフォールバックし warn ログ", async () => {
    wireValues(controller);

    fetch.mockResolvedValueOnce(new Response("NG", { status: 500 }));

    await controller.update();
    await waitMicro();

    expect(badgeSpan.hidden).toBe(true);
    expect(badgeSpan.textContent).toBe("0");
    expect(console.warn).toHaveBeenCalled();
  });

  test("visibilitychange: hidden→停止 / 表示→update再開", async () => {
    wireValues(controller);

    controller.startTimer();
    clearInterval.mockClear();
    setInterval.mockClear();
    fetch.mockClear();

    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    controller.onVisibilityChange();
    expect(clearInterval).toHaveBeenCalledTimes(1);
    expect(setInterval).not.toHaveBeenCalled();

    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ unread_count: 3 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    controller.onVisibilityChange();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(setInterval).toHaveBeenCalledTimes(1);
  });

  test("openModal(): 初回は fetch→DOM 差し込み→Modal.show()", async () => {
    wireValues(controller);
    if (window.Turbo) delete window.Turbo;

    const modalHTML = `
      <div id="notifications-modal" class="modal">
        <div class="modal-dialog"></div>
        <div class="modal-content"><p>通知モーダル</p></div>
      </div>`;

    fetch.mockResolvedValueOnce(new Response(modalHTML, {
      status: 200, headers: { "Content-Type": "text/html" },
    }));

    await controller.openModal();

    const container = document.getElementById("notifications-modal-container");
    expect(container).toBeTruthy();

    const modalEl = document.getElementById("notifications-modal");
    expect(modalEl).toBeTruthy();
    expect(modalEl.parentElement).toBe(document.body);

    expect(M.mockModalShow).toHaveBeenCalledTimes(1);
  });

  test("openModal(): 既存 .modal.show があれば先に hide()", async () => {
    wireValues(controller);
    if (window.Turbo) delete window.Turbo;

    const existing = document.createElement("div");
    existing.className = "modal show";
    document.body.appendChild(existing);

    fetch.mockResolvedValueOnce(new Response(`
      <div id="notifications-modal" class="modal"><div class="modal-dialog"></div></div>
    `, { status: 200, headers: { "Content-Type": "text/html" } }));

    setTimeout(() => {
      const ev = new window.Event("hidden.bs.modal");
      existing.dispatchEvent(ev);
    }, 0);

    await controller.openModal();

    expect(M.mockModalHide).toHaveBeenCalled();
    expect(M.mockModalShow).toHaveBeenCalled();
  });

  // ========= 追加テスト：未到達分岐のカバー =========

  test("startTimer(): pollInterval <= 0 はタイマー開始しない", () => {
    wireValues(controller);
    setInterval.mockClear();

    controller.pollIntervalValue = 0;
    controller.startTimer();
    expect(setInterval).not.toHaveBeenCalled();
  });

  test("startTimer(): pauseOnHidden=false かつ document.hidden=true でも開始する", () => {
    wireValues(controller);
    controller.pauseOnHiddenValue = false;
    controller.hasPauseOnHiddenValue = true;
    setInterval.mockClear();

    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    controller.startTimer();
    expect(setInterval).toHaveBeenCalledTimes(1);
  });

  test("update(): endpoint が無ければ実行しない / inFlight時も実行しない", async () => {
    wireValues(controller);
    controller.endpointValue = null;
    controller.hasEndpointValue = false;
    await controller.update();
    expect(fetch).not.toHaveBeenCalled();

    wireValues(controller);
    controller._inFlight = true;
    await controller.update();
    expect(fetch).not.toHaveBeenCalled();
  });

  test("renderCount(): hasBadgeTarget=false でも安全に抜ける", () => {
    wireValues(controller);
    badgeSpan.remove();
    expect(() => controller.renderCount(10)).not.toThrow();
  });

  test("イベント: click / keydown(Enter/Space) で openModal() を呼ぶ", async () => {
    wireValues(controller);

    const spy = jest.spyOn(controller, "openModal").mockResolvedValue(undefined);

    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    button.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    button.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: " " }));

    expect(spy).toHaveBeenCalledTimes(3);
  });

  test("openModal(): すでに #notifications-modal.show があれば再利用（fetch しない）", async () => {
    wireValues(controller);

    const modal = document.createElement("div");
    modal.id = "notifications-modal";
    modal.className = "modal show";
    document.body.appendChild(modal);

    fetch.mockClear();

    await controller.openModal();

    expect(fetch).not.toHaveBeenCalled();
    expect(M.mockModalShow).toHaveBeenCalledTimes(1);
  });

  test("_hideAnyOpenModals(): 開いているモーダルが無ければ何もしない", async () => {
    wireValues(controller);
    await controller._hideAnyOpenModals();
    expect(M.mockModalHide).not.toHaveBeenCalled();
  });

  test("_waitForElementOrMutation(): タイムアウトで null を返す", async () => {
    wireValues(controller);
    const el = await controller._waitForElementOrMutation("#never-appear", document.body, 10);
    expect(el).toBeNull();
  });

  test("openModal(): レンダ後も #notifications-modal が見つからなければエラーを出し終了", async () => {
    wireValues(controller);
    if (window.Turbo) delete window.Turbo;

    jest.spyOn(controller, "_waitForElementOrMutation").mockResolvedValue(null);

    fetch.mockResolvedValueOnce(new Response(`<div>NO MODAL HERE</div>`, {
      status: 200, headers: { "Content-Type": "text/html" },
    }));

    await controller.openModal();

    expect(console.error).toHaveBeenCalled();
    expect(document.getElementById("notifications-modal")).toBeNull();
  });

  test("_hideNotificationsModalSafely(): 対象が無くても安全に抜ける", () => {
    wireValues(controller);
    expect(() => controller._hideNotificationsModalSafely()).not.toThrow();
  });

  test("_hideNotificationsModalSafely(): 存在すれば hide を呼ぶ（例外なく安全）", () => {
    wireValues(controller);

    const modal = document.createElement("div");
    modal.id = "notifications-modal";
    modal.className = "modal show";
    document.body.appendChild(modal);

    controller._hideNotificationsModalSafely();
    expect(M.mockModalHide).toHaveBeenCalled();
  });

  test("demote（降格）: getComputedStyle と querySelectorAll(body *) をモックして枝を確実に通す", async () => {
    wireValues(controller);
    if (window.Turbo) delete window.Turbo;

    fetch.mockResolvedValueOnce(new Response(`
      <div id="notifications-modal" class="modal">
        <div class="modal-dialog"></div>
        <div class="modal-content"></div>
      </div>flex
    `, { status: 200, headers: { "Content-Type": "text/html" } }));

    const high = document.createElement("div");
    high.id = "high-z";
    high.style.position = "fixed";
    high.style.zIndex = "999999";
    document.body.appendChild(high);

    const other = document.createElement("div");
    other.id = "other";
    document.body.appendChild(other);
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    other.appendChild(backdrop);

    const origProtoQSA = Document.prototype.querySelectorAll;
    const qsaImpl = function (sel) {
      if (typeof sel === "string" && sel.trim() === "body *") {
        const list = [high];
        list.item = (i) => list[i];
        list.forEach = Array.prototype.forEach;
        return list;
      }
      return origProtoQSA.call(this, sel);
    };
    const qsaSpyDoc   = jest.spyOn(document, "querySelectorAll").mockImplementation(qsaImpl);
    const qsaSpyProto = jest.spyOn(Document.prototype, "querySelectorAll").mockImplementation(qsaImpl);

    const spyGetCS = jest.spyOn(window, "getComputedStyle").mockImplementation((el) => {
      if (el === high) {
        return { position: "fixed", zIndex: "999999" };
      }
      return { position: "static", zIndex: "auto" };
    });

    await controller.openModal();

    const modalEl = document.getElementById("notifications-modal");
    expect(modalEl.querySelector(".modal-dialog").getAttribute("tabindex")).toBe("-1");

    await waitTick();
    await waitMicro();

    const last = modalEl.lastChild;
    expect(!(last && last.nodeType === Node.TEXT_NODE && /\bflex\b/i.test(last.textContent || ""))).toBe(true);

    const bd = document.querySelector(".modal-backdrop");
    expect(bd).toBeTruthy();
    expect(bd.parentElement).toBe(document.body);
    expect(parseInt(bd.style.zIndex, 10)).toBe(999995);

    expect(high.hasAttribute("data-notif-demoted")).toBe(true);
    expect(parseInt(high.style.zIndex, 10)).toBeLessThan(controller.demoteBelowZValue);

    spyGetCS.mockRestore();
    qsaSpyDoc.mockRestore();
    qsaSpyProto.mockRestore();
  });

  test("Turbo Stream 分岐: window.Turbo.renderStreamMessage が呼ばれる", async () => {
    wireValues(controller);

    window.Turbo = {
      renderStreamMessage: jest.fn((html) => {
        setTimeout(() => {
          const container =
            document.getElementById("notifications-modal-container") || document.body;

          const div = document.createElement("div");
          div.innerHTML = `
            <div id="notifications-modal" class="modal">
              <div class="modal-dialog"></div>
              <div class="modal-content"></div>
            </div>`;
          container.appendChild(div.firstElementChild);
        }, 0);
      }),
    };

    const turboStreamHTML = `
      <turbo-stream action="append" target="notifications-modal-container">
        <template>
          <div id="notifications-modal" class="modal">
            <div class="modal-dialog"></div>
            <div class="modal-content"></div>
          </div>
        </template>
      </turbo-stream>
    `;
    fetch.mockResolvedValueOnce(
      new Response(turboStreamHTML, {
        status: 200,
        headers: { "Content-Type": "text/vnd.turbo-stream.html" },
      })
    );

    await controller.openModal();
    await waitTick();

    expect(window.Turbo.renderStreamMessage).toHaveBeenCalled();

    const modalEl = document.getElementById("notifications-modal");
    expect(modalEl).toBeTruthy();
    expect(M.mockModalShow).toHaveBeenCalledTimes(1);
  });

  test("menu toggle: wrapper/button が与えられたときの開閉と teardown", () => {
    wireValues(controller, {
      menuWrapperSelectorValue: "#menu-wrap",
      menuButtonSelectorValue: "#menu-btn",
      hasMenuWrapperSelectorValue: true,
      hasMenuButtonSelectorValue: true,
    });

    const wrap = document.createElement("div");
    wrap.id = "menu-wrap";
    const btn = document.createElement("button");
    btn.id = "menu-btn";
    document.body.appendChild(wrap);
    document.body.appendChild(btn);

    controller._setupMenuToggleIfProvided();

    btn.click();
    expect(wrap.classList.contains("is-open")).toBe(true);

    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(wrap.classList.contains("is-open")).toBe(false);

    btn.click();
    expect(wrap.classList.contains("is-open")).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(wrap.classList.contains("is-open")).toBe(false);

    controller._teardownMenuToggle();
  });

  test("モーダル close: dispose / 要素削除 / コンテナ掃除 / 降格“復元”（元z-indexあり/なし両分岐）", async () => {
    wireValues(controller);
    if (window.Turbo) delete window.Turbo;

    fetch.mockResolvedValueOnce(new Response(`
      <div id="notifications-modal" class="modal">
        <div class="modal-dialog"></div>
        <div class="modal-content"><p>通知モーダル</p></div>
      </div>
    `, { status: 200, headers: { "Content-Type": "text/html" } }));

    const high = document.createElement("div");
    high.id = "high-z";
    high.style.position = "fixed";
    high.style.zIndex = "999999";
    high.setAttribute("data-notif-demoted", "999999");
    document.body.appendChild(high);

    const high2 = document.createElement("div");
    high2.id = "high-z-2";
    high2.style.position = "fixed";
    high2.style.zIndex = String(controller.demoteBelowZValue - 1);
    high2.setAttribute("data-notif-demoted", "");
    document.body.appendChild(high2);

    await controller.openModal();

    const modalEl = document.getElementById("notifications-modal");
    const container = document.getElementById("notifications-modal-container");
    expect(modalEl).toBeTruthy();
    expect(container).toBeTruthy();

    const ev = new window.Event("hidden.bs.modal");
    modalEl.dispatchEvent(ev);

    expect(M.mockModalDispose).toHaveBeenCalled();
    expect(document.getElementById("notifications-modal")).toBeNull();
    expect(container.innerHTML).toBe("");

    expect(high.hasAttribute("data-notif-demoted")).toBe(false);
    expect(high.style.zIndex).toBe("999999");

    expect(high2.hasAttribute("data-notif-demoted")).toBe(false);
    expect(high2.style.zIndex).toBe("");
  });

  test("openModal(): #screen-cover-loading があれば非表示化＆bodyの pointerEvents / padding-right 復元", async () => {
    wireValues(controller);
    if (window.Turbo) delete window.Turbo;

    fetch.mockResolvedValueOnce(new Response(`
      <div id="notifications-modal" class="modal">
        <div class="modal-dialog"></div>
        <div class="modal-content"></div>
      </div>
    `, { status: 200, headers: { "Content-Type": "text/html" } }));

    const cover = document.createElement("div");
    cover.id = "screen-cover-loading";
    cover.style.display = "block";
    document.body.style.pointerEvents = "none";
    document.body.style.paddingRight = "10px";
    document.body.appendChild(cover);

    await controller.openModal();
    await waitTick();

    expect(cover.style.display).toBe("none");
    expect(cover.getAttribute("aria-hidden")).toBe("true");
    expect(document.body.style.pointerEvents).toBe("auto");
    expect(document.body.style.paddingRight).toBe("");
  });

  // ===== 追加テスト：残りブランチの完全カバー =====

  test("pageshow(persisted=true): 復帰時に通知モーダルを安全に閉じる", async () => {
    wireValues(controller);

    const modal = document.createElement("div");
    modal.id = "notifications-modal";
    modal.className = "modal show";
    document.body.appendChild(modal);

    const hideSpy = jest.spyOn(controller, "_hideNotificationsModalSafely");

    const ev = new Event("pageshow");
    Object.defineProperty(ev, "persisted", { value: true });
    window.dispatchEvent(ev);

    expect(hideSpy).toHaveBeenCalledTimes(1);
  });

  test("openModal(): 既存 #notifications-modal-container を再利用（新規作成ブロックを通らない）", async () => {
    wireValues(controller);
    if (window.Turbo) delete window.Turbo;

    const pre = document.createElement("div");
    pre.id = "notifications-modal-container";
    pre.setAttribute("data-pre", "yes");
    document.body.appendChild(pre);

    fetch.mockResolvedValueOnce(new Response(`
      <div id="notifications-modal" class="modal">
        <div class="modal-dialog"></div>
        <div class="modal-content"></div>
      </div>
    `, { status: 200, headers: { "Content-Type": "text/html" } }));

    await controller.openModal();

    const container = document.getElementById("notifications-modal-container");
    expect(container).toBe(pre);
    expect(container.getAttribute("data-pre")).toBe("yes");
    expect(M.mockModalShow).toHaveBeenCalledTimes(1);
  });

  test("openModal(): _opening ガードで二重実行を防ぐ（fetch されない）", async () => {
    wireValues(controller);

    controller._opening = true;
    await controller.openModal();

    expect(fetch).not.toHaveBeenCalled();
    expect(controller._opening).toBe(true);

    controller._opening = false;
  });

  test("menu teardown 後はイベントが解除されており、クリックしても開かない", () => {
    wireValues(controller, {
      menuWrapperSelectorValue: "#menu-wrap",
      menuButtonSelectorValue: "#menu-btn",
      hasMenuWrapperSelectorValue: true,
      hasMenuButtonSelectorValue: true,
    });

    const wrap = document.createElement("div");
    wrap.id = "menu-wrap";
    const btn = document.createElement("button");
    btn.id = "menu-btn";
    document.body.appendChild(wrap);
    document.body.appendChild(btn);

    controller._setupMenuToggleIfProvided();

    btn.click();
    expect(wrap.classList.contains("is-open")).toBe(true);

    controller._teardownMenuToggle();

    wrap.classList.remove("is-open");
    btn.click();
    expect(wrap.classList.contains("is-open")).toBe(false);

    wrap.classList.add("is-open");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(wrap.classList.contains("is-open")).toBe(true);
  });

  // 1) renderCount の 100件以上 / NaN / 負数 / 文字列 / 小数
  test("renderCount(): 100件以上は“99+”または数値(>=100)を許容、NaN/負数/未定義は0、文字列や小数も正規化", () => {
    wireValues(controller);

    controller.renderCount(100);
    const badge = document.querySelector("[data-notif-badge-target='badge']");
    expect(badge.hidden).toBe(false);
    const txt = badge.textContent.trim();
    const isPlusNotation = /^\d+\+$/.test(txt);
    const isNumber100up  = /^\d+$/.test(txt) && parseInt(txt, 10) >= 100;
    expect(isPlusNotation || isNumber100up).toBe(true);

    controller.renderCount("7");
    expect(badge.hidden).toBe(false);
    expect(badge.textContent.trim()).toBe("7");

    controller.renderCount(7.9);
    expect(parseInt(badge.textContent.trim(), 10)).toBe(7);

    controller.renderCount(undefined);
    expect(badge.hidden).toBe(true);
    expect(badge.textContent.trim()).toBe("0");

    controller.renderCount(NaN);
    expect(badge.hidden).toBe(true);
    expect(badge.textContent.trim()).toBe("0");

    controller.renderCount(-5);
    expect(badge.hidden).toBe(true);
    expect(badge.textContent.trim()).toBe("0");
  });

  // 2) _waitForElementOrMutation: 監視開始前に要素が既存 → 早期リターン
  test("_waitForElementOrMutation(): 監視開始時点で既に存在する要素なら即座に返す", async () => {
    wireValues(controller);

    const existing = document.createElement("div");
    existing.id = "already-here";
    document.body.appendChild(existing);

    const el = await controller._waitForElementOrMutation("#already-here", document, 100);
    expect(el).toBe(existing);
  });

  // 3) openModal: modalUrl 未設定（hasModalUrl=false）→ 早期 return
  test("openModal(): modalUrl が無い（hasModalUrl=false）ときは何もせず戻る", async () => {
    wireValues(controller);
    controller.hasModalUrlValue = false;
    controller.modalUrlValue = undefined;

    await controller.openModal();

    expect(fetch).not.toHaveBeenCalled();
    expect(document.getElementById("notifications-modal")).toBeNull();
  });

  // 4) _hideAnyOpenModals(): .modal.show がある → hide 呼び出し（hidden を確実に発火）
  test("_hideAnyOpenModals(): .modal.show が存在すれば Bootstrap の hide を呼ぶ", async () => {
    wireValues(controller);

    const open = document.createElement("div");
    open.className = "modal show";
    document.body.appendChild(open);

    M.mockModalHide.mockImplementation(() => {
      setTimeout(() => {
        const ev = new window.Event("hidden.bs.modal");
        open.dispatchEvent(ev);
      }, 0);
    });

    await controller._hideAnyOpenModals();
    await waitTick();

    expect(M.mockModalHide).toHaveBeenCalledTimes(1);
  });

  // 5) onVisibilityChange: pauseOnHidden=false なら hidden でも停止しない
  test("onVisibilityChange(): pauseOnHidden=false なら hidden でも停止しない", async () => {
    wireValues(controller);
    controller.pauseOnHiddenValue = false;
    controller.hasPauseOnHiddenValue = true;

    controller.startTimer();
    clearInterval.mockClear();
    setInterval.mockClear();

    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    controller.onVisibilityChange();

    expect(clearInterval).not.toHaveBeenCalled();
  });

  // 6) pageshow(persisted=false): 何もしない
  test("pageshow(persisted=false): 復帰でなければモーダルを閉じない", () => {
    wireValues(controller);

    const hideSpy = jest.spyOn(controller, "_hideNotificationsModalSafely");

    const ev = new Event("pageshow");
    Object.defineProperty(ev, "persisted", { value: false });
    window.dispatchEvent(ev);

    expect(hideSpy).not.toHaveBeenCalled();
  });

  // 7) Turbo 有効でも content-type text/html → HTML 分岐
  test("openModal(): Turbo 有効でも content-type が text/html なら HTML 分岐で表示", async () => {
    wireValues(controller);

    window.Turbo = { renderStreamMessage: jest.fn() };

    fetch.mockResolvedValueOnce(new Response(`
      <div id="notifications-modal" class="modal">
        <div class="modal-dialog"></div>
        <div class="modal-content"></div>
      </div>
    `, { status: 200, headers: { "Content-Type": "text/html" } }));

    await controller.openModal();

    expect(window.Turbo.renderStreamMessage).not.toHaveBeenCalled();
    expect(document.getElementById("notifications-modal")).toBeTruthy();
    expect(M.mockModalShow).toHaveBeenCalledTimes(1);

    delete window.Turbo;
  });

  // 8) keydown: Enter/Space 以外は openModal せず、レガシー 'Spacebar' も「呼ばれない」実装準拠
  test("keydown: Enter/Space 以外は openModal を呼ばず、'Spacebar' では呼ばれない（実装準拠）", () => {
    wireValues(controller);
    const spy = jest.spyOn(controller, "openModal").mockResolvedValue(undefined);

    // 呼ばれないキー
    button.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "a" }));
    expect(spy).not.toHaveBeenCalled();

    // レガシー表記 'Spacebar' → 実装はハンドリングしない前提
    button.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Spacebar" }));
    expect(spy).not.toHaveBeenCalled();
  });

  // 9) openModal: hasModalContainerId=false でも実装は fetch を実行しモーダルを描画（実装準拠）
  test("openModal(): hasModalContainerId=false でも fetch 実行＆モーダル描画（実装準拠）", async () => {
    wireValues(controller);
    if (window.Turbo) delete window.Turbo;

    controller.hasModalContainerIdValue = false;
    controller.modalContainerIdValue = undefined;

    fetch.mockResolvedValueOnce(new Response(`
      <div id="notifications-modal" class="modal">
        <div class="modal-dialog"></div>
        <div class="modal-content"></div>
      </div>
    `, { status: 200, headers: { "Content-Type": "text/html" } }));

    await controller.openModal();

    expect(fetch).toHaveBeenCalledTimes(1);
    // どの受け皿でも良いが、最終的にモーダルが挿入されていればOK
    expect(document.getElementById("notifications-modal")).toBeTruthy();
  });

  // 10) openModal: fetch が例外を投げる → エラーログ経由で終了
  test("openModal(): fetch が例外を投げた場合でも落ちずに終了する（エラーログ出力）", async () => {
    wireValues(controller);
    if (window.Turbo) delete window.Turbo;

    fetch.mockImplementationOnce(() => { throw new Error("network down"); });

    await controller.openModal();

    expect(console.error).toHaveBeenCalled();
    expect(document.getElementById("notifications-modal")).toBeNull();
  });

  // 11) demote: getComputedStyle が zIndex:auto を返す要素は降格されない枝
  test("demote: z-index='auto'（数値化不能）要素は降格されない", async () => {
    wireValues(controller);
    if (window.Turbo) delete window.Turbo;

    fetch.mockResolvedValueOnce(new Response(`
      <div id="notifications-modal" class="modal">
        <div class="modal-dialog"></div>
        <div class="modal-content"></div>
      </div>
    `, { status: 200, headers: { "Content-Type": "text/html" } }));

    // auto の要素
    const autoZ = document.createElement("div");
    autoZ.id = "auto-z";
    autoZ.style.position = "fixed";
    // zIndex 未設定 → getComputedStyle で "auto" を返す想定
    document.body.appendChild(autoZ);

    const spyGetCS = jest.spyOn(window, "getComputedStyle").mockImplementation((el) => {
      if (el === autoZ) {
        return { position: "fixed", zIndex: "auto" };
      }
      return { position: "static", zIndex: "auto" };
    });

    await controller.openModal();
    await waitTick();

    // 降格マークが付かないことを確認
    expect(autoZ.hasAttribute("data-notif-demoted")).toBe(false);

    spyGetCS.mockRestore();
  });
});
