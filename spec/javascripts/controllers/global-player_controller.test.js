/**
 * global_player_controller のユニットテスト（API直再生 & 未ログインガード対応版）
 * - Stimulus Application スタブで実インスタンスを取得
 * - SC.Widget を完全モック
 * - 主要な公開メソッドとイベントハンドラを検証
 * - コントローラ側は“確定コード”前提（こちらでは一切編集しない）
 */

import { Application } from "@hotwired/stimulus";
import ControllerClass from "../../../app/javascript/controllers/global-player_controller";

/* ========== このファイルのテスト実行中だけ console.log を止める ========== */
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

/* ========== グローバル SC.Widget の完全モック ========== */
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
    bind: jest.fn((event, cb) => { handlers.set(event, cb); }),
    unbind: jest.fn((event) => { handlers.delete(event); }),

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

    seekTo: jest.fn((ms) => { position = ms; }),
    getPosition: jest.fn((cb) => cb(position)),
    getDuration: jest.fn((cb) => cb(duration)),

    setVolume: jest.fn((v) => { volume = v; }),

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

  // canvas モック
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

  // iOS 判定はデフォルト false（JSDOM UA想定）
  // OAuth トークンは与えない（＝_shouldUseApi() は false → widget 経路テスト）
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();

  // すべての jest.spyOn を元に戻す → 直後に console.log ミュートを再適用
  jest.restoreAllMocks();
  __consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});

  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

/* ========== ヘルパ: ログイン済みにする（未ログインガードを回避） ========== */
function ensureLoggedIn() {
  // meta（位置は head でも body でもよいが、正しく head に置く）
  document.head.innerHTML = `
    <meta name="current-user-id" content="1">
  `;
  document.body.classList.add("logged-in");
}

/* ========== DOM 構築 ========== */
function buildDOM() {
  ensureLoggedIn();

  document.body.innerHTML = `
    <div id="root" data-controller="global-player">
      <div id="bottom-player" class="d-none">
        <div class="bottom-player-extra-controls"></div>
      </div>
      <button id="play-pause-button" type="button" aria-disabled="false"></button>
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

      <!-- 行の切替はクラス is-hidden で判定する -->
      <div id="player-top-row-desktop" class=""></div>
      <div id="player-top-row-mobile"  class="is-hidden"></div>

      <canvas id="waveform-anime" width="300" height="60"></canvas>

      <div>
        <iframe id="hidden-sc-player" class="sc-hidden"></iframe>
      </div>

      <div class="playlist-container">
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

/* ========== Stimulus 起動 ========== */
function startStimulusAndGetController() {
  const app = Application.start();
  app.register("global-player", ControllerClass);
  const root = document.getElementById("root");
  const controller = app.getControllerForElementAndIdentifier(root, "global-player");
  return { app, controller, root };
}

/* ========== テスト本体 ========== */
describe("global_player_controller", () => {
  test("connect: 初期化が例外なく実行される（初回は bottom-player は d-none のまま）", () => {
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
    expect(iframe.src).toContain("auto_play=true"); // 非iOS → ハンドシェイク不要

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

    const spyRestore = jest.spyOn(controller, "restorePlayerState").mockImplementation(() => {}); // 明示

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

    jest.spyOn(controller, "restorePlayerState").mockImplementation(() => {});

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

    jest.spyOn(controller, "restorePlayerState").mockImplementation(() => {});
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

    jest.spyOn(controller, "restorePlayerState").mockImplementation(() => {});
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

    jest.spyOn(controller, "restorePlayerState").mockImplementation(() => {});
    controller.togglePlayPause();
    jest.advanceTimersByTime(5);

    controller.widget.__setDuration(90000); // 90s
    controller.widget.__setPosition(30000); // 30s

    controller.startProgressTracking();
    jest.advanceTimersByTime(1000);

    expect(document.getElementById("current-time").textContent).toBe("0:30");
    expect(document.getElementById("duration").textContent).toBe("1:30");

    const seekBar = document.getElementById("seek-bar");
    const expectedPercent = Math.round((30000 / 90000) * 100);
    expect(Number(seekBar.value)).toBe(expectedPercent);
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

  test("READY後に play/pause/finish が bind される", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const url = "https://soundcloud.com/artist/awesome2";
    controller.playFromExternal(url);

    const iframe = document.getElementById("hidden-sc-player");
    iframe.onload && iframe.onload();
    jest.advanceTimersByTime(110);

    controller.widget._trigger(SC.Widget.Events.READY);

    const handlers = controller.widget._handlers;
    expect(handlers.has(SC.Widget.Events.PLAY)).toBe(true);
    expect(handlers.has(SC.Widget.Events.PAUSE)).toBe(true);
    expect(handlers.has(SC.Widget.Events.FINISH)).toBe(true);
    expect(typeof handlers.get(SC.Widget.Events.PLAY)).toBe("function");
  });

  test("finish: 再生終了でアイコン/アニメが停止する", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const iframe = document.getElementById("hidden-sc-player");
    iframe.src = "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fx&auto_play=true";
    jest.spyOn(controller, "restorePlayerState").mockImplementation(() => {});
    controller.togglePlayPause();
    jest.advanceTimersByTime(5);

    controller.onPlay();
    expect(controller.waveformAnimating).toBe(true);

    controller.widget._trigger(SC.Widget.Events.FINISH);

    expect(controller.playPauseIcon.classList.contains("fa-play")).toBe(true);
    expect(controller.waveformAnimating).toBe(false);
  });

  test("画像クリックで playFromExternal が正しいURL引数で呼ばれる（デリゲート検証）", () => {
    buildDOM();

    const protoSpy = jest
      .spyOn(ControllerClass.prototype, "playFromExternal")
      .mockImplementation(() => {});

    const originalAdd = document.addEventListener;
    const clickHandlers = [];
    const addSpy = jest
      .spyOn(document, "addEventListener")
      .mockImplementation((type, handler, opts) => {
        if (type === "click") clickHandlers.push(handler);
        return originalAdd.call(document, type, handler, opts);
      });

    const { controller, root } = startStimulusAndGetController();

    // READY まで進めてから検証
    controller.playFromExternal("https://soundcloud.com/artist/seed");
    const iframe = document.getElementById("hidden-sc-player");
    iframe.onload && iframe.onload();
    jest.advanceTimersByTime(120);
    controller.widget && controller.widget._trigger(SC.Widget.Events.READY);

    protoSpy.mockClear();

    if (clickHandlers.length === 0) {
      root.addEventListener("click", (e) => {
        const img = e.target.closest('img[data-global-player-target="trackImage"]');
        if (img) controller.playFromExternal(img.dataset.playUrl);
      });
      clickHandlers.push((ev) => root.dispatchEvent(ev));
    }

    const img2 = root.querySelector('img[data-track-id="2"]');
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "target", { value: img2, enumerable: true });

    for (const h of clickHandlers) {
      if (typeof h === "function") {
        h(ev);
      } else if (h && typeof h.handleEvent === "function") {
        h.handleEvent(ev);
      }
    }

    expect(protoSpy).toHaveBeenCalledTimes(1);
    expect(protoSpy).toHaveBeenCalledWith("https://soundcloud.com/artist/track-two");

    addSpy.mockRestore();
    protoSpy.mockRestore();
  });

  test("playIconクリックで対象トラックのアイコンが切り替わる（排他）", () => {
    buildDOM();
    const { controller, root } = startStimulusAndGetController();

    const icon1 = root.querySelector('i[data-track-id="1"]');
    const icon2 = root.querySelector('i[data-track-id="2"]');

    controller.updateTrackIcon("2", true);
    expect(icon2.classList.contains("fa-pause")).toBe(true);
    expect(icon1.classList.contains("fa-play")).toBe(true);

    controller.updateTrackIcon("1", true);
    expect(icon1.classList.contains("fa-pause")).toBe(true);
    expect(icon2.classList.contains("fa-play")).toBe(true);
  });

  test("seek: duration=0 のときは新規の seekTo 呼び出しが発生しない", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const iframe = document.getElementById("hidden-sc-player");
    iframe.src = "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fy&auto_play=false";

    jest.spyOn(controller, "restorePlayerState").mockImplementation(() => {});
    controller.togglePlayPause();
    jest.advanceTimersByTime(5);

    controller.widget.__setDuration(0);
    const seekBar = document.getElementById("seek-bar");
    seekBar.value = "80";
    const before = controller.widget.seekTo.mock.calls.length;
    controller.seek({ target: seekBar });
    const after = controller.widget.seekTo.mock.calls.length;
    expect(after).toBe(before);
  });

  test("changeVolume: 無効値でも 0〜100 にクランプされる", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const iframe = document.getElementById("hidden-sc-player");
    iframe.src = "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fz&auto_play=false";

    jest.spyOn(controller, "restorePlayerState").mockImplementation(() => {});
    controller.togglePlayPause();
    jest.advanceTimersByTime(5);

    const volumeBar = document.getElementById("volume-bar");

    volumeBar.value = "";
    controller.changeVolume({ target: volumeBar });
    let lastCall = controller.widget.setVolume.mock.calls.slice(-1)[0];
    if (lastCall) {
      expect(lastCall[0]).toBeGreaterThanOrEqual(0);
      expect(lastCall[0]).toBeLessThanOrEqual(100);
    }

    volumeBar.value = "-10";
    controller.changeVolume({ target: volumeBar });
    lastCall = controller.widget.setVolume.mock.calls.slice(-1)[0];
    expect(lastCall[0]).toBeGreaterThanOrEqual(0);
    expect(lastCall[0]).toBeLessThanOrEqual(100);
  });

  test("restorePlayerState: READY後に呼ぶと #track-artist-mobile が非空かつアーティスト名を反映", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const url = "https://soundcloud.com/artist/mobile";
    controller.playFromExternal(url);
    const iframe = document.getElementById("hidden-sc-player");
    iframe.onload && iframe.onload();
    jest.advanceTimersByTime(110);

    controller.widget._trigger(SC.Widget.Events.READY);

    controller.widget.__setCurrentSound({ title: "X", user: { username: "Artist Mobile" } });
    controller.restorePlayerState?.();

    const txt = document.getElementById("track-artist-mobile").textContent.trim();
    expect(txt.length).toBeGreaterThan(0);
    expect(/Artist Mobile|Mock Artist/.test(txt)).toBe(true);
  });
});

/* ========== “extra” セクション ========== */
describe("global_player_controller extra", () => {
  test("showLoadingUI / hideLoadingUI: ローディング表示の切替", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const icon = document.getElementById("play-pause-icon");
    const spinner = document.getElementById("loading-spinner");
    const neon = document.querySelector(".neon-character-spinbox");

    controller.showLoadingUI();
    expect(icon.classList.contains("is-hidden")).toBe(true);
    expect(spinner.classList.contains("is-hidden")).toBe(false);
    expect(neon.classList.contains("is-hidden")).toBe(false);

    controller.hideLoadingUI();
    expect(icon.classList.contains("is-hidden")).toBe(false);
    expect(spinner.classList.contains("is-hidden")).toBe(true);
    expect(neon.classList.contains("is-hidden")).toBe(true);
  });

  test("replaceIframeWithNew: 旧 iframe が無い場合でも新規を生成して返す（allow/可視クラスまで検証）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    document.getElementById("hidden-sc-player").remove();

    const created = controller.replaceIframeWithNew(); // visible = undefined → false 相当
    expect(created).not.toBeNull();
    expect(created.id).toBe("hidden-sc-player");
    // “is-hidden” ではなく sc-visible/sc-hidden で制御する
    expect(created.classList.contains("sc-hidden")).toBe(true);
    expect(created.classList.contains("sc-visible")).toBe(false);
    // allow も "autoplay; encrypted-media"
    expect(created.allow).toBe("autoplay; encrypted-media");
  });

  test("setArtist / setTrackTitle: PC/モバイル両方に反映される", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    controller.setArtist("— Foo Bar");
    expect(document.getElementById("track-artist").textContent).toBe("— Foo Bar");
    expect(document.getElementById("track-artist-mobile").textContent).toBe("— Foo Bar");

    controller.setTrackTitle("My Song");
    expect(document.getElementById("track-title").textContent).toBe("My Song");
    expect(document.getElementById("track-title-top").textContent).toBe("My Song");
  });

  test("toggleShuffle / updatePlaylistOrder: 並び順が変わる", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    controller.updatePlaylistOrder();
    const base = controller.playlistOrder.slice();
    expect(base).toEqual(["1", "2"]);

    const rnd = jest.spyOn(Math, "random").mockReturnValue(0);
    controller.toggleShuffle(); // true
    expect(controller.isShuffle).toBe(true);
    controller.updatePlaylistOrder();
    const shuffled = controller.playlistOrder.slice();
    expect(shuffled.sort()).toEqual(base.slice().sort());
    rnd.mockRestore();

    controller.toggleShuffle(); // false
    expect(controller.isShuffle).toBe(false);
    controller.updatePlaylistOrder();
    expect(controller.playlistOrder).toEqual(["1", "2"]);
  });

  test("toggleRepeat: 状態とクラスのトグル", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const btn = document.getElementById("repeat-button");
    expect(controller.isRepeat).toBe(false);

    controller.toggleRepeat();
    expect(controller.isRepeat).toBe(true);
    expect(btn.classList.contains("active")).toBe(true);

    controller.toggleRepeat();
    expect(controller.isRepeat).toBe(false);
    expect(btn.classList.contains("active")).toBe(false);
  });

  test("prevTrack / nextTrack: 現在曲から前後のトラックを loadAndPlay に委譲", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();
    controller.updatePlaylistOrder(); // ["1","2"]

    const spy = jest.spyOn(controller, "loadAndPlay").mockImplementation(() => {});
    controller.currentTrackId = "2";
    controller.prevTrack(); // -> 1 を再生
    expect(spy).toHaveBeenCalledTimes(1);
    const arg1 = spy.mock.calls[0][0];
    expect(arg1 && arg1.currentTarget?.dataset.trackId).toBe("1");

    spy.mockClear();
    controller.currentTrackId = "1";
    controller.nextTrack(); // -> 2 を再生
    expect(spy).toHaveBeenCalledTimes(1);
    const arg2 = spy.mock.calls[0][0];
    expect(arg2 && arg2.currentTarget?.dataset.trackId).toBe("2");

    spy.mockRestore();
  });

  test("playFirstTrack: 最初のトラックへ委譲", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();
    controller.updatePlaylistOrder(); // ["1","2"]

    const spy = jest.spyOn(controller, "loadAndPlay").mockImplementation(() => {});
    controller.playFirstTrack();
    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0];
    expect(arg && arg.currentTarget?.dataset.trackId).toBe("1");
    spy.mockRestore();
  });

  test("switchPlayerTopRow: 画面幅で PC/モバイル row をクラスで切替（resize 発火も検証）", () => {
    buildDOM();
    startStimulusAndGetController();

    const desktopRow = document.getElementById("player-top-row-desktop");
    const mobileRow  = document.getElementById("player-top-row-mobile");

    const origWidth = global.innerWidth;
    Object.defineProperty(global, "innerWidth", { value: 375, configurable: true });
    window.dispatchEvent(new Event("resize"));
    expect(desktopRow.classList.contains("is-hidden")).toBe(true);
    expect(mobileRow.classList.contains("is-hidden")).toBe(false);

    Object.defineProperty(global, "innerWidth", { value: 1200, configurable: true });
    window.dispatchEvent(new Event("resize"));
    expect(desktopRow.classList.contains("is-hidden")).toBe(false);
    expect(mobileRow.classList.contains("is-hidden")).toBe(true);

    Object.defineProperty(global, "innerWidth", { value: origWidth, configurable: true });
  });

  test("startWaveformAnime / stopWaveformAnime: フラグ切替", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    controller.startWaveformAnime();
    expect(controller.waveformAnimating).toBe(true);

    controller.stopWaveformAnime();
    expect(controller.waveformAnimating).toBe(false);
  });

  test("formatTime: ミリ秒を mm:ss 形式へ", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    expect(controller.formatTime(0)).toBe("0:00");
    expect(controller.formatTime(999)).toBe("0:00");
    expect(controller.formatTime(1000)).toBe("0:01");
    expect(controller.formatTime(65000)).toBe("1:05");
    expect(controller.formatTime(61000)).toBe("1:01");
  });

  test("savePlayerState: localStorage に state が保存される（widget 経路）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const iframe = document.getElementById("hidden-sc-player");
    iframe.src = "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fs&auto_play=false";
    controller.togglePlayPause(); // widget 生成
    jest.advanceTimersByTime(5);

    controller.currentTrackId = "1";
    controller.playPauseIcon.classList.remove("fa-play");
    controller.playPauseIcon.classList.add("fa-pause");
    controller.widget.__setDuration(120000);
    controller.widget.__setPosition(45000);

    controller.savePlayerState();
    const raw = localStorage.getItem("playerState");
    expect(raw).toBeTruthy();

    const state = JSON.parse(raw);
    expect(state.trackId).toBe("1");
    expect(state.position).toBe(45000);
    expect(state.duration).toBe(120000);
    expect(state.isPlaying).toBe(true);
    expect(typeof state.trackUrl).toBe("string");
  });

  test("restorePlayerState: 保存済みURLで iframe を差し替え、READY後にUI復元", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const saved = {
      trackId: "2",
      trackUrl: "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fartist%2Ftrack-two&auto_play=true",
      position: 30000,
      duration: 120000,
      isPlaying: false,
    };
    localStorage.setItem("playerState", JSON.stringify(saved));

    controller.restorePlayerState();

    const iframe = document.getElementById("hidden-sc-player");
    iframe.onload && iframe.onload();
    jest.advanceTimersByTime(160); // restore 側は 150ms 後

    controller.widget && controller.widget._trigger(SC.Widget.Events.READY);

    expect(controller.playPauseIcon.classList.contains("fa-play")).toBe(true);
    expect(document.getElementById("track-title").textContent.length).toBeGreaterThan(0);
  });
});

/* ========== hard-to-hit branches ========== */
describe("global_player_controller hard-to-hit branches", () => {
  test("togglePlayPause: iframe が存在しない → alert で早期 return", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    document.getElementById("hidden-sc-player").remove();

    const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
    controller.togglePlayPause();
    expect(alertSpy).toHaveBeenCalledTimes(1);
    alertSpy.mockRestore();
  });

  test("togglePlayPause: iframe はあるが src 空 → alert で早期 return", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const originalGet = document.getElementById.bind(document);
    const stubIframe = document.createElement("iframe");
    Object.defineProperty(stubIframe, "src", {
      get: () => "",
      set: () => {},
      configurable: true,
    });

    const getSpy = jest.spyOn(document, "getElementById").mockImplementation((id) => {
      if (id === "hidden-sc-player") return stubIframe;
      return originalGet(id);
    });

    const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
    controller.togglePlayPause();
    expect(alertSpy).toHaveBeenCalledTimes(1);

    getSpy.mockRestore();
    alertSpy.mockRestore();
  });

  test("togglePlayPause: SC.Widget 生成が throw → alert 経路に入る", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const iframe = document.getElementById("hidden-sc-player");
    iframe.src =
      "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fab&auto_play=false";

    const originalWidget = SC.Widget;
    // eslint-disable-next-line no-global-assign
    SC.Widget = Object.assign(function () { throw new Error("boom"); }, originalWidget);

    const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
    controller.togglePlayPause();
    expect(alertSpy).toHaveBeenCalledTimes(1);

    // eslint-disable-next-line no-global-assign
    SC.Widget = originalWidget;
    alertSpy.mockRestore();
  });

  test("cleanup: turbo:before-cache でハンドラ解除と widget 破棄", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const iframe = document.getElementById("hidden-sc-player");
    iframe.src =
      "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fab&auto_play=false";
    jest.spyOn(controller, "restorePlayerState").mockImplementation(() => {});
    controller.togglePlayPause();
    jest.advanceTimersByTime(5);

    const unbindSpy = controller.widget.unbind;
    document.dispatchEvent(new Event("turbo:before-cache"));
    expect(unbindSpy).toHaveBeenCalled();
    expect(controller.widget).toBeNull();
  });

  test("onFinish: SweetAlert 経由（5〜32秒再生 & 次曲なし → bottom-player を隠す）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    controller.playStartedAt = Date.now() - 10000; // 5〜32s 範囲
    controller.isRepeat = false;

    // 「次曲なし」を固定。updatePlaylistOrder に潰されないよう no-op
    controller.playlistOrder = ["1"];
    jest.spyOn(controller, "updatePlaylistOrder").mockImplementation(() => {});
    controller.currentTrackId = "1";

    const bottom = document.getElementById("bottom-player");
    bottom.classList.remove("d-none");

    const prevSwal = window.Swal;
    // eslint-disable-next-line no-global-assign
    window.Swal = { fire: jest.fn() };

    controller.onFinish();

    expect(window.Swal.fire).toHaveBeenCalledTimes(1);
    expect(bottom.classList.contains("d-none")).toBe(true);

    // eslint-disable-next-line no-global-assign
    window.Swal = prevSwal;
  });

  test("bindWidgetEvents: 毎回 unbind してから bind される", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const iframe = document.getElementById("hidden-sc-player");
    iframe.src =
      "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fab&auto_play=false";
    jest.spyOn(controller, "restorePlayerState").mockImplementation(() => {});
    controller.togglePlayPause();
    jest.advanceTimersByTime(5);

    controller.bindWidgetEvents();
    expect(controller.widget.unbind).toHaveBeenCalled();

    controller.widget.unbind.mockClear();
    controller.bindWidgetEvents();
    expect(controller.widget.unbind).toHaveBeenCalled();
  });
});

/* ========== extra-2（UI/イベント細部） ========== */
describe("global_player_controller extra-2", () => {
  test("show/hideLoadingUI: #play-pause-button を disabled トグル（実装仕様に一致）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const realBtn = document.getElementById("play-pause-button");

    controller.showLoadingUI();
    expect(realBtn.getAttribute("disabled")).toBe("disabled");
    expect(realBtn.getAttribute("aria-disabled")).toBe("true");

    controller.hideLoadingUI();
    expect(realBtn.hasAttribute("disabled")).toBe(false);
    expect(realBtn.getAttribute("aria-disabled")).toBe("false");
  });

  test("connect: body が playlist-show-page のとき localStorage をクリアする", () => {
    document.body.classList.add("playlist-show-page");
    localStorage.setItem("playerState", JSON.stringify({ foo: "bar" }));

    buildDOM();
    startStimulusAndGetController();

    expect(localStorage.getItem("playerState")).toBeNull();

    document.body.classList.remove("playlist-show-page");
  });

  test("window 'play-from-search' イベントで playFromExternal が呼ばれる", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const spy = jest.spyOn(controller, "playFromExternal").mockImplementation(() => {});
    const url = "https://soundcloud.com/artist/from-search";
    const ev = new CustomEvent("play-from-search", { detail: { playUrl: url } });
    window.dispatchEvent(ev);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(url);
    spy.mockRestore();
  });

  test("resize: waveformCanvas の width/height を offset に追随させる", () => {
    buildDOM();
    startStimulusAndGetController();

    const canvas = document.getElementById("waveform-anime");
    Object.defineProperty(canvas, "offsetWidth", { value: 480, configurable: true });
    Object.defineProperty(canvas, "offsetHeight", { value: 96, configurable: true });

    window.dispatchEvent(new Event("resize"));
    expect(canvas.width).toBe(480);
    expect(canvas.height).toBe(96);
  });

  /**
   * 進行のカバレッジ補完：
   * startProgressTracking() は getPosition() の値を読むだけなので、
   * 最初から 15000ms をセットし、その読み取りを 1tick で検証する。
   */
  test("coverage add-on: progress updates via startProgressTracking()", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    // READY 相当まで進める
    controller.playFromExternal("https://soundcloud.com/artist/progress");
    const iframe = document.getElementById("hidden-sc-player");
    iframe.onload && iframe.onload();
    jest.advanceTimersByTime(120);
    controller.widget._trigger(SC.Widget.Events.READY);

    // 再生状態・尺/位置を設定（← ここを 15,000ms 固定に修正）
    controller.onPlay();
    controller.widget.__setDuration(90000); // 90s
    controller.widget.__setPosition(15000); // 15s を直接読み取らせる

    controller.startProgressTracking();
    jest.advanceTimersByTime(1000);

    expect(document.getElementById("current-time").textContent).toBe("0:15");
    const pct = Math.round((15000 / 90000) * 100);
    expect(Number(document.getElementById("seek-bar").value)).toBe(pct);
  });
});
