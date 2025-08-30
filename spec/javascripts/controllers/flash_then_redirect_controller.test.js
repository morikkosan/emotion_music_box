/**
 * flash_then_redirect_controller.test.js
 * - connect() の SweetAlert 経路／alert フォールバック経路
 * - 事前クリーンアップ（.modal.show / .modal-backdrop / body.class/Style）
 * - go(): Turbo.visit 経路 と location.replace フォールバック
 *
 * ※ Stimulus の値機構は使わず、インスタンスに *_Value を直挿入して検証。
 */

jest.mock("@hotwired/stimulus", () => {
  // 値機構は使わないので空クラスでOK
  return { __esModule: true, Controller: class {} };
});

const flushMicro = async (n = 2) => { while (n--) await Promise.resolve(); };

describe("flash_then_redirect_controller", () => {
  let ControllerClass;

  beforeEach(async () => {
    jest.resetModules();
    // DOM 初期化（毎回クリーンな状態から）
    document.body.innerHTML = "";
    // bootstrap を window に生やす（connect() の掃除で参照）
    window.bootstrap = {
      Modal: {
        getInstance: () => null,
        getOrCreateInstance: () => ({ hide() {}, show() {} }),
      }
    };
    // Swal / Turbo / location は各テストで必要に応じて上書き
    ControllerClass = (await import("../../../app/javascript/controllers/flash_then_redirect_controller.js")).default;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete window.Turbo;
    document.body.innerHTML = "";
  });

  // ユーティリティ: コントローラ作成＋element付与
  function makeController(el = document.createElement("div")) {
    const c = new ControllerClass();
    c.element = el;
    return c;
  }

  test("connect(): SweetAlert 経由で表示→then後に go() が呼ばれる + 事前クリーンアップ実行", async () => {
    // --- 事前に「開いてるモーダル＋黒幕」を用意 ---
    const modal = document.createElement("div");
    modal.className = "modal show";
    document.body.appendChild(modal);

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    document.body.appendChild(backdrop);

    document.body.classList.add("modal-open");
    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = "15px";

    const hideSpy = jest.fn();
    // .modal.show に対して getInstance(...).hide() が呼ばれる
    window.bootstrap.Modal.getInstance = (m) => m === modal ? { hide: hideSpy } : null;

    // Swal.fire をモック（即 resolve）
    const fireSpy = jest.fn(() => Promise.resolve());
    window.Swal = { fire: fireSpy };

    const ctrl = makeController();
    // Stimulus の values は使わず、直でプロパティを与える
    Object.defineProperty(ctrl, "messageValue", { value: "完了メッセージ", configurable: true });
    Object.defineProperty(ctrl, "urlValue",     { value: "/next", configurable: true });
    Object.defineProperty(ctrl, "titleValue",   { value: "やったね", configurable: true });
    Object.defineProperty(ctrl, "iconValue",    { value: "info", configurable: true });
    Object.defineProperty(ctrl, "confirmTextValue", { value: "OK", configurable: true });

    const goSpy = jest.spyOn(ctrl, "go").mockImplementation(() => {});

    // 実行
    ctrl.connect();

    // 事前クリーンアップ
    expect(hideSpy).toHaveBeenCalled();
    expect(document.querySelectorAll(".modal-backdrop").length).toBe(0);
    expect(document.body.classList.contains("modal-open")).toBe(false);
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.paddingRight).toBe("");

    // SweetAlert 設定
    expect(fireSpy).toHaveBeenCalledTimes(1);
    expect(fireSpy.mock.calls[0][0]).toEqual({
      title: "やったね",
      text: "完了メッセージ",
      icon: "info",
      confirmButtonText: "OK",
      showCancelButton: false
    });

    // then() 後に go()
    await flushMicro();
    expect(goSpy).toHaveBeenCalled();
  });

  test("connect(): Swal 無しなら alert フォールバック → go() 実行", async () => {
    // Swal.fire が無い
    window.Swal = {}; // もしくは undefined でもOK
    const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});

    const ctrl = makeController();
    Object.defineProperty(ctrl, "messageValue", { value: "フォールバック", configurable: true });
    const goSpy = jest.spyOn(ctrl, "go").mockImplementation(() => {});

    ctrl.connect();

    expect(alertSpy).toHaveBeenCalledWith("フォールバック");
    expect(goSpy).toHaveBeenCalled();
  });

  test("connect(): message 未設定時の alert デフォルト文言（完了しました）", () => {
    window.Swal = {}; // force fallback
    const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});

    const ctrl = makeController();
    // messageValue を与えない
    const goSpy = jest.spyOn(ctrl, "go").mockImplementation(() => {});

    ctrl.connect();

    expect(alertSpy).toHaveBeenCalledWith("完了しました");
    expect(goSpy).toHaveBeenCalled();
  });

  test("go(): Turbo.visit があればそれを使う（action: replace）", () => {
    const visitSpy = jest.fn();
    window.Turbo = { visit: visitSpy };

    const ctrl = makeController();
    Object.defineProperty(ctrl, "urlValue", { value: "/turbo-next", configurable: true });

    ctrl.go();

    expect(visitSpy).toHaveBeenCalledWith("/turbo-next", { action: "replace" });
  });

  test("go(): Turbo 無しなら location.replace を使う", () => {
    // Turbo 無し
    window.Turbo = undefined;

    // location を **差し替え**（spy しない）
    const originalLocation = window.location;
    let calledWith = null;

    try {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: { replace: (v) => { calledWith = v; }, href: "https://example.com/" },
      });
    } catch {
      try { delete window.location; } catch {}
      window.location = { replace: (v) => { calledWith = v; }, href: "https://example.com/" };
    }

    const ctrl = makeController();
    Object.defineProperty(ctrl, "urlValue", { value: "/plain-next", configurable: true });

    ctrl.go();

    expect(calledWith).toBe("/plain-next");

    // 復元
    try {
      Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    } catch {
      try { delete window.location; } catch {}
      window.location = originalLocation;
    }
  });

  // ★ ここを差し替え：デフォルト「/」は Turbo 経路で検証し、JSDOM の location を触らない
  test('go(): urlValue 未指定時は "/" が使われる（Turbo 経路で検証）', () => {
    const visitSpy = jest.fn();
    window.Turbo = { visit: visitSpy };

    const ctrl = makeController(); // urlValue は与えない
    ctrl.go();

    expect(visitSpy).toHaveBeenCalledWith("/", { action: "replace" });
  });
});
