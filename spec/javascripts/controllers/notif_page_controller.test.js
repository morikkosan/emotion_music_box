/**
 * notif_page_controller のユニットテスト（valuesは手動配線）
 * - Stimulus スタブは targets のみ自動配線、values は未実装のため
 *   各テストで controller.hasXxxValue / controller.xxxValue をセットして
 *   onIndexConnect / onModalConnect / onPageConnect を直接呼び出す。
 * - connect() による初期イベント発火の影響は mockClear() でリセットしてから検証。
 * - connect() の分岐網羅テストも含む。
 */

import { Application } from "@hotwired/stimulus";
import ControllerClass from "../../../app/javascript/controllers/notif_page_controller";

describe("notif_page_controller", () => {
  let app;

  beforeEach(() => {
    document.body.innerHTML = "";
    app = Application.start();
    app.register("notif-page", ControllerClass);
  });

  afterEach(() => {
    try { app?.stop(); } catch (_) {}
    jest.restoreAllMocks();
    if (window.bootstrap && window.bootstrap.__TEST_INJECTED__) {
      delete window.bootstrap;
    }
  });

  function mount(html) {
    document.body.innerHTML = html;
    const el = document.querySelector("[data-controller='notif-page']");
    expect(el).toBeTruthy();
    const controller = app.getControllerForElementAndIdentifier(el, "notif-page");
    expect(controller).toBeTruthy();
    return { el, controller };
  }

  test("index: justMarked=true → notifications:refresh-badge を1回発火", () => {
    const spy = jest.spyOn(window, "dispatchEvent");
    const { controller } = mount(`<div data-controller="notif-page"></div>`);
    spy.mockClear();

    controller.hasJustMarkedValue = true;
    controller.justMarkedValue = true;

    controller.onIndexConnect();

    expect(spy).toHaveBeenCalledTimes(1);
    const evt = spy.mock.calls[0][0];
    expect(evt).toBeInstanceOf(CustomEvent);
    expect(evt.type).toBe("notifications:refresh-badge");
    expect(evt.detail).toEqual({ source: "index" });
  });

  test("index: justMarked=false（or 未指定）→ 発火なし", () => {
    const spy = jest.spyOn(window, "dispatchEvent");
    const { controller } = mount(`<div data-controller="notif-page"></div>`);
    spy.mockClear();

    controller.hasJustMarkedValue = true;
    controller.justMarkedValue = false;
    controller.onIndexConnect();
    expect(spy).not.toHaveBeenCalled();

    spy.mockClear();
    controller.hasJustMarkedValue = false;
    delete controller.justMarkedValue;
    controller.onIndexConnect();
    expect(spy).not.toHaveBeenCalled();
  });

  test("page: currentPage=3 → {source:'modal_page', page:3} を1回発火", () => {
    const spy = jest.spyOn(window, "dispatchEvent");
    const { controller } = mount(`<div data-controller="notif-page"></div>`);
    spy.mockClear();

    controller.hasCurrentPageValue = true;
    controller.currentPageValue = 3;

    controller.onPageConnect();

    expect(spy).toHaveBeenCalledTimes(1);
    const evt = spy.mock.calls[0][0];
    expect(evt).toBeInstanceOf(CustomEvent);
    expect(evt.type).toBe("notifications:refresh-badge");
    expect(evt.detail).toEqual({ source: "modal_page", page: 3 });
  });

  test("page: currentPage 未指定 → {page: undefined} のまま発火", () => {
    const spy = jest.spyOn(window, "dispatchEvent");
    const { controller } = mount(`<div data-controller="notif-page"></div>`);
    spy.mockClear();

    controller.hasCurrentPageValue = false;
    delete controller.currentPageValue;

    controller.onPageConnect();

    expect(spy).toHaveBeenCalledTimes(1);
    const evt = spy.mock.calls[0][0];
    expect(evt).toBeInstanceOf(CustomEvent);
    expect(evt.type).toBe("notifications:refresh-badge");
    expect(evt.detail).toEqual({ source: "modal_page", page: undefined });
  });

  test("modal: show() → hidden.bs.modal で dispose + 指定IDコンテナ掃除", () => {
    const showMock = jest.fn();
    const disposeMock = jest.fn();
    const modalInstance = { show: showMock, hide: jest.fn(), dispose: disposeMock };
    const getOrCreateInstanceMock = jest.fn(() => modalInstance);

    window.bootstrap = {
      __TEST_INJECTED__: true,
      Modal: {
        getOrCreateInstance: getOrCreateInstanceMock,
        getInstance: () => null,
      },
    };

    document.body.innerHTML = `
      <div id="notifications-modal-container"><div class="inner">残骸</div></div>
      <div id="modal-el" class="modal" data-controller="notif-page"></div>
    `;
    const el = document.getElementById("modal-el");
    const controller = app.getControllerForElementAndIdentifier(el, "notif-page");
    expect(controller).toBeTruthy();

    controller.hasModalContainerIdValue = true;
    controller.modalContainerIdValue = "notifications-modal-container";

    controller.onModalConnect();

    expect(getOrCreateInstanceMock).toHaveBeenCalledTimes(1);
    expect(getOrCreateInstanceMock).toHaveBeenCalledWith(el, { backdrop: true, keyboard: true });
    expect(showMock).toHaveBeenCalledTimes(1);

    const container = document.getElementById("notifications-modal-container");
    expect(container.innerHTML).toContain("残骸");

    el.dispatchEvent(new Event("hidden.bs.modal"));
    expect(disposeMock).toHaveBeenCalledTimes(1);
    expect(container.innerHTML).toBe("");
  });

  test("modal: modalContainerId 未指定 → 既定ID(notifications-modal-container)を掃除", () => {
    const showMock = jest.fn();
    const disposeMock = jest.fn();
    const modalInstance = { show: showMock, hide: jest.fn(), dispose: disposeMock };
    const getOrCreateInstanceMock = jest.fn(() => modalInstance);

    window.bootstrap = {
      __TEST_INJECTED__: true,
      Modal: {
        getOrCreateInstance: getOrCreateInstanceMock,
        getInstance: () => null,
      },
    };

    document.body.innerHTML = `
      <div id="notifications-modal-container"><span>X</span></div>
      <div id="modal-el" class="modal" data-controller="notif-page"></div>
    `;
    const el = document.getElementById("modal-el");
    const controller = app.getControllerForElementAndIdentifier(el, "notif-page");
    expect(controller).toBeTruthy();

    controller.hasModalContainerIdValue = false;
    delete controller.modalContainerIdValue;

    controller.onModalConnect();

    expect(getOrCreateInstanceMock).toHaveBeenCalledTimes(1);
    expect(showMock).toHaveBeenCalledTimes(1);

    const container = document.getElementById("notifications-modal-container");
    expect(container.innerHTML).toContain("X");

    el.dispatchEvent(new Event("hidden.bs.modal"));
    expect(disposeMock).toHaveBeenCalledTimes(1);
    expect(container.innerHTML).toBe("");
  });

  test("modal: bootstrap.Modal が無い場合は何もしない（早期return）", () => {
    const { el, controller } = mount(`
      <div id="modal-el" class="modal" data-controller="notif-page"></div>
    `);

    controller.hasModalContainerIdValue = true;
    controller.modalContainerIdValue = "notifications-modal-container";

    const cleanup = document.createElement("div");
    cleanup.id = "notifications-modal-container";
    cleanup.textContent = "KEEP";
    document.body.appendChild(cleanup);

    controller.onModalConnect();

    el.dispatchEvent(new Event("hidden.bs.modal"));
    expect(document.getElementById("notifications-modal-container").innerHTML).toBe("KEEP");
  });

  // =========================
  // connect() 分岐の網羅
  // =========================

  test("connect(): role='index' なら onIndexConnect が呼ばれる", () => {
    const { controller } = mount(`<div data-controller="notif-page"></div>`);

    const spyIndex = jest.spyOn(controller, "onIndexConnect").mockImplementation(() => {});
    const spyModal = jest.spyOn(controller, "onModalConnect").mockImplementation(() => {});
    const spyPage  = jest.spyOn(controller, "onPageConnect").mockImplementation(() => {});
    spyIndex.mockClear(); spyModal.mockClear(); spyPage.mockClear();

    controller.hasRoleValue = true;
    controller.roleValue = "index";
    controller.connect();

    expect(spyIndex).toHaveBeenCalledTimes(1);
    expect(spyModal).not.toHaveBeenCalled();
  });

  test("connect(): role='modal' なら onModalConnect が呼ばれる", () => {
    const { controller } = mount(`<div data-controller="notif-page"></div>`);

    const spyIndex = jest.spyOn(controller, "onIndexConnect").mockImplementation(() => {});
    const spyModal = jest.spyOn(controller, "onModalConnect").mockImplementation(() => {});
    const spyPage  = jest.spyOn(controller, "onPageConnect").mockImplementation(() => {});
    spyIndex.mockClear(); spyModal.mockClear(); spyPage.mockClear();

    controller.hasRoleValue = true;
    controller.roleValue = "modal";
    controller.connect();

    expect(spyModal).toHaveBeenCalledTimes(1);
    expect(spyIndex).not.toHaveBeenCalled();
  });

  // =========================
  // ★ 追加その1: connect() の default 分岐（未知のrole）
  // =========================
  test("connect(): roleに未知の値 → default で onPageConnect が呼ばれる", () => {
    const { controller } = mount(`<div data-controller="notif-page"></div>`);

    const spyIndex = jest.spyOn(controller, "onIndexConnect").mockImplementation(() => {});
    const spyModal = jest.spyOn(controller, "onModalConnect").mockImplementation(() => {});
    const spyPage  = jest.spyOn(controller, "onPageConnect").mockImplementation(() => {});
    spyIndex.mockClear(); spyModal.mockClear(); spyPage.mockClear();

    controller.hasRoleValue = true;
    controller.roleValue = "unknown-role";
    controller.connect();

    expect(spyPage).toHaveBeenCalledTimes(1);
    expect(spyIndex).not.toHaveBeenCalled();
    expect(spyModal).not.toHaveBeenCalled();
  });

  // =========================
  // ★ 追加その2: modal hidden 時に掃除対象コンテナが存在しない分岐
  // =========================
  test("modal: hidden.bs.modal 時、コンテナが存在しない場合でもエラーなくdisposeされる", () => {
    const showMock = jest.fn();
    const disposeMock = jest.fn();
    const modalInstance = { show: showMock, hide: jest.fn(), dispose: disposeMock };
    const getOrCreateInstanceMock = jest.fn(() => modalInstance);

    window.bootstrap = {
      __TEST_INJECTED__: true,
      Modal: {
        getOrCreateInstance: getOrCreateInstanceMock,
        getInstance: () => null,
      },
    };

    // あえて掃除対象コンテナは置かない
    document.body.innerHTML = `
      <div id="modal-el" class="modal" data-controller="notif-page"></div>
    `;
    const el = document.getElementById("modal-el");
    const controller = app.getControllerForElementAndIdentifier(el, "notif-page");
    expect(controller).toBeTruthy();

    // 任意IDを指定するが、DOMには存在させない
    controller.hasModalContainerIdValue = true;
    controller.modalContainerIdValue = "no-such-container-id";

    controller.onModalConnect();
    expect(getOrCreateInstanceMock).toHaveBeenCalledTimes(1);
    expect(showMock).toHaveBeenCalledTimes(1);

    // hidden で dispose は呼ばれるが、コンテナは無いので掃除はスキップ
    el.dispatchEvent(new Event("hidden.bs.modal"));
    expect(disposeMock).toHaveBeenCalledTimes(1);
    // 存在しないので null のまま
    expect(document.getElementById("no-such-container-id")).toBeNull();
  });
});
