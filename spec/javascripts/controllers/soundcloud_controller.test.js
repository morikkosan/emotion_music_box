/**
 * soundcloud_controller の網羅テスト
 * - open(event):
 *   - event.preventDefault() を呼ぶ
 *   - window.open を正しい引数で呼ぶ
 *   - setInterval は 500ms でセットされる
 *   - popup.closed=false の間は reload されない
 *   - popup.closed=true になると clearInterval + window.location.reload()
 *   - window.open が null を返す（ポップアップブロック等）場合も reload される
 */

import { Application } from "@hotwired/stimulus";
import ControllerClass from "controllers/soundcloud_controller";

describe("soundcloud_controller", () => {
  let app, root, controller;
  const originalLocation = window.location;

  beforeEach(() => {
    jest.useFakeTimers();

    document.body.innerHTML = "";
    app = Application.start();
    app.register("soundcloud", ControllerClass);

    root = document.createElement("div");
    root.setAttribute("data-controller", "soundcloud");
    document.body.appendChild(root);

    controller = app.getControllerForElementAndIdentifier(root, "soundcloud");

    // consoleノイズ抑制（任意）
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    app.stop();

    // location を元に戻す
    if (window.location !== originalLocation) {
      // eslint-disable-next-line no-global-assign
      window.location = originalLocation;
    }

    jest.clearAllTimers();
    jest.restoreAllMocks();
    document.body.innerHTML = "";
  });

  test("open(): preventDefault を呼ぶ & window.open を正しい引数で呼ぶ", () => {
    const evt = { preventDefault: jest.fn() };

    const openSpy = jest.spyOn(window, "open").mockReturnValue({
      closed: false,
    });

    controller.open(evt);

    expect(evt.preventDefault).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(
      "/auth/soundcloud?display=popup",
      "soundcloud_popup",
      "width=600,height=700,left=100,top=100,scrollbars=yes"
    );
  });

  test("open(): setInterval は 500ms でセットされる", () => {
    const evt = { preventDefault: jest.fn() };
    jest.spyOn(window, "open").mockReturnValue({ closed: false });

    const si = jest.spyOn(global, "setInterval");
    controller.open(evt);

    expect(si).toHaveBeenCalledTimes(1);
    expect(si).toHaveBeenCalledWith(expect.any(Function), 500);
  });

  test("open(): popup.closed=false の間は reload されず、true になると reload される", () => {
    const evt = { preventDefault: jest.fn() };

    // popup オブジェクトを保持し、後で closed を切り替える
    const popup = { closed: false };
    jest.spyOn(window, "open").mockReturnValue(popup);

    // location.reload をモック
    // eslint-disable-next-line no-global-assign
    delete window.location;
    // eslint-disable-next-line no-global-assign
    window.location = { reload: jest.fn() };

    const ci = jest.spyOn(global, "clearInterval");

    controller.open(evt);

    // 最初の 500ms → closed=false なので reload されない
    jest.advanceTimersByTime(500);
    expect(window.location.reload).not.toHaveBeenCalled();
    expect(ci).not.toHaveBeenCalled();

    // 閉じられたことにする → 次のtickで reload
    popup.closed = true;
    jest.advanceTimersByTime(500);

    expect(window.location.reload).toHaveBeenCalledTimes(1);
    expect(ci).toHaveBeenCalledTimes(1);
    expect(ci).toHaveBeenCalledWith(expect.any(Number)); // interval IDでクリア
  });

  test("open(): window.open が null（ポップアップブロック等）の場合、最初のtickで reload される", () => {
    const evt = { preventDefault: jest.fn() };

    jest.spyOn(window, "open").mockReturnValue(null);

    // eslint-disable-next-line no-global-assign
    delete window.location;
    // eslint-disable-next-line no-global-assign
    window.location = { reload: jest.fn() };

    const ci = jest.spyOn(global, "clearInterval");

    controller.open(evt);

    // 最初の 500ms tick で !popup 判定 → reload
    jest.advanceTimersByTime(500);

    expect(window.location.reload).toHaveBeenCalledTimes(1);
    expect(ci).toHaveBeenCalledTimes(1);
    expect(ci).toHaveBeenCalledWith(expect.any(Number));
  });

  test("open(): window.open が {closed:true} を返す場合も、最初のtickで reload される", () => {
    const evt = { preventDefault: jest.fn() };

    jest.spyOn(window, "open").mockReturnValue({ closed: true });

    // eslint-disable-next-line no-global-assign
    delete window.location;
    // eslint-disable-next-line no-global-assign
    window.location = { reload: jest.fn() };

    const ci = jest.spyOn(global, "clearInterval");

    controller.open(evt);

    jest.advanceTimersByTime(500);

    expect(window.location.reload).toHaveBeenCalledTimes(1);
    expect(ci).toHaveBeenCalledTimes(1);
    expect(ci).toHaveBeenCalledWith(expect.any(Number));
  });
});
