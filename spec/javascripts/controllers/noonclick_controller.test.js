/**
 * noonclick_controller の網羅テスト
 * - goToRecommended: window.location.href = "/recommended"
 * - closeWindow: window.close() が呼ばれる
 * - confirmDelete: confirm=false → preventDefault/stopPropagation 実行
 *                  confirm=true  → 何もしない
 */

import { Application } from "@hotwired/stimulus";
import ControllerClass from "controllers/noonclick_controller";

describe("noonclick_controller", () => {
  let app, root, controller;
  const originalLocation = window.location;

  beforeEach(() => {
    document.body.innerHTML = "";
    app = Application.start();
    app.register("noonclick", ControllerClass);

    root = document.createElement("div");
    root.setAttribute("data-controller", "noonclick");
    document.body.appendChild(root);

    controller = app.getControllerForElementAndIdentifier(root, "noonclick");

    // ログ抑制（任意）
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

    jest.restoreAllMocks();
    document.body.innerHTML = "";
  });

  test("goToRecommended: window.location.href を /recommended に変更する", () => {
    // jsdom の location を差し替えて副作用を局所化
    // eslint-disable-next-line no-global-assign
    delete window.location;
    // eslint-disable-next-line no-global-assign
    window.location = { href: "http://localhost/" };

    controller.goToRecommended();

    expect(window.location.href).toBe("/recommended");
  });

  test("closeWindow: window.close() を1回呼ぶ", () => {
    if (!window.close) {
      // jsdom で未定義な場合に備えて定義
      // eslint-disable-next-line no-undef
      window.close = () => {};
    }
    const spy = jest.spyOn(window, "close").mockImplementation(() => {});
    controller.closeWindow();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test("confirmDelete: ユーザーがキャンセル(false)するとイベントをキャンセルする", () => {
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(false);
    const event = { preventDefault: jest.fn(), stopPropagation: jest.fn() };

    controller.confirmDelete(event);

    expect(confirmSpy).toHaveBeenCalledWith("本当にこのプレイリストを削除しますか？");
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
  });

  test("confirmDelete: ユーザーがOK(true)なら何もしない", () => {
    jest.spyOn(window, "confirm").mockReturnValue(true);
    const event = { preventDefault: jest.fn(), stopPropagation: jest.fn() };

    controller.confirmDelete(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
  });
});
