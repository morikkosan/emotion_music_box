// spec/javascripts/controllers/tag_input_controller.test.js
/**
 * tag_input_controller 網羅テスト（修正版・ブランチ100%）
 * - connect: 初期値あり/なし 両方をカバー
 * - keydown(Enter)の全バリデーション分岐
 * - filterSuggestions: 空/通常取得→クリック
 * - _renderTags: 削除
 * - clearSuggestions/_clearInput
 */

import { Application } from "@hotwired/stimulus";
import ControllerClass from "controllers/tag_input_controller";

// ---- 非同期flush（Promiseチェーン/タイマー進行）----
const flushAsync = async (ms = 0) => {
  await Promise.resolve();
  await Promise.resolve();
  if (ms > 0) jest.advanceTimersByTime(ms);
  jest.runOnlyPendingTimers();
  await Promise.resolve();
};

describe("tag_input_controller", () => {
  let app, root, input, tags, suggestions, hidden, controller;

  beforeEach(() => {
    jest.useFakeTimers();

    document.body.innerHTML = `
      <div id="host" data-controller="tag-input">
        <input data-tag-input-target="input" />
        <div data-tag-input-target="tags"></div>
        <div data-tag-input-target="suggestions"></div>
        <input type="hidden" data-tag-input-target="hidden" value="  alpha , beta , , gamma  " />
      </div>
    `;

    root = document.getElementById("host");
    input = root.querySelector('[data-tag-input-target="input"]');
    tags = root.querySelector('[data-tag-input-target="tags"]');
    suggestions = root.querySelector('[data-tag-input-target="suggestions"]');
    hidden = root.querySelector('[data-tag-input-target="hidden"]');

    // fetch/alertモック
    global.fetch = jest.fn();
    jest.spyOn(window, "alert").mockImplementation(() => {});

    app = Application.start();
    app.register("tag-input", ControllerClass);
    controller = app.getControllerForElementAndIdentifier(root, "tag-input");
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });

  test("connect: hidden初期値が取り込まれ、badge描画 & hidden再設定", () => {
    expect(controller.selectedTags).toEqual(["alpha", "beta", "gamma"]);
    const badges = tags.querySelectorAll("span.badge");
    expect(badges.length).toBe(3);
    const texts = Array.from(badges).map((b) => b.childNodes[0].textContent);
    expect(texts).toEqual(["alpha", "beta", "gamma"]);
    expect(hidden.value).toBe("alpha,beta,gamma");
  });

  // ★ 追加：初期値なし（空）分岐のカバー
  test("connect: hidden初期値なし（空）でも_renderTags実行＆hiddenは空のまま", () => {
    // 既に connect 済みなので一旦停止 → DOMを差し替えて再接続
    app.stop();
    document.body.innerHTML = `
      <div id="host2" data-controller="tag-input">
        <input data-tag-input-target="input" />
        <div data-tag-input-target="tags"></div>
        <div data-tag-input-target="suggestions"></div>
        <input type="hidden" data-tag-input-target="hidden" value="" />
      </div>
    `;
    const root2 = document.getElementById("host2");
    const input2 = root2.querySelector('[data-tag-input-target="input"]');
    const tags2 = root2.querySelector('[data-tag-input-target="tags"]');
    const suggestions2 = root2.querySelector('[data-tag-input-target="suggestions"]');
    const hidden2 = root2.querySelector('[data-tag-input-target="hidden"]');

    app = Application.start();
    app.register("tag-input", ControllerClass);
    const ctrl2 = app.getControllerForElementAndIdentifier(root2, "tag-input");

    expect(ctrl2.selectedTags).toEqual([]);
    expect(tags2.innerHTML).toBe(""); // _renderTagsは呼ばれるが空
    expect(hidden2.value).toBe("");   // join(",") も空のまま
    // 以降で使わないが、変数の未使用防止
    expect(input2).toBeTruthy();
    expect(suggestions2).toBeTruthy();
  });

  test("keydown: Enter以外は何もしない", () => {
    const evt = { key: "a", preventDefault: jest.fn() };
    const before = hidden.value;
    controller.keydown(evt);
    expect(evt.preventDefault).not.toHaveBeenCalled();
    expect(hidden.value).toBe(before);
  });

  test("keydown: 空文字（trim後空）は_clearInputのみ", () => {
    input.value = "   ";
    const evt = { key: "Enter", preventDefault: jest.fn() };
    controller.keydown(evt);
    expect(evt.preventDefault).toHaveBeenCalled();
    expect(input.value).toBe("");
    expect(suggestions.innerHTML).toBe("");
    expect(controller.selectedTags).toEqual(["alpha", "beta", "gamma"]);
  });

  test("keydown: 重複タグはalert→_clearInput", () => {
    input.value = "beta";
    const evt = { key: "Enter", preventDefault: jest.fn() };
    controller.keydown(evt);
    expect(evt.preventDefault).toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith("同じタグは追加できません");
    expect(input.value).toBe("");
    expect(controller.selectedTags).toEqual(["alpha", "beta", "gamma"]);
  });

  test("keydown: 既に3つある状態で4つ目追加はalert→_clearInput", () => {
    input.value = "delta";
    const evt = { key: "Enter", preventDefault: jest.fn() };
    controller.keydown(evt);
    expect(evt.preventDefault).toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith("タグは最大3つまでです");
    expect(input.value).toBe("");
    expect(controller.selectedTags).toEqual(["alpha", "beta", "gamma"]);
  });

  test("keydown: 長さ>10はalert→_clearInput（3未満にしてから検証）", () => {
    tags.querySelector("button.btn-close").click(); // alpha削除 → ["beta","gamma"]
    expect(controller.selectedTags).toEqual(["beta", "gamma"]);
    expect(hidden.value).toBe("beta,gamma");

    input.value = "abcdefghijkl"; // 12文字
    const evt = { key: "Enter", preventDefault: jest.fn() };
    controller.keydown(evt);
    expect(window.alert).toHaveBeenCalledWith("タグは10文字以内で入力してください");
    expect(input.value).toBe("");
    expect(controller.selectedTags).toEqual(["beta", "gamma"]);
  });

  test("keydown: 禁止文字（@など）はalert→_clearInput（3未満にしてから検証）", () => {
    tags.querySelector("button.btn-close").click(); // alpha削除 → ["beta","gamma"]
    expect(controller.selectedTags).toEqual(["beta", "gamma"]);

    input.value = "@bad";
    const evt = { key: "Enter", preventDefault: jest.fn() };
    controller.keydown(evt);
    expect(window.alert).toHaveBeenCalledWith("記号や特殊文字は使えません");
    expect(input.value).toBe("");
    expect(controller.selectedTags).toEqual(["beta", "gamma"]);
  });

  test("keydown: 正常追加→badge描画 & hidden更新 & _clearInput（3未満にしてから検証）", () => {
    tags.querySelector("button.btn-close").click(); // alpha削除 → ["beta","gamma"]
    expect(controller.selectedTags).toEqual(["beta", "gamma"]);

    input.value = "jpop";
    const evt = { key: "Enter", preventDefault: jest.fn() };
    controller.keydown(evt);

    expect(controller.selectedTags).toEqual(["beta", "gamma", "jpop"]);
    const badges = tags.querySelectorAll("span.badge");
    expect(badges.length).toBe(3);
    const texts = Array.from(badges).map((b) => b.childNodes[0].textContent);
    expect(texts).toEqual(["beta", "gamma", "jpop"]);
    expect(hidden.value).toBe("beta,gamma,jpop");
    expect(input.value).toBe("");
  });

  test("filterSuggestions: 空クエリはclearSuggestionsのみでfetchされない", async () => {
    suggestions.innerHTML = "<div>old</div>";
    input.value = "   ";
    controller.filterSuggestions();
    await flushAsync();
    expect(fetch).not.toHaveBeenCalled();
    expect(suggestions.innerHTML).toBe("");
  });

  test("filterSuggestions: 正常fetch→候補描画→クリックで_addTag & _clearInput（URLエンコード確認、3未満に調整）", async () => {
    tags.querySelector("button.btn-close").click(); // alpha削除 → ["beta","gamma"]
    expect(controller.selectedTags).toEqual(["beta", "gamma"]);
    controller._addTag("jpop"); // → ["beta","gamma","jpop"]
    expect(controller.selectedTags).toEqual(["beta", "gamma", "jpop"]);
    tags.querySelector("button.btn-close").click(); // beta削除 → ["gamma","jpop"]
    expect(controller.selectedTags).toEqual(["gamma", "jpop"]);

    const query = "A&B あ";
    input.value = query;
    const encoded = encodeURIComponent(query);

    fetch.mockResolvedValueOnce({
      json: jest.fn().mockResolvedValueOnce([
        { name: "Rock" },
        { name: "Lo fi" },
      ]),
    });

    controller.filterSuggestions();
    await flushAsync();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe(`/tags/search?q=${encoded}`);

    const opts = suggestions.querySelectorAll("div.dropdown-item");
    expect(opts.length).toBe(2);
    expect(opts[0].textContent).toBe("Rock");
    expect(opts[1].textContent).toBe("Lo fi");

    opts[0].dispatchEvent(new MouseEvent("click", { bubbles: true })); // add "Rock"
    await flushAsync();

    expect(controller.selectedTags).toEqual(["gamma", "jpop", "Rock"]);
    expect(hidden.value).toBe("gamma,jpop,Rock");
    expect(input.value).toBe("");
    expect(suggestions.innerHTML).toBe("");
  });

  test("_renderTags: removeボタンで削除→hidden更新", () => {
    controller.selectedTags = ["x", "y"];
    controller._renderTags();
    expect(tags.querySelectorAll("span.badge").length).toBe(2);

    hidden.value = controller.selectedTags.join(",");

    const btn = tags.querySelector("button.btn-close");
    btn.click();

    expect(controller.selectedTags).toEqual(["y"]);
    expect(tags.querySelectorAll("span.badge").length).toBe(1);
    expect(hidden.value).toBe("y");
  });

  test("clearSuggestions/_clearInput 単体: innerHTMLクリア & inputクリア", () => {
    input.value = "keep";
    suggestions.innerHTML = "<div>tmp</div>";

    controller.clearSuggestions();
    expect(suggestions.innerHTML).toBe("");

    suggestions.innerHTML = "<div>tmp2</div>";
    controller._clearInput();
    expect(input.value).toBe("");
    expect(suggestions.innerHTML).toBe("");
  });
});
