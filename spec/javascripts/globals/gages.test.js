/**
 * custom/gages.js 総合テスト（自己完結・分岐網羅）
 * - rAF と ResizeObserver を制御して「track.offsetWidth===0 → RO 経由再実行」＆「rAF 即時再実行」両方を踏む
 * - 色分岐（<=20 / <=40 / <=70 / >70）
 * - goToRecommended（正常/異常）
 * - input/submit/turbo:submit-end の同期ロジック
 * - イベント配線（document/window/Bootstrap shown.*）
 * - ensureHPBarOnce（#hp-bar 初期あり／後挿入の両方）
 * - getHPFromDocument の dataset.value ルート
 */

describe("custom/gages.js", () => {
  let origRAF;
  let origRO;
  let origLocation;
  let origOffsetWidthDesc;

  // 可変な track 幅をテストから操作するためのフラグ
  let __trackWidth = 0;
  const setTrackWidth = (n) => { __trackWidth = n; };

  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = "";
    localStorage.clear();

    // offsetWidth をテスト制御できるようにする
    origOffsetWidthDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get() { return __trackWidth; }
    });

    // rAF はデフォ即時実行（テストごとに上書きすることあり）
    origRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb) => { cb(); return 1; };

    // ResizeObserver をテスト用に制御可能に
    const observers = [];
    class FakeRO {
      constructor(cb) { this.cb = cb; observers.push(this); }
      observe() { /* テスト側で手動トリガ */ }
      disconnect() {}
    }
    origRO = window.ResizeObserver;
    window.ResizeObserver = FakeRO;
    // グローバルトリガ（rAF 内で RO が observe された後にここを呼ぶ）
    window.__triggerRO = () => observers.forEach(o => o.cb());

    // window.location をテスト用に差し替え（href を書き換え可能に）
    origLocation = window.location;
    delete window.location;
    window.location = { href: "http://test.host/" };
  });

  afterEach(() => {
    // 復元
    if (origOffsetWidthDesc) {
      Object.defineProperty(HTMLElement.prototype, "offsetWidth", origOffsetWidthDesc);
    }
    window.requestAnimationFrame = origRAF;
    window.ResizeObserver = origRO;
    delete window.__triggerRO;
    delete window.location;
    window.location = origLocation;

    document.body.innerHTML = "";
    jest.restoreAllMocks();
  });

  // ----- モジュール読込ヘルパ（どのファイル名でも拾えるように）-----
  const importGages = () => {
    jest.isolateModules(() => {
      const candidates = [
        "custom/gages.js",
        "custom/gages_test.js",
        "custom/gages.mjs",
      ];
      let loaded = false;
      let lastErr = null;
      for (const m of candidates) {
        try {
          require(m);
          loaded = true;
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!loaded) {
        throw new Error(
          "Could not load gages module. Tried: " + candidates.join(", ") +
          (lastErr ? `\nLast error: ${String(lastErr)}` : "")
        );
      }
    });
  };

  test("bars が無い時は早期 return（エラーにならない）", () => {
    importGages();
    expect(typeof window.updateHPBar).toBe("function");
    expect(() => window.updateHPBar()).not.toThrow();
  });

  test("track.offsetWidth===0 → rAF → ResizeObserver 経由で再実行され値反映（<=20: red）", () => {
    document.body.innerHTML = `
      <div id="track"><div id="hp-bar"></div></div>
      <div id="hp-status-text"></div>
      <span id="bar-width-display"></span>
      <span id="bar-width-display-mobile"></span>
    `;
    setTrackWidth(0); // 最初は 0（rAF 分岐へ）
    localStorage.setItem("hpPercentage", "10"); // <=20 の赤分岐

    importGages();

    // 1回目：track.offsetWidth===0 → rAF 内で RO を observe
    window.updateHPBar();

    // rAF 内で「まだ 0」→ RO 経由へ。ここでトラックが表示されたことにする
    setTrackWidth(200);
    // RO コールバックを強制発火 → updateHPBar() が再実行される
    window.__triggerRO();

    const bar = document.getElementById("hp-bar");
    const status = document.getElementById("hp-status-text");
    const disp = document.getElementById("bar-width-display");
    const dispM = document.getElementById("bar-width-display-mobile");

    expect(bar.style.width).toBe("10%");
    expect(bar.dataset.width).toBe("10%");
    expect(status.textContent).toContain("ストレス危険");
    // 色（red）
    expect(bar.style.backgroundColor).toBe("red");
    // 表示
    expect(disp.textContent).toBe("10%");
    expect(dispM.textContent).toBe("10%");
  });

  test("rAF 即時ブランチ：rAF 内で offsetWidth>0 になった場合は RO を使わずに再実行される", () => {
    document.body.innerHTML = `
      <div id="track"><div id="hp-bar"></div></div>
      <div id="hp-status-text"></div>
    `;
    // rAF を一時的に「後で手動発火」方式へ
    let storedCB = null;
    const prevRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb) => { storedCB = cb; return 1; };

    setTrackWidth(0);
    localStorage.setItem("hpPercentage", "40"); // yellow 分岐狙い
    importGages();

    window.updateHPBar();   // ここでは track=0 → rAF にコールバック保存

    setTrackWidth(300);     // rAF 実行時には表示されている想定
    storedCB();             // rAF を今呼ぶ → 「if (track.offsetWidth>0) 再実行」分岐を踏む

    const bar = document.getElementById("hp-bar");
    expect(bar.style.backgroundColor).toBe("yellow");

    // 後片付け
    window.requestAnimationFrame = prevRAF;
  });

  test("色分岐（<=40: yellow, <=70: #9ACD32, >70: green）を順に踏む", () => {
    document.body.innerHTML = `
      <div id="track"><div id="hp-bar"></div></div>
      <div id="hp-status-text"></div>
    `;
    setTrackWidth(300); // すでに表示状態

    importGages();
    const bar = document.getElementById("hp-bar");
    const status = document.getElementById("hp-status-text");

    // <=40 → yellow
    localStorage.setItem("hpPercentage", "30");
    window.updateHPBar();
    expect(bar.style.backgroundColor).toBe("yellow");
    expect(status.textContent).toContain("ちょっと休みましょ");

    // <=70 → #9ACD32（JSDOM は hex を rgb に正規化することがある）
    localStorage.setItem("hpPercentage", "55");
    window.updateHPBar();
    const bg = bar.style.backgroundColor;
    expect(bg === "#9ACD32" || bg === "rgb(154, 205, 50)").toBe(true);
    expect(status.textContent).toContain("おつかれさまです");

    // >70 → green
    localStorage.setItem("hpPercentage", "85");
    window.updateHPBar();
    expect(bar.style.backgroundColor).toBe("green");
    expect(status.textContent).toContain("メンタル正常");
  });

  test("barWidthDisplay / barWidthDisplayMobile が存在しない場合でも落ちない（ガード分岐）", () => {
    document.body.innerHTML = `
      <div id="track"><div id="hp-bar"></div></div>
    `;
    setTrackWidth(300);
    importGages();

    localStorage.setItem("hpPercentage", "64");
    expect(() => window.updateHPBar()).not.toThrow();
  });

  test("goToRecommended: 正常系（hp=88 で遷移先にクエリが付与）", () => {
    importGages();
    localStorage.setItem("hpPercentage", "88");

    window.goToRecommended();
    expect(window.location.href).toContain("/emotion_logs/recommended?hp=88");
  });

  test("goToRecommended: 異常系（未設定/NaN なら alert）", () => {
    importGages();
    const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
    localStorage.removeItem("hpPercentage");

    window.goToRecommended();
    expect(alertSpy).toHaveBeenCalled();
  });

  test("input: target が HTMLElement でないときは早期 return（document に直接 input を発火）", () => {
    importGages();
    const spy = jest.spyOn(window, "updateHPBar");
    document.dispatchEvent(new Event("input", { bubbles: true }));
    expect(spy).not.toHaveBeenCalled();
  });

  test("input: 無効値（Number.isFinite が false）では set も update も走らない", () => {
    document.body.innerHTML = `
      <div id="track"><div id="hp-bar"></div></div>
      <input id="hp-input" value="abc" />
    `;
    setTrackWidth(300);

    importGages();
    const spy = jest.spyOn(window, "updateHPBar");
    const input = document.getElementById("hp-input");
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(localStorage.getItem("hpPercentage")).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  test("submit で form 内の HP 値を拾って setHPAndRefresh", () => {
    document.body.innerHTML = `
      <div id="track"><div id="hp-bar"></div></div>
      <form id="f">
        <input name="hp" value="66" />
      </form>
    `;
    setTrackWidth(300);

    importGages();
    const spy = jest.spyOn(window, "updateHPBar");
    const form = document.getElementById("f");

    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(localStorage.getItem("hpPercentage")).toBe("66");
    expect(spy).toHaveBeenCalled();
  });

  test("submit: dataset.value ルート（value/property/attribute が無くても data-value があれば拾う）", () => {
    document.body.innerHTML = `
      <div id="track"><div id="hp-bar"></div></div>
      <form id="f">
        <div id="hp" data-value="33"></div>
      </form>
    `;
    setTrackWidth(300);

    importGages();
    const form = document.getElementById("f");
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(localStorage.getItem("hpPercentage")).toBe("33");
  });

  test("turbo:submit-end 成功時（status 200）で setHPAndRefresh が呼ばれる", () => {
    document.body.innerHTML = `
      <div id="track"><div id="hp-bar"></div></div>
      <form id="f">
        <input class="js-hp-input" value="72" />
      </form>
    `;
    setTrackWidth(300);

    importGages();
    const spy = jest.spyOn(window, "updateHPBar");
    const form = document.getElementById("f");

    const event = new CustomEvent("turbo:submit-end", {
      bubbles: true,
      detail: { fetchResponse: { response: { status: 200 } } }
    });
    form.dispatchEvent(event);

    expect(localStorage.getItem("hpPercentage")).toBe("72");
    expect(spy).toHaveBeenCalled();
  });

  test("turbo:submit-end 成功時（fallback: detail.success===true）で setHPAndRefresh が呼ばれる", () => {
    document.body.innerHTML = `
      <div id="track"><div id="hp-bar"></div></div>
      <form id="f">
        <input id="hp" value="77" />
      </form>
    `;
    setTrackWidth(300);

    importGages();
    const form = document.getElementById("f");

    const event = new CustomEvent("turbo:submit-end", {
      bubbles: true,
      detail: { success: true } // ← fetchResponse なし、success=true で 200 相当
    });
    form.dispatchEvent(event);

    expect(localStorage.getItem("hpPercentage")).toBe("77");
  });

  test("turbo:submit-end 失敗時（status 500）では更新されない", () => {
    document.body.innerHTML = `
      <div id="track"><div id="hp-bar"></div></div>
      <form id="f">
        <input id="hp" value="12" />
      </form>
    `;
    setTrackWidth(300);

    importGages();
    const spy = jest.spyOn(window, "updateHPBar");
    const form = document.getElementById("f");

    const event = new CustomEvent("turbo:submit-end", {
      bubbles: true,
      detail: { fetchResponse: { response: { status: 500 } } }
    });
    form.dispatchEvent(event);

    expect(localStorage.getItem("hpPercentage")).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  test("イベント配線（document/window/Bootstrap shown.*）で updateHPBar が呼ばれる", () => {
    importGages();
    const spy = jest.spyOn(window, "updateHPBar");

    // document系
    ["DOMContentLoaded", "turbo:load", "turbo:render", "turbo:frame-load"].forEach(evt =>
      document.dispatchEvent(new Event(evt))
    );
    // window系
    ["pageshow", "resize", "orientationchange"].forEach(evt =>
      window.dispatchEvent(new Event(evt))
    );
    // Bootstrap系（キャプチャ）
    ["shown.bs.modal", "shown.bs.tab", "shown.bs.offcanvas"].forEach(evt =>
      document.dispatchEvent(new Event(evt, { bubbles: true }))
    );

    // 7 + 3 + 3 = 13 回以上
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(13);
  });

  test("ensureHPBarOnce（初期に #hp-bar が存在）: import 時に即反映される", () => {
    // 先に #hp-bar を用意 → IIFE の if 分岐（即 update ）を踏む
    document.body.innerHTML = `
      <div id="track"><div id="hp-bar"></div></div>
    `;
    setTrackWidth(300);
    importGages(); // ここで IIFE が走るはず

    const bar = document.getElementById("hp-bar");
    // localStorage 未設定のデフォ 50% が反映されている
    expect(bar.style.width).toBe("50%");
  });

  test("ensureHPBarOnce（後挿入）: 読み込み時に #hp-bar が無くても、後から追加されたら反映される", async () => {
    setTrackWidth(250);
    importGages();

    const spy = jest.spyOn(window, "updateHPBar");

    // 初期は #hp-bar なし → IIFE が MutationObserver を張る
    expect(document.getElementById("hp-bar")).toBeNull();

    // 後から #hp-bar を追加
    const track = document.createElement("div");
    track.id = "track";
    const bar = document.createElement("div");
    bar.id = "hp-bar";
    track.appendChild(bar);
    document.body.appendChild(track);

    // MutationObserver はマイクロタスク扱いのことがあるので一拍置く
    await Promise.resolve();
    await Promise.resolve();

    // 実装/環境によって複数回来る可能性があるため「1回以上」で判定
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  // 1) クリップ動作（min/max）を踏む：0%/100% と色を確認
test("hpPercentage は 0〜100 に丸められる（-5→0%, 123→100%）", () => {
  document.body.innerHTML = `
    <div id="track"><div id="hp-bar"></div></div>
    <div id="hp-status-text"></div>
    <span id="bar-width-display"></span>
  `;
  // track を表示状態に
  (Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth").get
    ? null
    : Object.defineProperty(HTMLElement.prototype, "offsetWidth", { get: () => 300 })
  );
  const importGages = () => jest.isolateModules(() => {
    const cands = ["custom/gages.js","custom/gages_test.js","custom/gages.mjs"];
    for (const m of cands) { try { require(m); break; } catch {} }
  });
  importGages();

  const bar = document.getElementById("hp-bar");
  const status = document.getElementById("hp-status-text");

  localStorage.setItem("hpPercentage", "-5");
  window.updateHPBar();
  expect(bar.style.width).toBe("0%");
  expect(status.textContent).toContain("ストレス危険");

  localStorage.setItem("hpPercentage", "123");
  window.updateHPBar();
  expect(bar.style.width).toBe("100%");
  expect(status.textContent).toContain("メンタル正常");
});

// 2) getHPFromDocument の “value属性” フォールバック経路
test("submit: value 属性のフォールバックで値を取得できる", () => {
  document.body.innerHTML = `
    <div id="track"><div id="hp-bar"></div></div>
    <form id="f">
      <input id="hp" />
    </form>
  `;
  // property は未設定、attribute だけ設定
  const el = document.getElementById("hp");
  el.setAttribute("value", "44");

  const importGages = () => jest.isolateModules(() => {
    const cands = ["custom/gages.js","custom/gages_test.js","custom/gages.mjs"];
    for (const m of cands) { try { require(m); break; } catch {} }
  });
  importGages();

  const form = document.getElementById("f");
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

  expect(localStorage.getItem("hpPercentage")).toBe("44");
});

});


