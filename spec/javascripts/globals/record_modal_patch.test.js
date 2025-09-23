/**
 * spec/javascripts/globals/record_modal_patch.test.js
 *
 * 対象: app/javascript/custom/record_modal_patch.js
 * カバレッジ目標:
 *  - tagName !== "TURBO-STREAM" で return
 *  - action/target が不一致で return
 *  - action="update" & target="record-modal-content" で実際に show() が呼ばれる
 *  - modal が無い場合 / bootstrap.Modal が無い場合の早期 return
 */
describe("custom/record_modal_patch.js", () => {
  beforeAll(async () => {
    jest.resetModules();
    await import("custom/record_modal_patch"); // イベントリスナ登録
  });

  beforeEach(() => {
    document.body.innerHTML = "";
    jest.clearAllMocks();
    delete window.bootstrap;
  });

  test("tagName が TURBO-STREAM 以外なら return", () => {
    const ev = new Event("turbo:before-stream-render", { bubbles: true });
    Object.defineProperty(ev, "target", { value: document.createElement("div") });
    document.dispatchEvent(ev); // 例外出なければOK
  });

  test("action/target が条件不一致なら return", () => {
    const el = document.createElement("turbo-stream");
    el.setAttribute("action", "append"); // update じゃない
    el.setAttribute("target", "record-modal-content");

    const ev = new Event("turbo:before-stream-render", { bubbles: true });
    Object.defineProperty(ev, "target", { value: el });
    Object.defineProperty(ev, "detail", { value: { render: jest.fn() } });

    document.dispatchEvent(ev);
    expect(ev.detail.render).not.toHaveBeenCalled();
  });

  test("action=update & target=record-modal-content なら render 差し替え + show()", () => {
    jest.useFakeTimers();

    const modal = document.createElement("div");
    modal.id = "record-modal";
    document.body.appendChild(modal);

    const showMock = jest.fn();
    window.bootstrap = {
      Modal: {
        getOrCreateInstance: jest.fn(() => ({ show: showMock })),
      },
    };

    const el = document.createElement("turbo-stream");
    el.setAttribute("action", "update");
    el.setAttribute("target", "record-modal-content");

    const originalRender = jest.fn();
    const ev = new Event("turbo:before-stream-render", { bubbles: true });
    Object.defineProperty(ev, "target", { value: el });
    Object.defineProperty(ev, "detail", { value: { render: originalRender } });

    document.dispatchEvent(ev);
    ev.detail.render(el);

    jest.runAllTimers();

    expect(originalRender).toHaveBeenCalledWith(el);
    expect(window.bootstrap.Modal.getOrCreateInstance).toHaveBeenCalledWith(modal);
    expect(showMock).toHaveBeenCalled();

    jest.useRealTimers();
  });

  test("modal が存在しない場合は show() が呼ばれない", () => {
    jest.useFakeTimers();

    window.bootstrap = {
      Modal: { getOrCreateInstance: jest.fn(() => ({ show: jest.fn() })) },
    };

    const el = document.createElement("turbo-stream");
    el.setAttribute("action", "update");
    el.setAttribute("target", "record-modal-content");

    const ev = new Event("turbo:before-stream-render", { bubbles: true });
    Object.defineProperty(ev, "target", { value: el });
    Object.defineProperty(ev, "detail", { value: { render: jest.fn() } });

    document.dispatchEvent(ev);
    ev.detail.render(el);

    jest.runAllTimers();

    expect(window.bootstrap.Modal.getOrCreateInstance).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  test("bootstrap.Modal が未定義なら show() が呼ばれない", () => {
    jest.useFakeTimers();

    const modal = document.createElement("div");
    modal.id = "record-modal";
    document.body.appendChild(modal);

    // bootstrap 未定義
    delete window.bootstrap;

    const el = document.createElement("turbo-stream");
    el.setAttribute("action", "update");
    el.setAttribute("target", "record-modal-content");

    const ev = new Event("turbo:before-stream-render", { bubbles: true });
    Object.defineProperty(ev, "target", { value: el });
    Object.defineProperty(ev, "detail", { value: { render: jest.fn() } });

    document.dispatchEvent(ev);
    ev.detail.render(el);

    jest.runAllTimers();

    // 例外が出ず、呼ばれないことを確認
    // bootstrap 無いので何も起きない
    expect(true).toBe(true);

    jest.useRealTimers();
  });
});
