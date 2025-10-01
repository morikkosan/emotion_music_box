// spec/javascripts/globals/application_boot.test.js
/**
 * application.js のブート副作用テスト（完全アイソレーション）
 * - safeCleanup の try/catch を両方踏む
 * - 初回(true) / 再ブート(false) の両分岐を踏む
 * - 他スイートへ mock/副作用を漏らさない（jest.doMock + isolateModules）
 */

describe("app/javascript/application.js boot (isolated)", () => {
  const noopMods = [
    "custom/comments",
    "custom/flash_messages",
    "custom/gages_test",
    "custom/inline_handlers",
    "custom/swal_my_create",
    "custom/push_once",
    "custom/turbo_loader",
    "custom/modal_guards",
    "custom/record_modal_patch",
    "custom/modal_content_observer",
    "custom/screen_cover",
    "custom/hp_date_init",
    "custom/recommend_button",
    "custom/avatar_cropper",
    "custom/recommended_global",
  ];

  // 各テストを完全分離して実行するためのヘルパ
  function withIsolatedBoot({ alreadyInited = false, throwOnceOnCleanup = false } = {}, assertion) {
    jest.resetModules();

    // 各テスト内だけでモジュールをモック（doMock）
    jest.isolateModules(() => {
      // Rails/Turbo/Bootstrap は静的インポートされるので最小モック
      jest.doMock("@hotwired/turbo-rails", () => ({}), { virtual: true });
      jest.doMock("@rails/ujs", () => ({ __esModule: true, default: { start: () => {} } }), { virtual: true });
      jest.doMock("bootstrap", () => ({ __esModule: true }), { virtual: true });

      // 重い custom 群はノーオペに
      for (const m of noopMods) {
        jest.doMock(m, () => ({}), { virtual: true });
      }

      // overlay / SW は呼び出し検証
      jest.doMock("custom/overlay_cleanup.js", () => ({
        __esModule: true,
        runGlobalOverlayCleanup: jest.fn(),
      }), { virtual: true });

      jest.doMock("custom/register_service_worker", () => ({
        __esModule: true,
        registerServiceWorker: jest.fn(),
      }), { virtual: true });

      // ここで必要なモジュール参照を取得（同一 isolate 内）
      const overlay = require("custom/overlay_cleanup.js");
      const sw      = require("custom/register_service_worker");

      // 事前状態（false 側を踏みたい時はここで初期化済みにしておく）
      delete window.__overlayCleanupInitialized;
      delete window.runGlobalOverlayCleanup;
      // ログうるさいなら抑制
      jest.spyOn(console, "log").mockImplementation(() => {});

      if (alreadyInited) {
        window.runGlobalOverlayCleanup = () => {}; // falsy でない
        window.__overlayCleanupInitialized = true; // 既に初期化済み
      }

      // テスト対象の import（副作用がここで走る）
      require("application.js");

      // try/catch の catch 分岐を踏みたい時
      if (throwOnceOnCleanup) {
        overlay.runGlobalOverlayCleanup.mockImplementationOnce(() => { throw new Error("boom"); });
      }

      // 呼び出し先を引き渡してアサーション実行
      assertion({ overlay, sw });
    });
  }

  afterEach(() => {
    jest.restoreAllMocks();
    // 念のためグローバルを掃除
    delete window.__overlayCleanupInitialized;
    delete window.runGlobalOverlayCleanup;
  });

  test("初回ブート: safeCleanup の try/catch 両方 + SW登録 1回", () => {
    withIsolatedBoot({ alreadyInited: false, throwOnceOnCleanup: true }, ({ overlay, sw }) => {
      // 1回目: pageshow → throw して catch 分岐
      window.dispatchEvent(new Event("pageshow"));
      expect(overlay.runGlobalOverlayCleanup).toHaveBeenCalledTimes(1);

      // 2回目以降: 正常パス（try 成功）を踏む
      document.dispatchEvent(new Event("turbo:before-cache"));
      document.dispatchEvent(new Event("turbo:render"));
      document.dispatchEvent(new Event("turbo:load"));
      window.dispatchEvent(new Event("pageshow"));

      expect(overlay.runGlobalOverlayCleanup).toHaveBeenCalledTimes(5);

      // SW は import のたび 1 回
      expect(sw.registerServiceWorker).toHaveBeenCalledTimes(1);

      // window への公開も確認
      expect(typeof window.runGlobalOverlayCleanup).toBe("function");
    });
  });

  test("再ブート: 既に初期化済みならリスナー再登録されない（overlay は呼ばれない）", () => {
    withIsolatedBoot({ alreadyInited: true }, ({ overlay, sw }) => {
      // 念のためクリアしてからイベントをばら撒く
      overlay.runGlobalOverlayCleanup.mockClear();

      document.dispatchEvent(new Event("turbo:before-cache"));
      document.dispatchEvent(new Event("turbo:render"));
      document.dispatchEvent(new Event("turbo:load"));
      window.dispatchEvent(new Event("pageshow"));

      // 呼ばれていない = 再登録無し
      expect(overlay.runGlobalOverlayCleanup).not.toHaveBeenCalled();

      // SW は import のたび 1 回
      expect(sw.registerServiceWorker).toHaveBeenCalledTimes(1);
    });
  });
});
