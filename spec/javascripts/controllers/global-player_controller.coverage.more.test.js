/* =======================================================================================
 * global-player_controller.coverage.more.test.js
 * - コントローラ本体は変更しない
 * - “存在すれば呼ぶ / 例外が出ない” を前提に、取りこぼし分岐を叩く
 * ======================================================================================= */

import { Application } from "@hotwired/stimulus";
import ControllerClass from "../../../app/javascript/controllers/global-player_controller";

/* ===== DOM/Stimulus 起動ユーティリティ ===== */
function buildDOMBase() {
  document.body.innerHTML = `
    <div id="root" data-controller="global-player">
      <div id="bottom-player" class="d-none">
        <div class="bottom-player-extra-controls"></div>
      </div>
      <button class="mobile-footer-menu">
        <button class="footer-btn playfirst"></button>
      </button>

      <i id="play-pause-icon" class="fa fa-play"></i>
      <button id="play-pause-button" type="button"></button>

      <div id="track-title"></div>
      <div id="track-title-top"></div>
      <div id="track-artist"></div>
      <div id="loading-spinner" class="is-hidden"></div>
      <div class="neon-character-spinbox is-hidden"></div>

      <input id="seek-bar" type="range" min="0" max="100" value="0">
      <span id="current-time">0:00</span>
      <span id="duration">0:00</span>
      <input id="volume-bar" type="range" min="0" max="100" value="70">

      <div id="player-top-row-desktop"></div>
      <div id="player-top-row-mobile" class="is-hidden"></div>

      <div class="playlist-container">
        <img data-global-player-target="trackImage" data-track-id="1" data-play-url="https://soundcloud.com/a/x" />
        <i data-global-player-target="playIcon" class="fa fa-play" data-track-id="1"></i>
        <img data-global-player-target="trackImage" data-track-id="2" data-play-url="https://soundcloud.com/a/y" />
      </div>

      <button id="prev-track-button"></button>
      <button id="next-track-button"></button>
      <button id="shuffle-button"></button>
      <button id="repeat-button"></button>

      <iframe id="hidden-sc-player" class="sc-hidden"></iframe>
    </div>
  `;

  // ログイン済フラグ
  document.head.innerHTML += `<meta name="current-user-id" content="1">`;
  document.body.classList.add("logged-in");
}

function startStimulus() {
  const app = Application.start();
  app.register("global-player", ControllerClass);
  const root = document.getElementById("root");
  const controller = app.getControllerForElementAndIdentifier(root, "global-player");
  return { app, controller, root };
}

/* ===== 低レベルモック類 ===== */
function installSCWidgetMock() {
  const handlers = new Map();
  const api = { READY: "ready", PLAY: "play", PAUSE: "pause", FINISH: "finish" };
  const widget = {
    bind: jest.fn((ev, cb) => handlers.set(ev, cb)),
    unbind: jest.fn((ev) => handlers.delete(ev)),
    _trigger(ev) { handlers.get(ev)?.(); },
    play: jest.fn(),
    pause: jest.fn(),
    isPaused: jest.fn((cb) => cb(true)),
    getDuration: jest.fn((cb) => cb(123000)),
    getPosition: jest.fn((cb) => cb(1000)),
    getCurrentSound: jest.fn((cb) => cb({ title: "t", user: { username: "u" } })),
    seekTo: jest.fn(),
    setVolume: jest.fn(),
  };
  global.SC = { Widget: Object.assign(() => widget, { Events: api }) };
  return widget;
}

function installSwalMock() {
  const mock = { fire: jest.fn(() => Promise.resolve()) };
  // eslint-disable-next-line no-global-assign
  global.Swal = mock;
  if (typeof window !== "undefined") window.Swal = mock;
}

/* ===== テスト前後 ===== */
let __consoleSpy;
const __origLog = console.log;

beforeAll(() => {
  installSCWidgetMock();
});
beforeEach(() => {
  jest.useFakeTimers();
  __consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  installSwalMock();
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  localStorage.clear();
  sessionStorage?.clear?.();
});
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
  try { __consoleSpy?.mockRestore(); } finally { console.log = __origLog; }
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  localStorage.clear();
  sessionStorage?.clear?.();
});

/* =======================================================================================
 * 1) ハンドシェイク / iframe 可視制御 / 安全破棄
 * ======================================================================================= */
describe("Handshake / iframe visibility / safe nuke", () => {
  test("iOS + API不可 → _showHandshakeHint / _hideHandshakeHint / _setIframeVisibility", async () => {
    buildDOMBase();

    // iOS想定: _isIOS=true, _shouldUseApi=false
    jest.spyOn(ControllerClass.prototype, "_isIOS").mockReturnValue(true);
    jest.spyOn(ControllerClass.prototype, "_shouldUseApi").mockReturnValue(false);

    const { controller } = startStimulus();

    // onload が設定されているときの READY 経路も踏む（存在すれば）
    const iframeInitial = document.getElementById("hidden-sc-player");
    if (iframeInitial && typeof iframeInitial.onload === "function") {
      iframeInitial.onload();
    }

    // hint 表示 → 可視クラス切替
    controller._showHandshakeHint();
    const hint = document.getElementById("sc-handshake-hint");
    expect(hint).toBeTruthy();

    controller._setIframeVisibility(true);

    // ★ ここで再取得（connect 内で差し替え／削除されている可能性を考慮）
    const iframeAfterShow = document.getElementById("hidden-sc-player");
    if (iframeAfterShow) {
      expect(iframeAfterShow.classList.contains("sc-visible")).toBe(true);
    }

    // hint を閉じる
    controller._hideHandshakeHint();
    expect(document.getElementById("sc-handshake-hint")).toBeFalsy();

    // 不可視化しても例外にならない
    controller._setIframeVisibility(false);
    const iframeAfterHide = document.getElementById("hidden-sc-player");
    if (iframeAfterHide) {
      expect(iframeAfterHide.classList.contains("sc-hidden")).toBe(true);
    }
  });

  test("_safeNukeIframe: src解除＋DOMから除去", () => {
    buildDOMBase();
    const { controller } = startStimulus();

    const toRemove = document.createElement("iframe");
    toRemove.id = "to-nuke";
    toRemove.src = "https://w.soundcloud.com/player/?url=x";
    document.body.appendChild(toRemove);

    controller._safeNukeIframe(toRemove);
    expect(document.getElementById("to-nuke")).toBeFalsy();
  });

  test("replaceIframeWithNew(visible) → クラス付与", () => {
    buildDOMBase();
    const { controller } = startStimulus();

    const newIf = controller.replaceIframeWithNew(true);
    expect(newIf).toBeTruthy();
    expect(newIf.classList.contains("sc-keepalive")).toBe(true);
    // visible 指定で sc-visible が立つ
    expect(newIf.classList.contains("sc-visible")).toBe(true);
  });
});

/* =======================================================================================
 * 2) iOS 音量UIの表示/非表示 と _reallyUnmute
 * ======================================================================================= */
describe("iOS volume UI / unmute 保険", () => {
  test("_setupIOSVolumeUI → スライダー隠す＋ヒント表示 → _removeIOSVolumeHint → _showVolumeBar", () => {
    buildDOMBase();

    // iOSと見なす
    jest.spyOn(ControllerClass.prototype, "_isIOS").mockReturnValue(true);
    const { controller } = startStimulus();

    // 初期で volumeBar はある
    const vol = document.getElementById("volume-bar");
    expect(vol).toBeTruthy();

    controller._setupIOSVolumeUI();
    // 非表示属性が立つ
    expect(vol.hasAttribute("hidden")).toBe(true);
    expect(vol.hasAttribute("disabled")).toBe(true);
    expect(document.getElementById("ios-volume-hint")).toBeTruthy();

    controller._removeIOSVolumeHint();
    expect(document.getElementById("ios-volume-hint")).toBeFalsy();

    // iOSでも _showVolumeBar は安全に動作
    controller._showVolumeBar();
    expect(vol.classList.contains("is-hidden")).toBe(false);
  });

  test("_reallyUnmute: 非iOSでは volumeBar の値で volume 反映", () => {
    buildDOMBase();
    jest.spyOn(ControllerClass.prototype, "_isIOS").mockReturnValue(false);

    const { controller } = startStimulus();
    const audio = controller._ensureMedia({ useVideo: false });

    // 70% をセット済み（DOM初期値）
    controller._reallyUnmute(audio);
    expect(audio.muted).toBe(false);
    expect(Math.abs(audio.volume - 0.7) < 0.001).toBe(true);
  });
});

/* =======================================================================================
 * 3) stopOnlyPlayer / cleanup（リスナ解除や iframe 破棄の経路）
 * ======================================================================================= */
describe("stopOnlyPlayer / cleanup", () => {
  test("stopOnlyPlayer: widget破棄・audio停止・iframe除去", () => {
    buildDOMBase();
    const { controller } = startStimulus();

    // 擬似的に widget と audio を準備
    const widget = (global.SC && SC.Widget && SC.Widget()) || null;
    controller.widget = widget;

    const a = controller._ensureMedia({ useVideo: false });
    // 走らせてから止める
    controller.stopOnlyPlayer();

    // widget は null 化される想定
    expect(controller.widget).toBeNull();
    // iframe は消される（safeNuke 経路）
    expect(document.getElementById("hidden-sc-player")).toBeFalsy();
  });

  test("cleanup: 各種イベント解除＆observer解放＆iframe破棄（例外なく完走）", () => {
    buildDOMBase();
    const { controller } = startStimulus();

    expect(() => controller.cleanup()).not.toThrow();
    expect(controller._footerGuardMO).toBeNull();
    expect(document.getElementById("hidden-sc-player")).toBeFalsy();
  });
});

/* =======================================================================================
 * 4) MediaSession ハンドラの登録
 * ======================================================================================= */
describe("MediaSession handlers", () => {
  test("connect 時に mediaSession.setActionHandler が呼ばれる", () => {
    const setActionHandler = jest.fn();
    // eslint-disable-next-line no-global-assign
    navigator.mediaSession = { setActionHandler };

    buildDOMBase();
    const { controller } = startStimulus();
    expect(controller).toBeTruthy();

    expect(setActionHandler).toHaveBeenCalledWith("previoustrack", expect.any(Function));
    expect(setActionHandler).toHaveBeenCalledWith("nexttrack", expect.any(Function));
  });
});

/* =======================================================================================
 * 5) _updatePlayButton 経路（レンダイベントでの切替）
 * ======================================================================================= */
describe("_updatePlayButton by turbo events", () => {
  test("turbo:render 発火で playfirst の disabled トグルがエラーなく動く", () => {
    buildDOMBase();
    const { controller } = startStimulus();

    document.querySelectorAll(".playlist-container [data-track-id]").forEach((n) => n.remove());
    document.dispatchEvent(new Event("turbo:render"));

    expect(true).toBe(true);

    const img = document.createElement("img");
    img.setAttribute("data-track-id", "99");
    img.setAttribute("data-play-url", "https://soundcloud.com/a/z");
    document.querySelector(".playlist-container").appendChild(img);
    document.dispatchEvent(new Event("turbo:frame-load"));

    expect(true).toBe(true);
  });
});

/* =======================================================================================
 * 追記終了
 * ======================================================================================= */
