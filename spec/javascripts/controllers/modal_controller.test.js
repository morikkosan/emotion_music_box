// spec/javascripts/controllers/modal_controller.test.js
/**
 * 対象: app/javascript/controllers/modal_controller.js
 * ねらい:
 *  - connect():
 *    ・既存の .modal.show を安全に閉じ、hidden 後に dispose/remove される
 *    ・既存の .modal-backdrop と body の状態(modal-open/overflow)を掃除する
 *    ・自分(this.element)のモーダルを生成して show する
 *    ・#emotion_log_description があれば rAF 後に focus される
 *    ・this.element の hidden で dispose & 要素削除 & #modal-container を空にして掃除する
 *  - turbo:before-cache:
 *    ・開いているモーダルを hidden 後に dispose/remove
 *    ・backdrop/ body を掃除
 *  - turbo:before-stream-render (remove/replace × target=modal-container):
 *    ・開いているモーダルを安全に閉じる
 */

jest.mock("@hotwired/turbo-rails", () => ({}), { virtual: true });
jest.mock("@rails/ujs", () => ({ __esModule: true, default: { start: () => {} } }));

// Bootstrap をインテリジェントにモック: 各 element 単位でインスタンスを保持し、hide() で hidden.bs.modal を発火
jest.mock("bootstrap", () => {
  const instances = new Map();
  const makeHiddenEvent = () => new Event("hidden.bs.modal", { bubbles: true });

  class FakeModal {
    constructor(el) {
      this._el = el;
      this.show = jest.fn();
      this.hide = jest.fn(() => {
        // Bootstrapは非同期で hidden が飛ぶので、次tickで擬似発火
        setTimeout(() => {
          this._el.dispatchEvent(makeHiddenEvent());
        }, 0);
      });
      this.dispose = jest.fn();
    }
  }

  const Modal = {
    getInstance(el) {
      return instances.get(el) || null;
    },
    getOrCreateInstance(el) {
      if (!instances.has(el)) instances.set(el, new FakeModal(el));
      return instances.get(el);
    },
    __getInstance(el) {
      return instances.get(el) || null;
    },
    __clear() {
      instances.clear();
    },
  };

  return { __esModule: true, Modal };
});

// Stimulus は Controller だけあればOK（Applicationは使わない）
jest.mock("@hotwired/stimulus", () => ({
  __esModule: true,
  Controller: class {},
}));

// 相対URLを解決する location スタブ（万一 href を触っても落ちないように）
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
    reload: jest.fn(),
    toString() { return this.href; },
    origin: base,
  };
  Object.defineProperty(window, "location", { value: loc, writable: true });
}

describe("modal_controller", () => {
  let ModalModule;
  let ControllerClass;

  beforeEach(async () => {
    jest.resetModules();
    ModalModule = require("bootstrap"); // モックの参照

    // rAF は同期で実行してフォーカス確認を安定化
    window.requestAnimationFrame = (cb) => cb();

    // DOM 初期化（backdrop と body 状態をわざと汚しておく）
    document.body.innerHTML = `
      <div id="modal-container"></div>
      <div class="modal-backdrop"></div>
    `;
    document.body.classList.add("modal-open");
    document.body.style.overflow = "hidden";

    // 既存で開いているモーダルを用意
    const existing = document.createElement("div");
    existing.id = "existing-modal";
    existing.className = "modal show";
    document.body.appendChild(existing);

    // これから接続する対象モーダル（コントローラ要素）
    const container = document.getElementById("modal-container");
    const current = document.createElement("div");
    current.id = "current-modal";
    current.className = "modal";
    current.setAttribute("data-controller", "modal");
    current.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <textarea id="emotion_log_description"></textarea>
        </div>
      </div>
    `;
    container.appendChild(current);

    stubLocationWithBase();

    // コントローラ本体を読み込み（ファイル末尾のイベントハンドラも登録される）
    ControllerClass = (await import("../../../app/javascript/controllers/modal_controller.js")).default;

    // Stimulusを使わず手動接続
    const instance = new ControllerClass();
    instance.element = current;
    instance.connect();

    // 既存モーダルの hidden 発火（hide→次tick）を待つ
    await new Promise((r) => setTimeout(r, 0));
  });

  afterEach(() => {
    jest.clearAllMocks();
    ModalModule.Modal.__clear?.();
    document.body.innerHTML = "";
    document.body.className = "";
    document.body.style.overflow = "";
  });

  test("connect: 既存モーダルを安全に閉じ、backdrop/body を掃除し、自身のモーダルを show する", async () => {
    const existing = document.getElementById("existing-modal");
    const current = document.getElementById("current-modal");

    // 既存モーダルは hidden 後に remove されている（connect 時の処理）
    expect(existing).toBeNull();

    // 初期の掃除が効いている
    expect(document.querySelector(".modal-backdrop")).toBeNull();
    expect(document.body.classList.contains("modal-open")).toBe(false);
    expect(document.body.style.overflow).toBe("");

    // 自分のモーダルは show 済み
    const inst = ModalModule.Modal.getInstance(current);
    expect(inst).toBeTruthy();
    expect(inst.show).toHaveBeenCalledTimes(1);

    // rAF 後に #emotion_log_description にフォーカス
    const desc = document.getElementById("emotion_log_description");
    expect(document.activeElement).toBe(desc);
  });

  test("current hidden: dispose され、要素は削除、#modal-container は空、backdrop/body は掃除される", async () => {
    const current = document.getElementById("current-modal");
    const container = document.getElementById("modal-container");
    const inst = ModalModule.Modal.getInstance(current);

    // hidden を人工発火
    current.dispatchEvent(new Event("hidden.bs.modal", { bubbles: true }));

    // 非同期処理はないが、保険でtick待ち
    await new Promise((r) => setTimeout(r, 0));

    // dispose が呼ばれ、要素削除 & container クリア
    expect(inst.dispose).toHaveBeenCalledTimes(1);
    expect(document.getElementById("current-modal")).toBeNull();
    expect(container.innerHTML).toBe("");

    // 掃除確認
    expect(document.querySelector(".modal-backdrop")).toBeNull();
    expect(document.body.classList.contains("modal-open")).toBe(false);
    expect(document.body.style.overflow).toBe("");
  });

  test("turbo:before-cache: 開いているモーダルを hidden 後に dispose/remove し、backdrop/body を掃除", async () => {
    // 開いている別モーダルをわざと作る
    const another = document.createElement("div");
    another.id = "another-modal";
    another.className = "modal show";
    document.body.appendChild(another);

    // ここで backdrops を足してみる（掃除確認用）
    const bd = document.createElement("div");
    bd.className = "modal-backdrop";
    document.body.appendChild(bd);
    document.body.classList.add("modal-open");
    document.body.style.overflow = "hidden";

    // before-cache 発火
    document.dispatchEvent(new Event("turbo:before-cache", { bubbles: true }));

    // hide → hidden は次tickで発火（モック仕様）
    await new Promise((r) => setTimeout(r, 0));

    // 削除されたか
    expect(document.getElementById("another-modal")).toBeNull();
    // 掃除
    expect(document.querySelector(".modal-backdrop")).toBeNull();
    expect(document.body.classList.contains("modal-open")).toBe(false);
    expect(document.body.style.overflow).toBe("");
  });

  test("turbo:before-stream-render (action=remove/replace × target=modal-container): 開いているモーダルを安全に閉じる", async () => {
    const open = document.createElement("div");
    open.id = "stream-open-modal";
    open.className = "modal show";
    document.body.appendChild(open);

    // (A) remove のケース → ★ DOMに追加してから dispatch（document.listener で拾えるように）
    const streamA = document.createElement("turbo-stream");
    streamA.setAttribute("action", "remove");
    streamA.setAttribute("target", "modal-container");
    document.body.appendChild(streamA);
    const evA = new CustomEvent("turbo:before-stream-render", { bubbles: true, cancelable: true });
    streamA.dispatchEvent(evA);

    await new Promise((r) => setTimeout(r, 0));
    expect(document.getElementById("stream-open-modal")).toBeNull();
    streamA.remove();

    // (B) replace のケース（再度用意）
    const open2 = document.createElement("div");
    open2.id = "stream-open-modal-2";
    open2.className = "modal show";
    document.body.appendChild(open2);

    const streamB = document.createElement("turbo-stream");
    streamB.setAttribute("action", "replace");
    streamB.setAttribute("target", "modal-container");
    document.body.appendChild(streamB);
    const evB = new CustomEvent("turbo:before-stream-render", { bubbles: true, cancelable: true });
    streamB.dispatchEvent(evB);

    await new Promise((r) => setTimeout(r, 0));
    expect(document.getElementById("stream-open-modal-2")).toBeNull();
    streamB.remove();
  });

  test("turbo:before-stream-render (条件不一致) では何もしない", async () => {
    const keep = document.createElement("div");
    keep.id = "keep-modal";
    keep.className = "modal show";
    document.body.appendChild(keep);

    // action が append なので対象外
    const stream = document.createElement("turbo-stream");
    stream.setAttribute("action", "append");
    stream.setAttribute("target", "modal-container");
    document.body.appendChild(stream);
    stream.dispatchEvent(new CustomEvent("turbo:before-stream-render", { bubbles: true, cancelable: true }));

    await new Promise((r) => setTimeout(r, 0));
    expect(document.getElementById("keep-modal")).not.toBeNull();
    stream.remove();
  });
});
