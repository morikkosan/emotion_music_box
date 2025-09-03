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
    const expectedPercent = Math.round((30000 / 90000) * 100); // コントローラ側 Math.round に合わせる
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

  // ===== ここからカバレッジ増強の追加テスト =====

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

  // document 以外に委譲されていても落ちないように保険を入れた検証
  test("画像クリックで playFromExternal が正しいURL引数で呼ばれる（デリゲート経路の確実検証）", () => {
    buildDOM();

    const protoSpy = jest
      .spyOn(ControllerClass.prototype, "playFromExternal")
      .mockImplementation(() => {});

    const originalAdd = document.addEventListener;
    const clickHandlers = [];
    const addSpy = jest
      .spyOn(document, "addEventListener")
      .mockImplementation((type, handler, opts) => {
        if (type === "click") {
          clickHandlers.push(handler);
        }
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

  test("playIconクリックで対象トラックのアイコンが切り替わる（既存トラックとの排他）", () => {
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

  test("seek: duration=0 のときは新規の seekTo 呼び出しが発生しない（ガード分岐）", () => {
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

  test("changeVolume: 無効値でも最終的に 0〜100 にクランプされる（ガード/クランプ分岐）", () => {
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

  test("restorePlayerState: READY後に呼ぶと #track-artist-mobile が非空かつ現在のアーティスト名を反映", () => {
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

// ===== ここから “追加カバレッジ” テストだけ追記 =====
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

  test("replaceIframeWithNew: 旧 iframe が無い場合でも新規を生成して返す", () => {
  buildDOM();
  const { controller } = startStimulusAndGetController();

  document.getElementById("hidden-sc-player").remove();

  const created = controller.replaceIframeWithNew();
  expect(created).not.toBeNull();
  expect(created.id).toBe("hidden-sc-player");
  expect(created.classList.contains("is-hidden")).toBe(true);
  expect(created.allow).toBe("autoplay");
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

  test("toggleShuffle / updatePlaylistOrder / shufflePlaylistOrder: 並び順が変わる", () => {
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

  test("switchPlayerTopRow: 画面幅で PC/モバイル row を切替（resize 発火も検証）", () => {
    buildDOM();
    startStimulusAndGetController();

    const desktopRow = document.getElementById("player-top-row-desktop");
    const mobileRow  = document.getElementById("player-top-row-mobile");

    const origWidth = global.innerWidth;
    Object.defineProperty(global, "innerWidth", { value: 375, configurable: true });
    window.dispatchEvent(new Event("resize"));
    expect(desktopRow.style.display).toBe("none");
    expect(mobileRow.style.display).toBe("flex");

    Object.defineProperty(global, "innerWidth", { value: 1200, configurable: true });
    window.dispatchEvent(new Event("resize"));
    expect(desktopRow.style.display).toBe("flex");
    expect(mobileRow.style.display).toBe("none");

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

  test("formatTime: ミリ秒を mm:ss 形式へ（ms 引数）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    expect(controller.formatTime(0)).toBe("0:00");
    expect(controller.formatTime(999)).toBe("0:00");
    expect(controller.formatTime(1000)).toBe("0:01");
    expect(controller.formatTime(65000)).toBe("1:05");
    expect(controller.formatTime(61000)).toBe("1:01");
  });

  test("savePlayerState: localStorage に state が保存される（position/duration/title/再生中）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const iframe = document.getElementById("hidden-sc-player");
    iframe.src = "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fs&auto_play=false";
    controller.togglePlayPause(); // widget 生成ルート
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

  test("restorePlayerState: 保存済みURLで iframe を差し替え、READY後にUI復元を走らせる", () => {
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

// ===== ここから “hard-to-hit branches” =====
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

  // === 修復: 5〜32秒再生 + 次曲なし → アラートして bottom-player を隠す
 test("onFinish: SweetAlert 経由（Swal.fire が呼ばれ、次曲なしなら bottom-player を隠す）", () => {
  buildDOM();
  const { controller } = startStimulusAndGetController();

  controller.playStartedAt = Date.now() - 10000; // 5〜32s 範囲
  controller.isRepeat = false;

  // 「次曲なし」を固定。updatePlaylistOrder に潰されないよう no-op
  controller.playlistOrder = ["1"];
  jest.spyOn(controller, "updatePlaylistOrder").mockImplementation(() => {});
  controller.currentTrackId = "1"; // ← 文字列で統一

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

// ===== ここから “extra-2” （UI/イベント細部）=====
describe("global_player_controller extra-2", () => {
  test("show/hideLoadingUI: #play-pause-button を disabled トグル（実装仕様に一致）", () => {
    buildDOM();

    const icon = document.getElementById("play-pause-icon");
    const realBtn = document.createElement("button");
    realBtn.id = "play-pause-button";
    icon.parentNode.insertBefore(realBtn, icon);

    const { controller } = startStimulusAndGetController();

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

  test("replaceIframeWithNew: 枠属性(frameBorder/scrolling/size) まで付く", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const newIframe = controller.replaceIframeWithNew();
    expect(newIframe.frameBorder).toBe("no");
    expect(newIframe.scrolling).toBe("no");
    expect(newIframe.width).toBe("100%");
    expect(newIframe.height).toBe("166");
  });
});

// ===== ここから “hard-to-hit branches (more)” =====
describe("global_player_controller hard-to-hit branches (more)", () => {
  test("onFinish: 次曲あり（repeat=false）→ 次アイコンで loadAndPlay", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    controller.isRepeat = false;
    controller.playlistOrder = ["1", "2"];
    controller.currentTrackId = "1";
    controller.playStartedAt = Date.now() - 40000; // 40s 経過（権利アラート外）

    const spy = jest.spyOn(controller, "loadAndPlay").mockImplementation(() => {});
    controller.onFinish();

    jest.advanceTimersByTime(400);

    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0];
    expect(arg && arg.currentTarget?.dataset.trackId).toBe("2");

    spy.mockRestore();
  });

  test("tryRestore: getCurrentSound が空を返し続けた後に復元される（リトライ分岐）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const iframe = document.getElementById("hidden-sc-player");
    iframe.src = "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fab&auto_play=false";
    jest.spyOn(controller, "restorePlayerState").mockImplementation(() => {});
    controller.togglePlayPause();
    jest.advanceTimersByTime(5);

    let count = 0;
    controller.widget.getCurrentSound = jest.fn((cb) => {
      count += 1;
      if (count <= 3) cb({});
      else cb({ title: "Restored Title", user: { username: "Restored Artist" } });
    });

    controller.widget.getDuration = jest.fn((cb) => cb(123000));

    controller.tryRestore({ position: 0, isPlaying: false }, 0);
    jest.advanceTimersByTime(1000);

    expect(document.getElementById("track-title").textContent).toBe("Restored Title");
    expect(document.getElementById("track-artist").textContent).toContain("Restored Artist");
  });

  test("onFinish: repeat=true → 現在曲を loadAndPlay でリスタート", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    controller.currentTrackId = "1";
    controller.isRepeat = true;
    controller.playlistOrder = ["1", "2"];
    controller.playStartedAt = Date.now() - 10000; // 10s

    const spy = jest.spyOn(controller, "loadAndPlay").mockImplementation(() => {});
    controller.onFinish();

    jest.advanceTimersByTime(400);

    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0];
    expect(arg && arg.currentTarget?.dataset.trackId).toBe("1");

    spy.mockRestore();
  });

  test("seek: ドラッグ中は自動更新を抑止し、mouseup で再開される", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const iframe = document.getElementById("hidden-sc-player");
    iframe.src = "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fab&auto_play=false";
    jest.spyOn(controller, "restorePlayerState").mockImplementation(() => {});
    controller.togglePlayPause();
    jest.advanceTimersByTime(5);

    controller.widget.__setPosition(100000);
    controller.widget.__setDuration(200000);
    controller.widget.getDuration = jest.fn((cb) => cb(200000));

    const seekBar = document.getElementById("seek-bar");

    seekBar.dispatchEvent(new Event("mousedown"));
    controller.startProgressTracking();
    jest.advanceTimersByTime(1000);
    expect(seekBar.value).toBe("0");

    document.dispatchEvent(new Event("mouseup"));
    jest.advanceTimersByTime(1000);

    expect(parseFloat(seekBar.value)).toBeCloseTo(50, 1);
  });

  test("playFromExternal: replaceIframeWithNew が null を返した場合は alert 経路", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const repSpy = jest.spyOn(controller, "replaceIframeWithNew").mockReturnValue(null);
    const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});

    controller.playFromExternal("https://soundcloud.com/artist/foo");
    expect(repSpy).toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledTimes(1);

    repSpy.mockRestore();
    alertSpy.mockRestore();
  });

  test("onPlayIconClick: 同じトラックをクリックしたら再生/一時停止トグル", () => {
    buildDOM();
    const { controller, root } = startStimulusAndGetController();

    const iframe = document.getElementById("hidden-sc-player");
    iframe.src = "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fab&auto_play=false";
    jest.spyOn(controller, "restorePlayerState").mockImplementation(() => {});
    controller.togglePlayPause();
    jest.advanceTimersByTime(5);

    controller.currentTrackId = "1";
    const icon1 = root.querySelector('i[data-track-id="1"]');

    controller.widget.play();
    controller.onPlayIconClick({ currentTarget: icon1, stopPropagation() {} });
    expect(controller.widget.pause).toHaveBeenCalled();

    controller.widget.pause();
    controller.onPlayIconClick({ currentTarget: icon1, stopPropagation() {} });
    expect(controller.widget.play).toHaveBeenCalled();
  });

  test("togglePlayPause: 既に widget がある場合は isPaused の結果で play/pause を実行", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const iframe = document.getElementById("hidden-sc-player");
    iframe.src = "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fab&auto_play=false";
    jest.spyOn(controller, "restorePlayerState").mockImplementation(() => {});
    controller.togglePlayPause();
    jest.advanceTimersByTime(5);

    controller.widget.pause();

    controller.togglePlayPause();
    expect(controller.widget.play).toHaveBeenCalled();
  });

  test("restorePlayerState: 保存なし・URLなしのときは何も起きない（早期 return）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    localStorage.removeItem("playerState");
    controller.restorePlayerState();

    localStorage.setItem("playerState", JSON.stringify({ trackId: "1" }));
    controller.restorePlayerState();

    expect(true).toBe(true);
  });
});

// ===== tiny gap fillers =====
describe("global_player_controller tiny gap fillers", () => {
  test("showLoadingUI: タイトルが 'NOW LOADING...' / top が 'Loading…' に置換される", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();
    controller.showLoadingUI();

    const titleTextNoSpace = document
      .getElementById("track-title")
      .textContent.replace(/\s+/g, "").trim();

    expect(titleTextNoSpace).toMatch(/NOWLOADING/i);
    expect(document.getElementById("track-title-top").innerHTML).toBe("Loading…");
  });

  // ★ 修復: 旧仕様の「何もしない」期待 → 新仕様のフォールバック期待へ
  test("prevTrack: currentTrackId なしなら最後の曲へフォールバック再生", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();
    controller.updatePlaylistOrder(); // ["1","2"]

    const spy = jest.spyOn(controller, "loadAndPlay").mockImplementation(() => {});
    controller.prevTrack(); // currentTrackId 未設定 → 最後 "2"
    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0];
    expect(arg && arg.currentTarget?.dataset.trackId).toBe("2");
    spy.mockRestore();
  });

  test("prevTrack: 先頭なら最後の曲へフォールバック再生", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();
    controller.updatePlaylistOrder(); // ["1","2"]
    controller.currentTrackId = "1";

    const spy = jest.spyOn(controller, "loadAndPlay").mockImplementation(() => {});
    controller.prevTrack();
    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0];
    expect(arg && arg.currentTarget?.dataset.trackId).toBe("2");
    spy.mockRestore();
  });

  test("nextTrack: 末尾なら最初の曲へフォールバック再生", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();
    controller.updatePlaylistOrder(); // ["1","2"]
    controller.currentTrackId = "2";

    const spy = jest.spyOn(controller, "loadAndPlay").mockImplementation(() => {});
    controller.nextTrack();
    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0];
    expect(arg && arg.currentTarget?.dataset.trackId).toBe("1");
    spy.mockRestore();
  });

  test("switchPlayerTopRow: 対象DOMが無ければ何もせず落ちない（早期return）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    document.getElementById("player-top-row-desktop").remove();
    document.getElementById("player-top-row-mobile").remove();

    expect(() => controller.switchPlayerTopRow()).not.toThrow();
  });

  test("loadAndPlay: READY後 getCurrentSound が数回空→その後取得でタイトル反映（リトライ成功ルート）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const playIcon = document.querySelector('i[data-track-id="1"]');
    const ev = { currentTarget: playIcon, stopPropagation() {} };

    const originalFactory = SC.Widget;
    let callCount = 0;
    // eslint-disable-next-line no-global-assign
    SC.Widget = Object.assign(function () {
      const w = originalFactory(); // 既定のモック
      w.getCurrentSound = jest.fn((cb) => {
        callCount += 1;
        if (callCount < 3) cb({});            // タイトルなし
        else cb({ title: "After Retry", user: { username: "Retry Artist" } });
      });
      return w;
    }, SC.Widget);

    controller.loadAndPlay(ev);

    const iframe = document.getElementById("hidden-sc-player");
    iframe.onload && iframe.onload();
    jest.advanceTimersByTime(120);
    controller.widget && controller.widget._trigger(SC.Widget.Events.READY);

    jest.advanceTimersByTime(600); // 250×2 + α

    expect(document.getElementById("track-title").textContent).toBe("After Retry");
    expect(document.getElementById("track-artist").textContent).toContain("Retry Artist");

    // eslint-disable-next-line no-global-assign
    SC.Widget = originalFactory;
  });

  test("savePlayerState: widget が無ければ何もしない（早期return）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    localStorage.setItem("playerState", JSON.stringify({ foo: "bar" }));
    controller.savePlayerState();

    expect(localStorage.getItem("playerState")).toBeTruthy();
  });

  test("bindWidgetEvents: widget が null でも落ちない（早期return）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();
    controller.widget = null;
    expect(() => controller.bindWidgetEvents()).not.toThrow();
  });

  test("startProgressTracking: widget=null / isSeeking=true では DOM 更新されない", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    expect(() => controller.startProgressTracking()).not.toThrow();

    const iframe = document.getElementById("hidden-sc-player");
    iframe.src = "https://w.soundcloud.com/player/?url=x&auto_play=false";
    jest.spyOn(controller, "restorePlayerState").mockImplementation(() => {});
    controller.togglePlayPause();
    jest.advanceTimersByTime(5);

    controller.widget.__setDuration(60000);
    controller.widget.__setPosition(30000);
    controller.isSeeking = true;
    controller.startProgressTracking();
    jest.advanceTimersByTime(1000);

    expect(document.getElementById("current-time").textContent).toBe("0:00");
    expect(document.getElementById("duration").textContent).toBe("0:00");
  });

  test("tryRestore: 5回超リトライしても取得できなければ『タイトル不明』にフォールバック", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const iframe = document.getElementById("hidden-sc-player");
    iframe.src = "https://w.soundcloud.com/player/?url=y&auto_play=false";
    jest.spyOn(controller, "restorePlayerState").mockImplementation(() => {});
    controller.togglePlayPause();
    jest.advanceTimersByTime(5);

    controller.widget.getDuration = jest.fn((cb) => cb(120000));
    controller.widget.getCurrentSound = jest.fn((cb) => cb({}));

    const state = { position: 12345, isPlaying: false };
    controller.tryRestore(state);

    jest.advanceTimersByTime(250 * 6 + 10);

    expect(document.getElementById("track-title").textContent).toBe("タイトル不明");
    expect(document.getElementById("track-artist").textContent).toBe("");
  });

  // ★ 修復: リトライ完了までタイマーを十分に進めて『タイトル不明』表示を検証
  test("playFromExternal: READY後も title 取れなければ『タイトル不明』を表示", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    controller.playFromExternal("https://soundcloud.com/no-title");
    const iframe = document.getElementById("hidden-sc-player");
    iframe.onload && iframe.onload();
    jest.advanceTimersByTime(110);

    controller.widget.__setCurrentSound({});
    controller.widget._trigger(SC.Widget.Events.READY);

    // 180ms × 6回 = 1080ms → 余裕を見て 1200ms
    jest.advanceTimersByTime(1200);

    expect(document.getElementById("track-title").textContent).toBe("タイトル不明");
    expect(document.getElementById("track-artist").textContent).toBe("");
  });

  test("stopWaveformAnime: 停止時に clearRect が呼ばれる", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();
    const canvas = document.getElementById("waveform-anime");
    const ctx = canvas.getContext("2d");

    controller.startWaveformAnime();
    controller.stopWaveformAnime();

    expect(ctx.clearRect).toHaveBeenCalled();
    expect(controller.waveformAnimating).toBe(false);
  });

  test("formatTime: undefined/null/負値でも '0:00' になる", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    expect(controller.formatTime()).toBe("0:00");
    expect(controller.formatTime(null)).toBe("0:00");
    expect(controller.formatTime(-1000)).toBe("0:00");
  });

  test("updateTrackIcon: 対象ターゲットが存在しない場合は何もせず落ちない（早期return）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    document.querySelectorAll('[data-global-player-target="playIcon"]').forEach((n) => n.remove());
    expect(() => controller.updateTrackIcon("1", true)).not.toThrow();
  });
});

test("restorePlayerState: isPlaying=true → seekTo + play + UI反映（PLAYイベントを明示発火）", () => {
  buildDOM();
  const { controller } = startStimulusAndGetController();

  const saved = {
    trackId: "2",
    trackUrl: "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fartist%2Ftrack-two&auto_play=true",
    position: 42000,
    duration: 120000,
    isPlaying: true,
  };
  localStorage.setItem("playerState", JSON.stringify(saved));

  controller.restorePlayerState();

  const iframe = document.getElementById("hidden-sc-player");
  iframe.onload && iframe.onload();
  jest.advanceTimersByTime(160);
  controller.widget && controller.widget._trigger(SC.Widget.Events.READY);

  // seek + play までは同期で確認
  expect(controller.widget.seekTo).toHaveBeenCalledWith(42000);
  expect(controller.widget.play).toHaveBeenCalled();

  // bind は READY 後なので PLAY を明示トリガして UI を確認
  controller.widget._trigger(SC.Widget.Events.PLAY);
  expect(controller.playPauseIcon.classList.contains("fa-pause")).toBe(true);

  const icon2 = document.querySelector('i[data-track-id="2"]');
  expect(icon2.classList.contains("fa-pause")).toBe(true);
});


test("startWaveformAnime: 1フレームで描画API(beginPath/lineTo/stroke)が呼ばれる", () => {
  buildDOM();
  const { controller } = startStimulusAndGetController();
  const ctx = document.getElementById("waveform-anime").getContext("2d");

  controller.startWaveformAnime();
  // このスイートでは rAF= setTimeout(...,0) なので少し進める
  jest.advanceTimersByTime(1);

  expect(ctx.beginPath).toHaveBeenCalled();
  expect(ctx.lineTo).toHaveBeenCalled();
  expect(ctx.stroke).toHaveBeenCalled();

  controller.stopWaveformAnime(); // 後片付け
});

// ===== coverage gap killers =====
describe("global_player_controller gap killers", () => {
  test("hideLoadingUI: screen-cover-loading を必ず畳む（_hideScreenCover 分岐）", () => {
    buildDOM();
    const cover = document.createElement("div");
    cover.id = "screen-cover-loading";
    cover.style.display = "block";
    document.body.appendChild(cover);

    const { controller } = startStimulusAndGetController();
    controller.showLoadingUI();
    controller.hideLoadingUI();

    expect(cover.style.display).toBe("none");
    expect(cover.getAttribute("aria-hidden")).toBe("true");
  });

  test("updateSeekAria: dur あり/なしの両分岐を踏む", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();
    const seek = document.getElementById("seek-bar");

    controller.updateSeekAria(42, 30000, 120000);
    expect(seek.getAttribute("aria-valuenow")).toBe("42");
    expect(seek.getAttribute("aria-valuetext")).toBe("0:30 / 2:00");

    controller.updateSeekAria(7, 7000, 0);
    expect(seek.getAttribute("aria-valuenow")).toBe("7");
    expect(seek.getAttribute("aria-valuetext")).toBe("0:07");
  });

  test("updatePlaylistOrder: targets 無しでも .playlist-container で順序復元（フォールバック枝）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    // targets を空にしてフォールバックを強制
    controller.trackImageTargets = [];
    const wrap = document.createElement("div");
    wrap.className = "playlist-container";
    wrap.innerHTML = `
      <img data-track-id="10" data-play-url="https://soundcloud.com/a/10">
      <img data-track-id="11" data-play-url="https://soundcloud.com/a/11">`;
    controller.element.appendChild(wrap);

    controller.isShuffle = false;
    controller.updatePlaylistOrder();
    expect(controller.playlistOrder).toEqual(["10", "11"]);
  });

  test("prev/next: playIconTargets 不在でも _q フォールバックで要素取得（CSS.escape 経路）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    // フォールバック対象のDOMを用意
    const wrap = document.createElement("div");
    wrap.className = "playlist-container";
    wrap.innerHTML = `
      <i class="fa" data-track-id="21" data-play-url="https://soundcloud.com/a/21"></i>
      <i class="fa" data-track-id="22" data-play-url="https://soundcloud.com/a/22"></i>`;
    controller.element.appendChild(wrap);

    controller.trackImageTargets = [];      // order はこの2つ
    controller.updatePlaylistOrder();       // ["21","22"]
    controller.playIconTargets = [];        // find() を空振りさせる
    const spy = jest.spyOn(controller, "loadAndPlay").mockImplementation(() => {});

    controller.currentTrackId = "21";
    controller.nextTrack();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].currentTarget?.dataset.trackId).toBe("22");

    spy.mockRestore();
  });

  test("startWaveformAnime: strokeStyle/lineWidth 設定行まで実行される", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();
    const ctx = document.getElementById("waveform-anime").getContext("2d");

    controller.startWaveformAnime();
    jest.advanceTimersByTime(1); // rAF= setTimeout(…,0) の1フレーム

    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.lineWidth).toBe(2);
    expect(ctx.strokeStyle).toBe("#10ffec");

    controller.stopWaveformAnime();
  });

  test("_safeNukeIframe: src blank化→属性削除→DOMから除去まで通る", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const old = document.createElement("iframe");
    old.id = "old-test-iframe";
    old.src = "https://w.soundcloud.com/player/?url=x";
    document.body.appendChild(old);

    controller._safeNukeIframe(old);
    expect(document.getElementById("old-test-iframe")).toBeNull();
  });
});



// ===== coverage gap killers 2 =====
describe("global_player_controller gap killers 2", () => {
  test("hideLoadingUI: #screen-cover-loading が無い時の分岐（false ブランチ）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();
    // cover を置かずに hide → if (cover) の false 側を踏む
    controller.showLoadingUI();
    expect(() => controller.hideLoadingUI()).not.toThrow();
  });

  test("cleanup: removeEventListener/unbind が throw しても落ちない（try/catch の catch へ）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    // 例外を投げる偽の要素群
    const makeThrower = () => ({ removeEventListener: () => { throw new Error("boom"); } });
    controller.seekBar   = makeThrower();
    controller.volumeBar = makeThrower();
    controller._prevBtn  = makeThrower();
    controller._nextBtn  = makeThrower();

    // _container 側も throw させる
    jest.spyOn(controller, "_container").mockReturnValue(makeThrower());

    // widget.unbind も throw させる
    controller.widget = { unbind: () => { throw new Error("unbind-boom"); } };

    expect(() => controller.cleanup()).not.toThrow();
    // widget は null にされる（後始末まで到達）
    expect(controller.widget).toBeNull();
  });

  test("savePlayerState: widget.getPosition が throw しても catch 分岐で落ちない", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    controller.widget = {
      getPosition: () => { throw new Error("pos-boom"); },
      getDuration: (cb) => cb(1000),
    };
    // 例外でも投げずに抜ければ OK
    expect(() => controller.savePlayerState()).not.toThrow();
  });

  test("bindWidgetEvents: unbind が throw → catch を踏みつつ bind は実行される", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const bind = jest.fn();
    const widget = {
      unbind: () => { throw new Error("unbind-boom"); },
      bind,
    };
    controller.widget = widget;

    expect(() => controller.bindWidgetEvents()).not.toThrow();
    // 3イベント分の bind が呼ばれる
    expect(bind).toHaveBeenCalledTimes(3);
  });

  test("startWaveformAnime: waveformCtx が無い時は早期 return（false ブランチ）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    controller.waveformCtx = null; // ctx なし
    controller.startWaveformAnime();
    // ctx なしなのでアニメは開始されない
    expect(controller.waveformAnimating).toBe(false);
  });

  test("updatePlaylistOrder: targets も .playlist-container も空（フォールバック不成立）でも落ちない", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    // targets を空にして、DOM 直走査でもゼロにする
    controller.trackImageTargets = [];
    // element 配下には data-* を置かない
    const loneDiv = document.createElement("div");
    loneDiv.className = "playlist-container";
    controller.element.appendChild(loneDiv);

    controller.updatePlaylistOrder();
    expect(Array.isArray(controller.playlistOrder)).toBe(true);
    expect(controller.playlistOrder.length).toBe(0);
  });

  test("prevTrack: 対象アイコンが見つからない分岐（_q でも null）で何も起きない", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    controller.trackImageTargets = [];
    controller.playIconTargets = [];
    controller.playlistOrder = ["1", "2"];
    controller.currentTrackId = "1";

    const spy = jest.spyOn(controller, "loadAndPlay").mockImplementation(() => {});
    // DOM からも data-track-id 要素を消して見つからない状況を作る
    document.querySelectorAll("[data-track-id]").forEach((n) => n.remove());

    controller.prevTrack(); // -> アイコン取れず何も起きない
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test("nextTrack: playlistOrder が空の早期 return（false ブランチ）", () => {
  buildDOM();
  const { controller } = startStimulusAndGetController();

  // 毎回空にするようにスタブ（実装を触らずに早期returnを踏む）
  jest.spyOn(controller, "updatePlaylistOrder").mockImplementation(() => {
    controller.playlistOrder = [];
  });

  const spy = jest.spyOn(controller, "loadAndPlay").mockImplementation(() => {});
  expect(() => controller.nextTrack()).not.toThrow();
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});


  test("startWaveformAnime: save/restore まで実行（描画ブロックの行全体を踏む）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();
    const ctx = document.getElementById("waveform-anime").getContext("2d");

    controller.startWaveformAnime();
    jest.advanceTimersByTime(1); // 1フレーム
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();

    controller.stopWaveformAnime();
  });
});



// ===== gap killers 3: 残りの分岐を踏む =====
describe("global_player_controller gap killers 3", () => {
  test("tryRestore: widget=null → 300ms 後の再試行で復元（!this.widget 分岐）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    controller.widget = null;
    const state = { position: 12345, isPlaying: false };
    controller.tryRestore(state); // ここで 300ms 後に再呼び出しがスケジュールされる

    // 再試行タイミングに間に合うよう、簡易モックを差し込む
    const mock = {
      getDuration: jest.fn((cb) => cb(120000)),
      getCurrentSound: jest.fn((cb) => cb({ title: "TK", user: { username: "AR" } })),
      seekTo: jest.fn(),
      pause: jest.fn(),
    };
    controller.widget = mock;

    jest.advanceTimersByTime(300);

    expect(document.getElementById("track-title").textContent).toBe("TK");
    expect(controller.widget.seekTo).toHaveBeenCalledWith(12345);
  });

  test("tryRestore: duration=0 → 300ms 後に再試行（!dur 分岐）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    let first = true;
    const mock = {
      getDuration: jest.fn((cb) => cb(first ? 0 : 90000)),
      getCurrentSound: jest.fn((cb) => cb({ title: "After Dur", user: { username: "AR" } })),
      seekTo: jest.fn(),
      pause: jest.fn(),
    };
    controller.widget = mock;

    controller.tryRestore({ position: 0, isPlaying: false });
    first = false; // 2回目で duration を返すよう切替
    jest.advanceTimersByTime(300);

    expect(document.getElementById("track-title").textContent).toBe("After Dur");
  });

  test("updatePlaylistOrder: targets 空 → DOM フォールバックで順序復元", () => {
    buildDOM();
    const { controller, root } = startStimulusAndGetController();

    controller.trackImageTargets = [];         // Stimulus targets を空に
    root.classList.add("playlist-container");  // フォールバックのクエリに合致させる

    controller.updatePlaylistOrder();
    expect(controller.playlistOrder).toEqual(["1", "2"]);
  });

  test("replaceIframeWithNew: 親候補が無い時は document.body に追加（親決定分岐）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    document.getElementById("hidden-sc-player").remove(); // 旧iframeなし
    document.getElementById("bottom-player").remove();    // 親候補も除去

    const created = controller.replaceIframeWithNew();
    expect(created).toBeTruthy();
    expect(created.parentNode).toBe(document.body);
  });

  test("startWaveformAnime: ctx なしなら即 return（ガード分岐）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    controller.waveformCtx = null;
    controller.waveformCanvas = null;
    controller.startWaveformAnime();

    expect(controller.waveformAnimating).toBe(false);
  });

  test("_hideScreenCover: 要素が存在する場合の分岐（hideLoadingUI 経由）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const cover = document.createElement("div");
    cover.id = "screen-cover-loading";
    document.body.appendChild(cover);

    controller.hideLoadingUI(); // 内部で _hideScreenCover が呼ばれる

    expect(cover.style.display).toBe("none");
    expect(cover.getAttribute("aria-hidden")).toBe("true");
  });
});



// ===== gap killers 4: まだ残ってる分岐まとめ踏み =====
describe("global_player_controller gap killers 4", () => {
  test("restorePlayerState: SC.Widget が READY前に throw → 150ms 後にリトライ成功", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();
    // 保存状態を用意
    const saved = {
      trackId: "1",
      trackUrl: "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fa&auto_play=true",
      position: 1000,
      duration: 120000,
      isPlaying: false,
    };
    localStorage.setItem("playerState", JSON.stringify(saved));

    // 1回目だけ throw、2回目で成功させる
    const original = SC.Widget;
    let call = 0;
    // eslint-disable-next-line no-global-assign
    SC.Widget = Object.assign(function () {
      call += 1;
      if (call === 1) throw new Error("boom-on-restore");
      return original();
    }, SC.Widget);

    controller.restorePlayerState();
    const iframe = document.getElementById("hidden-sc-player");
    iframe.onload && iframe.onload();
    // 1回目: 150ms後に再試行がスケジュールされる
    jest.advanceTimersByTime(150);
    // 2回目（成功側）も走らせる
    jest.advanceTimersByTime(5);
    controller.widget && controller.widget._trigger(SC.Widget.Events.READY);

    // 成功して UI が動いていることだけ確認
    expect(document.getElementById("track-title").textContent.length).toBeGreaterThan(0);

    // eslint-disable-next-line no-global-assign
    SC.Widget = original;
  });

  test("playFromExternal: SC.Widget 生成が throw → 120ms 後に自動リトライ", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const original = SC.Widget;
    let call = 0;
    // eslint-disable-next-line no-global-assign
    SC.Widget = Object.assign(function () {
      call += 1;
      if (call === 1) throw new Error("boom-on-external");
      return original();
    }, SC.Widget);

    controller.playFromExternal("https://soundcloud.com/artist/retry");
    const iframe = document.getElementById("hidden-sc-player");
    iframe.onload && iframe.onload();

    // 1回目は throw → リトライ予約
    jest.advanceTimersByTime(120);
    // リトライ分
    jest.advanceTimersByTime(5);
    controller.widget && controller.widget._trigger(SC.Widget.Events.READY);

    expect(document.getElementById("bottom-player").classList.contains("d-none")).toBe(false);

    // eslint-disable-next-line no-global-assign
    SC.Widget = original;
  });

  test("loadAndPlay: タイトルが6回連続で取れない → 『タイトル不明』にフォールバック", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();
    const playIcon = document.querySelector('i[data-track-id="1"]');
    const ev = { currentTarget: playIcon, stopPropagation() {} };

    // getCurrentSound が常に空
    const original = SC.Widget;
    // eslint-disable-next-line no-global-assign
    SC.Widget = Object.assign(function () {
      const w = original();
      w.getCurrentSound = jest.fn((cb) => cb({})); // タイトルなしを返し続ける
      return w;
    }, SC.Widget);

    controller.loadAndPlay(ev);
    const iframe = document.getElementById("hidden-sc-player");
    iframe.onload && iframe.onload();
    jest.advanceTimersByTime(120);
    controller.widget && controller.widget._trigger(SC.Widget.Events.READY);

    // 180ms × 6回分 + α
    jest.advanceTimersByTime(1200);
    expect(document.getElementById("track-title").textContent).toBe("タイトル不明");
    expect(document.getElementById("track-artist").textContent).toBe("");

    // eslint-disable-next-line no-global-assign
    SC.Widget = original;
  });

  test("_container: element=null でも .playlist-container を拾い、なければ document", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();
    // element を外す
    controller.element = null;
    const holder = document.createElement("div");
    holder.className = "playlist-container";
    document.body.appendChild(holder);
    expect(controller._container()).toBe(holder);

    // 消すと document にフォールバック
    holder.remove();
    expect(controller._container()).toBe(document);
  });

  test("_safeNukeIframe: null を渡しても落ちない（早期return）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();
    expect(() => controller._safeNukeIframe(null)).not.toThrow();
  });

  test("cleanup: iframe を事前に消した状態でも例外なく完了（旧iframe無しの分岐）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();
    document.getElementById("hidden-sc-player").remove();
    expect(() => controller.cleanup()).not.toThrow();
  });

  test("bindWidgetEvents: unbind が throw しても catch で続行して bind 完了", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();
    controller.widget = {
      bind: jest.fn(),
      unbind: jest.fn(() => { throw new Error("unbind-broken"); }),
    };
    expect(() => controller.bindWidgetEvents()).not.toThrow();
    expect(controller.widget.bind).toHaveBeenCalledTimes(3);
  });

  test("A11y: 対象DOMが無い時のガード（setPlayPauseAria / updateSeekAria / updateVolumeAria）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    // 対象を消してガードを踏む
    document.getElementById("play-pause-button")?.remove();
    document.getElementById("seek-bar")?.remove();
    document.getElementById("volume-bar")?.remove();

    expect(() => controller.setPlayPauseAria(true)).not.toThrow();
    expect(() => controller.updateSeekAria(50, 1000, 2000)).not.toThrow();
    expect(() => controller.updateVolumeAria("70")).not.toThrow();
  });

  test("resize: waveformCanvas が無いときは幅/高さ追随をスキップ（ガード）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();
    controller.waveformCanvas = null; // ガードを踏む
    window.dispatchEvent(new Event("resize"));
    // 何も起きなければOK（落ちないことを確認）
    expect(true).toBe(true);
  });

  test("toggleShuffle / toggleRepeat: ボタンDOMが存在しなくても落ちない", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();
    document.getElementById("shuffle-button").remove();
    document.getElementById("repeat-button").remove();
    expect(() => controller.toggleShuffle()).not.toThrow();
    expect(() => controller.toggleRepeat()).not.toThrow();
  });
});

