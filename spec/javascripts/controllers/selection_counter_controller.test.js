// spec/javascripts/controllers/selection_counter_controller.test.js

/**
 * selection_counter_controller.js の動作検証
 * - connect/disconnect（副作用経路も通る）
 * - 追加/削除 → sessionStorage 反映 & カウント更新
 * - button 有効/無効切替（element 内 / document fallback）
 * - applyCheckedState: value / data-id 両方に反映（※実運用どおり value を優先）
 * - clearAll
 * - turbo:load / turbo:frame-load 反映
 * - MutationObserver 経路（50ms デバウンス）
 */

jest.mock("@hotwired/turbo-rails", () => ({}), { virtual: true });
jest.mock("@rails/ujs", () => ({ __esModule: true, default: { start: () => {} } }));
jest.mock("bootstrap", () => ({ __esModule: true }));

describe("selection_counter_controller", () => {
  let Stim;
  let app;
  let ControllerClass;

  beforeEach(() => {
    jest.resetModules();
    sessionStorage.clear();

    document.body.innerHTML = `
      <div id="root"
           data-controller="selection-counter"
           data-selection-counter-target="output">
        <span data-selection-counter-target="output" id="out">0個選択中</span>
        <button type="button" id="inner-btn" class="bookmark-playlist-create-btn disabled"
                disabled aria-disabled="true">作成</button>
      </div>

      <button type="button" id="global-btn" class="bookmark-playlist-create-btn disabled"
              disabled aria-disabled="true" style="display:none">作成(グローバル)</button>

      <!-- 実運用に合わせて、data-id のものにも value を付与する -->
      <input type="checkbox" class="playlist-check" id="cb-value-1" value="1">
      <input type="checkbox" class="playlist-check" id="cb-dataset-99" data-id="99" value="99">
    `;

    Stim = require("@hotwired/stimulus");
    ControllerClass = require("controllers/selection_counter_controller.js").default;

    app = Stim.Application.start();
    app.register("selection-counter", ControllerClass);

    const el = document.getElementById("root");
    const inst = app.getControllerForElementAndIdentifier(el, "selection-counter");

    // values はスタブで自動反映されないため代入
    inst.checkboxSelectorValue = ".playlist-check";
    inst.buttonSelectorValue   = ".bookmark-playlist-create-btn";

    window.__selInst = inst;
  });

  afterEach(() => {
    try { window.__selInst?.disconnect(); } catch {}
    delete window.__selInst;
    jest.restoreAllMocks();
  });

  test("初期状態: 0個表示・ボタンは無効（element 内優先探索）", () => {
    const inst = window.__selInst;
    expect(inst.outputTarget.textContent).toBe("0個選択中");

    const btn = document.getElementById("inner-btn");
    expect(btn.hasAttribute("disabled")).toBe(true);
    expect(btn.classList.contains("disabled")).toBe(true);
    expect(btn.getAttribute("aria-disabled")).toBe("true");
  });

  test("handleChange: チェック/アンチェックで件数遷移 & ボタン切替（value + data-id 付き）", () => {
    const inst = window.__selInst;
    const out = inst.outputTarget;
    const btn = document.getElementById("inner-btn");

    const cb1 = document.getElementById("cb-value-1");       // value=1
    const cb2 = document.getElementById("cb-dataset-99");    // data-id=99 かつ value=99

    // 1) value=1 をチェック
    cb1.checked = true;
    cb1.dispatchEvent(new Event("change", { bubbles: true }));
    expect(out.textContent).toBe("1個選択中");
    expect(btn.hasAttribute("disabled")).toBe(false);
    expect(btn.classList.contains("disabled")).toBe(false);
    expect(btn.getAttribute("aria-disabled")).toBe("false");

    // 2) value=99 をチェック
    cb2.checked = true;
    cb2.dispatchEvent(new Event("change", { bubbles: true }));
    expect(out.textContent).toBe("2個選択中");

    // 3) value=1 を外す → 1個
    cb1.checked = false;
    cb1.dispatchEvent(new Event("change", { bubbles: true }));
    expect(out.textContent).toBe("1個選択中");

    // 4) value=99 も外す → 0個 & 無効に戻る
    cb2.checked = false;
    cb2.dispatchEvent(new Event("change", { bubbles: true }));
    expect(out.textContent).toBe("0個選択中");
    expect(btn.hasAttribute("disabled")).toBe(true);
    expect(btn.classList.contains("disabled")).toBe(true);
    expect(btn.getAttribute("aria-disabled")).toBe("true");
  });

  test("buttonSelector: element 内に無い場合は document.querySelector の fallback を使う", () => {
    const inst = window.__selInst;
    document.getElementById("inner-btn").remove();
    document.getElementById("global-btn").style.display = "";

    const cb1 = document.getElementById("cb-value-1");
    cb1.checked = true;
    cb1.dispatchEvent(new Event("change", { bubbles: true }));

    const globalBtn = document.getElementById("global-btn");
    expect(globalBtn.hasAttribute("disabled")).toBe(false);
    expect(globalBtn.classList.contains("disabled")).toBe(false);
    expect(globalBtn.getAttribute("aria-disabled")).toBe("false");
  });

  test("applyCheckedState: 保存済みセットを value=1 / value=99 の両方に反映", () => {
    const inst = window.__selInst;

    // 固定キーで保存
    inst.namespaceKeyValue = "spec-namespace";
    const key = inst._storageKey();
    sessionStorage.setItem(key, JSON.stringify(["1", "99"]));

    const cb1 = document.getElementById("cb-value-1");
    const cb2 = document.getElementById("cb-dataset-99");
    cb1.checked = false; cb2.checked = false;

    inst.applyCheckedState();
    inst.updateCount();

    expect(cb1.checked).toBe(true);
    expect(cb2.checked).toBe(true);
    expect(inst.outputTarget.textContent).toBe("2個選択中");
  });

  test("clearAll: 全解除＆保存クリア＆カウント0", () => {
    const inst = window.__selInst;

    const cb1 = document.getElementById("cb-value-1");
    const cb2 = document.getElementById("cb-dataset-99");
    cb1.checked = true; cb2.checked = true;
    cb1.dispatchEvent(new Event("change", { bubbles: true }));
    cb2.dispatchEvent(new Event("change", { bubbles: true }));
    expect(inst.outputTarget.textContent).toBe("2個選択中");

    inst.clearAll();

    expect(cb1.checked).toBe(false);
    expect(cb2.checked).toBe(false);
    expect(inst.outputTarget.textContent).toBe("0個選択中");

    const key = inst._storageKey();
    expect(sessionStorage.getItem(key)).toBe(JSON.stringify([]));
  });

  test("turbo:load / turbo:frame-load で再反映（保存セットを UI に適用）", () => {
    const inst = window.__selInst;

    // デフォルトキーで 1 を保存
    const key = inst._storageKey();
    sessionStorage.setItem(key, JSON.stringify(["1"]));
    const cb1 = document.getElementById("cb-value-1");
    cb1.checked = false;

    document.dispatchEvent(new Event("turbo:load"));
    expect(cb1.checked).toBe(true);
    expect(inst.outputTarget.textContent).toBe("1個選択中");

    // 99 に差し替え → frame-load で value=99 が反映
    sessionStorage.setItem(key, JSON.stringify(["99"]));
    const cb2 = document.getElementById("cb-dataset-99");
    cb1.checked = false; cb2.checked = false;
    document.dispatchEvent(new Event("turbo:frame-load"));
    expect(cb1.checked).toBe(false);
    expect(cb2.checked).toBe(true);
    expect(inst.outputTarget.textContent).toBe("1個選択中");
  });

  // ★ 修正：非同期テストにして、appendChild 後に microtask をフラッシュしてからタイマーを進める
  test("MutationObserver 経路: ノード追加後 50ms 後に apply+update が走る", async () => {
    const inst = window.__selInst;
    jest.useFakeTimers();

    const key = inst._storageKey();
    sessionStorage.setItem(key, JSON.stringify(["77"]));

    const lateCb = document.createElement("input");
    lateCb.type = "checkbox";
    lateCb.className = "playlist-check";
    lateCb.id = "cb-late-77";
    lateCb.value = "77";

    expect(inst.outputTarget.textContent).toBe("0個選択中");

    document.body.appendChild(lateCb);

    // ここで MutationObserver のコールバックは microtask で実行される。
    // microtask を1〜2回フラッシュしてから、50ms のデバウンスタイマーを進める。
    await Promise.resolve();
    await Promise.resolve();

    // MO のコールバック内 setTimeout(50) を消化
    jest.advanceTimersByTime(60);

    expect(lateCb.checked).toBe(true);
    expect(inst.outputTarget.textContent).toBe("1個選択中");

    jest.useRealTimers();
  });

  test("_storageKey: namespace 未指定なら selection:/path:bookmarks を使う（概形）", () => {
    const inst = window.__selInst;

    const spy = jest.spyOn(window.sessionStorage.__proto__, "setItem");
    const cb1 = document.getElementById("cb-value-1");
    cb1.checked = true;
    cb1.dispatchEvent(new Event("change", { bubbles: true }));

    expect(spy).toHaveBeenCalled();
    const [key, val] = spy.mock.calls.pop();
    expect(typeof key).toBe("string");
    expect(key.startsWith("selection:")).toBe(true);
    expect(key.endsWith(":bookmarks")).toBe(true);
    expect(val).toBe(JSON.stringify(["1"]));

    spy.mockRestore();
  });

  // ===== ここから追加（ブランチ欠け対策・本体無改変） =====

  // 56-59: !matches(sel) の早期 return を通す
  test("handleChange: 対象外の要素(change)は無視される（selector 不一致の早期return）", () => {
    const inst = window.__selInst;
    const out = inst.outputTarget;

    const other = document.createElement("input");
    other.type = "checkbox";
    other.className = "not-playlist"; // セレクタ不一致
    document.body.appendChild(other);

    other.checked = true;
    other.dispatchEvent(new Event("change", { bubbles: true }));

    // 何も変化しない
    expect(out.textContent).toBe("0個選択中");
    const key = inst._storageKey();
    expect(sessionStorage.getItem(key)).toBeNull();
  });

  // 75: hasOutputTarget が falsy の経路を通す（出力ターゲットの無い別インスタンス）
  test("updateCount: 出力ターゲットが無い場合は表示更新をスキップ（hasOutputTarget falsy）", () => {
    const inst1 = window.__selInst;

    // まず既存インスタンスで保存を1件入れておく
    const key1 = inst1._storageKey();
    sessionStorage.setItem(key1, JSON.stringify(["1"]));

    // 出力ターゲット無しの要素で新しいインスタンスを作る（既存DOMは触らない）
    const root2 = document.createElement("div");
    root2.id = "root-no-output";
    root2.setAttribute("data-controller", "selection-counter");
    document.body.appendChild(root2);

    const inst2 = app.getControllerForElementAndIdentifier(root2, "selection-counter");
    inst2.checkboxSelectorValue = ".playlist-check";
    inst2.buttonSelectorValue = ""; // ボタン更新もしない

    // falsy 分岐（hasOutputTarget は定義されていない → falsy）
    expect("hasOutputTarget" in inst2).toBe(false);
    expect(() => inst2.updateCount()).not.toThrow();
  });

  // 85: 指定セレクタにボタンが存在しない場合も安全にスキップ（btn null）
  test("updateCount: 指定セレクタにボタンが存在しない場合も安全にスキップ（btn null）", () => {
    const inst = window.__selInst;
    const btn = document.getElementById("inner-btn");

    const key = inst._storageKey();
    sessionStorage.setItem(key, JSON.stringify(["1"]));

    inst.buttonSelectorValue = ".no-such-button"; // 見つからない
    inst.updateCount();

    // 出力は更新
    expect(inst.outputTarget.textContent).toBe("1個選択中");
    // 既存ボタンは変更されない
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  // 124: _loadSet の catch 経路（破損JSON）
  test("_loadSet: 破損JSONでも落ちず空集合扱い（catch 経路）", () => {
    const inst = window.__selInst;
    const key = inst._storageKey();
    sessionStorage.setItem(key, "{ invalid json"); // JSON.parse 失敗

    inst.updateCount(); // _loadSet が走る
    expect(inst.outputTarget.textContent).toBe("0個選択中");
  });

  // save 側の catch は既に別ケースで通過（_saveSet: setItem throw）済み


    // --- ここから追記: 既存ケースに一切干渉しない「素インスタンス直叩き」分岐網羅 ---

  describe("branch-only micro (no DOM/Storage side-effects)", () => {
    // 56: (!e.target) 早期return … 直接呼び出し
    test("handleChange: e.target が無いイベントは無視（早期return: !e.target）", () => {
      const Klass = require("controllers/selection_counter_controller.js").default;
      const inst  = new Klass();
      // セレクタ未設定でもデフォルト(".playlist-check")でOK。何も起きず例外無しが確認点。
      expect(() => inst.handleChange({})).not.toThrow();
    });

    // 59-60: (!id) 早期return … matches は true、value="" で id 空にして直叩き
    test("handleChange: セレクタ一致でも id が空なら無視（早期return: !id）", () => {
      const Klass = require("controllers/selection_counter_controller.js").default;
      const inst  = new Klass();
      inst.checkboxSelectorValue = ".playlist-check";

      const fakeTarget = {
        matches: sel => sel === ".playlist-check",
        value: "",            // ← id を空に
        dataset: {},          // data-id も無し
        checked: true
      };

      // 実行しても _loadSet/_saveSet には到達せず早期return
      expect(() => inst.handleChange({ target: fakeTarget })).not.toThrow();
    });

    // 75 & 85: hasOutputTarget falsy と buttonSelectorValue falsy を同時に通す
    test("updateCount: 出力ターゲット無し & ボタン指定無しでも安全に実行", () => {
      const Klass = require("controllers/selection_counter_controller.js").default;
      const inst  = new Klass();
      inst.element = document.createElement("div"); // ボタン探索で使われるが、ボタンは置かない
      inst.buttonSelectorValue = "";                // ← falsy 分岐（85）を通す

      // _loadSet だけをスタブして件数=1に（Storageを触らない）
      jest.spyOn(inst, "_loadSet").mockReturnValue(new Set(["1"]));

      // hasOutputTarget を定義しない = falsy 分岐（75）
      expect("hasOutputTarget" in inst).toBe(false);
      expect(() => inst.updateCount()).not.toThrow();
    });

    // 124 & 129: _loadSet の catch（破損JSON）と _saveSet の catch（setItem 例外）
    test("_loadSet/_saveSet: 例外経路も落ちない（catch）", () => {
      const Klass = require("controllers/selection_counter_controller.js").default;
      const inst  = new Klass();

      // _loadSet: 破損JSON → catch で空集合
      jest.spyOn(inst, "_storageKey").mockReturnValue("branch-only-key");
      sessionStorage.setItem("branch-only-key", "{ invalid json");
      const set = inst._loadSet();
      expect(set instanceof Set).toBe(true);
      expect(set.size).toBe(0);

      // _saveSet: setItem が throw → catch で握りつぶす（副作用なし）
      const spy = jest
        .spyOn(window.sessionStorage.__proto__, "setItem")
        .mockImplementation(() => { throw new Error("boom"); });

      expect(() => inst._saveSet(new Set(["1"]))).not.toThrow();
      expect(sessionStorage.getItem("branch-only-key")).toBe("{ invalid json"); // 変化なし

      spy.mockRestore();
    });
  });

  // --- 追記ここまで ---

  
});


