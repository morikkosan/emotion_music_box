// spec/javascripts/controllers/add_song_modal_controller.test.js
/**
 * 対象: app/javascript/controllers/add_song_modal_controller.js
 * 確認:
 *  - connect(): #addSongsModal があれば bootstrap.Modal.getOrCreateInstance が呼ばれる
 *  - connect(): hidden.bs.modal 発火で window.location.reload() が呼ばれる
 *  - connect(): #addSongsModal が無ければ何もしない
 *  - hideItem(): クリック起点から最寄りの li[data-add-song-modal-target='item'] を remove する
 */

jest.mock("@hotwired/turbo-rails", () => ({}), { virtual: true });
jest.mock("@rails/ujs", () => ({ __esModule: true, default: { start: () => {} } }));

// bootstrap をモック（getOrCreateInstance の呼び出し検証用）
jest.mock("bootstrap", () => {
  const Modal = {
    getOrCreateInstance: jest.fn(() => ({})),
  };
  return { __esModule: true, Modal };
});

// Stimulus は Controller だけあれば十分
jest.mock("@hotwired/stimulus", () => ({
  __esModule: true,
  Controller: class {},
}));

// 相対URLを扱っても落ちないよう location スタブ
function stubLocationWithBase(base = "https://example.com") {
  let _href = `${base}/`;
  const loc = {
    get href() { return _href; },
    set href(val) {
      if (typeof val === "string" && /^https?:\/\//i.test(val)) _href = val;
      else if (typeof val === "string" && val.startsWith("/")) _href = `${base}${val}`;
      else _href = `${base}/${val || ""}`;
    },
    assign(val) { this.href = val; },
    replace(val) { this.href = val; },
    reload: jest.fn(), // ← テストで監視したい
    toString() { return this.href; },
    origin: base,
  };
  Object.defineProperty(window, "location", { value: loc, writable: true });
}

describe("add_song_modal_controller", () => {
  let ControllerClass;
  let modalEl;
  let containerEl;

  beforeEach(async () => {
    jest.resetModules();
    // DOM 準備
    document.body.innerHTML = `
      <div id="modal-container">
        <!-- data-controller は任意（このテストでは手動 new/connect する） -->
        <div id="controller-root"></div>
      </div>

      <!-- モーダル本体（存在するケース用） -->
      <div id="addSongsModal" class="modal">
        <div class="modal-dialog"><div class="modal-content"></div></div>
      </div>

      <!-- hideItem の検証用リスト -->
      <ul id="song-list">
        <li data-add-song-modal-target="item">
          <form>
            <button id="remove-btn-1" type="button">remove</button>
          </form>
        </li>
        <li data-add-song-modal-target="item">
          <form>
            <button id="remove-btn-2" type="button">remove</button>
          </form>
        </li>
      </ul>
    `;

    stubLocationWithBase();

    modalEl = document.getElementById("addSongsModal");
    containerEl = document.getElementById("controller-root");

    ControllerClass = (await import("../../../app/javascript/controllers/add_song_modal_controller.js")).default;
  });

  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = "";
  });

  function connectController(rootEl = containerEl) {
    const instance = new ControllerClass();
    instance.element = rootEl;
    if (typeof instance.connect === "function") instance.connect();
    return instance;
  }

  test("connect(): モーダルがあれば getOrCreateInstance が呼ばれる & hidden で reload()", () => {
    const { Modal } = require("bootstrap");
    const inst = connectController();

    // ① 生成が呼ばれる
    expect(Modal.getOrCreateInstance).toHaveBeenCalledTimes(1);
    expect(Modal.getOrCreateInstance).toHaveBeenCalledWith(modalEl);

    // ② hidden.bs.modal を発火 → reload が呼ばれる
    const before = window.location.reload.mock.calls.length;
    modalEl.dispatchEvent(new Event("hidden.bs.modal", { bubbles: true }));
    expect(window.location.reload).toHaveBeenCalledTimes(before + 1);
  });

  test("connect(): モーダルが無ければ何もしない（getOrCreateInstance 不呼び出し）", async () => {
    const { Modal } = require("bootstrap");
    // モーダルを消してから接続
    modalEl.remove();

    connectController();

    expect(Modal.getOrCreateInstance).not.toHaveBeenCalled();
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  test("hideItem(): クリック起点から最寄りの li[data-add-song-modal-target='item'] を remove", () => {
    const controller = connectController();

    const btn1 = document.getElementById("remove-btn-1");
    expect(document.querySelectorAll("li[data-add-song-modal-target='item']").length).toBe(2);

    controller.hideItem({ target: btn1 });

    expect(document.querySelectorAll("li[data-add-song-modal-target='item']").length).toBe(1);
    // もう片方は残っている
    expect(document.getElementById("remove-btn-2")).not.toBeNull();
  });
});
