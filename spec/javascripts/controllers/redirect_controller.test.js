/**
 * redirect_controller テスト
 * - connect 時に 1200ms 後、data-redirect-url の値へ window.location.href を変更
 * - Stimulus の this.data.get('url') はテスト側で最小モック
 */

import RedirectController from "controllers/redirect_controller";

describe("redirect_controller", () => {
  let controller, root;
  let originalLocation;

  beforeEach(() => {
    jest.useFakeTimers();

    // window.location をテスト用に差し替え（書き換え可能に）
    originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { href: "https://test.local/initial" },
    });

    // data-controller と data-redirect-url を持つ要素
    root = document.createElement("div");
    root.setAttribute("data-controller", "redirect");
    root.setAttribute("data-redirect-url", "/next");

    // コントローラインスタンスを手動で生成
    controller = new RedirectController();
    controller.element = root;
    // Stimulusの this.data.get('url') を最小モック
    controller.data = {
      get: (key) => (key === "url" ? root.getAttribute("data-redirect-url") : null),
    };
  });

  afterEach(() => {
    // window.location を元に戻す
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
    jest.useRealTimers();
  });

  test("connect後、1200ms 経過で href が data-redirect-url に切り替わる（相対URL）", () => {
    expect(window.location.href).toBe("https://test.local/initial");

    controller.connect(); // setTimeout(1200) が仕込まれる

    // まだ変わらない
    jest.advanceTimersByTime(1199);
    expect(window.location.href).toBe("https://test.local/initial");

    // 1200ms 到達で遷移
    jest.advanceTimersByTime(1);
    expect(window.location.href).toBe("/next");
  });

  test("絶対URLでも 1200ms 後に切り替わる", () => {
    // 入力を絶対URLに変更
    root.setAttribute("data-redirect-url", "https://example.com/done");

    controller.connect();

    jest.advanceTimersByTime(1200);
    expect(window.location.href).toBe("https://example.com/done");
  });
});
