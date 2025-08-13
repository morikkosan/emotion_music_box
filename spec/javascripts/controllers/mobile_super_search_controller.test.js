import { Application } from "@hotwired/stimulus";
import MobileSuperSearchController from "controllers/mobile_super_search_controller";
import { Modal } from "bootstrap";

describe("mobile_super_search_controller", () => {
  let app;

  beforeAll(() => {
    app = Application.start();
    app.register("mobile-super-search", MobileSuperSearchController);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    jest.restoreAllMocks();
    document.body.classList.remove("modal-open");
    document.body.style.removeProperty("overflow");
    document.body.style.removeProperty("padding-right");
  });

  // ------- ヘルパ -------
  function buildModal({ id = "mobile-super-search-modal", withSubmitBtn = true } = {}) {
    const modal = document.createElement("div");
    modal.id = id;
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          ${withSubmitBtn ? '<button data-role="mobile-search-submit" type="button">Search</button>' : ""}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function buildTriggerWithValue({ modalId = "my-modal" } = {}) {
    const modal = buildModal({ id: modalId });
    const btn = document.createElement("button");
    btn.setAttribute("data-controller", "mobile-super-search");
    document.body.appendChild(btn);
    const controller = app.getControllerForElementAndIdentifier(btn, "mobile-super-search");
    // Stimulus values はスタブで配線されないので手動セット
    controller.modalIdValue = modalId;
    controller.hasModalIdValue = true;
    return { btn, modal, controller };
  }

  function buildTriggerWithSelector({ modalId = "sel-modal" } = {}) {
    const modal = buildModal({ id: modalId });
    const btn = document.createElement("button");
    btn.setAttribute("data-controller", "mobile-super-search");
    btn.setAttribute("data-bs-target", `#${modalId}`);
    document.body.appendChild(btn);
    const controller = app.getControllerForElementAndIdentifier(btn, "mobile-super-search");
    return { btn, modal, controller };
  }

  // ------- 既存の網羅テスト -------
  test("connect(): モーダル直付けでイベント購読と初期フラグ", () => {
    const modal = buildModal({ id: "msm" });
    modal.setAttribute("data-controller", "mobile-super-search");

    const spyGetOrCreate = jest.spyOn(Modal, "getOrCreateInstance");
    const controller = app.getControllerForElementAndIdentifier(modal, "mobile-super-search");

    expect(controller._isModal).toBe(true);
    expect(spyGetOrCreate).toHaveBeenCalledTimes(1);

    const hideSpy = jest.spyOn(controller, "_hideIfExists");
    document.dispatchEvent(new Event("turbo:before-cache"));
    document.dispatchEvent(new Event("turbo:before-render"));
    expect(hideSpy).toHaveBeenCalledTimes(2);
  });

  test("disconnect(): ドキュメント購読解除（効果）", () => {
    const modal = buildModal();
    modal.setAttribute("data-controller", "mobile-super-search");
    const controller = app.getControllerForElementAndIdentifier(modal, "mobile-super-search");

    const hideSpy = jest.spyOn(controller, "_hideIfExists");
    controller.disconnect();

    document.dispatchEvent(new Event("turbo:before-cache"));
    document.dispatchEvent(new Event("turbo:before-render"));
    expect(hideSpy).not.toHaveBeenCalled();
  });

  test("open(): values 経由で scrub → show、shown/hidden でフラグ＆スクラブ", () => {
    const { controller, modal } = buildTriggerWithValue({ modalId: "m1" });

    const mockInst = { show: jest.fn(), hide: jest.fn() };
    const sGetOrCreate = jest.spyOn(Modal, "getOrCreateInstance").mockReturnValue(mockInst);

    // 擬似的に副作用を置く → open() 冒頭の _scrub() が消す
    const bd = document.createElement("div");
    bd.className = "modal-backdrop";
    document.body.appendChild(bd);
    document.body.classList.add("modal-open");
    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = "17px";

    controller.open({ preventDefault: jest.fn() });

    expect(sGetOrCreate).toHaveBeenCalled();
    expect(mockInst.show).toHaveBeenCalledTimes(1);
    expect(controller._transitioning).toBe(true);

    expect(document.querySelector(".modal-backdrop")).toBeNull();
    expect(document.body.classList.contains("modal-open")).toBe(false);
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.paddingRight).toBe("");

    // shown → フラグ解除
    modal.dispatchEvent(new Event("shown.bs.modal"));
    expect(controller._transitioning).toBe(false);
    expect(controller._closing).toBe(false);

    // hidden → _scrub()
    const bd2 = document.createElement("div");
    bd2.className = "modal-backdrop";
    document.body.appendChild(bd2);
    document.body.classList.add("modal-open");
    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = "17px";

    modal.dispatchEvent(new Event("hidden.bs.modal"));
    expect(document.querySelector(".modal-backdrop")).toBeNull();
    expect(document.body.classList.contains("modal-open")).toBe(false);
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.paddingRight).toBe("");
  });

  test("open(): data-bs-target セレクタ経由でも show が呼ばれる", () => {
    const { controller } = buildTriggerWithSelector({ modalId: "m2" });
    const mockInst = { show: jest.fn(), hide: jest.fn() };
    jest.spyOn(Modal, "getOrCreateInstance").mockReturnValue(mockInst);

    controller.open({ preventDefault: jest.fn() });
    expect(mockInst.show).toHaveBeenCalledTimes(1);
  });

  test("close(): _hideIfExists → hide（多重防止）", () => {
    const modal = buildModal({ id: "m3" });
    modal.setAttribute("data-controller", "mobile-super-search");
    const controller = app.getControllerForElementAndIdentifier(modal, "mobile-super-search");

    const mockInst = { show: jest.fn(), hide: jest.fn() };
    jest.spyOn(Modal, "getInstance").mockReturnValue(null);
    jest.spyOn(Modal, "getOrCreateInstance").mockReturnValue(mockInst);

    controller.close({ preventDefault: jest.fn() });
    expect(mockInst.hide).toHaveBeenCalledTimes(1);

    controller.close();
    expect(mockInst.hide).toHaveBeenCalledTimes(1);

    modal.dispatchEvent(new Event("hidden.bs.modal"));
    expect(controller._closing).toBe(false);
  });

  test("beforeSubmit()/afterSubmit(): 送信ボタンあり → disabled 切替＋ hideIfExists", () => {
    const modal = buildModal({ id: "m4", withSubmitBtn: true });
    modal.setAttribute("data-controller", "mobile-super-search");
    const controller = app.getControllerForElementAndIdentifier(modal, "mobile-super-search");

    const hideSpy = jest.spyOn(controller, "_hideIfExists");

    controller.beforeSubmit();
    const btn = modal.querySelector('[data-role="mobile-search-submit"]');
    expect(hideSpy).toHaveBeenCalledTimes(1);
    expect(btn.disabled).toBe(true);

    controller.afterSubmit();
    expect(btn.disabled).toBe(false);
  });

  test("_modalEl(): _isModal / values / data-bs-target の各経路", () => {
    // _isModal
    const modalA = buildModal({ id: "ma" });
    modalA.setAttribute("data-controller", "mobile-super-search");
    const cA = app.getControllerForElementAndIdentifier(modalA, "mobile-super-search");
    expect(cA._modalEl()).toBe(modalA);

    // values（手動設定）
    const { controller: cB, modal: modalB } = buildTriggerWithValue({ modalId: "mb" });
    expect(cB._modalEl()).toBe(modalB);

    // data-bs-target
    const { controller: cC, modal: modalC } = buildTriggerWithSelector({ modalId: "mc" });
    expect(cC._modalEl()).toBe(modalC);
  });

  // ------- Branches を確実に個別で踏むテスト -------

  test("connect(): _isModal=false の場合はドキュメントイベントを購読しない", () => {
    const btn = document.createElement("button");
    btn.setAttribute("data-controller", "mobile-super-search");
    document.body.appendChild(btn);

    const controller = app.getControllerForElementAndIdentifier(btn, "mobile-super-search");
    expect(controller._isModal).toBe(false);

    const beforeCacheSpy = jest.spyOn(controller, "_beforeCache");
    document.dispatchEvent(new Event("turbo:before-cache"));
    expect(beforeCacheSpy).not.toHaveBeenCalled();

    const beforeRenderSpy = jest.spyOn(controller, "_beforeRender");
    document.dispatchEvent(new Event("turbo:before-render"));
    expect(beforeRenderSpy).not.toHaveBeenCalled();
  });

  test("_modalEl(): どの条件も満たさない場合は null（open() は何もしない）", () => {
    // data-controller だけの素のボタン → _isModal=false / valuesなし / data-bs-targetなし
    const btn = document.createElement("button");
    btn.setAttribute("data-controller", "mobile-super-search");
    document.body.appendChild(btn);

    const controller = app.getControllerForElementAndIdentifier(btn, "mobile-super-search");

    expect(controller._modalEl()).toBeNull(); // ← null分岐を明示的に踏む

    const sGetOrCreate = jest.spyOn(Modal, "getOrCreateInstance");
    controller.open({ preventDefault: jest.fn() }); // 何も起きないはず
    expect(sGetOrCreate).not.toHaveBeenCalled();
  });

  test("beforeSubmit()/afterSubmit(): 送信ボタンが存在しない場合でも落ちない（btn分岐のfalse側）", () => {
    const modal = buildModal({ id: "m5", withSubmitBtn: false });
    modal.setAttribute("data-controller", "mobile-super-search");
    const controller = app.getControllerForElementAndIdentifier(modal, "mobile-super-search");

    // ボタンは存在しない
    expect(modal.querySelector('[data-role="mobile-search-submit"]')).toBeNull();

    // 例外なく通ること（分岐falseをカバー）
    expect(() => controller.beforeSubmit()).not.toThrow();
    expect(() => controller.afterSubmit()).not.toThrow();
  });

  test("_hideIfExists(): el=null なら早期return（!el 分岐）", () => {
    const modal = buildModal({ id: "mh1" });
    modal.setAttribute("data-controller", "mobile-super-search");
    const controller = app.getControllerForElementAndIdentifier(modal, "mobile-super-search");

    const spyModalEl = jest.spyOn(controller, "_modalEl").mockReturnValue(null);
    const spyGetInst = jest.spyOn(Modal, "getOrCreateInstance");

    controller._hideIfExists();

    expect(spyModalEl).toHaveBeenCalled();
    expect(spyGetInst).not.toHaveBeenCalled(); // 早期return
  });

  test("_hideIfExists(): closing=true なら早期return（this._closing 分岐）", () => {
    const modal = buildModal({ id: "mh2" });
    modal.setAttribute("data-controller", "mobile-super-search");
    const controller = app.getControllerForElementAndIdentifier(modal, "mobile-super-search");

    jest.spyOn(controller, "_modalEl").mockReturnValue(modal);
    const spyGetInst = jest.spyOn(Modal, "getOrCreateInstance");
    controller._closing = true;

    controller._hideIfExists();

    expect(spyGetInst).not.toHaveBeenCalled(); // 早期return
  });

  test("_hideIfExists(): どちらもfalseなら hide() 実行（true側）", () => {
    const modal = buildModal({ id: "mh3" });
    modal.setAttribute("data-controller", "mobile-super-search");
    const controller = app.getControllerForElementAndIdentifier(modal, "mobile-super-search");

    jest.spyOn(controller, "_modalEl").mockReturnValue(modal);
    controller._closing = false;

    const inst = { hide: jest.fn() };
    jest.spyOn(Modal, "getInstance").mockReturnValue(null);
    jest.spyOn(Modal, "getOrCreateInstance").mockReturnValue(inst);

    controller._hideIfExists();

    expect(inst.hide).toHaveBeenCalledTimes(1);
    expect(controller._closing).toBe(true);
  });
});
