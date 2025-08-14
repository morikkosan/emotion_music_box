// spec/javascripts/controllers/bookmark_controller.test.js

import { Application } from "@hotwired/stimulus";
import BookmarkController from "../../../app/javascript/controllers/bookmark_controller";

// Stimulusアプリを立ち上げてコントローラを取得するヘルパー
const bootController = async (html, { stored = [] } = {}) => {
  document.body.innerHTML = html;
  localStorage.setItem("playlist:selected_ids", JSON.stringify(stored));

  const app = Application.start();
  app.register("bookmark", BookmarkController);

  const root = document.querySelector("[data-controller='bookmark']");
  const instance = app.getControllerForElementAndIdentifier(root, "bookmark");
  return instance;
};

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  localStorage.clear();
  const url = "http://localhost/example?genre=rock&emotion=happy&period=week&sort=popular";
  window.history.pushState({}, "", url);
  delete window.Turbo;
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("bookmark_controller", () => {
  test("connect: localStorageから選択復元 + hidden targetに反映", async () => {
    const html = `
      <div data-controller="bookmark">
        <input data-bookmark-target="selectedLogsInput" type="hidden" />
        <input class="playlist-check" type="checkbox" value="1" />
        <input class="playlist-check" type="checkbox" value="3" />
        <input class="playlist-check" type="checkbox" value="9" />
      </div>
    `;
    const controller = await bootController(html, { stored: ["1", "3"] });

    const boxes = [...document.querySelectorAll(".playlist-check")];
    expect(boxes.map(b => [b.value, b.checked])).toEqual([
      ["1", true],
      ["3", true],
      ["9", false],
    ]);

    const hidden = document.querySelector('[data-bookmark-target="selectedLogsInput"]');
    expect(hidden.value).toBe("1,3");

    controller.disconnect(); // cleanup
  });

  // connect の try/catch の catch 側を叩く（壊れたJSONを入れる）
  test("connect: localStorage JSONが壊れている場合は catch 側で selected=[]", async () => {
    const html = `
      <div data-controller="bookmark">
        <input data-bookmark-target="selectedLogsInput" type="hidden" />
        <input id="a" class="playlist-check" type="checkbox" value="10" />
        <input id="b" class="playlist-check" type="checkbox" value="20" />
      </div>
    `;
    document.body.innerHTML = html;

    // 壊れたJSONを入れてから起動
    localStorage.setItem("playlist:selected_ids", "oops:not-json");

    const app = Application.start();
    app.register("bookmark", BookmarkController);
    const root = document.querySelector("[data-controller='bookmark']");
    const controller = app.getControllerForElementAndIdentifier(root, "bookmark");

    // どれもチェックされず、hiddenも空
    expect(document.getElementById("a").checked).toBe(false);
    expect(document.getElementById("b").checked).toBe(false);
    const hidden = document.querySelector('[data-bookmark-target="selectedLogsInput"]');
    expect(hidden.value).toBe("");

    controller.disconnect();
  });

  test("change: チェックON/OFFでselected/persist/hiddenが更新される", async () => {
    const html = `
      <div data-controller="bookmark">
        <input data-bookmark-target="selectedLogsInput" type="hidden" />
        <input id="cb1" class="playlist-check" type="checkbox" value="1" />
        <input id="cb2" class="playlist-check" type="checkbox" value="2" />
      </div>
    `;
    const controller = await bootController(html, { stored: ["1"] });

    const cb1 = document.getElementById("cb1");
    const cb2 = document.getElementById("cb2");
    const hidden = document.querySelector('[data-bookmark-target="selectedLogsInput"]');

    cb2.checked = true;
    cb2.dispatchEvent(new Event("change", { bubbles: true }));
    expect(JSON.parse(localStorage.getItem("playlist:selected_ids"))).toEqual(["1", "2"]);
    expect(hidden.value).toBe("1,2");

    cb1.checked = false;
    cb1.dispatchEvent(new Event("change", { bubbles: true }));
    expect(JSON.parse(localStorage.getItem("playlist:selected_ids"))).toEqual(["2"]);
    expect(hidden.value).toBe("2");

    controller.disconnect(); // cleanup
  });

  // change ガード（.playlist-check以外）は無視される
  test("change: .playlist-check 以外の変更は無視され、persistされない", async () => {
    const html = `
      <div data-controller="bookmark">
        <input data-bookmark-target="selectedLogsInput" type="hidden" />
        <input id="plain" type="checkbox" value="999" />
      </div>
    `;
    const controller = await bootController(html, { stored: [] });

    const before = localStorage.getItem("playlist:selected_ids"); // "[]"
    const plain = document.getElementById("plain");
    plain.checked = true;
    plain.dispatchEvent(new Event("change", { bubbles: true }));

    expect(localStorage.getItem("playlist:selected_ids")).toBe(before); // 変化なし
    controller.disconnect();
  });

  test("turbo:frame-load: logs_list(_mobile) 読み込み時に再同期", async () => {
    const html = `
      <div data-controller="bookmark">
        <input data-bookmark-target="selectedLogsInput" type="hidden" />
        <input id="cb1" class="playlist-check" type="checkbox" value="1" />
        <input id="cb2" class="playlist-check" type="checkbox" value="2" />
        <turbo-frame id="logs_list"></turbo-frame>
      </div>
    `;
    const controller = await bootController(html, { stored: ["2"] });

    const cb1 = document.getElementById("cb1");
    cb1.checked = true;

    const frame = document.getElementById("logs_list");
    frame.dispatchEvent(new Event("turbo:frame-load", { bubbles: true }));

    expect(cb1.checked).toBe(false);
    const cb2 = document.getElementById("cb2");
    expect(cb2.checked).toBe(true);

    const hidden = document.querySelector('[data-bookmark-target="selectedLogsInput"]');
    expect(hidden.value).toBe("2");

    controller.disconnect(); // cleanup
  });

  test("submitPlaylistForm: hidden(selected_log_ids と selected_logs[]) を生成", async () => {
    const html = `
      <div data-controller="bookmark">
        <form id="f"></form>
      </div>
    `;
    const controller = await bootController(html, { stored: ["5", "9", "12"] });

    const form = document.getElementById("f");
    controller.submitPlaylistForm({ target: form });

    const strHidden = form.querySelector('input[name="selected_log_ids"]');
    expect(strHidden).toBeTruthy();
    expect(strHidden.value).toBe("5,9,12");

    const arrHidden = [...form.querySelectorAll('input[name="selected_logs[]"]')];
    expect(arrHidden.map(i => i.value)).toEqual(["5", "9", "12"]);

    controller.disconnect(); // cleanup
  });

  test("clearSelection: 成功時にlocalStorageとチェックをクリアしhiddenを更新", async () => {
    const html = `
      <div data-controller="bookmark">
        <input data-bookmark-target="selectedLogsInput" type="hidden" />
        <input class="playlist-check" type="checkbox" value="5" checked />
        <input class="playlist-check" type="checkbox" value="9" checked />
      </div>
    `;
    const controller = await bootController(html, { stored: ["5", "9"] });

    controller.clearSelection({ detail: { success: true } });

    expect(JSON.parse(localStorage.getItem("playlist:selected_ids"))).toEqual([]);
    const boxes = [...document.querySelectorAll(".playlist-check")];
    expect(boxes.every(b => !b.checked)).toBe(true);

    const hidden = document.querySelector('[data-bookmark-target="selectedLogsInput"]');
    expect(hidden.value).toBe("");

    controller.disconnect(); // cleanup
  });

  // clearSelection の早期 return（success=false）
  test("clearSelection: detail.success=false の場合は何もしない", async () => {
    const html = `
      <div data-controller="bookmark">
        <input data-bookmark-target="selectedLogsInput" type="hidden" />
        <input class="playlist-check" type="checkbox" value="1" checked />
      </div>
    `;
    const controller = await bootController(html, { stored: ["1"] });

    controller.clearSelection({ detail: { success: false } });

    // localStorage/チェック/hidden がそのまま
    expect(JSON.parse(localStorage.getItem("playlist:selected_ids"))).toEqual(["1"]);
    expect(document.querySelector(".playlist-check").checked).toBe(true);
    expect(document.querySelector('[data-bookmark-target="selectedLogsInput"]').value).toBe("1");

    controller.disconnect();
  });

  test("toggleMyPageLogs（モバイル分岐・frameあり）: logs_list_mobile の src を更新", async () => {
    const html = `
      <div data-controller="bookmark">
        <turbo-frame id="logs_list_mobile"></turbo-frame>
        <form id="mobile-bookmarks-form">
          <input name="genre" value="jazz" />
          <input name="q" value="hello" />
          <input id="chk" type="checkbox" />
        </form>
      </div>
    `;
    const controller = await bootController(html);

    const chk = document.getElementById("chk");

    chk.checked = true;
    const evt = new Event("change", { bubbles: true, cancelable: true });
    Object.defineProperty(evt, "target", { value: chk });
    controller.toggleMyPageLogs(evt);

    const frame = document.getElementById("logs_list_mobile");
    const src = frame.getAttribute("src");
    expect(src).toContain("/emotion_logs/bookmarks?");
    expect(src).toContain("genre=jazz");
    expect(src).toContain("q=hello");
    expect(src).toContain("include_my_logs=true");
    expect(src).toContain("view=mobile");

    controller.disconnect(); // cleanup
  });

  // モバイル分岐・frameなし・チェックOFF → include_my_logs を削除し Turbo.visit(frame) を使う
  test("toggleMyPageLogs（モバイル: frameなし/チェックOFF）: include_my_logs を付けず Turbo.visit(frame) を呼ぶ", async () => {
    window.Turbo = { visit: jest.fn() };

    const html = `
      <div data-controller="bookmark">
        <!-- frame は無い -->
        <form id="mobile-bookmarks-form">
          <input name="genre" value="soul" />
          <input name="q" value="bye" />
          <input id="chk" type="checkbox" />
        </form>
      </div>
    `;
    const controller = await bootController(html);

    const chk = document.getElementById("chk");
    chk.checked = false; // OFF
    const evt = new Event("change", { bubbles: true, cancelable: true });
    Object.defineProperty(evt, "target", { value: chk });
    controller.toggleMyPageLogs(evt);

    expect(window.Turbo.visit).toHaveBeenCalledTimes(1);
    const [url, opts] = window.Turbo.visit.mock.calls[0];
    expect(url).toContain("/emotion_logs/bookmarks?");
    expect(url).toContain("genre=soul");
    expect(url).toContain("q=bye");
    expect(url).toContain("view=mobile");
    expect(url).not.toContain("include_my_logs=true");
    expect(opts).toEqual({ frame: "logs_list_mobile" });

    controller.disconnect();
  });

  test("toggleMyPageLogs（デスクトップ分岐）: Turbo.visit が使われURLに既存パラメータが引き継がれる（ON）", async () => {
    window.Turbo = { visit: jest.fn() };

    const html = `
      <div data-controller="bookmark">
        <form id="desktop-form">
          <input id="chk" type="checkbox" />
        </form>
      </div>
    `;
    const controller = await bootController(html);

    const chk = document.getElementById("chk");
    chk.checked = true; // ON
    const evt = new Event("change", { bubbles: true });
    Object.defineProperty(evt, "target", { value: chk });
    controller.toggleMyPageLogs(evt);

    expect(window.Turbo.visit).toHaveBeenCalledTimes(1);
    const [url, opts] = window.Turbo.visit.mock.calls[0];
    expect(url).toMatch(/^http:\/\/localhost\/emotion_logs\/bookmarks\?/);
    // 既存のクエリが引き継がれる
    expect(url).toContain("genre=rock");
    expect(url).toContain("emotion=happy");
    expect(url).toContain("period=week");
    expect(url).toContain("sort=popular");
    // ONなので include_my_logs=true
    expect(url).toContain("include_my_logs=true");
    expect(opts).toEqual({ action: "advance" });

    controller.disconnect(); // cleanup
  });

  // デスクトップ分岐（OFF）→ include_my_logs を付けない
  test("toggleMyPageLogs（デスクトップ分岐・OFF）: include_my_logs を付けない", async () => {
    window.Turbo = { visit: jest.fn() };

    const html = `
      <div data-controller="bookmark">
        <form id="desktop-form">
          <input id="chk" type="checkbox" />
        </form>
      </div>
    `;
    const controller = await bootController(html);

    const chk = document.getElementById("chk");
    chk.checked = false; // OFF
    const evt = new Event("change", { bubbles: true });
    Object.defineProperty(evt, "target", { value: chk });
    controller.toggleMyPageLogs(evt);

    const [url] = window.Turbo.visit.mock.calls[0];
    expect(url).toMatch(/^http:\/\/localhost\/emotion_logs\/bookmarks\?/);
    expect(url).toContain("genre=rock");
    expect(url).not.toContain("include_my_logs=true"); // 付かない

    controller.disconnect();
  });

  test("disconnect: イベントリスナを解除する", async () => {
    const html = `
      <div data-controller="bookmark">
        <input class="playlist-check" type="checkbox" value="1" />
      </div>
    `;
    const controller = await bootController(html);

    // 検証を「null基準」にするため、いったんキーを消す
    localStorage.removeItem("playlist:selected_ids");

    // 切断してからイベントを投げる → 何も起きない
    controller.disconnect();

    const cb = document.querySelector(".playlist-check");
    cb.checked = true;
    cb.dispatchEvent(new Event("change", { bubbles: true }));

    // 変更されていない（= 書き込みが発生しない）
    expect(localStorage.getItem("playlist:selected_ids")).toBeNull();
  });
});
