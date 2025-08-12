/**
 * global_player_controller のユニットテスト
 * - Stimulus Application スタブで実インスタンスを取得
 * - SC.Widget を完全モック
 * - 主要な公開メソッドとイベントハンドラを検証
 */

import { Application } from "@hotwired/stimulus";
// ★ 実ファイル名に合わせて「ハイフン」版を import
import ControllerClass from "../../../app/javascript/controllers/global-player_controller";

// --- このファイルのテスト実行中だけ console.log を止める ---
let __consoleLogSpy;
const __originalConsoleLog = console.log;
beforeAll(() => {
  __consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
});
afterAll(() => {
  try { __consoleLogSpy?.mockRestore(); } finally {
    // 念のため原状復帰
    // eslint-disable-next-line no-global-assign
    console.log = __originalConsoleLog;
  }
});

// ====== グローバル SC.Widget の完全モック ======
function createSCWidgetMock() {
  let paused = true;
  let duration = 120000; // 120秒
  let position = 0;
  let volume = 100;
  let currentSound = { title: "Mock Title", user: { username: "Mock Artist" } };
  const handlers = new Map();

  const api = {
    Events: Object.freeze({
      READY: "ready",
      PLAY: "play",
      PAUSE: "pause",
      FINISH: "finish",
    }),
  };

  const widget = {
    _handlers: handlers,
    _trigger(event) {
      const h = handlers.get(event);
      if (h) h();
    },
    bind: jest.fn((event, cb) => {
      handlers.set(event, cb);
    }),
    unbind: jest.fn((event) => {
      handlers.delete(event);
    }),

    play: jest.fn(() => {
      paused = false;
      const cb = handlers.get(api.Events.PLAY);
      cb && cb();
    }),
    pause: jest.fn(() => {
      paused = true;
      const cb = handlers.get(api.Events.PAUSE);
      cb && cb();
    }),
    isPaused: jest.fn((cb) => cb(paused)),

    seekTo: jest.fn((ms) => {
      position = ms;
    }),
    getPosition: jest.fn((cb) => cb(position)),
    getDuration: jest.fn((cb) => cb(duration)),

    setVolume: jest.fn((v) => {
      volume = v;
    }),

    getCurrentSound: jest.fn((cb) => cb(currentSound)),

    __setDuration(ms) { duration = ms; },
    __setPosition(ms) { position = ms; },
    __setCurrentSound(obj) { currentSound = obj; },
    __getState() { return { paused, duration, position, volume, currentSound }; },
  };

  return { api, widget };
}

beforeAll(() => {
  const { api, widget } = createSCWidgetMock();
  global.SC = {
    Widget: Object.assign(
      function WidgetFactory() { return widget; },
      api
    ),
  };
});

beforeEach(() => {
  jest.useFakeTimers();

  // このテストファイル用の canvas モック
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    clearRect: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
    lineWidth: 0,
    strokeStyle: "",
  });

  if (!global.requestAnimationFrame) {
    global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  }
  if (!global.cancelAnimationFrame) {
    global.cancelAnimationFrame = (id) => clearTimeout(id);
  }
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();

  // ここで他のモックを全部復元 → console.log も復活してしまう
  jest.restoreAllMocks();

  // ⇒ 直後に、このファイル分の console.log ミュートを必ず再適用
  __consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});

  document.body.innerHTML = "";
});

function buildDOM() {
  document.body.innerHTML = `
    <div id="root" data-controller="global-player">
      <div id="bottom-player" class="d-none"></div>
      <i id="play-pause-icon" class="fa fa-play"></i>

      <div id="track-title"></div>
      <div id="track-title-top"></div>
      <div id="track-artist"></div>
      <div id="loading-spinner" class="is-hidden"></div>
      <div class="neon-character-spinbox is-hidden"></div>

      <input id="seek-bar" type="range" min="0" max="100" value="0">
      <span id="current-time">0:00</span>
      <span id="duration">0:00</span>
      <input id="volume-bar" type="range" min="0" max="100" value="100">

      <div id="player-top-row-desktop" style="display:flex"></div>
      <div id="player-top-row-mobile"  style="display:none"></div>

      <canvas id="waveform-anime" width="300" height="60"></canvas>

      <div>
        <iframe id="hidden-sc-player" class="is-hidden"></iframe>
      </div>

      <div>
        <img data-global-player-target="trackImage"
             data-track-id="1"
             data-play-url="https://soundcloud.com/artist/track-one" />
        <img data-global-player-target="trackImage"
             data-track-id="2"
             data-play-url="https://soundcloud.com/artist/track-two" />

        <i data-global-player-target="playIcon" class="fa fa-play" data-track-id="1"></i>
        <i data-global-player-target="playIcon" class="fa fa-play" data-track-id="2"></i>
      </div>

      <button id="prev-track-button"></button>
      <button id="next-track-button"></button>
      <button id="shuffle-button"></button>
      <button id="repeat-button"></button>

      <div id="track-artist-mobile"></div>
    </div>
  `;
}

function startStimulusAndGetController() {
  const app = Application.start();
  app.register("global-player", ControllerClass);
  const root = document.getElementById("root");
  const controller = app.getControllerForElementAndIdentifier(root, "global-player");
  return { app, controller, root };
}

describe("global_player_controller", () => {
  test("connect: 初期化が例外なく実行される", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();
    expect(controller).toBeTruthy();
    expect(controller.widget).toBeNull();
    expect(document.getElementById("bottom-player").classList.contains("d-none")).toBe(true);
  });

  test("playFromExternal: iframe 差し替え → READY 後にタイトル/アーティスト反映＆ローディング非表示", async () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const url = "https://soundcloud.com/artist/awesome";
    controller.playFromExternal(url);

    const iframe = document.getElementById("hidden-sc-player");
    expect(iframe.src).toContain(encodeURIComponent(url));
    expect(iframe.src).toContain("auto_play=true");

    iframe.onload && iframe.onload();
    jest.advanceTimersByTime(110);

    expect(controller.widget).toBeTruthy();
    controller.widget._trigger(SC.Widget.Events.READY);

    const title = document.getElementById("track-title").textContent;
    const artist = document.getElementById("track-artist").textContent;
    expect(title).toBe("Mock Title");
    expect(artist).toContain("Mock Artist");

    expect(document.getElementById("loading-spinner").classList.contains("is-hidden")).toBe(true);
    expect(document.getElementById("bottom-player").classList.contains("d-none")).toBe(false);
  });

  test("togglePlayPause: widget 未生成でも iframe があれば再生成してトグル", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const iframe = document.getElementById("hidden-sc-player");
    iframe.src = "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fabc&auto_play=false";

    const spyRestore = jest.spyOn(controller, "restorePlayerState").mockImplementation(() => {}); // ★ 重要

    controller.togglePlayPause();
    jest.advanceTimersByTime(5);

    expect(controller.widget).toBeTruthy();
    expect(spyRestore).toHaveBeenCalled();

    controller.togglePlayPause();
    jest.advanceTimersByTime(5);

    expect(
      controller.playPauseIcon.classList.contains("fa-play") ||
      controller.playPauseIcon.classList.contains("fa-pause")
    ).toBe(true);
  });

  test("onPlay / onPause: アイコンと波形アニメの状態が切り替わる", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const iframe = document.getElementById("hidden-sc-player");
    iframe.src = "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fabc&auto_play=false";

    jest.spyOn(controller, "restorePlayerState").mockImplementation(() => {}); // ★ 重要

    controller.togglePlayPause();
    jest.advanceTimersByTime(5);

    controller.onPlay();
    expect(controller.playPauseIcon.classList.contains("fa-pause")).toBe(true);
    expect(controller.waveformAnimating).toBe(true);

    controller.onPause();
    expect(controller.playPauseIcon.classList.contains("fa-play")).toBe(true);
    expect(controller.waveformAnimating).toBe(false);
  });

  test("seek: seek-bar の入力で widget.seekTo が呼ばれる", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const iframe = document.getElementById("hidden-sc-player");
    iframe.src = "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fabc&auto_play=false";

    jest.spyOn(controller, "restorePlayerState").mockImplementation(() => {}); // 念のため

    controller.togglePlayPause();
    jest.advanceTimersByTime(5);

    controller.widget.__setDuration(100000);
    const seekBar = document.getElementById("seek-bar");
    seekBar.value = "50";
    controller.seek({ target: seekBar });
    expect(controller.widget.seekTo).toHaveBeenCalledWith(50000);
  });

  test("changeVolume: volume-bar の入力で widget.setVolume が呼ばれる", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const iframe = document.getElementById("hidden-sc-player");
    iframe.src = "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fabc&auto_play=false";

    jest.spyOn(controller, "restorePlayerState").mockImplementation(() => {}); // ★ 重要

    controller.togglePlayPause();
    jest.advanceTimersByTime(5);

    const volumeBar = document.getElementById("volume-bar");
    volumeBar.value = "50";
    controller.changeVolume({ target: volumeBar });
    expect(controller.widget.setVolume).toHaveBeenCalledWith(50);
  });

  test("startProgressTracking: 1秒ごとに時間/シークが更新される", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const iframe = document.getElementById("hidden-sc-player");
    iframe.src = "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fabc&auto_play=false";

    jest.spyOn(controller, "restorePlayerState").mockImplementation(() => {}); // 念のため

    controller.togglePlayPause();
    jest.advanceTimersByTime(5);

    controller.widget.__setDuration(90000); // 90s
    controller.widget.__setPosition(30000); // 30s

    controller.startProgressTracking();
    jest.advanceTimersByTime(1000);

    expect(document.getElementById("current-time").textContent).toBe("0:30");
    expect(document.getElementById("duration").textContent).toBe("1:30");

    const seekBar = document.getElementById("seek-bar");
    expect(parseFloat(seekBar.value)).toBeCloseTo((30000 / 90000) * 100, 5);
  });

  test("updateTrackIcon: 対象トラックだけが pause アイコン、それ以外は play", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    controller.updateTrackIcon("2", true);
    const icons = Array.from(document.querySelectorAll('[data-global-player-target="playIcon"]'));
    const icon1 = icons.find((i) => i.dataset.trackId === "1");
    const icon2 = icons.find((i) => i.dataset.trackId === "2");

    expect(icon1.classList.contains("fa-play")).toBe(true);
    expect(icon1.classList.contains("fa-pause")).toBe(false);

    expect(icon2.classList.contains("fa-pause")).toBe(true);
    expect(icon2.classList.contains("fa-play")).toBe(false);
  });
});
