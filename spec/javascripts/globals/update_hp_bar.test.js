/**
 * update_hp_bar.test.js（軽量スモーク版）
 * - 本体は一切変更せず、ここは OOM 回避のため最小限だけ検証
 * - 詳細な分岐は update_hp_bar.more.test.js に任せる
 */

const realRAF = global.requestAnimationFrame;
let rafQ = [];

beforeAll(() => {
  // rAF をキュー化（無限再帰・即時多重呼び出しの暴走防止）
  global.requestAnimationFrame = (cb) => { rafQ.push(cb); return 1; };
  global.__flushRaf = () => {
    const q = rafQ.slice();
    rafQ = [];
    q.forEach(fn => { try { fn(); } catch {} });
  };

  // ResizeObserver の軽量モック
  if (!global.ResizeObserver) {
    class FakeRO { constructor(cb){ this.cb = cb; } observe(){} disconnect(){} }
    global.ResizeObserver = FakeRO;
  }

  // MutationObserver はリークしやすいので no-op 化（必要なら手動 trigger 可）
  const __MO_REG = [];
  class LeakSafeMO {
    constructor(cb){ this.cb = cb; __MO_REG.push(this); }
    observe(){ /* noop */ }
    disconnect(){ /* noop */ }
    takeRecords(){ return []; }
    // テストで必要になったら instance._trigger([...]) してね
    _trigger(muts=[{ type:"childList", target: document.body }]) {
      try { this.cb(muts, this); } catch {}
    }
  }
  global.MutationObserver = LeakSafeMO;
  global.___MO_REG = __MO_REG;

  // 本体読み込み（1回だけ）
  require("../../../app/javascript/custom/gages_test.js");
});

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  rafQ = [];
  // もし何か積まれていたら一応空にしておく
  if (typeof global.__flushRaf === "function") {
    try { global.__flushRaf(); } catch {}
  }
});

afterAll(() => {
  global.requestAnimationFrame = realRAF;
  delete global.__flushRaf;
  delete global.___MO_REG;
});

describe("window.updateHPBar（スモーク）", () => {
  test("バーが無くても例外を投げない", () => {
    document.body.innerHTML = `<div></div>`;
    expect(() => window.updateHPBar()).not.toThrow();
  });

  test("track が可視なら 1 回で反映される（色: 55%→#9ACD32）", () => {
    document.body.innerHTML = `
      <div id="track"><div id="hp-bar"></div></div>
      <p id="hp-status-text"></p>
    `;
    // 可視にして rAF の “offsetWidth=0 ループ” を回避
    const track = document.getElementById("track");
    Object.defineProperty(track, "offsetWidth", { value: 300, configurable: true });

    localStorage.setItem("hpPercentage", "55");
    window.updateHPBar();

    const bar = document.getElementById("hp-bar");
    const bg = bar.style.backgroundColor;

    expect(bar.style.width).toBe("55%");
    // jsdom だと rgb 正規化されることがある
    expect(bg === "#9ACD32" || bg === "rgb(154, 205, 50)").toBe(true);
  });
});
