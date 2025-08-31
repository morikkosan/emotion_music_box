// spec/javascripts/controllers/add_song_modal_controller.test.js
/**
 * 対象: app/javascript/controllers/add_song_modal_controller.js
 * 期待する振る舞い（現実装に合わせる）:
 *  - connect(): 何もしない（クラッシュしない）
 *  - onSubmitStart(): 送信ボタンをロック＆文言を「追加中...」に変更
 *  - onSubmitEnd(): 成功時は該当 li を remove、ボタンは元に戻す。失敗時は li 残す＆ボタン復元
 *  - hideItem(): onSubmitEnd と同じ挙動（エイリアス）
 */

jest.mock("@hotwired/turbo-rails", () => ({}), { virtual: true });
jest.mock("@rails/ujs", () => ({ __esModule: true, default: { start: () => {} } }));

// Stimulus は Controller だけモックすればOK
jest.mock("@hotwired/stimulus", () => ({
  __esModule: true,
  Controller: class {},
}));

describe("add_song_modal_controller (new behavior)", () => {
  let ControllerClass;
  let containerEl;

  beforeEach(async () => {
    jest.resetModules();

    // DOM 準備
    document.body.innerHTML = `
      <div id="controller-root"></div>

      <ul id="song-list">
        <li data-add-song-modal-target="item" id="li-1">
          <form id="form-1">
            <button id="btn-1" type="submit">追加</button>
          </form>
        </li>
        <li data-add-song-modal-target="item" id="li-2">
          <form id="form-2">
            <button id="btn-2" type="submit">追加</button>
          </form>
        </li>
      </ul>
    `;

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

  test("connect(): 何もしない（例外が出ない）", () => {
    expect(() => connectController()).not.toThrow();
  });

  test("onSubmitStart(): ボタンをロック＆文言変更", () => {
    const controller = connectController();
    const form = document.getElementById("form-1");
    const btn = document.getElementById("btn-1");

    controller.onSubmitStart({ target: form });

    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe("追加中...");
    expect(btn.dataset._locked).toBe("1");
    expect(btn.dataset._orig).toBe("追加");
  });

  test("onSubmitEnd(): 成功時に li を remove＆ボタン復元", () => {
    const controller = connectController();
    const form = document.getElementById("form-1");
    const btn = document.getElementById("btn-1");

    // start → end の流れを再現
    controller.onSubmitStart({ target: form });
    expect(btn.disabled).toBe(true);

    controller.onSubmitEnd({ target: form, detail: { success: true } });

    // li が1つ消える
    expect(document.getElementById("li-1")).toBeNull();
    expect(document.getElementById("li-2")).not.toBeNull();

    // ボタンは復元
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe("追加");
    expect(btn.dataset._locked).toBeUndefined();
    expect(btn.dataset._orig).toBeUndefined();
  });

  test("onSubmitEnd(): 失敗時は li 残し＆ボタン復元のみ", () => {
    const controller = connectController();
    const form = document.getElementById("form-1");
    const btn = document.getElementById("btn-1");

    controller.onSubmitStart({ target: form });
    controller.onSubmitEnd({ target: form, detail: { success: false } });

    // li は残る
    expect(document.getElementById("li-1")).not.toBeNull();
    expect(document.getElementById("li-2")).not.toBeNull();

    // ボタンは復元
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe("追加");
    expect(btn.dataset._locked).toBeUndefined();
    expect(btn.dataset._orig).toBeUndefined();
  });

  test("hideItem(): 成功時は onSubmitEnd と同じ動作（li remove）", () => {
    const controller = connectController();
    const form = document.getElementById("form-1");

    controller.hideItem({ target: form, detail: { success: true } });

    expect(document.getElementById("li-1")).toBeNull();
    expect(document.getElementById("li-2")).not.toBeNull();
  });
});
