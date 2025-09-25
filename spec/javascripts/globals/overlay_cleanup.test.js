// spec/javascripts/globals/overlay_cleanup.test.js
// 対象: app/javascript/custom/overlay_cleanup.js
// 目的: 分岐網羅（getInstance / getOrCreateInstance、try/catch の catch 側）で Branch 100%

import { runGlobalOverlayCleanup } from "../../../app/javascript/custom/overlay_cleanup.js";

describe("runGlobalOverlayCleanup()", () => {
  let originalBootstrap;
  let getInstanceMock, getOrCreateMock;

  beforeEach(() => {
    document.body.innerHTML = ""; // DOMリセット
    originalBootstrap = window.bootstrap;

    getInstanceMock = jest.fn();
    getOrCreateMock = jest.fn();

    // bootstrap をテスト専用に差し替え（dispose 付きで必ず返す）
    window.bootstrap = {
      Modal: {
        getInstance: getInstanceMock,
        getOrCreateInstance: getOrCreateMock,
      },
    };
  });

  afterEach(() => {
    window.bootstrap = originalBootstrap;
    jest.restoreAllMocks();
  });

  function setupModalDOM() {
    // 可視モーダル
    const modal = document.createElement("div");
    modal.className = "modal show";
    modal.style.display = "block";
    modal.setAttribute("aria-modal", "true");
    document.body.appendChild(modal);

    // バックドロップ類
    const bd1 = document.createElement("div");
    bd1.className = "modal-backdrop";
    const bd2 = document.createElement("div");
    bd2.className = "offcanvas-backdrop";
    document.body.appendChild(bd1);
    document.body.appendChild(bd2);

    // body 状態
    document.body.classList.add("modal-open", "swal2-shown");
    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = "15px";
    document.body.style.pointerEvents = "none";

    // SweetAlert の残骸
    const ids = ["swal-fake-modal"];
    const sels = [
      "#sweet-alert",
      ".swal2-container",
      ".swal2-backdrop",
      ".sweet-overlay",
    ];

    ids.forEach((id) => {
      const n = document.createElement("div");
      n.id = id;
      document.body.appendChild(n);
    });
    sels.forEach((sel) => {
      const n = document.createElement("div");
      if (sel.startsWith("#")) {
        n.id = sel.slice(1);
      } else {
        n.className = sel.slice(1);
      }
      document.body.appendChild(n);
    });

    return modal;
  }

  it("getOrCreateInstance 経路（getInstance が null）で正常掃除（try 正常系）", () => {
    const modal = setupModalDOM();

    // getInstance が null → getOrCreateInstance の分岐
    getInstanceMock.mockReturnValue(null);
    const inst = { hide: jest.fn(), dispose: jest.fn() };
    getOrCreateMock.mockReturnValue(inst);

    runGlobalOverlayCleanup();

    // インスタンス操作
    expect(getInstanceMock).toHaveBeenCalledWith(modal);
    expect(getOrCreateMock).toHaveBeenCalledWith(modal);
    expect(inst.hide).toHaveBeenCalled();
    expect(inst.dispose).toHaveBeenCalled();

    // モーダルDOMの整理
    expect(modal.classList.contains("show")).toBe(false);
    expect(modal.style.display).toBe("");
    expect(modal.getAttribute("aria-modal")).toBe(null);
    expect(modal.getAttribute("aria-hidden")).toBe("true");

    // バックドロップが消えている
    expect(document.querySelector(".modal-backdrop")).toBeNull();
    expect(document.querySelector(".offcanvas-backdrop")).toBeNull();

    // body の復旧（paddingRight は環境依存のため主張しない）
    expect(document.body.classList.contains("modal-open")).toBe(false);
    expect(document.body.classList.contains("swal2-shown")).toBe(false);
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.pointerEvents).toBe("auto");

    // SweetAlert 残骸が remove で消えている（正常ルート）
    expect(document.querySelector("#swal-fake-modal")).toBeNull();
    expect(document.querySelector("#sweet-alert")).toBeNull();
    expect(document.querySelector(".swal2-container")).toBeNull();
    expect(document.querySelector(".swal2-backdrop")).toBeNull();
    expect(document.querySelector(".sweet-overlay")).toBeNull();
  });

  it("getInstance 経路（左側が真）で掃除（getOrCreateInstance は呼ばれない）", () => {
    const modal = setupModalDOM();

    const inst = { hide: jest.fn(), dispose: jest.fn() };
    getInstanceMock.mockReturnValue(inst);

    runGlobalOverlayCleanup();

    expect(getInstanceMock).toHaveBeenCalledWith(modal);
    expect(getOrCreateMock).not.toHaveBeenCalled();
    expect(inst.hide).toHaveBeenCalled();
    expect(inst.dispose).toHaveBeenCalled();

    // モーダルDOMの整理が継続されていること
    expect(modal.classList.contains("show")).toBe(false);
    expect(modal.style.display).toBe("");
    expect(modal.getAttribute("aria-hidden")).toBe("true");
  });

  it("モーダルの try/catch：hide() が throw しても catch で握りつぶし、後続のDOM掃除は行われる", () => {
    const modal = setupModalDOM();

    getInstanceMock.mockReturnValue(null);
    const inst = { hide: jest.fn(() => { throw new Error("boom"); }), dispose: jest.fn() };
    getOrCreateMock.mockReturnValue(inst);

    // 例外を出しても関数全体は落ちない
    expect(() => runGlobalOverlayCleanup()).not.toThrow();

    // hide は呼ばれている（throw 済み）
    expect(inst.hide).toHaveBeenCalled();

    // DOM 側の掃除は進んでいる
    expect(modal.classList.contains("show")).toBe(false);
    expect(modal.getAttribute("aria-hidden")).toBe("true");
  });

  it("SweetAlert の try/catch：remove() が throw した要素は style で無効化される", () => {
    // SweetAlert 要素のみを作って検証
    const el = document.createElement("div");
    el.className = "swal2-container";
    // remove をわざと壊す
    el.remove = () => { throw new Error("cannot remove"); };
    document.body.appendChild(el);

    // モーダル類がなくても関数は動く
    getInstanceMock.mockReturnValue(null);
    getOrCreateMock.mockReturnValue({ hide: jest.fn(), dispose: jest.fn() });

    expect(() => runGlobalOverlayCleanup()).not.toThrow();

    // remove に失敗した要素は style で無効化されている
    expect(el.style.pointerEvents).toBe("none");
    expect(el.style.display).toBe("none");
    expect(el.style.visibility).toBe("hidden");
  });
});
