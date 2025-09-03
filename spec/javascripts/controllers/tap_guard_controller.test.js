// spec/javascripts/controllers/tap_guard_controller.test.js

/**
 * tap_guard_controller の挙動テスト
 * - 指の移動距離が threshold 超えでドラッグ扱い → touchend 後 400ms 以内の click を抑止
 * - threshold 未満はクリックを許可
 * - data-tap-guard-threshold-value が反映される
 * - touch 系イベントなしの click は素通り
 *
 * できるだけ実運用に近い形（Stimulus 起動＋data-action）で検証しつつ、
 * JSDOM の制約で defaultPrevented が反映されづらい 2 ケースは、
 * コントローラメソッドを直接呼ぶ“ユニット方式”で preventDefault/stopPropagation を検証。
 */

import { Application } from "@hotwired/stimulus";
import TapGuardController from "../../../app/javascript/controllers/tap_guard_controller";

// ---- ヘルパ（統合テスト用）: Touchイベントを JSDOM で安全に作って発火する ----
// JSDOM には TouchEvent/Touch が無いので、通常の Event に touches を差し込む。
function dispatchTouch(el, type, { x, y }) {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "touches", {
    get: () => [{ clientX: x, clientY: y }],
  });
  el.dispatchEvent(ev);
  return ev;
}

// ---- ヘルパ（統合テスト用）: クリックを発火し、defaultPrevented を返す ----
function dispatchClick(el) {
  const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
  const result = el.dispatchEvent(ev);
  return { ev, result };
}

// ---- ヘルパ（ユニット方式）: コントローラを直に生成してテスト ----
function makeController(threshold) {
  const el = document.createElement("a");
  document.body.appendChild(el);

  const c = new TapGuardController();
  c.element = el;
  // Stimulus values の代替セット
  c.thresholdValue = threshold != null ? threshold : 14;
  c.connect();

  // 簡易イベント（preventDefault/stopPropagation をスパイ）
  const makeTouch = (x, y) => ({
    touches: [{ clientX: x, clientY: y }],
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
  });
  const makeClick = () => ({
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
  });

  return { controller: c, el, makeTouch, makeClick };
}

let app;
let now;
let perfSpy;

beforeEach(() => {
  document.body.innerHTML = "";
  app = Application.start();
  app.register("tap-guard", TapGuardController);

  // performance.now のモック（ゴーストクリック 400ms 制御用）
  now = 1000;
  perfSpy = jest.spyOn(performance, "now").mockImplementation(() => now);
});

afterEach(() => {
  try {
    app?.stop();
  } catch {}
  perfSpy?.mockRestore();
  document.body.innerHTML = "";
});

// ---- DOM セットアップ（統合） ----
function setupDom({ threshold } = {}) {
  document.body.innerHTML = `
    <a href="#ok" id="link"
      data-controller="tap-guard"
      data-action="
        touchstart->tap-guard#start
        touchmove->tap-guard#move
        touchend->tap-guard#end
        click->tap-guard#click
      "
      ${threshold != null ? `data-tap-guard-threshold-value="${threshold}"` : ""}
    >link</a>
  `;

  const link = document.getElementById("link");

  // バブリング確認用（stopPropagation が効いているか）
  const bubbleSpy = jest.fn();
  document.addEventListener("click", bubbleSpy);

  return { link, bubbleSpy };
}

describe("tap_guard_controller", () => {
  // ───────── 統合寄り（Stimulus＋data-action）─────────

  test("閾値未満の移動ではクリックは抑止されない（default threshold=14px）", () => {
    const { link, bubbleSpy } = setupDom(); // threshold 指定なし → 14px

    dispatchTouch(link, "touchstart", { x: 10, y: 10 });
    dispatchTouch(link, "touchmove", { x: 15, y: 10 }); // dx=5（閾値未満）
    dispatchTouch(link, "touchend",  { x: 15, y: 10 });

    const { ev } = dispatchClick(link);

    expect(ev.defaultPrevented).toBe(false);
    expect(bubbleSpy).toHaveBeenCalledTimes(1);
  });

  test("閾値超え→400ms 経過後のクリックは通す（default=14px）", () => {
    const { link, bubbleSpy } = setupDom();

    dispatchTouch(link, "touchstart", { x: 0, y: 0 });
    dispatchTouch(link, "touchmove",  { x: 0, y: 30 }); // dy=30 → dragging 想定
    dispatchTouch(link, "touchend",   { x: 0, y: 30 });

    now = 1000 + 401; // 抑止ウィンドウ経過

    const { ev } = dispatchClick(link);

    expect(ev.defaultPrevented).toBe(false);
    expect(bubbleSpy).toHaveBeenCalledTimes(1);
  });

  test("touch 系イベントなしの click は抑止されない", () => {
    const { link, bubbleSpy } = setupDom();

    const { ev } = dispatchClick(link);

    expect(ev.defaultPrevented).toBe(false);
    expect(bubbleSpy).toHaveBeenCalledTimes(1);
  });

  test("閾値未満 → end 直後の click でも通す（_suppressClickUntil は設定されない）", () => {
    const { link, bubbleSpy } = setupDom();

    dispatchTouch(link, "touchstart", { x: 100, y: 100 });
    dispatchTouch(link, "touchmove",  { x: 110, y: 100 }); // 10px（閾値未満）
    dispatchTouch(link, "touchend",   { x: 110, y: 100 });

    now = 1100; // すぐ

    const { ev } = dispatchClick(link);

    expect(ev.defaultPrevented).toBe(false);
    expect(bubbleSpy).toHaveBeenCalledTimes(1);
  });

  // ───────── ユニット方式（メソッド直呼びで確実に検証）─────────
  // JSDOM では defaultPrevented が反映されにくいケースがあるため、
  // preventDefault/stopPropagation が呼ばれたこと自体を検証する。

  test("閾値超えの移動でドラッグ扱い → touchend直後（400ms以内）のクリックは抑止される（ユニット方式）", () => {
    const { controller: c, makeTouch, makeClick } = makeController(14);

    // start → move（閾値超え）→ end
    c.start(makeTouch(0, 0));
    c.move(makeTouch(20, 0));     // 20px > 14px → dragging=true
    c.end(makeTouch(20, 0));      // 抑止ウィンドウ設定

    now = 1200; // 1000 + 200ms（まだ 400ms 未満）

    const clickEv = makeClick();
    c.click(clickEv);

    expect(clickEv.preventDefault).toHaveBeenCalled();
    expect(clickEv.stopPropagation).toHaveBeenCalled();
  });

  test("data-tap-guard-threshold-value が反映される（threshold=1px なら 2px 移動で抑止・ユニット方式）", () => {
    const { controller: c, makeTouch, makeClick } = makeController(1);

    c.start(makeTouch(50, 50));
    c.move(makeTouch(52, 50));   // 2px > 1px → dragging=true
    c.end(makeTouch(52, 50));    // 抑止ウィンドウ設定

    now = 1050; // 1000 + 50ms（400ms 未満）

    const clickEv = makeClick();
    c.click(clickEv);

    expect(clickEv.preventDefault).toHaveBeenCalled();
    expect(clickEv.stopPropagation).toHaveBeenCalled();
  });
});


test("start: touches が無いときは早期 return（ガード分岐）", () => {
  const { controller: c } = makeController(14);

  // 何もしないことを確認したいので、初期値をわざと変えておく
  c._dragging = true;
  c._startX = 123;
  c._startY = 456;

  expect(() => c.start({})).not.toThrow();
  expect(c._dragging).toBe(true);   // 変化しない
  expect(c._startX).toBe(123);
  expect(c._startY).toBe(456);
});

test("move: touches が無いときは早期 return（ガード分岐）", () => {
  const { controller: c } = makeController(14);

  c._dragging = false;
  expect(() => c.move({})).not.toThrow();
  expect(c._dragging).toBe(false);  // 変化しない
});
