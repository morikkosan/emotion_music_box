/**
 * spec/javascripts/globals/record_modal_patch.test.js
 *
 * 対象: app/javascript/custom/record_modal_patch.js
 * カバレッジ目標:
 *  - tagName !== "TURBO-STREAM" で return
 *  - action/target が不一致で return
 *  - action="update" & target="record-modal-content" で実際に show() が呼ばれる
 */
describe("custom/record_modal_patch.js", () => {
  beforeAll(async () => {
    jest.resetModules();
    await import("custom/record_modal_patch"); // イベントリスナ登録
  });

  beforeEach(() => {
    document.body.innerHTML = "";
    jest.clearAllMocks();
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

    document.dispatchEvent(ev); // render が上書きされない
    expect(ev.detail.render).not.toHaveBeenCalled();
  });

  test("action=update & target=record-modal-content なら render 差し替え + show()", () => {
  jest.useFakeTimers(); // ★ 追加

  // DOM準備
  const modal = document.createElement("div");
  modal.id = "record-modal";
  document.body.appendChild(modal);

  const showMock = jest.fn();
  window.bootstrap = {
    Modal: {
      getOrCreateInstance: jest.fn(() => ({ show: showMock })),
    },
  };

  // turbo-stream 要素
  const el = document.createElement("turbo-stream");
  el.setAttribute("action", "update");
  el.setAttribute("target", "record-modal-content");

  const originalRender = jest.fn();
  const ev = new Event("turbo:before-stream-render", { bubbles: true });
  Object.defineProperty(ev, "target", { value: el });
  Object.defineProperty(ev, "detail", { value: { render: originalRender } });

  document.dispatchEvent(ev);

  // 差し替え後の render を呼ぶ
  ev.detail.render(el);

  // requestAnimationFrame を実行させる
  jest.runAllTimers(); // ★ 追加

  expect(originalRender).toHaveBeenCalledWith(el);
  expect(window.bootstrap.Modal.getOrCreateInstance).toHaveBeenCalledWith(modal);
  expect(showMock).toHaveBeenCalled();

  jest.useRealTimers(); // ★ 忘れずに戻す
});

});
