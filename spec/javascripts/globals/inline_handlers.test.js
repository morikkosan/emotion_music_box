// spec/javascripts/custom/inline_handlers.test.js
/**
 * inline_handlers.js の統合テスト（分岐網羅）
 * - DOMContentLoaded / turbo:load の各イベントにぶら下がる setupInlineHandlers を直接実行
 * - goToRecommended（成功/未保存）/ closeWindow / confirm(playlist/account, OK/Cancel) /
 *   auto-submit(select change) / 二重初期化での重複リスナ抑止 を検証
 * - window.location.href 代入は JSDOM の navigation 例外を避けるため上書きモック
 */

const loadModuleAndCaptureSetups = () => {
  jest.resetModules();

  let domLoadedHandler = null;
  let turboLoadHandler = null;

  // import 時に addEventListener に登録されるコールバックを捕捉
  const addSpy = jest.spyOn(document, "addEventListener").mockImplementation((type, cb) => {
    if (type === "DOMContentLoaded") domLoadedHandler = cb;
    if (type === "turbo:load") turboLoadHandler = cb;
    // 実際の登録は行わない（テスト間の汚染を防ぐ）
  });

  jest.isolateModules(() => {
    require("custom/inline_handlers.js");
  });

  addSpy.mockRestore();

  return { domLoadedHandler, turboLoadHandler };
};

const dispatchClick = (el) => {
  const evt = new MouseEvent("click", { bubbles: true, cancelable: true });
  const spy = jest.spyOn(evt, "preventDefault");
  el.dispatchEvent(evt);
  return { evt, preventSpy: spy };
};

const dispatchChange = (el) => {
  const evt = new Event("change", { bubbles: true, cancelable: true });
  const spy = jest.spyOn(evt, "preventDefault");
  el.dispatchEvent(evt);
  return { evt, preventSpy: spy };
};

describe("custom/inline_handlers.js", () => {
  let originalLocation;

  beforeEach(() => {
    // 画面をリセット
    document.body.innerHTML = "";
    localStorage.clear();

    // console のノイズ抑制（必要なら外してOK）
    jest.spyOn(console, "log").mockImplementation(() => {});

    // alert / confirm / close をモック
    if (!window.alert) window.alert = () => {};
    if (!window.confirm) window.confirm = () => {};
    if (!window.close) window.close = () => {};
    jest.spyOn(window, "alert").mockImplementation(() => {});
    jest.spyOn(window, "confirm").mockReturnValue(true);
    jest.spyOn(window, "close").mockImplementation(() => {});

    // location.href 代入で Navigation 例外が出ないように一時上書き
    originalLocation = window.location;
    // jsdom でも delete → 再代入で上書きできる
    // （環境により不可の場合は Object.defineProperty で writable: true を付ける方法に切替）
    // eslint-disable-next-line no-undef
    delete window.location;
    window.location = {
      ...originalLocation,
      href: "http://localhost/",
      assign: jest.fn(),
      replace: jest.fn(),
    };
  });

  afterEach(() => {
    // 復元
    // eslint-disable-next-line no-undef
    delete window.location;
    window.location = originalLocation;
    jest.restoreAllMocks();
  });

  test("モジュール読み込み時に window._flashShownOnce が null 設定される", () => {
    const { domLoadedHandler, turboLoadHandler } = loadModuleAndCaptureSetups();
    expect(window._flashShownOnce).toBeNull();
    expect(typeof domLoadedHandler).toBe("function");
    expect(typeof turboLoadHandler).toBe("function");
  });

  test("DOMContentLoaded 発火で setupInlineHandlers が走る（ログ確認）", () => {
    const { domLoadedHandler } = loadModuleAndCaptureSetups();

    // 適当な要素を置いておく（クエリ実行のため）
    document.body.innerHTML = `
      <button class="go-to-recommended-btn"></button>
      <button class="close-window-btn"></button>
    `;

    domLoadedHandler(); // setupInlineHandlers 実行
    expect(console.log).toHaveBeenCalledWith("setupInlineHandlers ran.");
  });

  describe("おすすめボタン（goToRecommended）", () => {
    test("hpPercentage が保存されている場合、/emotion_logs/recommended?hp=XX に遷移先が設定される", () => {
      const { domLoadedHandler } = loadModuleAndCaptureSetups();

      document.body.innerHTML = `<button class="go-to-recommended-btn">go</button>`;
      localStorage.setItem("hpPercentage", "88");

      domLoadedHandler();

      const btn = document.querySelector(".go-to-recommended-btn");
      dispatchClick(btn);

      expect(window.location.href).toContain("/emotion_logs/recommended?hp=88");
      expect(window.alert).not.toHaveBeenCalled();
    });

    test("hpPercentage が無い場合、alert が表示され preventDefault される", () => {
      const { domLoadedHandler } = loadModuleAndCaptureSetups();

      document.body.innerHTML = `<button class="go-to-recommended-btn">go</button>`;
      localStorage.removeItem("hpPercentage");

      domLoadedHandler();

      const btn = document.querySelector(".go-to-recommended-btn");
      const { preventSpy } = dispatchClick(btn);

      expect(window.alert).toHaveBeenCalledTimes(1);
      // goToRecommended 内で preventDefault は wrapper 側で行っている
      expect(preventSpy).toHaveBeenCalled();
    });

    test("二重初期化してもリスナが重複しない（クリック2回で window.goToRecommended 2回のみ）", () => {
      const { domLoadedHandler } = loadModuleAndCaptureSetups();

      document.body.innerHTML = `<button class="go-to-recommended-btn">go</button>`;
      // wrapper が呼ぶ先をスパイ化
      window.goToRecommended = jest.fn();

      // 初期化を2回呼ぶ（重複しないことを確認）
      domLoadedHandler();
      domLoadedHandler();

      const btn = document.querySelector(".go-to-recommended-btn");
      btn.click();
      btn.click();

      expect(window.goToRecommended).toHaveBeenCalledTimes(2);
    });
  });

  describe("ページを閉じるボタン（closeWindow）", () => {
    test("クリックで preventDefault され、window.closeWindow が呼ばれる", () => {
      const { domLoadedHandler } = loadModuleAndCaptureSetups();

      document.body.innerHTML = `<button class="close-window-btn">close</button>`;
      // 呼び先をスパイ
      window.closeWindow = jest.fn();

      domLoadedHandler();

      const btn = document.querySelector(".close-window-btn");
      const { preventSpy } = dispatchClick(btn);

      expect(preventSpy).toHaveBeenCalled();
      expect(window.closeWindow).toHaveBeenCalledTimes(1);
    });
  });

  describe("プレイリスト削除 confirm（.playlist-delete-btn）", () => {
    test("キャンセル(false)なら preventDefault される", () => {
      const { domLoadedHandler } = loadModuleAndCaptureSetups();

      document.body.innerHTML = `<a href="#" class="playlist-delete-btn">del</a>`;
      window.confirm.mockReturnValue(false);

      domLoadedHandler();

      const a = document.querySelector(".playlist-delete-btn");
      const { preventSpy } = dispatchClick(a);

      expect(window.confirm).toHaveBeenCalled();
      expect(preventSpy).toHaveBeenCalled();
    });

    test("OK(true)なら preventDefault されない", () => {
      const { domLoadedHandler } = loadModuleAndCaptureSetups();

      document.body.innerHTML = `<a href="#" class="playlist-delete-btn">del</a>`;
      window.confirm.mockReturnValue(true);

      domLoadedHandler();

      const a = document.querySelector(".playlist-delete-btn");
      const { preventSpy } = dispatchClick(a);

      expect(window.confirm).toHaveBeenCalled();
      expect(preventSpy).not.toHaveBeenCalled();
    });
  });

  describe("アカウント削除 confirm（.account-delete-btn）", () => {
    test("キャンセル(false)なら preventDefault される", () => {
      const { domLoadedHandler } = loadModuleAndCaptureSetups();

      document.body.innerHTML = `<a href="#" class="account-delete-btn">del</a>`;
      window.confirm.mockReturnValue(false);

      domLoadedHandler();

      const a = document.querySelector(".account-delete-btn");
      const { preventSpy } = dispatchClick(a);

      expect(window.confirm).toHaveBeenCalled();
      expect(preventSpy).toHaveBeenCalled();
    });

    test("OK(true)なら preventDefault されない", () => {
      const { domLoadedHandler } = loadModuleAndCaptureSetups();

      document.body.innerHTML = `<a href="#" class="account-delete-btn">del</a>`;
      window.confirm.mockReturnValue(true);

      domLoadedHandler();

      const a = document.querySelector(".account-delete-btn");
      const { preventSpy } = dispatchClick(a);

      expect(window.confirm).toHaveBeenCalled();
      expect(preventSpy).not.toHaveBeenCalled();
    });
  });

  describe("EMOTION セレクト自動送信（.auto-submit-emotion）", () => {
    test("change で所属フォームの submit が呼ばれる", () => {
      const { domLoadedHandler } = loadModuleAndCaptureSetups();

      document.body.innerHTML = `
        <form id="f1">
          <select class="auto-submit-emotion" name="emotion">
            <option value="happy">happy</option>
          </select>
        </form>
      `;
      const form = document.getElementById("f1");
      form.submit = jest.fn();

      domLoadedHandler();

      const select = document.querySelector(".auto-submit-emotion");
      dispatchChange(select);

      expect(form.submit).toHaveBeenCalledTimes(1);
    });
  });

  test("turbo:load でも setupInlineHandlers は実行される", () => {
    const { turboLoadHandler } = loadModuleAndCaptureSetups();

    document.body.innerHTML = `
      <button class="go-to-recommended-btn"></button>
      <a href="#" class="playlist-delete-btn"></a>
      <a href="#" class="account-delete-btn"></a>
      <button class="close-window-btn"></button>
      <form><select class="auto-submit-emotion"></select></form>
    `;

    turboLoadHandler();
    expect(console.log).toHaveBeenCalledWith("setupInlineHandlers ran.");
  });
});
