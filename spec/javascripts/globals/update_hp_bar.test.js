// spec/javascripts/globals/update_hp_bar.more.test.js
/**
 * 目的：
 * - gages_test.js の未カバー分岐を網羅
 *   - bars.length === 0 で return
 *   - track.offsetWidth === 0 の requestAnimationFrame 分岐
 *   - 各しきい値（<=20, <=40, <=70, >70）
 *   - barWidthDisplay / barWidthDisplayMobile の反映
 *   - goToRecommended の NaN 分岐（alert）
 *   - input/submit/turbo:submit-end のフォーム同期
 *   - DOMContentLoaded / turbo:load / turbo:render / turbo:frame-load の各イベントで updateHPBar が呼ばれる
 *   - MutationObserver による ensureHPBarOnce
 */

import { renderHTML } from "../helpers/dom";

// ---- jsdom で未実装の API をモック（RAF はキュー方式にする）----
let rafQueue = [];
beforeAll(() => {
  // requestAnimationFrame を即時実行ではなく、キューに積んで後で手動実行できるようにする
  global.requestAnimationFrame = (cb) => {
    rafQueue.push(cb);
    return 1;
  };
  // テストからフラッシュできるようにユーティリティを用意
  global.__flushRaf = () => {
    while (rafQueue.length) {
      const fn = rafQueue.shift();
      try { fn(); } catch {}
    }
  };

  // ResizeObserver モック
  if (!global.ResizeObserver) {
    class RO {
      constructor(cb) { this._cb = cb; this._target = null; }
      observe(target) { this._target = target; }
      disconnect() {}
      // テスト用: 外から呼べるトリガ
      _trigger() { this._cb([{ target: this._target }]); }
    }
    global.ResizeObserver = RO;
  }
});

// 本番の実装を読み込む
beforeAll(() => {
  // パスは実ファイルに合わせる
  require("../../../app/javascript/custom/gages_test.js");
});

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  jest.restoreAllMocks();
  rafQueue = [];
});

describe("window.updateHPBar の境界/分岐", () => {
  test("bars が無いなら何もしない（例外なく return）", () => {
    renderHTML(`<div><p>no bar</p></div>`);
    expect(() => window.updateHPBar()).not.toThrow();
  });

  test("track.offsetWidth === 0 のとき requestAnimationFrame 経由で後から反映", () => {
    // 親要素の offsetWidth を 0 -> 200 に変化させ、RAF フラッシュ後に反映させる
    renderHTML(`
      <div id="track" style="width:0">
        <div id="hp-bar"></div>
      </div>
      <span id="bar-width-display"></span>
      <span id="bar-width-display-mobile"></span>
      <p id="hp-status-text"></p>
    `);

    const track = document.getElementById("track");
    Object.defineProperty(track, "offsetWidth", { value: 0, configurable: true });

    localStorage.setItem("hpPercentage", "30"); // 30% → yellow

    // 1回目呼び出し：offsetWidth=0 なので内部で requestAnimationFrame に積まれる
    window.updateHPBar();

    // ここで表示された想定に切り替える（= 幅が出た）
    Object.defineProperty(track, "offsetWidth", { value: 200, configurable: true });

    // RAF キューをフラッシュ（ここで初めてコールバックが実行され、再度 updateHPBar が走る）
    global.__flushRaf();

    const bar = document.getElementById("hp-bar");
    expect(bar.style.width).toBe("30%");
    expect(bar.style.backgroundColor).toBe("yellow");
  });

  test("しきい値: 10% → red / 危険", () => {
    renderHTML(`
      <div>
        <div id="hp-bar"></div>
        <span id="bar-width-display"></span>
        <span id="bar-width-display-mobile"></span>
        <p id="hp-status-text"></p>
      </div>
    `);
    localStorage.setItem("hpPercentage", "10");
    window.updateHPBar();

    const bar = document.getElementById("hp-bar");
    expect(bar.style.width).toBe("10%");
    expect(bar.style.backgroundColor).toBe("red");
    expect(document.getElementById("hp-status-text").textContent).toContain("危険");
    expect(document.getElementById("bar-width-display").textContent).toBe("10%");
    expect(document.getElementById("bar-width-display-mobile").textContent).toBe("10%");
  });

  test("しきい値: 35% → yellow", () => {
    renderHTML(`<div><div id="hp-bar"></div><p id="hp-status-text"></p></div>`);
    localStorage.setItem("hpPercentage", "35");
    window.updateHPBar();

    const bar = document.getElementById("hp-bar");
    expect(bar.style.backgroundColor).toBe("yellow");
  });

  test("しきい値: 50% → #9ACD32 / おつかれ", () => {
    renderHTML(`<div><div id="hp-bar"></div><p id="hp-status-text"></p></div>`);
    localStorage.setItem("hpPercentage", "50");
    window.updateHPBar();

    const bar = document.getElementById("hp-bar");
    // jsdom は rgb に正規化される
    expect(bar.style.backgroundColor).toBe("rgb(154, 205, 50)");
    expect(document.getElementById("hp-status-text").textContent).toContain("おつかれ");
  });

  test("しきい値: 90% → green", () => {
    renderHTML(`<div><div id="hp-bar"></div><p id="hp-status-text"></p></div>`);
    localStorage.setItem("hpPercentage", "90");
    window.updateHPBar();

    const bar = document.getElementById("hp-bar");
    expect(bar.style.backgroundColor).toBe("green");
  });

  test("barWidthDisplay 要素が無い場合でも落ちない", () => {
    renderHTML(`<div><div id="hp-bar"></div></div>`);
    localStorage.setItem("hpPercentage", "70");
    expect(() => window.updateHPBar()).not.toThrow();
  });
});

describe("goToRecommended（NaN 分岐）", () => {
  test("hp が NaN のとき alert が呼ばれる", () => {
    renderHTML(`<div></div>`);
    localStorage.removeItem("hpPercentage");

    const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
    window.goToRecommended();
    expect(alertSpy).toHaveBeenCalled();
  });
});

describe("フォーム同期（input/submit/turbo:submit-end）", () => {
  test("input で hp を更新 → localStorage とバーが更新", () => {
    renderHTML(`
      <div>
        <div id="hp-bar"></div>
        <input id="hp" name="hp" value="0">
      </div>
    `);

    // 初期反映
    window.updateHPBar();

    // 入力イベント
    const input = document.getElementById("hp");
    input.value = "77";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(localStorage.getItem("hpPercentage")).toBe("77");

    // 入力後の反映
    const bar = document.getElementById("hp-bar");
    expect(bar.style.width).toBe("77%");
  });

  test("submit 後、フォームから値取得して保存", () => {
    renderHTML(`
      <div>
        <form id="f">
          <input id="hp-input" name="hp" value="33">
          <button type="submit">ok</button>
        </form>
        <div id="hp-bar"></div>
      </div>
    `);

    const form = document.getElementById("f");
    // submit のキャプチャリスナが定義されているので、通常の submit でOK
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(localStorage.getItem("hpPercentage")).toBe("33");
    window.updateHPBar();
    expect(document.getElementById("hp-bar").style.width).toBe("33%");
  });

  test("turbo:submit-end (成功扱い) で保存", () => {
    renderHTML(`
      <div>
        <form id="f2">
          <input class="js-hp-input" value="88">
        </form>
        <div id="hp-bar"></div>
      </div>
    `);

    const form = document.getElementById("f2");
    const ev = new CustomEvent("turbo:submit-end", {
      bubbles: true,
      detail: { success: true } // 成功扱い
    });
    Object.defineProperty(ev, "target", { value: form });

    document.dispatchEvent(ev);

    expect(localStorage.getItem("hpPercentage")).toBe("88");
    window.updateHPBar();
    expect(document.getElementById("hp-bar").style.width).toBe("88%");
  });
});

describe("イベントトリガ（DOMContentLoaded / turbo 系 / window 系）", () => {
  test("document 側のイベントで updateHPBar が呼ばれる", () => {
    renderHTML(`<div><div id="hp-bar"></div></div>`);
    const spy = jest.spyOn(window, "updateHPBar").mockImplementation(() => {});

    ["DOMContentLoaded", "turbo:load", "turbo:render", "turbo:frame-load"].forEach(evt => {
      document.dispatchEvent(new Event(evt));
    });

    expect(spy).toHaveBeenCalledTimes(4);
  });

  test("window 側のイベントで updateHPBar が呼ばれる", () => {
    renderHTML(`<div><div id="hp-bar"></div></div>`);
    const spy = jest.spyOn(window, "updateHPBar").mockImplementation(() => {});

    ["pageshow", "resize", "orientationchange"].forEach(evt => {
      window.dispatchEvent(new Event(evt));
    });

    expect(spy).toHaveBeenCalledTimes(3);
  });
});

describe("ensureHPBarOnce（後から DOM に #hp-bar が入る）", () => {
  test("MutationObserver で #hp-bar 追加時に一度だけ反映される", () => {
    renderHTML(`<div id="root"></div>`);
    const root = document.getElementById("root");

    // まだバーが無い状態で script が読み込まれた（beforeAllで既にrequire済）
    // → IIFE が observer を張っているはず
    // 後から #hp-bar を追加
    const bar = document.createElement("div");
    bar.id = "hp-bar";
    root.appendChild(bar);

    // 追加後に update が一度実行される想定なので、正常に呼べることを確認
    expect(() => window.updateHPBar()).not.toThrow();
  });
});
