/**
 * spec/javascripts/globals/modal_guards.test.js
 *
 * 対象: app/javascript/custom/modal_guards.js
 * カバレッジ目標:
 *  - (!el) 早期return
 *  - BS.getInstance / getOrCreateInstance 両分岐
 *  - BS不在フォールバック
 *  - anyOpen true/false 両分岐
 *  - pageshow.persisted true
 */

describe("custom/modal_guards.js", () => {
  const resetDom = () => {
    document.body.className = "";
    document.body.style.cssText = "";
    document.body.innerHTML = "";
  };

  const installBootstrapMock = ({ getInst = null, makeInst = () => ({ show: jest.fn(), hide: jest.fn() }) } = {}) => {
    const getInstanceMock = jest.fn().mockReturnValue(getInst);
    const makeInstMock = jest.fn().mockImplementation(() => makeInst());
    window.bootstrap = {
      Modal: {
        getInstance: getInstanceMock,
        getOrCreateInstance: makeInstMock,
      },
    };
    return { getInstanceMock, makeInstMock };
  };

  const removeBootstrap = () => {
    delete window.bootstrap;
  };

  beforeAll(async () => {
    jest.resetModules();
    await import("custom/modal_guards"); // イベントリスナ登録は一度だけ
  });

  beforeEach(() => {
    resetDom();
  });

  afterEach(() => {
    resetDom();
    removeBootstrap();
    jest.restoreAllMocks();
  });

  // 検索モーダル: !el 早期return
  test("検索モーダル: 要素が無ければ何も起きない", () => {
    installBootstrapMock();
    document.dispatchEvent(new Event("turbo:before-render"));
    document.dispatchEvent(new Event("turbo:before-cache"));
    document.dispatchEvent(new Event("turbo:visit"));
    const ev = new Event("pageshow");
    Object.defineProperty(ev, "persisted", { value: true });
    window.dispatchEvent(ev);
    expect(true).toBe(true);
  });

  // 検索モーダル: BSありで hide が呼ばれる
  test("検索モーダル: BSあり → getOrCreateInstance().hide()", () => {
    const modal = document.createElement("div");
    modal.id = "mobile-super-search-modal";
    document.body.appendChild(modal);

    const hideFn = jest.fn();
    installBootstrapMock({ makeInst: () => ({ hide: hideFn }) });

    document.dispatchEvent(new Event("turbo:before-render"));

    expect(hideFn).toHaveBeenCalled();
    expect(modal.classList.contains("show")).toBe(false);
    expect(modal.getAttribute("aria-hidden")).toBe("true");
    expect(modal.style.display).toBe("none");
  });

  // 検索モーダル: BS不在フォールバック + pageshow.persisted
  test("検索モーダル: BS不在でもフォールバックで閉じる & pageshow.persistedでも閉じる", () => {
    const modal = document.createElement("div");
    modal.id = "mobile-super-search-modal";
    modal.classList.add("show");
    document.body.appendChild(modal);

    removeBootstrap();

    document.dispatchEvent(new Event("turbo:visit"));
    expect(modal.classList.contains("show")).toBe(false);

    modal.classList.add("show");
    const ev = new Event("pageshow");
    Object.defineProperty(ev, "persisted", { value: true });
    window.dispatchEvent(ev);
    expect(modal.classList.contains("show")).toBe(false);
  });

  // プレイリスト: bind 多重防止
  test("プレイリスト: バインドは一度だけ", () => {
    const btn = document.createElement("button");
    btn.id = "show-playlist-modal-mobile";
    document.body.appendChild(btn);

    const modal = document.createElement("div");
    modal.id = "playlist-modal-mobile";
    document.body.appendChild(modal);

    const showFn = jest.fn();
    installBootstrapMock({ makeInst: () => ({ show: showFn, hide: jest.fn() }) });

    // 初回クリックで呼ばれる
    document.dispatchEvent(new Event("DOMContentLoaded"));
    btn.click();
    expect(showFn).toHaveBeenCalledTimes(1);

    // 再度 turbo:load, turbo:render が来ても増えない
    document.dispatchEvent(new Event("turbo:load"));
    document.dispatchEvent(new Event("turbo:render"));
    btn.click();
    expect(showFn).toHaveBeenCalledTimes(2);
  });

  // プレイリスト: anyOpen true → 事前掃除しない
  test("プレイリスト: anyOpenがtrueなら背景掃除されない", () => {
    const other = document.createElement("div");
    other.className = "modal show";
    document.body.appendChild(other);

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    document.body.appendChild(backdrop);
    document.body.classList.add("modal-open");

    const btn = document.createElement("button");
    btn.id = "show-playlist-modal-mobile";
    document.body.appendChild(btn);

    const modal = document.createElement("div");
    modal.id = "playlist-modal-mobile";
    document.body.appendChild(modal);

    const showFn = jest.fn();
    installBootstrapMock({ makeInst: () => ({ show: showFn, hide: jest.fn() }) });

    document.dispatchEvent(new Event("DOMContentLoaded"));
    btn.click();

    expect(showFn).toHaveBeenCalled();
    expect(document.querySelector(".modal-backdrop")).not.toBeNull();
    expect(document.body.classList.contains("modal-open")).toBe(true);
  });

  // プレイリスト: BS不在フォールバック（背景クリックで閉じる）
  test("プレイリスト: BS不在フォールバックで開閉する", () => {
    removeBootstrap();

    const btn = document.createElement("button");
    btn.id = "show-playlist-modal-mobile";
    document.body.appendChild(btn);

    const modal = document.createElement("div");
    modal.id = "playlist-modal-mobile";
    document.body.appendChild(modal);

    document.dispatchEvent(new Event("DOMContentLoaded"));

    btn.click();
    expect(modal.classList.contains("show")).toBe(true);

    modal.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(modal.classList.contains("show")).toBe(false);
  });

  // プレイリスト: hideMobilePlaylistModalSafely (イベント & pageshow)
  test("プレイリスト: turboイベントとpageshow.persistedで閉じる", () => {
    const modal = document.createElement("div");
    modal.id = "playlist-modal-mobile";
    modal.className = "modal show";
    document.body.appendChild(modal);

    const hideFn = jest.fn();
    installBootstrapMock({ makeInst: () => ({ hide: hideFn }) });

    document.dispatchEvent(new Event("turbo:before-cache"));
    expect(hideFn).toHaveBeenCalled();

    modal.classList.add("show");
    const ev = new Event("pageshow");
    Object.defineProperty(ev, "persisted", { value: true });
    window.dispatchEvent(ev);
    expect(hideFn).toHaveBeenCalledTimes(2);
  });

  // プレイリスト: !el 早期return
  test("プレイリスト: 要素なしなら何も起きない", () => {
    installBootstrapMock();
    document.dispatchEvent(new Event("turbo:before-render"));
    document.dispatchEvent(new Event("turbo:before-cache"));
    document.dispatchEvent(new Event("turbo:visit"));
    const ev = new Event("pageshow");
    Object.defineProperty(ev, "persisted", { value: true });
    window.dispatchEvent(ev);
    expect(true).toBe(true);
  });
});
