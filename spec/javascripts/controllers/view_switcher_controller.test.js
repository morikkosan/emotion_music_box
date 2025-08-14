/**
 * view_switcher_controller の網羅テスト
 */

import { Application } from "@hotwired/stimulus";
import ControllerClass from "controllers/view_switcher_controller";

// ---------- ヘルパ ----------
const setInnerWidth = (w) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: w,
  });
};

const pushPath = (path) => {
  window.history.pushState({}, "", path);
};

const dispatchResize = () => {
  window.dispatchEvent(new Event("resize"));
};

const dispatchPopstate = () => {
  window.dispatchEvent(new PopStateEvent("popstate"));
};

const buildViews = () => {
  const desktop = document.createElement("div");
  desktop.id = "desktop-view";
  const mobile = document.createElement("div");
  mobile.id = "mobile-view";
  document.body.appendChild(desktop);
  document.body.appendChild(mobile);
  return { desktop, mobile };
};

const buildFooter = () => {
  const wrap = document.createElement("div");
  wrap.className = "mobile-footer";

  const mkItem = (iconClass) => {
    const parent = document.createElement("div");
    parent.className = "text-center text-white small";
    const i = document.createElement("i");
    i.className = iconClass;
    parent.appendChild(i);
    return parent;
  };

  wrap.appendChild(mkItem("bi-house"));
  wrap.appendChild(mkItem("bi-person"));
  wrap.appendChild(mkItem("bi-heart"));
  wrap.appendChild(mkItem("bi-fire"));

  document.body.appendChild(wrap);
  return wrap;
};

describe("view_switcher_controller", () => {
  let app;
  let root;
  let controller;

  const originalLocation = window.location;

  beforeEach(() => {
    document.body.innerHTML = "";
    app = Application.start();
    app.register("view-switcher", ControllerClass);

    root = document.createElement("div");
    root.setAttribute("data-controller", "view-switcher");
    document.body.appendChild(root);

    setInnerWidth(1200);
    pushPath("/");

    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    if (controller && typeof controller.disconnect === "function") {
      controller.disconnect();
    }
    app?.stop();

    if (window.location !== originalLocation) {
      // eslint-disable-next-line no-global-assign
      window.location = originalLocation;
    }

    jest.restoreAllMocks();
    document.body.innerHTML = "";
  });

  test("smoke", () => {
    expect(true).toBe(true);
  });

  test("対象外ページ: desktop表示, mobile非表示で早期return", () => {
    const { desktop, mobile } = buildViews();
    pushPath("/settings");

    controller = app.getControllerForElementAndIdentifier(root, "view-switcher");

    expect(desktop.classList.contains("view-hidden")).toBe(false);
    expect(mobile.classList.contains("view-hidden")).toBe(true);
  });

  test("対象ページ + デスクトップ幅 → desktop表示/mobile非表示 → resizeで反転", () => {
    const { desktop, mobile } = buildViews();
    pushPath("/emotion_logs");
    setInnerWidth(1200);

    controller = app.getControllerForElementAndIdentifier(root, "view-switcher");

    expect(desktop.classList.contains("view-hidden")).toBe(false);
    expect(mobile.classList.contains("view-hidden")).toBe(true);

    setInnerWidth(480);
    dispatchResize();

    expect(desktop.classList.contains("view-hidden")).toBe(true);
    expect(mobile.classList.contains("view-hidden")).toBe(false);
  });

  test("対象ページ + モバイル幅 → mobile表示/desktop非表示 → resizeで反転", () => {
    const { desktop, mobile } = buildViews();
    pushPath("/emotion_logs/index");
    setInnerWidth(480);

    controller = app.getControllerForElementAndIdentifier(root, "view-switcher");

    expect(desktop.classList.contains("view-hidden")).toBe(true);
    expect(mobile.classList.contains("view-hidden")).toBe(false);

    setInnerWidth(1200);
    dispatchResize();

    expect(desktop.classList.contains("view-hidden")).toBe(false);
    expect(mobile.classList.contains("view-hidden")).toBe(true);
  });

  test("特殊分岐: モバイル幅かつ /emotion_logs/bookmarks → /emotion_logs へ replace()", () => {
    buildViews();
    setInnerWidth(480);
    pushPath("/emotion_logs/bookmarks");

    // eslint-disable-next-line no-global-assign
    delete window.location;
    // eslint-disable-next-line no-global-assign
    window.location = {
      pathname: "/emotion_logs/bookmarks",
      replace: jest.fn(),
      href: "http://localhost/emotion_logs/bookmarks",
    };

    controller = app.getControllerForElementAndIdentifier(root, "view-switcher");

    expect(window.location.replace).toHaveBeenCalledTimes(1);
    expect(window.location.replace).toHaveBeenCalledWith("/emotion_logs");
  });

  test("highlightActiveFooter: 各パスでactiveが正しく付与", () => {
    buildViews();
    const footer = buildFooter();

    pushPath("/");
    setInnerWidth(480);
    controller = app.getControllerForElementAndIdentifier(root, "view-switcher");

    const parents = footer.querySelectorAll(".text-center.text-white.small");
    const [homeP, personP, heartP, fireP] = parents;

    expect(homeP.classList.contains("active")).toBe(true);
    expect(personP.classList.contains("active")).toBe(false);
    expect(heartP.classList.contains("active")).toBe(false);
    expect(fireP.classList.contains("active")).toBe(false);

    pushPath("/my_emotion_logs");
    dispatchPopstate();
    expect(homeP.classList.contains("active")).toBe(false);
    expect(personP.classList.contains("active")).toBe(true);
    expect(heartP.classList.contains("active")).toBe(false);
    expect(fireP.classList.contains("active")).toBe(false);

    pushPath("/emotion_logs/bookmarks");
    dispatchPopstate();
    expect(homeP.classList.contains("active")).toBe(false);
    expect(personP.classList.contains("active")).toBe(false);
    expect(heartP.classList.contains("active")).toBe(true);
    expect(fireP.classList.contains("active")).toBe(false);

    pushPath("/recommended");
    dispatchPopstate();
    expect(homeP.classList.contains("active")).toBe(false);
    expect(personP.classList.contains("active")).toBe(false);
    expect(heartP.classList.contains("active")).toBe(false);
    expect(fireP.classList.contains("active")).toBe(true);
  });

  test("イベント配線と解除: 同じ関数参照で remove される（resize/popstate）", () => {
    buildViews();
    pushPath("/emotion_logs");
    setInnerWidth(1200);

    const addSpy = jest.spyOn(window, "addEventListener");
    const removeSpy = jest.spyOn(window, "removeEventListener");

    controller = app.getControllerForElementAndIdentifier(root, "view-switcher");

    // 登録された関数参照を取得
    const resizeAdd = addSpy.mock.calls.find(c => c[0] === "resize");
    const popAdd    = addSpy.mock.calls.find(c => c[0] === "popstate");
    expect(resizeAdd).toBeTruthy();
    expect(popAdd).toBeTruthy();

    const resizeFn = resizeAdd[1];
    const popFn    = popAdd[1];

    // disconnect → 同じ参照で remove されること
    controller.disconnect();

    expect(removeSpy).toHaveBeenCalledWith("resize", resizeFn);
    expect(removeSpy).toHaveBeenCalledWith("popstate", popFn);
  });

  test("対象外ページ + 片方のビューしか存在しない場合の分岐（存在チェック）", () => {
    // desktop のみ
    const desktop = document.createElement("div");
    desktop.id = "desktop-view";
    document.body.appendChild(desktop);

    pushPath("/not-target");
    controller = app.getControllerForElementAndIdentifier(root, "view-switcher");
    expect(desktop.classList.contains("view-hidden")).toBe(false);

    // 後片付け
    controller.disconnect();
    desktop.remove();

    // mobile のみ
    const mobile = document.createElement("div");
    mobile.id = "mobile-view";
    document.body.appendChild(mobile);

    pushPath("/another-not-target");
    controller = app.getControllerForElementAndIdentifier(root, "view-switcher");
    expect(mobile.classList.contains("view-hidden")).toBe(true);
  });
});
