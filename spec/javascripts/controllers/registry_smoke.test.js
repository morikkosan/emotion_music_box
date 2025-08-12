// spec/javascripts/controllers/registry_smoke.test.js
/**
 * 目的:
 *  - controllers/index.js が Stimulus Application に
 *    期待する識別子で register を1回ずつ行っていることを確認。
 *  - 全てのコントローラー検知テスト重複登録や登録漏れを早期検知するスモークテスト。
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
    __mockApp: app, // テストから参照するため公開
  };
});

describe("controllers/index.js registration", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test("すべてのコントローラが期待どおりに1回ずつ register される", async () => {
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
    ];

    const Stim = require("@hotwired/stimulus");
    const app = Stim.__mockApp;

    // 対象を読み込む（副作用で register が呼ばれる）
    await import("../../../app/javascript/controllers/index.js");

    // 呼ばれた識別子一覧を取り出す
    const calledIds = app.register.mock.calls.map(args => args[0]);

    // 件数一致
    expect(calledIds.length).toBe(expected.length);

    // 順不同で一致（順序まで縛りたければ toEqual(expected) に）
    expect(new Set(calledIds)).toEqual(new Set(expected));

    // 各IDが1回ずつ
    expected.forEach(id => {
      const count = calledIds.filter(x => x === id).length;
      expect(count).toBe(1);
    });
  });
});
