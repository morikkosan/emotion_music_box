// spec/javascripts/controllers/tag_autocomplete_controller.test.js
/**
 * tag_autocomplete_controller 網羅テスト
 * - IME合成中はfetchしない（compositionstart / compositionend）
 * - 空文字入力で候補クリア & fetch未実行
 * - 正常fetch → 文字列/オブジェクト混在のタグ配列をli化
 * - liクリックで selectSuggestion: 値反映・候補クリア・一時的にinputリスナ解除→setTimeout後に再接続
 * - 例外系: fetch失敗時に候補クリア & console.error
 * - closeSuggestions: 内側クリックは維持、外側クリックで候補クリア
 * - URLエンコードが適切（encodeURIComponentの確認）
 */

import { Application } from "@hotwired/stimulus";
import ControllerClass from "controllers/tag_autocomplete_controller";

// ---- ユーティリティ: 非同期flush（Promiseチェーン/タイマーを前に進める）----
const flushAsync = async (ms = 0) => {
  // microtaskを2回ほど回してfetch→json→thenを進める
  await Promise.resolve();
  await Promise.resolve();
  if (ms > 0) jest.advanceTimersByTime(ms);
  // pendingTimersを実行（setTimeout(0)など）
  jest.runOnlyPendingTimers();
  await Promise.resolve();
};

describe("tag_autocomplete_controller", () => {
  let app, root, input, list, controller;

  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = `
      <div id="host" data-controller="tag-autocomplete">
        <input type="text" data-tag-autocomplete-target="input" />
        <ul data-tag-autocomplete-target="suggestions"></ul>
      </div>
    `;
    root = document.getElementById("host");
    input = root.querySelector('input[data-tag-autocomplete-target="input"]');
    list = root.querySelector('ul[data-tag-autocomplete-target="suggestions"]');

    app = Application.start();
    app.register("tag-autocomplete", ControllerClass);
    controller = app.getControllerForElementAndIdentifier(root, "tag-autocomplete");

    // デフォルトのfetchモックは各テスト内で設定
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  test("smoke: コントローラがconnectし、初期状態 isComposing=false", () => {
    expect(controller).toBeTruthy();
    expect(controller.isComposing).toBe(false);
    // targetsの自動配線確認（スタブ機構）
    expect(controller.inputTarget).toBe(input);
    expect(controller.suggestionsTarget).toBe(list);
  });

  test("IME合成中はfetchSuggestionsが早期returnしfetch未実行", async () => {
    // 合成開始: isComposing=true
    input.dispatchEvent(new CompositionEvent("compositionstart", { data: "あ" }));
    expect(controller.isComposing).toBe(true);

    // 入力イベント（合成中）→ fetchは走らない
    input.value = "あ";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flushAsync();
    expect(fetch).not.toHaveBeenCalled();

    // 合成終了: isComposing=false かつ 手動でfetchSuggestions実行
    fetch.mockResolvedValueOnce({
      json: jest.fn().mockResolvedValueOnce([{ name: "合成後" }]),
    });
    input.dispatchEvent(new CompositionEvent("compositionend", { data: "あ" }));
    await flushAsync();
    expect(controller.isComposing).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(list.querySelectorAll("li").length).toBe(1);
    expect(list.textContent).toContain("合成後");
  });

  test("空文字（trim後に空）では候補クリアし、fetchは呼ばれない", async () => {
    // もともと何か入っていたと仮定してクリア挙動を確かめる
    list.innerHTML = `<li>old</li>`;
    input.value = "   "; // trimで空
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flushAsync();
    expect(fetch).not.toHaveBeenCalled();
    expect(list.innerHTML).toBe("");
  });

  test("通常入力でfetch → 文字列/オブジェクト混在の候補をliで表示 & URLエンコード確認", async () => {
    const query = "A&B あ";
    const encoded = encodeURIComponent(query); // 'A%26B%20%E3%81%82'

    fetch.mockResolvedValueOnce({
      json: jest.fn().mockResolvedValueOnce([
        "Rock",
        { name: "J-Pop" },
        { name: "Lo fi" },
      ]),
    });

    input.value = query;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flushAsync();

    // fetchのURL（エンコード）確認
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe(`/tags/search?q=${encoded}`);

    const items = Array.from(list.querySelectorAll("li"));
    expect(items.map((li) => li.textContent)).toEqual(["Rock", "J-Pop", "Lo fi"]);
    // liのクラス/スタイル付与も確認
    items.forEach((li) => {
      expect(li.className).toContain("list-group-item");
      expect(li.className).toContain("list-group-item-action");
      expect(li.style.cursor).toBe("pointer");
    });
  });

  test("liクリックで selectSuggestion: 値反映・候補クリア・一時的にinputリスナ解除→タイマー後に再接続", async () => {
    // 候補を出す
    fetch.mockResolvedValueOnce({
      json: jest.fn().mockResolvedValueOnce(["Jazz", "Funk"]),
    });
    input.value = "ja";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flushAsync();

    const li = list.querySelector("li");
    expect(li).toBeTruthy();
    // fetchの呼び出し回数を基準化しておく
    fetch.mockClear();

    // liクリック → selectSuggestion
    li.click();
    expect(input.value).toBe("Jazz");
    expect(list.innerHTML).toBe("");

    // setTimeoutで再接続されるまではinputリスナが外れているはず
    input.value = "JazzX";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flushAsync();
    expect(fetch).not.toHaveBeenCalled();

    // タイマー発火後に再びinputでfetchされる
    await flushAsync(0); // setTimeout(0)を実行
    fetch.mockResolvedValueOnce({ json: jest.fn().mockResolvedValueOnce([]) });
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flushAsync();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("fetch失敗時: console.errorを呼びつつ候補クリア", async () => {
    // 事前に候補が何かある状態を再現
    list.innerHTML = `<li>old</li>`;

    fetch.mockRejectedValueOnce(new Error("network"));
    input.value = "err";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flushAsync();

    // setupFilesAfterEnvで console.error は spy 済み
    expect(console.error).toHaveBeenCalled();
    expect(list.innerHTML).toBe("");
  });

  test("closeSuggestions: 内側クリックでは維持、外側クリックでクリア", async () => {
    // 候補を出す
    fetch.mockResolvedValueOnce({
      json: jest.fn().mockResolvedValueOnce(["Keep", "Clear"]),
    });
    input.value = "k";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flushAsync();

    expect(list.querySelectorAll("li").length).toBe(2);

    // 内側クリック → 維持
    input.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushAsync();
    expect(list.querySelectorAll("li").length).toBe(2);

    // 外側クリック → クリア
    const outside = document.createElement("div");
    document.body.appendChild(outside);
    outside.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushAsync();
    expect(list.innerHTML).toBe("");
  });

  test("直接fetchSuggestions()呼び出しでも、isComposing=trueなら何もしない", async () => {
    controller.isComposing = true;
    input.value = "abc";
    controller.fetchSuggestions(); // 直接呼ぶ
    await flushAsync();
    expect(fetch).not.toHaveBeenCalled();
  });
});
