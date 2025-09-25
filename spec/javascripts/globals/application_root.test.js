// spec/javascripts/globals/application_root.test.js
// 対象: app/javascript/application.js（ルート）
// 目的: ガード分岐の両側 + safeCleanup の try/catch 両方を通して Branch 100%

// ▼ 副作用の小さいモック（SW登録とクリーンアップ関数）
jest.doMock("../../../app/javascript/custom/register_service_worker", () => {
  return { registerServiceWorker: jest.fn() };
}, { virtual: true });

const overlayCleanupMock = { runGlobalOverlayCleanup: jest.fn() };
jest.doMock("../../../app/javascript/custom/overlay_cleanup.js", () => {
  return overlayCleanupMock;
}, { virtual: true });

describe("app/javascript/application.js (root bootstrap & overlay guards)", () => {
  let originalRunCleanup, originalInitialized;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // 退避 & 初期化
    originalRunCleanup = window.runGlobalOverlayCleanup;
    originalInitialized = window.__overlayCleanupInitialized;
    delete window.runGlobalOverlayCleanup;
    delete window.__overlayCleanupInitialized;
  });

  afterEach(() => {
    // 復元
    if (originalRunCleanup === undefined) {
      delete window.runGlobalOverlayCleanup;
    } else {
      window.runGlobalOverlayCleanup = originalRunCleanup;
    }
    if (originalInitialized === undefined) {
      delete window.__overlayCleanupInitialized;
    } else {
      window.__overlayCleanupInitialized = originalInitialized;
    }
  });

  it("初回ロード：ガード true 側（window 公開＆リスナー登録＆クリーンアップ発火: 正常系）", async () => {
    await import("../../../app/javascript/application.js");

    // window に公開される（!window.runGlobalOverlayCleanup が true 分岐）
    expect(typeof window.runGlobalOverlayCleanup).toBe("function");

    // 正常系：イベントで safeCleanup 経由の runGlobalOverlayCleanup が呼ばれる
    const before = overlayCleanupMock.runGlobalOverlayCleanup.mock.calls.length;
    document.dispatchEvent(new Event("turbo:before-cache"));
    document.dispatchEvent(new Event("turbo:render"));
    document.dispatchEvent(new Event("turbo:load"));
    window.dispatchEvent(new Event("pageshow"));
    const after = overlayCleanupMock.runGlobalOverlayCleanup.mock.calls.length;
    // 他モジュールが同じイベントを使っていても、とにかく「増えている」ことを検証
    expect(after).toBeGreaterThan(before);
  });

  it("2回目ロード：ガード false 側（上書きされず＆overlay 用リスナーも再登録されない → イベント発火しても呼ばれない）", async () => {
    // 既存あり＝false 分岐を踏ませる
    const sentinel = jest.fn();
    window.runGlobalOverlayCleanup = sentinel;
    window.__overlayCleanupInitialized = true;

    await import("../../../app/javascript/application.js");

    // 既存が上書きされていない
    expect(window.runGlobalOverlayCleanup).toBe(sentinel);

    // リスナー再登録なし想定：イベントを投げても sentinel は呼ばれない
    const before = sentinel.mock.calls.length;
    document.dispatchEvent(new Event("turbo:before-cache"));
    document.dispatchEvent(new Event("turbo:render"));
    document.dispatchEvent(new Event("turbo:load"));
    window.dispatchEvent(new Event("pageshow"));
    const after = sentinel.mock.calls.length;
    expect(after).toBe(before); // 増えていない
  });

  it("初回ロード：safeCleanup の catch 側も踏む（runGlobalOverlayCleanup が throw しても落ちない）", async () => {
    // true 分岐を有効化
    delete window.runGlobalOverlayCleanup;
    delete window.__overlayCleanupInitialized;

    await import("../../../app/javascript/application.js");

    // まず何回呼ばれているか現在値を取得（他モジュールの影響で 0 とは限らない）
    const beforeFirst = overlayCleanupMock.runGlobalOverlayCleanup.mock.calls.length;

    // 正常呼び出しで try 側を踏む（少なくとも +1 されるはず）
    document.dispatchEvent(new Event("turbo:load"));
    const afterFirst = overlayCleanupMock.runGlobalOverlayCleanup.mock.calls.length;
    expect(afterFirst).toBeGreaterThan(beforeFirst);

    // 次の発火で throw させて catch 側も踏む（テストが落ちなければ OK）
    overlayCleanupMock.runGlobalOverlayCleanup.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    document.dispatchEvent(new Event("turbo:load"));
    const afterSecond = overlayCleanupMock.runGlobalOverlayCleanup.mock.calls.length;

    // 例外を投げても safeCleanup の catch で吸収されるため、呼び出し回数はさらに増える
    expect(afterSecond).toBeGreaterThan(afterFirst);
    // ここで例外が外に漏れていない（テスト失敗にならない）＝ catch 到達
  });
});
