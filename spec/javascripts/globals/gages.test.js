// spec/javascripts/globals/gages.test.js
/**
 * custom/gages.js 総合テスト（自己完結・分岐網羅）
 * 実装は触らず、テスト側で rAF と「可視/不可視」を制御して検証します。
 */

describe("custom/gages.js", () => {
  let origRAF;
  let __rafQ;
  let origGetClientRects;
  let origLocation;

  // 可視/不可視の切り替えフラグ（hp-bar のみ反映）
  let __barVisible = true;
  const setTrackWidth = (n) => { __barVisible = n > 0; }; // 既存テスト呼び出しを温存

  // ----- モジュール読込ヘルパ -----
  const importGages = () =>
    jest.isolateModules(() => {
      try {
        require("custom/gages_test.js");
      } catch {
        require("custom/gages.js");
      }
    });

  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = "";
    localStorage.clear();

    // rAF をキュー化 → 手動で flush
    __rafQ = [];
    origRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb) => { __rafQ.push(cb); return __rafQ.length; };
    window.__flushRAF = () => {
      const q = __rafQ.slice();
      __rafQ = [];
      q.forEach(fn => fn());
    };

    // 「見えている/いない」を hp-bar に対してだけ制御
    __barVisible = true;
    origGetClientRects = Element.prototype.getClientRects;
    Element.prototype.getClientRects = function () {
      if (this && this.id === "hp-bar") {
        return __barVisible ? [{ left: 0, top: 0, width: 200, height: 10 }] : [];
      }
      return origGetClientRects ? origGetClientRects.call(this) : [];
    };

    // window.location をテスト用に差し替え
    origLocation = window.location;
    delete window.location;
    window.location = { href: "http://test.host/" };
  });

  afterEach(() => {
    // 復元
    window.requestAnimationFrame = origRAF;
    delete window.__flushRAF;

    if (origGetClientRects) Element.prototype.getClientRects = origGetClientRects;

    delete window.location;
    window.location = origLocation;

    document.body.innerHTML = "";
    jest.restoreAllMocks();
  });

  // ========== テスト本体 ==========

  test("bars が無い時は早期 return（エラーにならない）", () => {
    importGages();
    expect(typeof window.updateHPBar).toBe("function");
    expect(() => window.updateHPBar()).not.toThrow();
  });

  test("不可視 → 次フレームで可視にして rAF 経由で値反映（<=20: red）", () => {
    document.body.innerHTML = `
      <div id="track"><div id="hp-bar"></div></div>
      <div id="hp-status-text"></div>
      <span id="bar-width-display"></span>
      <span id="bar-width-display-mobile"></span>
    `;
    setTrackWidth(0); // 最初は不可視
    localStorage.setItem("hpPercentage", "10"); // <=20 → red

    importGages();

    // 1回目：不可視なので次フレームへ
    window.updateHPBar();

    // 次フレームで可視化 → flush
    setTrackWidth(200);
    window.__flushRAF();

    const bar = document.getElementById("hp-bar");
    const status = document.getElementById("hp-status-text");
    const disp = document.getElementById("bar-width-display");
    const dispM = document.getElementById("bar-width-display-mobile");

    expect(bar.style.width).toBe("10%");
    expect(bar.dataset.width).toBe("10%");
    expect(bar.style.backgroundColor).toBe("red");
    expect(status.textContent).toContain("ストレス危険");
    expect(disp.textContent).toBe("10%");
    expect(dispM.textContent).toBe("10%");
  });

  test("rAF 即時ブランチ相当：import 前に可視にしておけば1回で反映（yellow）", () => {
    document.body.innerHTML = `
      <div id="track"><div id="hp-bar"></div></div>
      <div id="hp-status-text"></div>
    `;
    setTrackWidth(300);              // すでに可視
    localStorage.setItem("hpPercentage", "40");

    importGages();
    window.updateHPBar();            // 1回で抜ける

    const bar = document.getElementById("hp-bar");
    expect(bar.style.backgroundColor).toBe("yellow");
  });

  test("色分岐（<=40: yellow, <=70: #9ACD32, >70: green）を順に踏む", () => {
    document.body.innerHTML = `
      <div id="track"><div id="hp-bar"></div></div>
      <div id="hp-status-text"></div>
    `;
    setTrackWidth(300); // 可視
    importGages();

    const bar = document.getElementById("hp-bar");
    const status = document.getElementById("hp-status-text");

    localStorage.setItem("hpPercentage", "30");
    window.updateHPBar();
    expect(bar.style.backgroundColor).toBe("yellow");
    expect(status.textContent).toContain("ちょっと休みましょ");

    localStorage.setItem("hpPercentage", "55");
    window.updateHPBar();
    const bg = bar.style.backgroundColor;
    expect(bg === "#9ACD32" || bg === "rgb(154, 205, 50)").toBe(true);
    expect(status.textContent).toContain("おつかれさまです");

    localStorage.setItem("hpPercentage", "85");
    window.updateHPBar();
    expect(bar.style.backgroundColor).toBe("green");
    expect(status.textContent).toContain("メンタル正常");
  });

  test("barWidthDisplay / barWidthDisplayMobile が無くても落ちない", () => {
    document.body.innerHTML = `<div id="track"><div id="hp-bar"></div></div>`;
    setTrackWidth(300);
    importGages();

    localStorage.setItem("hpPercentage", "64");
    expect(() => window.updateHPBar()).not.toThrow();
  });

  test("goToRecommended: 正常系（hp=88）", () => {
    importGages();
    localStorage.setItem("hpPercentage", "88");
    window.goToRecommended();
    expect(window.location.href).toContain("/emotion_logs/recommended?hp=88");
  });

  test("goToRecommended: 異常系（未設定は alert）", () => {
    importGages();
    const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
    localStorage.removeItem("hpPercentage");
    window.goToRecommended();
    expect(alertSpy).toHaveBeenCalled();
  });

  test("input: target が HTMLElement でない時はスルー", () => {
    importGages();
    const spy = jest.spyOn(window, "updateHPBar");
    document.dispatchEvent(new Event("input", { bubbles: true }));
    expect(spy).not.toHaveBeenCalled();
  });

  test("input: 無効値（Number.isFinite false）では更新されない", () => {
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
      <form id="f"><input name="hp" value="66" /></form>
    `;
    setTrackWidth(300);
    importGages();

    const spy = jest.spyOn(window, "updateHPBar");
    const form = document.getElementById("f");
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(localStorage.getItem("hpPercentage")).toBe("66");
    expect(spy).toHaveBeenCalled();
  });

  test("submit: dataset.value ルート（value/property/attribute 無しでも data-value があれば拾う）", () => {
    document.body.innerHTML = `
      <div id="track"><div id="hp-bar"></div></div>
      <form id="f"><div id="hp" data-value="33"></div></form>
    `;
    setTrackWidth(300);
    importGages();

    const form = document.getElementById("f");
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(localStorage.getItem("hpPercentage")).toBe("33");
  });

  test("turbo:submit-end 成功時（status 200）で setHPAndRefresh", () => {
    document.body.innerHTML = `
      <div id="track"><div id="hp-bar"></div></div>
      <form id="f"><input class="js-hp-input" value="72" /></form>
    `;
    setTrackWidth(300);
    importGages();

    const spy = jest.spyOn(window, "updateHPBar");
    const form = document.getElementById("f");
    const event = new CustomEvent("turbo:submit-end", {
      bubbles: true,
      detail: { fetchResponse: { response: { status: 200 } } },
    });
    form.dispatchEvent(event);

    expect(localStorage.getItem("hpPercentage")).toBe("72");
    expect(spy).toHaveBeenCalled();
  });

  test("turbo:submit-end 成功時（fallback: detail.success===true）で setHPAndRefresh", () => {
    document.body.innerHTML = `
      <div id="track"><div id="hp-bar"></div></div>
      <form id="f"><input id="hp" value="77" /></form>
    `;
    setTrackWidth(300);
    importGages();

    const form = document.getElementById("f");
    const event = new CustomEvent("turbo:submit-end", {
      bubbles: true,
      detail: { success: true },
    });
    form.dispatchEvent(event);

    expect(localStorage.getItem("hpPercentage")).toBe("77");
  });

  test("turbo:submit-end 失敗時（status 500）では更新されない", () => {
    document.body.innerHTML = `
      <div id="track"><div id="hp-bar"></div></div>
      <form id="f"><input id="hp" value="12" /></form>
    `;
    setTrackWidth(300);
    importGages();

    const spy = jest.spyOn(window, "updateHPBar");
    const form = document.getElementById("f");
    const event = new CustomEvent("turbo:submit-end", {
      bubbles: true,
      detail: { fetchResponse: { response: { status: 500 } } },
    });
    form.dispatchEvent(event);

    expect(localStorage.getItem("hpPercentage")).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  test("イベント配線（document/window/Bootstrap shown.*）で updateHPBar が呼ばれる", () => {
    importGages();
    const spy = jest.spyOn(window, "updateHPBar");

    ["DOMContentLoaded", "turbo:load", "turbo:render", "turbo:frame-load"].forEach(evt =>
      document.dispatchEvent(new Event(evt))
    );
    ["pageshow", "resize", "orientationchange"].forEach(evt =>
      window.dispatchEvent(new Event(evt))
    );
    ["shown.bs.modal", "shown.bs.tab", "shown.bs.offcanvas"].forEach(evt =>
      document.dispatchEvent(new Event(evt, { bubbles: true }))
    );

    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(13);
  });

  test("ensureHPBarOnce（初期に #hp-bar が存在）: import 時に即反映", () => {
    document.body.innerHTML = `<div id="track"><div id="hp-bar"></div></div>`;
    setTrackWidth(300);
    importGages(); // IIFE 発火

    const bar = document.getElementById("hp-bar");
    expect(bar.style.width).toBe("50%");
  });

  test("ensureHPBarOnce（後挿入）: 読み込み後に #hp-bar を追加すると反映される", async () => {
    setTrackWidth(250);
    importGages();

    const spy = jest.spyOn(window, "updateHPBar");
    expect(document.getElementById("hp-bar")).toBeNull();

    const track = document.createElement("div");
    track.id = "track";
    const bar = document.createElement("div");
    bar.id = "hp-bar";
    track.appendChild(bar);
    document.body.appendChild(track);

    await Promise.resolve();
    await Promise.resolve();

    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  test("hpPercentage は 0〜100 に丸められる（-5→0%, 123→100%）", () => {
    document.body.innerHTML = `
      <div id="track"><div id="hp-bar"></div></div>
      <div id="hp-status-text"></div>
      <span id="bar-width-display"></span>
    `;
    setTrackWidth(300);
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

  test("submit: value 属性のフォールバックで値を取得できる", () => {
    document.body.innerHTML = `
      <div id="track"><div id="hp-bar"></div></div>
      <form id="f"><input id="hp" /></form>
    `;
    // property は未設定、attribute だけ設定
    const el = document.getElementById("hp");
    el.setAttribute("value", "44");

    setTrackWidth(300); // 可視にして無限ループ回避
    importGages();

    const form = document.getElementById("f");
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(localStorage.getItem("hpPercentage")).toBe("44");
  });
});
