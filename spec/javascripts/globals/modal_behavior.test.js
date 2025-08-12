// spec/javascripts/globals/modal_behavior.test.js

// --- Turbo を最初にモック（ESM読み込み前に） ---
jest.mock("@hotwired/turbo-rails", () => ({
  __esModule: true,
  Turbo: { renderStreamMessage: jest.fn(), visit: jest.fn() }
}));

// --- Bootstrap をモジュールごとモック（import * as bootstrap が参照するのはこのモック） ---
jest.mock("bootstrap", () => {
  const instances = new Map();
  class Modal {
    constructor(el) { this.el = el; this._shown = false; }
    show() { this._shown = true; }
    hide() { this._shown = false; }
    static getOrCreateInstance(el) {
      if (!instances.has(el)) instances.set(el, new Modal(el));
      return instances.get(el);
    }
  }
  return { __esModule: true, Modal, __instances: instances };
});

// Stimulus
import { Application } from "@hotwired/stimulus";

let app;

// Stimulus が connect するのを1ティック待つヘルパ
const tick = () => new Promise((r) => setTimeout(r, 0));

// jsdom 未実装の alert をダミー化
beforeAll(() => {
  if (!window.alert) {
    // eslint-disable-next-line no-undef
    global.alert = jest.fn();
  }
});

// 各テストで controller を「モック適用後」に読み込むため、毎回リセット→requireする
const loadController = () => {
  jest.resetModules(); // モジュールキャッシュクリア（上の jest.mock は維持される）
  // eslint-disable-next-line import/no-dynamic-require
  return require("../../../app/javascript/controllers/search_music_controller.js").default;
};

describe("モーダル挙動（共通テストファイル）", () => {
  beforeEach(() => {
    app = Application.start();
  });

  afterEach(() => {
    app.stop();
    jest.restoreAllMocks();
    document.body.innerHTML = "";
  });

  describe("search_music_controller のモーダル連携", () => {
    test("fetchAndSwap: Turbo.renderStreamMessage を呼び、モーダルを表示する", async () => {
      // テスト用DOM
      document.body.innerHTML = `
        <div data-controller="search-music">
          <input data-search-music-target="audio" value="http://example.com/xxx">
          <input data-search-music-target="track" value="Name - Artist">
          <div data-search-music-target="results"></div>
        </div>
        <div id="modal-container" class="modal"><div id="modal-content"></div></div>
      `;

      const SearchMusicController = loadController();
      app.register("search-music", SearchMusicController);

      // ★ Stimulus が connect するのを待つ
      await tick();

      // fetch をモック（Turbo Stream HTMLを返す）
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        text: async () => "<turbo-stream action='replace' target='modal-content'></turbo-stream>"
      });

      // ノイズ抑制
      jest.spyOn(console, "error").mockImplementation(() => {});
      jest.spyOn(window, "alert").mockImplementation(() => {});

      const controller = app.getControllerForElementAndIdentifier(
        document.querySelector("[data-controller]"),
        "search-music"
      );

      await controller.fetchAndSwap("/emotion_logs/form_switch.turbo_stream?music_url=U&track_name=T");

      // Turbo描画が呼ばれること
      const { Turbo } = require("@hotwired/turbo-rails");
      expect(Turbo.renderStreamMessage).toHaveBeenCalled();

      // モーダルが show されていること
      const modalEl = document.getElementById("modal-container");
      const { Modal } = require("bootstrap");
      const instance = Modal.getOrCreateInstance(modalEl);
      expect(instance._shown).toBe(true);
    });

    test("backToSearch: 旧モーダルを閉じ、新しいフォームHTMLを描画して再表示", async () => {
      document.body.innerHTML = `
        <div data-controller="search-music">
          <input data-search-music-target="audio" value="http://example.com/xxx">
          <input data-search-music-target="track" value="Name - Artist">
          <div data-search-music-target="results"></div>
        </div>
        <div id="modal-container" class="modal"><div id="modal-content"></div></div>
      `;

      const SearchMusicController = loadController();
      app.register("search-music", SearchMusicController);

      // ★ Stimulus が connect するのを待つ
      await tick();

      // fetch をモック（再取得用 Turbo Stream）
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        text: async () => "<turbo-stream action='update' target='modal-content'></turbo-stream>"
      });

      jest.spyOn(console, "error").mockImplementation(() => {});
      jest.spyOn(window, "alert").mockImplementation(() => {});

      const controller = app.getControllerForElementAndIdentifier(
        document.querySelector("[data-controller]"),
        "search-music"
      );

      await controller.backToSearch();

      const { Turbo } = require("@hotwired/turbo-rails");
      expect(Turbo.renderStreamMessage).toHaveBeenCalled();

      const modalEl = document.getElementById("modal-container");
      const { Modal } = require("bootstrap");
      const instance = Modal.getOrCreateInstance(modalEl);
      expect(instance._shown).toBe(true);
    });
  });
});
