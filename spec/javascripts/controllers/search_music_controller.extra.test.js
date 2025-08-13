/**
 * search_music_controller 総合カバレッジ（一本化）
 * ねらい：
 *  - 空クエリ早期return（alert のみ・fetchなし）
 *  - search() エラーの2系統を両方踏む（← 41–42行の完全カバー）
 *      A) res.ok=false ＋ json() が {error:'BAD'} … "BAD" 経路
 *      B) res.ok=false ＋ json() 失敗 … "HTTP {status}" フォールバック
 *  - 成功時の描画・ページネーション（prev/nextの境界含む）
 *  - select()/confirm() 経路（encoded URL で fetchAndSwap を呼ぶ）
 *  - backToSearch() の NG/OK 経路（モーダル hide/show, Turbo.render, Stimulus.enhance）
 *  - fetchAndSwap() の OK/NG 経路とヘッダ
 *  - search() のヘッダ/オプション検証（credentials, Accept）
 */

import { Application } from "@hotwired/stimulus";

// Turbo/Bootstrap は先にモック
jest.mock("@hotwired/turbo-rails", () => ({
  Turbo: { renderStreamMessage: jest.fn() },
}));
jest.mock("bootstrap", () => ({
  Modal: {
    getOrCreateInstance: jest.fn(() => ({
      show: jest.fn(),
      hide: jest.fn(),
    })),
  },
}));

import ControllerClass from "controllers/search_music_controller";
import { Turbo } from "@hotwired/turbo-rails";
import * as bootstrap from "bootstrap";

// 非同期ドレイン（マイクロ→マクロ）
const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
};

describe("search_music_controller (coverage, single file)", () => {
  let app, root, controller;
  let query, results, loading, audio, track;

  beforeEach(() => {
    // ★ 各テストでモックの呼び出し履歴をクリア（前テストの副作用を断つ）
    jest.clearAllMocks();

    document.body.innerHTML = "";

    root = document.createElement("div");
    root.setAttribute("data-controller", "search-music");

    // 必要 targets
    query = document.createElement("input");
    query.setAttribute("data-search-music-target", "query");

    results = document.createElement("div");
    results.setAttribute("data-search-music-target", "results");

    loading = document.createElement("div");
    loading.setAttribute("data-search-music-target", "loading");
    loading.style.display = "none";

    audio = document.createElement("input");
    audio.setAttribute("data-search-music-target", "audio");

    track = document.createElement("input");
    track.setAttribute("data-search-music-target", "track");

    const form = document.createElement("form");
    form.appendChild(query);

    root.appendChild(form);
    root.appendChild(results);
    root.appendChild(loading);
    root.appendChild(audio);
    root.appendChild(track);
    document.body.appendChild(root);

    // Stimulus 起動
    app = Application.start();
    app.register("search-music", ControllerClass);
    controller = app.getControllerForElementAndIdentifier(root, "search-music");

    // モック
    global.fetch = jest.fn();
    global.alert = jest.fn();

    // scrollIntoView は JSDOM に無いことがある
    if (!Element.prototype.scrollIntoView) {
      // eslint-disable-next-line no-extend-native
      Element.prototype.scrollIntoView = jest.fn();
    }
  });

  afterEach(() => {
    app && app.stop();
    // ★ 呼び出し履歴を毎回クリア（モジュールモックの累積を防ぐ）
    jest.clearAllMocks();
  });

  // === search() : 早期return
  test("空クエリ: alertのみ・fetchは呼ばれない", async () => {
    query.value = "   ";
    const ret = controller.search();
    if (ret && typeof ret.then === "function") { try { await ret; } catch (_) {} }
    await settle();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(global.alert).toHaveBeenCalledTimes(1);
    expect(String(global.alert.mock.calls[0][0] || "")).toContain("検索ワードを入力してください");
    expect(loading.style.display === "none" || loading.style.display === "").toBe(true);
  });

  // === search() : 41–42行（throw new Error(json?.error || `HTTP ${status}`)）の両側
  test("search エラーA: res.ok=false + json()→{error:'BAD'} で 'BAD' 経路（41–42 左側）", async () => {
    query.value = "x";
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "BAD" }),
    });

    await controller.search();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.alert).toHaveBeenCalledTimes(1);
    expect(String(global.alert.mock.calls[0][0])).toContain("BAD");
    expect(loading.style.display).toBe("none");
  });

  test("search エラーB: res.ok=false + json()失敗 で 'HTTP 500' フォールバック（41–42 右側）", async () => {
    query.value = "y";
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new Error("broken"); },
    });

    const p = controller.search();
    if (p && typeof p.then === "function") { try { await p; } catch (_) {} }
    await settle();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.alert).toHaveBeenCalledTimes(1);
    expect(String(global.alert.mock.calls[0][0])).toMatch(/HTTP\s*500/);
    expect(loading.style.display).toBe("none");
  });

  // === search() : 成功 → 描画 / ページネーション
  test("search 成功: レンダリング & ページネーション（prev/next境界含む）", async () => {
    query.value = "ok";
    // 13件（1ページ10件） → 2ページ構成
    const collection = Array.from({ length: 13 }).map((_, i) => ({
      id: i + 1,
      title: `Song ${i + 1}`,
      user: { username: `Artist ${i + 1}` },
      permalink_url: `https://sc/${i + 1}`,
      artwork_url: null,
    }));

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => collection,
    });

    await controller.search();
    await settle();

    // 1ページ目情報
    const info = results.querySelector(".pagination-controls span");
    expect(info).toBeTruthy();
    expect(info.textContent).toMatch(/ページ\s*1\s*\/\s*2/);

    // prev は出ない、next は出る
    expect(results.querySelector("button.btn.btn-secondary.me-2")).toBeNull();
    const nextBtn = results.querySelector("button.btn.btn-secondary.ms-2");
    expect(nextBtn).toBeTruthy();

    // nextPage メソッドでページ送り
    controller.nextPage();
    // 2ページ目情報
    const info2 = results.querySelector(".pagination-controls span");
    expect(info2.textContent).toMatch(/ページ\s*2\s*\/\s*2/);

    // 2ページ目では next 無し・prev あり
    expect(results.querySelector("button.btn.btn-secondary.ms-2")).toBeNull();
    expect(results.querySelector("button.btn.btn-secondary.me-2")).toBeTruthy();

    // さらに nextPage() しても超えない（総数ガード）
    controller.nextPage();
    const info3 = results.querySelector(".pagination-controls span");
    expect(info3.textContent).toMatch(/ページ\s*2\s*\/\s*2/);

    // prevPage() で戻る
    controller.prevPage();
    const info4 = results.querySelector(".pagination-controls span");
    expect(info4.textContent).toMatch(/ページ\s*1\s*\/\s*2/);
  });

  // === select() → confirm ボタン・scrollIntoView・イベント発火・input値
  test("select(): confirmボタン追加・scrollIntoView・inputs更新・イベント発火", () => {
    controller.searchResults = [
      { id: 1, title: "選曲A", user: { username: "Artist A" }, permalink_url: "https://sc/a", artwork_url: null },
    ];
    controller.currentPage = 1;
    controller.renderPage();

    const selectBtn = results.querySelector("button.btn-success");
    expect(selectBtn).toBeTruthy();

    const eventSpy = jest.fn();
    window.addEventListener("play-from-search", eventSpy);

    controller.select({ target: selectBtn });

    // confirm ボタン
    const slot = results.querySelector(".player-slot");
    const confirmBtn = slot.querySelector("button.btn-primary");
    expect(confirmBtn).toBeTruthy();

    // inputs 更新
    expect(audio.value).toBe("https://sc/a");
    expect(track.value).toBe("選曲A - Artist A");

    // イベント発火
    expect(eventSpy).toHaveBeenCalledTimes(1);

    // scrollIntoView 実行（polyfillモック）
    if (Element.prototype.scrollIntoView.mock) {
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    }
  });

  // === confirm() → fetchAndSwap をエンコードURLで呼ぶ
  test("confirm(): fetchAndSwap を encoded URL で呼ぶ", async () => {
    audio.value = "https://sc/プレイ URL";
    track.value = "曲名 - アーティスト";

    controller.fetchAndSwap = jest.fn().mockResolvedValue(undefined);
    await controller.confirm();

    expect(controller.fetchAndSwap).toHaveBeenCalledTimes(1);
    const url = controller.fetchAndSwap.mock.calls[0][0];
    expect(url.startsWith("/emotion_logs/form_switch.turbo_stream?")).toBe(true);
    expect(url).toContain(encodeURIComponent(audio.value));
    expect(url).toContain(encodeURIComponent(track.value));
  });

  // === backToSearch(): NG 経路（alert して return）
  test("backToSearch() NG: hide → alert → Turbo未呼び", async () => {
    const modal = document.createElement("div");
    modal.id = "modal-container";
    document.body.appendChild(modal);

    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "<turbo-stream></turbo-stream>",
    });

    await controller.backToSearch();

    // 最初に hide
    expect(bootstrap.Modal.getOrCreateInstance).toHaveBeenCalledTimes(1);
    const inst = bootstrap.Modal.getOrCreateInstance.mock.results[0].value;
    expect(inst.hide).toHaveBeenCalledTimes(1);

    // alert & Turbo は未呼び
    expect(global.alert).toHaveBeenCalledTimes(1);
    expect(Turbo.renderStreamMessage).not.toHaveBeenCalled();
  });

  // === backToSearch(): OK 経路（render → show → enhance）
  test("backToSearch() OK: Turbo.render → 新モーダル show → Stimulus.enhance", async () => {
    // 旧モーダル
    const modal = document.createElement("div");
    modal.id = "modal-container";
    document.body.appendChild(modal);

    // render 後に参照される新モーダル/コンテンツを先置き（DOM差分は簡略）
    const newModal = document.createElement("div");
    newModal.id = "modal-container";
    const content = document.createElement("div");
    content.id = "modal-content";
    document.body.appendChild(newModal);
    document.body.appendChild(content);

    window.Stimulus = { enhance: jest.fn() };

    global.fetch.mockResolvedValue({
      ok: true,
      text: async () => "<turbo-stream></turbo-stream>",
    });

    await controller.backToSearch();

    expect(Turbo.renderStreamMessage).toHaveBeenCalledTimes(1);

    expect(bootstrap.Modal.getOrCreateInstance).toHaveBeenCalled();
    const showInst = bootstrap.Modal.getOrCreateInstance.mock.results.slice(-1)[0].value;
    expect(showInst.show).toHaveBeenCalledTimes(1);

    expect(window.Stimulus.enhance).toHaveBeenCalledTimes(1);
  });

  // === fetchAndSwap(): OK/NG とヘッダ
  test("fetchAndSwap() OK: Turbo.render & モーダル show（ヘッダ確認）", async () => {
    const modal = document.createElement("div");
    modal.id = "modal-container";
    document.body.appendChild(modal);

    global.fetch.mockResolvedValue({
      ok: true,
      text: async () => "<turbo-stream></turbo-stream>",
    });

    await controller.fetchAndSwap("/path?x=1");

    expect(Turbo.renderStreamMessage).toHaveBeenCalledTimes(1);
    expect(bootstrap.Modal.getOrCreateInstance).toHaveBeenCalled();
    const inst = bootstrap.Modal.getOrCreateInstance.mock.results.slice(-1)[0].value;
    expect(inst.show).toHaveBeenCalledTimes(1);

    // Accept/credentials（実装どおり）
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts).toEqual(expect.objectContaining({
      credentials: "same-origin",
      headers: expect.objectContaining({ Accept: "text/vnd.turbo-stream.html" }),
    }));
  });

  test("fetchAndSwap() NG: alert、Turbo未呼び", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "err",
    });

    await controller.fetchAndSwap("/bad");
    expect(global.alert).toHaveBeenCalledTimes(1);
    expect(Turbo.renderStreamMessage).not.toHaveBeenCalled();
  });

  // === search(): ヘッダ/オプション（credentials, Accept）
  test("search(): credentials same-origin & Accept: application/json", async () => {
    query.value = "headercheck";
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    await controller.search();
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts).toEqual(expect.objectContaining({
      credentials: "same-origin",
      headers: expect.objectContaining({ Accept: "application/json" }),
    }));
  });
});
