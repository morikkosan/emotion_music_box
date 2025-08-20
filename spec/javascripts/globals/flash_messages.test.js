/**
 * flash_messages.js 総合テスト（安定化＋行37/114まで到達）
 * - フェイク MutationObserver（明示トリガ）
 * - DOMContentLoaded は捕捉して必要時のみ実行（累積防止）
 * - bodyのdata-*は毎テストで確実にクリア
 */
describe("custom/flash_messages.js", () => {
  let originalLocation;
  let capturedDomReady = null;
  let addEventSpy;
  let originalAddEventListener;

  // ▼ フェイク MutationObserver
  let _observers;
  class FakeMutationObserver {
    constructor(cb) { this.cb = cb; _observers.push(this); }
    observe() {}
    disconnect() {}
    __triggerAdded(node) { this.cb([{ addedNodes: [node] }]); }
  }
  const triggerAllAdded = (node) => _observers.forEach((o) => o.__triggerAdded(node));

  const importModule = () => {
    jest.isolateModules(() => {
      require("custom/flash_messages.js");
    });
  };

  const flushAllTimers = async () => {
    await Promise.resolve();
    jest.runOnlyPendingTimers();
    await Promise.resolve();
  };

  const clearBodyFlashAttrs = () => {
    document.body.removeAttribute("data-flash-alert");
    document.body.removeAttribute("data-flash-notice");
    document.body.dataset.flashAlert = "";
    document.body.dataset.flashNotice = "";
  };

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();

    // フェイクMOへ差し替え
    _observers = [];
    global.MutationObserver = FakeMutationObserver;

    // DOM初期化（※body属性は残るので後で必ずクリア）
    document.body.innerHTML = `
      <meta name="csrf-token" content="csrf123" />
      <a id="logout-link" href="/logout">logout</a>
    `;
    clearBodyFlashAttrs();

    // Swal モック
    global.Swal = {
      fire: jest.fn().mockResolvedValue({ isConfirmed: true }),
    };

    // ログ静粛化
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});

    // location を絶対URL解決に
    originalLocation = window.location;
    Object.defineProperty(window, "location", {
      value: { href: "http://localhost/", assign: jest.fn(), replace: jest.fn() },
      writable: true,
      configurable: true,
    });

    // DOMContentLoaded 捕捉（登録はしない）
    capturedDomReady = null;
    originalAddEventListener = document.addEventListener;
    addEventSpy = jest
      .spyOn(document, "addEventListener")
      .mockImplementation(function (type, handler, options) {
        if (type === "DOMContentLoaded") { capturedDomReady = handler; return; }
        return originalAddEventListener.call(this, type, handler, options);
      });

    window._flashShownOnce = null;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    capturedDomReady = null;
    clearBodyFlashAttrs();
  });

  // --- 既存安定テスト群 ---

  test("MutationObserver経由で flashNotice を1回表示し、副作用を確認", async () => {
    importModule();

    const cont = document.createElement("div");
    cont.id = "flash-container";
    cont.dataset.flashNotice = "保存しました";
    document.body.appendChild(cont);

    triggerAllAdded(cont);
    await flushAllTimers();

    expect(Swal.fire).toHaveBeenCalledTimes(1);
    const opts = Swal.fire.mock.calls[0][0];
    expect(opts.icon).toBe("success");
    expect(opts.text).toBe("保存しました");
    expect(typeof opts.didClose).toBe("function");

    expect(document.body.dataset.flashNotice).toBe("");
    expect(document.querySelector("#flash-container")).toBeNull();

    expect(window._flashShownOnce).toBe("flashNotice:保存しました");
    opts.didClose();
    expect(window._flashShownOnce).toBeNull();
  });

  test("同一 notice は二重表示されず、didClose 後は再表示される（body.dataset経由）", async () => {
    importModule();

    const c1 = document.createElement("div");
    c1.id = "flash-container";
    c1.dataset.flashNotice = "OK";
    document.body.appendChild(c1);

    triggerAllAdded(c1);
    await flushAllTimers();

    expect(Swal.fire).toHaveBeenCalledTimes(1);
    const firstOpts = Swal.fire.mock.calls[0][0];
    expect(window._flashShownOnce).toBe("flashNotice:OK");

    document.body.dataset.flashNotice = "OK";
    window.showFlashSwal("直接呼び出し");
    expect(Swal.fire).toHaveBeenCalledTimes(1);

    firstOpts.didClose();
    document.body.dataset.flashNotice = "OK";
    window.showFlashSwal("再表示テスト");
    expect(Swal.fire).toHaveBeenCalledTimes(2);
    const secondOpts = Swal.fire.mock.calls[1][0];
    expect(secondOpts.icon).toBe("success");
    expect(secondOpts.text).toBe("OK");
  });

  test("flashAlert と flashNotice が同時にある場合、alert が優先され error で表示", async () => {
    importModule();

    const cont = document.createElement("div");
    cont.id = "flash-container";
    cont.dataset.flashAlert = "失敗しました";
    cont.dataset.flashNotice = "保存しました";
    document.body.appendChild(cont);

    triggerAllAdded(cont);
    await flushAllTimers();

    expect(Swal.fire).toHaveBeenCalledTimes(1);
    const opts = Swal.fire.mock.calls[0][0];
    expect(opts.icon).toBe("error");
    expect(opts.text).toBe("失敗しました");

    expect(document.body.dataset.flashAlert).toBe("");
    expect(document.querySelector("#flash-container")).toBeNull();
    expect(window._flashShownOnce).toBe("flashAlert:失敗しました");

    // error 側 didClose も実行
    opts.didClose();
  });

  test('flashAlert が "すでにログイン済みです" の場合は表示しない', async () => {
    importModule();

    const cont = document.createElement("div");
    cont.id = "flash-container";
    cont.dataset.flashAlert = "すでにログイン済みです";
    document.body.appendChild(cont);

    triggerAllAdded(cont);
    await flushAllTimers();

    expect(Swal.fire).not.toHaveBeenCalled();
    expect(document.querySelector("#flash-container")).not.toBeNull();
    expect(window._flashShownOnce).toBeNull();
  });

  test("Swal 未読込時は warn を出して安全に抜ける", () => {
    delete global.Swal;
    importModule();

    document.body.dataset.flashNotice = "OK";
    window.showFlashSwal("直接呼び出し");

    expect(console.warn).toHaveBeenCalled();
  });

  test("DOMContentLoaded 後に logout をクリック → 確認モーダル後、form.submit が呼ばれる (isConfirmed=true)", async () => {
  importModule();

  // ▼ 本番実装に合わせて：logout専用フォームを先にDOMへ
  const form = document.createElement("form");
  form.setAttribute("action", "/sign_out");
  form.setAttribute("method", "post");
  form.dataset.logoutForm = "true"; // data-logout-form="true"
  document.body.appendChild(form);

  // DOMContentLoaded をこのタイミングで発火（↑のフォームを拾わせる）
  expect(typeof capturedDomReady).toBe("function");
  capturedDomReady();

  // submit() を監視
  const submitSpy = jest
    .spyOn(HTMLFormElement.prototype, "submit")
    .mockImplementation(() => {});

  // ▼ submitイベントを発火（jsdomでは click だけだと送信されない事がある）
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

  // SweetAlert が開く
  expect(Swal.fire).toHaveBeenCalledTimes(1);
  const opts = Swal.fire.mock.calls[0][0];
  expect(opts.icon).toBe("question");
  expect(opts.showCancelButton).toBe(true);

  // didClose でガード解除も踏む
  window._flashShownOnce = "dummy";
  opts.didClose();
  expect(window._flashShownOnce).toBeNull();

  // resolve → form.submit() が呼ばれる
  await Promise.resolve();
  jest.runOnlyPendingTimers();
  await Promise.resolve();

  expect(submitSpy).toHaveBeenCalledTimes(1);
});


  test("logout キャンセル時は submit されない (isConfirmed=false)", async () => {
  // Swal をキャンセル解決に差し替え
  global.Swal = { fire: jest.fn().mockResolvedValue({ isConfirmed: false }) };

  importModule();

  // ▼ logout専用フォームを先にDOMへ
  const form = document.createElement("form");
  form.setAttribute("action", "/sign_out");
  form.setAttribute("method", "post");
  form.dataset.logoutForm = "true";
  document.body.appendChild(form);

  expect(typeof capturedDomReady).toBe("function");
  capturedDomReady();

  const submitSpy = jest
    .spyOn(HTMLFormElement.prototype, "submit")
    .mockImplementation(() => {});

  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

  await Promise.resolve();
  jest.runOnlyPendingTimers();
  await Promise.resolve();

  expect(Swal.fire).toHaveBeenCalledTimes(1);
  expect(submitSpy).not.toHaveBeenCalled();
});


  test("Swal 不在で logout submit → alert は出ず、デフォルト送信（preventDefault されない）", () => {
  delete global.Swal;

  importModule();

  // ▼ logout専用フォームを先にDOMへ
  const form = document.createElement("form");
  form.setAttribute("action", "/sign_out");
  form.setAttribute("method", "post");
  form.dataset.logoutForm = "true";
  document.body.appendChild(form);

  expect(typeof capturedDomReady).toBe("function");
  capturedDomReady();

  // alert は呼ばれない
  const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});

  // preventDefault されていないことを dispatch の戻り値で確認
  const ev = new Event("submit", { bubbles: true, cancelable: true });
  const result = form.dispatchEvent(ev);

  expect(alertSpy).not.toHaveBeenCalled();
  expect(result).toBe(true);                 // = preventDefault されていない
  expect(ev.defaultPrevented).toBe(false);   // 念のため
});


  test("hidden.bs.modal (cyber-popup) で _flashShownOnce がリセット（肯定分岐）", () => {
    importModule();

    window._flashShownOnce = "flashNotice:OK";
    const popupEl = document.createElement("div");
    popupEl.className = "cyber-popup";

    const ev = new Event("hidden.bs.modal", { bubbles: true });
    Object.defineProperty(ev, "target", { value: popupEl });
    document.dispatchEvent(ev);

    expect(window._flashShownOnce).toBeNull();
  });

  // --- 追加: 行37/114 をピンポイントで埋める ---

  test("alert の二重表示ガードに引っかかる（直接呼び出し）", () => {
    importModule();

    document.body.dataset.flashAlert = "失敗しました";
    window.showFlashSwal("call1");

    expect(Swal.fire).toHaveBeenCalledTimes(1);
    expect(window._flashShownOnce).toBe("flashAlert:失敗しました");

    // 同一メッセージ再度 → ガードで return
    document.body.dataset.flashAlert = "失敗しました";
    window.showFlashSwal("call2");

    expect(Swal.fire).toHaveBeenCalledTimes(1);
    const logged = console.log.mock.calls.some((c) => (c[0] || "").includes("二重発火防止（alert）"));
    expect(logged).toBe(true);
  });

  test("container 経由の notice 二重表示ガード（ガード時は container 残る）", async () => {
    importModule();

    // 1回目: notice 表示（Observer経由）
    const c1 = document.createElement("div");
    c1.id = "flash-container";
    c1.dataset.flashNotice = "OK";
    document.body.appendChild(c1);
    triggerAllAdded(c1);
    await flushAllTimers();

    expect(Swal.fire).toHaveBeenCalledTimes(1);
    const firstOpts = Swal.fire.mock.calls[0][0];
    expect(window._flashShownOnce).toBe("flashNotice:OK");

    // 2回目: container経由で同一 notice → ガードで return; し、DOM残骸は残る
    const c2 = document.createElement("div");
    c2.id = "flash-container";
    c2.dataset.flashNotice = "OK";
    document.body.appendChild(c2);

    window.showFlashSwal("direct");
    expect(Swal.fire).toHaveBeenCalledTimes(1);
    expect(document.querySelector("#flash-container")).not.toBeNull();

    // 解除後に再度表示 → c2 が消える
    firstOpts.didClose();
    window.showFlashSwal("again");
    expect(Swal.fire).toHaveBeenCalledTimes(2);
    expect(document.querySelector("#flash-container")).toBeNull();
  });

  test("DOMContentLoaded: #logout-link が存在しない場合は早期 return（UI副作用なし）", () => {
    importModule();

    // #logout-link を取り除く
    const link = document.getElementById("logout-link");
    link.parentNode.removeChild(link);

    expect(typeof capturedDomReady).toBe("function");
    capturedDomReady(); // ← ここで if (!logoutLink) return; を通す

    // 何も起きないこと（Swal.fire が増えない/イベント未発火）
    expect(Swal.fire).toHaveBeenCalledTimes(0);
  });

  test("hidden.bs.modal: Element 以外(Textノード)が target でも落ちずに何も起きない（optional chaining 経路）", () => {
    importModule();

    window._flashShownOnce = "flashNotice:SOMETHING";

    // Textノードでイベントを発火（bubbles: true で document まで上げる）
    const textNode = document.createTextNode("x");
    document.body.appendChild(textNode);
    const ev = new Event("hidden.bs.modal", { bubbles: true });
    textNode.dispatchEvent(ev);

    // 何も変化しない（resetログも出ない）
    expect(window._flashShownOnce).toBe("flashNotice:SOMETHING");
    const resetLogged = console.log.mock.calls.some((c) => (c[0] || "").includes("モーダル閉じでリセット"));
    expect(resetLogged).toBe(false);
  });

  // ★ ここが追加（CSRFメタ無しの else 分岐を踏む）
  test("logout 確認OK時: csrf meta が無い分岐（authenticity_token 未付与でも submit する）", async () => {
  // meta を import 前に除去しておく
  const meta = document.querySelector('meta[name="csrf-token"]');
  if (meta) meta.parentNode.removeChild(meta);

  importModule();

  // ▼ logout専用フォームを先にDOMへ
  const form = document.createElement("form");
  form.setAttribute("action", "/sign_out");
  form.setAttribute("method", "post");
  form.dataset.logoutForm = "true";
  document.body.appendChild(form);

  expect(typeof capturedDomReady).toBe("function");
  capturedDomReady();

  const submitSpy = jest
    .spyOn(HTMLFormElement.prototype, "submit")
    .mockImplementation(() => {});

  // 送信フロー開始
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

  await Promise.resolve();
  jest.runOnlyPendingTimers();
  await Promise.resolve();

  // Swal が1回開いた後に submit 実行
  expect(Swal.fire).toHaveBeenCalledTimes(1);
  expect(submitSpy).toHaveBeenCalled();

  // authenticity_token は追加されない（フォーム経路では生成しない想定）
  const tokenInput = document.querySelector('input[name="authenticity_token"]');
  expect(tokenInput).toBeNull();
});

});
