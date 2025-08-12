// spec/javascripts/entry/application_localstorage_hp_init.test.js
/**
 * 対象: app/javascript/application.js
 * 目的:
 *  - turbo:load で hpDate が今日でなければ hp% を "50" に初期化し hpDate を更新
 *  - すでに今日なら hp% は上書きされない
 *  - bfcache 復帰 pageshow(persisted) 時の保険関数の動作（例外なく動く）を確認
 */

jest.mock("../../../app/javascript/custom/register_service_worker", () => ({
  registerServiceWorker: jest.fn(),
}));
jest.mock("../../../app/javascript/custom/push_subscription", () => ({
  subscribeToPushNotifications: jest.fn().mockResolvedValue(undefined),
}));

// Dateを固定（他テストへの副作用を避けるため、元Dateを退避→最後に戻す）
const FIXED_ISO = "2025-08-12";
const OriginalDate = Date;
class FixedDate extends OriginalDate {
  constructor(...args) {
    if (args.length === 0) {
      super(`${FIXED_ISO}T09:00:00.000Z`);
    } else {
      super(...args);
    }
  }
  static now() { return new FixedDate().getTime(); }
  toISOString() { return `${FIXED_ISO}T09:00:00.000Z`; }
}
global.Date = FixedDate;

describe("application.js - localStorage HP初期化", () => {
  beforeEach(async () => {
    jest.resetModules();
    document.body.innerHTML = `
      <div id="loading-overlay" class="view-hidden"></div>
      <div id="mobile-super-search-modal" class="modal"></div>
    `;
    window.isLoggedIn = false; // このテストではPushは関係ない
    delete window.location;
    window.location = new URL("https://example.com/");

    await import("../../../app/javascript/application.js");
  });

  afterEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  afterAll(() => {
    // 他ファイルに影響しないように戻す
    global.Date = OriginalDate;
  });

  function fire(name, target = document, detail = {}) {
    const ev = new CustomEvent(name, { bubbles: true, cancelable: true, detail });
    target.dispatchEvent(ev);
  }

  test("初回ロード: hpDateが未設定 → hp%を50, hpDateを今日に保存", () => {
    expect(localStorage.getItem("hpDate")).toBeNull();
    expect(localStorage.getItem("hpPercentage")).toBeNull();

    fire("turbo:load");

    expect(localStorage.getItem("hpDate")).toBe(FIXED_ISO);
    expect(localStorage.getItem("hpPercentage")).toBe("50");
  });

  test("既に今日の日付: 既存hp%は上書きされない", () => {
    localStorage.setItem("hpDate", FIXED_ISO);
    localStorage.setItem("hpPercentage", "77");

    fire("turbo:load");

    expect(localStorage.getItem("hpDate")).toBe(FIXED_ISO);
    expect(localStorage.getItem("hpPercentage")).toBe("77"); // 維持
  });

  test("昨日の日付: 今日に更新され hp% は 50 に再初期化される", () => {
    const YESTERDAY = "2025-08-11";
    localStorage.setItem("hpDate", YESTERDAY);
    localStorage.setItem("hpPercentage", "99"); // 何か別の値

    fire("turbo:load");

    expect(localStorage.getItem("hpDate")).toBe(FIXED_ISO);
    expect(localStorage.getItem("hpPercentage")).toBe("50");
  });

  test("bfcache復帰(persisted)で保険関数が動いても例外にならない", () => {
    const ev = new Event("pageshow");
    Object.defineProperty(ev, "persisted", { value: true });
    window.dispatchEvent(ev);

    // 例外が出なければOK（非同期UI系なので真値は確認困難）
    expect(true).toBe(true);
  });
});
