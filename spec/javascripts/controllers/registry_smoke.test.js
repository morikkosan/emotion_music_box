// spec/javascripts/controllers/registry_smoke.test.js

/**
 * 目的:
 *  - controllers/index.js が Stimulus Application に
 *    期待する識別子で register を1回ずつ行っていることを確認。
 *  - 余計/不足や重複登録を早期検知するスモークテスト。
 */

jest.mock("@hotwired/turbo-rails", () => ({}), { virtual: true });
jest.mock("@rails/ujs", () => ({ __esModule: true, default: { start: () => {} } }));
jest.mock("bootstrap", () => ({ __esModule: true })); // 依存衝突を避けるダミー

// Stimulus モック: Application.start() が register をスパイとして持つ app を返す
jest.mock("@hotwired/stimulus", () => {
  const app = { register: jest.fn() };
  return {
    __esModule: true,
    Controller: class {},
    Application: {
      start: jest.fn(() => app),
    },
    __mockApp: app, // テストから参照
  };
});

describe("controllers/index.js registration", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test("すべてのコントローラが期待どおりに1回ずつ register される", async () => {
    // 期待している登録ID一覧（本体に合わせて selection-counter, notif-badge, notif-page を含める）
    const expected = [
      "modal",
      "search-music",
      "submit-handler",
      "bookmark-toggle",
      "comment-form",
      "reaction",
      "tag-input",
      "tag-autocomplete",
      "view-switcher",
      "record-btn",
      "mobile-super-search",
      "playlist-modal",
      "global-player",
      "bookmark",
      "add-song-modal",
      "push",
      "redirect",
      "comment-update",
      "mobile-footer",
      "flash-then-redirect",
      "tap-guard",
      "selection-counter", // ← 既存追加
      "notif-badge",       // ← 新規追加
      "notif-page",        // ← 新規追加
    ];

    const Stim = require("@hotwired/stimulus");
    const app = Stim.__mockApp;

    // 対象を読み込む（副作用で register が呼ばれる）
    await import("../../../app/javascript/controllers/index.js");

    // 呼ばれた識別子一覧を取り出す
    const calledIds = app.register.mock.calls.map(args => args[0]);

    // 差分計算
    const extras  = calledIds.filter(id => !expected.includes(id));
    const missing = expected.filter(id => !calledIds.includes(id));

    // 余計/不足なし
    expect({ extras, missing }).toEqual({ extras: [], missing: [] });

    // 各IDが1回ずつ
    const countMap = calledIds.reduce((m, id) => (m[id] = (m[id] || 0) + 1, m), {});
    expected.forEach(id => {
      expect(countMap[id] || 0).toBe(1);
    });
  });
});
