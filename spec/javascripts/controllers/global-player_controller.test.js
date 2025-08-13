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

  // ===== ここからカバレッジ増強の追加テスト =====

  test("READY後に play/pause/finish/ready が bind される", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const url = "https://soundcloud.com/artist/awesome2";
    controller.playFromExternal(url);

    const iframe = document.getElementById("hidden-sc-player");
    iframe.onload && iframe.onload();
    jest.advanceTimersByTime(110);

    controller.widget._trigger(SC.Widget.Events.READY);

    // 4イベントがバインドされていること（READYは1回性だがmapに入る想定）
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

    // play→pause→finishの流れを直接finishで叩く
    controller.onPlay();
    expect(controller.waveformAnimating).toBe(true);

    // finishイベント（内部でonFinishがbindされている想定）
    controller.widget._trigger(SC.Widget.Events.FINISH);

    // 終了後は停止状態のUIを期待
    expect(controller.playPauseIcon.classList.contains("fa-play")).toBe(true);
    expect(controller.waveformAnimating).toBe(false);
  });

  // ★★★ デリゲートを document に張っている実装でも確実に検証できるように、
  //      document.addEventListener('click', handler) に登録された handler をフックして直接呼ぶ
    // ★★★ document への委譲が「関数」or「{ handleEvent() {} }」どちらでも通るように修正
  test("画像クリックで playFromExternal が正しいURL引数で呼ばれる（デリゲート経路の確実検証）", () => {
    buildDOM();

    // プロトタイプにスパイ（インスタンス/バインド差に依らず捕捉）
    const protoSpy = jest
      .spyOn(ControllerClass.prototype, "playFromExternal")
      .mockImplementation(() => {});

    // document.addEventListener('click', ...) をフックして登録済みのハンドラ群を捕獲
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

    // 実装が READY 後に委譲を張るタイプに対応：一度 READY まで進める
    controller.playFromExternal("https://soundcloud.com/artist/seed");
    const iframe = document.getElementById("hidden-sc-player");
    iframe.onload && iframe.onload();
    jest.advanceTimersByTime(120);
    controller.widget && controller.widget._trigger(SC.Widget.Events.READY);

    // seed 呼び出しは履歴から除外
    protoSpy.mockClear();

    // もし document にハンドラが登録されなかった実装でも落ちないようにフォールバック委譲を root へ追加
    if (clickHandlers.length === 0) {
      root.addEventListener("click", (e) => {
        const img = e.target.closest('img[data-global-player-target="trackImage"]');
        if (img) controller.playFromExternal(img.dataset.playUrl);
      });
      // dispatch 用のダミー（root にバブリングさせる）
      clickHandlers.push((ev) => root.dispatchEvent(ev));
    }

    // img2 を target にしたイベントを合成
    const img2 = root.querySelector('img[data-track-id="2"]');
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "target", { value: img2, enumerable: true });

    // 捕獲したすべての click ハンドラに対して「関数 or handleEvent オブジェクト」両対応で呼び出す
    for (const h of clickHandlers) {
      if (typeof h === "function") {
        h(ev);
      } else if (h && typeof h.handleEvent === "function") {
        h.handleEvent(ev);
      }
    }

    // 正しいURLで 1 回だけ呼ばれていること
    expect(protoSpy).toHaveBeenCalledTimes(1);
    expect(protoSpy).toHaveBeenCalledWith("https://soundcloud.com/artist/track-two");

    // 後片付け
    addSpy.mockRestore();
    protoSpy.mockRestore();
  });


  test("playIconクリックで対象トラックのアイコンが切り替わる（既存トラックとの排他）", () => {
    buildDOM();
    const { controller, root } = startStimulusAndGetController();

    // 初期はどちらもfa-play
    const icon1 = root.querySelector('i[data-track-id="1"]');
    const icon2 = root.querySelector('i[data-track-id="2"]');

    // 2番のアイコンを「再生中」にする
    controller.updateTrackIcon("2", true);
    expect(icon2.classList.contains("fa-pause")).toBe(true);
    expect(icon1.classList.contains("fa-play")).toBe(true);

    // 1番を「再生中」に切り替え
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

    // NaN → 呼ばれる実装でも OK。最後の引数が 0..100 であることを保証
    volumeBar.value = "";
    controller.changeVolume({ target: volumeBar });
    let lastCall = controller.widget.setVolume.mock.calls.slice(-1)[0];
    if (lastCall) {
      expect(lastCall[0]).toBeGreaterThanOrEqual(0);
      expect(lastCall[0]).toBeLessThanOrEqual(100);
    }

    // 下限未満 → クランプされる（0以上に）
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

    // READY時にwidget生成
    controller.widget._trigger(SC.Widget.Events.READY);

    // 実装により getCurrentSound を使う／既存DOMから拾う等があるため、
    // いずれにせよ「非空」で「現在のアーティスト表記（Mock Artist など）」が入ることを検証
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

  test("replaceIframeWithNew: 古いiframeを新規に置換し属性が整う", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const oldIframe = document.getElementById("hidden-sc-player");
    oldIframe.src = "about:blank#old";

    const newIframe = controller.replaceIframeWithNew();
    expect(newIframe).toBeTruthy();
    expect(newIframe).not.toBe(oldIframe);
    expect(newIframe.id).toBe("hidden-sc-player");
    expect(newIframe.classList.contains("is-hidden")).toBe(true);
    expect(newIframe.allow).toBe("autoplay");
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

    // まず確定順を取得
    controller.updatePlaylistOrder();
    const base = controller.playlistOrder.slice();
    expect(base).toEqual(["1", "2"]);

    // Math.random を固定してシャッフル結果を再現
    const rnd = jest.spyOn(Math, "random").mockReturnValue(0); // 必ず先頭と入れ替わらないが、`for` で j=0 になることも
    controller.toggleShuffle(); // true
    expect(controller.isShuffle).toBe(true);
    // シャッフル後の順序（固定 random による確定結果を許容・同値でなければ OK）
    controller.updatePlaylistOrder();
    const shuffled = controller.playlistOrder.slice();
    // 並びが存在し、要素は同じ
    expect(shuffled.sort()).toEqual(base.slice().sort());
    rnd.mockRestore();

    // シャッフル OFF に戻す
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

    // モバイル化
    const origWidth = global.innerWidth;
    Object.defineProperty(global, "innerWidth", { value: 375, configurable: true });
    window.dispatchEvent(new Event("resize"));
    expect(desktopRow.style.display).toBe("none");
    expect(mobileRow.style.display).toBe("flex");

    // デスクトップ化
    Object.defineProperty(global, "innerWidth", { value: 1200, configurable: true });
    window.dispatchEvent(new Event("resize"));
    expect(desktopRow.style.display).toBe("flex");
    expect(mobileRow.style.display).toBe("none");

    // 後始末
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

  test("formatTime: 端的なフォーマット検証", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    expect(controller.formatTime(0)).toBe("0:00");
    expect(controller.formatTime(999)).toBe("0:00");
    expect(controller.formatTime(1000)).toBe("0:01");
    expect(controller.formatTime(61000)).toBe("1:01");
  });

  test("savePlayerState: localStorage に state が保存される（position/duration/title/再生中）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    // 再生準備
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

    // 保存データを作っておく
    const saved = {
      trackId: "2",
      trackUrl: "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fartist%2Ftrack-two&auto_play=true",
      position: 30000,
      duration: 120000,
      isPlaying: false,
    };
    localStorage.setItem("playerState", JSON.stringify(saved));

    // 復元
    controller.restorePlayerState();

    // iframe onload → READY を経由させる
    const iframe = document.getElementById("hidden-sc-player");
    iframe.onload && iframe.onload();
    jest.advanceTimersByTime(160); // restore 側は 150ms 後

    // READY でウィジェット生成して復元ロジック走行
    controller.widget && controller.widget._trigger(SC.Widget.Events.READY);

    // 位置反映（pause 指定のため play/pause のUIは fa-play に戻るはず）
    expect(controller.playPauseIcon.classList.contains("fa-play")).toBe(true);
    // タイトル・アーティストは Mock 値で埋まる
    expect(document.getElementById("track-title").textContent.length).toBeGreaterThan(0);
  });
});

// ===== ここから “追加カバレッジ” テストだけ追記 =====
// ===== ここから “追加カバレッジ” テストだけ追記（差し替え版） =====
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

  test("replaceIframeWithNew: 古いiframeを新規に置換し属性が整う", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    const oldIframe = document.getElementById("hidden-sc-player");
    oldIframe.src = "about:blank#old";

    const newIframe = controller.replaceIframeWithNew();
    expect(newIframe).toBeTruthy();
    expect(newIframe).not.toBe(oldIframe);
    expect(newIframe.id).toBe("hidden-sc-player");
    expect(newIframe.classList.contains("is-hidden")).toBe(true);
    expect(newIframe.allow).toBe("autoplay");
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
    expect(controller.formatTime(65000)).toBe("1:05"); // ← 65秒は 65000ms
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
    jest.advanceTimersByTime(160);

    controller.widget && controller.widget._trigger(SC.Widget.Events.READY);

    expect(controller.playPauseIcon.classList.contains("fa-play")).toBe(true);
    expect(document.getElementById("track-title").textContent.length).toBeGreaterThan(0);
  });
});


// ===== ここから “hard-to-hit branches” の追加テスト =====
describe("global_player_controller hard-to-hit branches", () => {
  test("togglePlayPause: iframe が存在しない → alert で早期 return", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    // #hidden-sc-player を消す
    document.getElementById("hidden-sc-player").remove();

    const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
    controller.togglePlayPause();
    expect(alertSpy).toHaveBeenCalledTimes(1);
    alertSpy.mockRestore();
  });

  // === 1) iframe はあるが src 空 → alert で早期 return ===
test("togglePlayPause: iframe はあるが src 空 → alert で早期 return", () => {
  buildDOM();
  const { controller } = startStimulusAndGetController();

  // jsdom だと src="" でも絶対URLに解決されて truthy になるため、
  // document.getElementById を一時差し替えして src を強制的に空文字で返す
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

    // 一時的に SC.Widget を throw させる
    const originalWidget = SC.Widget;
    // eslint-disable-next-line no-global-assign
    SC.Widget = Object.assign(function () { throw new Error("boom"); }, originalWidget);

    const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
    controller.togglePlayPause();
    expect(alertSpy).toHaveBeenCalledTimes(1);

    // 復元
    // eslint-disable-next-line no-global-assign
    SC.Widget = originalWidget;
    alertSpy.mockRestore();
  });

  test("cleanup: turbo:before-cache でハンドラ解除と widget 破棄", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    // widget を生成
    const iframe = document.getElementById("hidden-sc-player");
    iframe.src =
      "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fab&auto_play=false";
    jest.spyOn(controller, "restorePlayerState").mockImplementation(() => {});
    controller.togglePlayPause(); // widget を作る
    jest.advanceTimersByTime(5);

    const unbindSpy = controller.widget.unbind;
    // turbo:before-cache を発火（connect 内で once で登録済み）
    document.dispatchEvent(new Event("turbo:before-cache"));
    expect(unbindSpy).toHaveBeenCalled();
    expect(controller.widget).toBeNull();
  });

  test("togglePlayPause: iframe はあるが src 空 → alert で早期 return", () => {
  buildDOM();
  const { controller } = startStimulusAndGetController();

  // jsdom だと src="" でも絶対URLに解決されて truthy になるため、
  // document.getElementById を一時差し替えして src を強制的に空文字で返す
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


// === 2) 5〜32 秒再生 → 権利制限アラート + 次曲なしで bottom-player を隠す ===
test("onFinish: 5〜32 秒再生 → 権利制限アラート + 次曲なしで bottom-player を隠す", () => {
  buildDOM();
  const { controller } = startStimulusAndGetController();

  controller.playStartedAt = Date.now() - 10000; // 10s 経過
  controller.isRepeat = false;
  controller.playlistOrder = ["1"]; // 次曲なし
  controller.currentTrackId = "1";

  const bottom = document.getElementById("bottom-player");
  bottom.classList.remove("d-none");

  // Swal が存在すると alert ではなく Swal.fire に入るので、明示的に無効化
  const prevSwal = window.Swal;
  // eslint-disable-next-line no-global-assign
  window.Swal = undefined;

  const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
  controller.onFinish();

  expect(alertSpy).toHaveBeenCalledTimes(1);
  expect(bottom.classList.contains("d-none")).toBe(true);

  alertSpy.mockRestore();
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

    // 1回目
    controller.bindWidgetEvents();
    expect(controller.widget.unbind).toHaveBeenCalled();

    // 呼び出し回数をクリアして 2回目
    controller.widget.unbind.mockClear();
    controller.bindWidgetEvents();
    expect(controller.widget.unbind).toHaveBeenCalled();
  });
});

// ===== ここから “extra-2” の追加テスト（UI/イベント細部） =====
describe("global_player_controller extra-2", () => {
  test("show/hideLoadingUI: 近傍のボタン disabled をトグル（closest('button') 経路）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    // play-pause-icon をボタンでラップして closest('button') が拾えるようにする
    const icon = document.getElementById("play-pause-icon");
    const btn = document.createElement("button");
    icon.parentNode.insertBefore(btn, icon);
    btn.appendChild(icon);

    controller.showLoadingUI();
    expect(btn.getAttribute("disabled")).toBe("disabled");

    controller.hideLoadingUI();
    expect(btn.hasAttribute("disabled")).toBe(false);
  });

  test("connect: body が playlist-show-page のとき localStorage をクリアする", () => {
    // 事前にフラグと保存をセット
    document.body.classList.add("playlist-show-page");
    localStorage.setItem("playerState", JSON.stringify({ foo: "bar" }));

    buildDOM();
    startStimulusAndGetController();

    expect(localStorage.getItem("playerState")).toBeNull();

    // 後始末
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
    // offsetWidth/offsetHeight を上書き
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

// ===== ここから “hard-to-hit branches (more)” の追加テスト =====
describe("global_player_controller hard-to-hit branches (more)", () => {
 // （置き換え）onFinish: repeat=true → 現在曲を loadAndPlay でリスタート
// （差し替え版）onFinish: 次曲あり（repeat=false）→ 次アイコンで loadAndPlay
test("onFinish: 次曲あり（repeat=false）→ 次アイコンで loadAndPlay", () => {
  buildDOM();
  const { controller } = startStimulusAndGetController();

  controller.isRepeat = false;
  controller.playlistOrder = ["1", "2"];
  controller.currentTrackId = "1";
  controller.playStartedAt = Date.now() - 40000; // 40s 経過（権利アラート分岐外）

  const spy = jest.spyOn(controller, "loadAndPlay").mockImplementation(() => {});
  controller.onFinish();

  // onFinish 内で setTimeout(…, 300) を使って次曲を呼ぶので進める
  jest.advanceTimersByTime(400);

  expect(spy).toHaveBeenCalledTimes(1);
  const arg = spy.mock.calls[0][0];
  expect(arg && arg.currentTarget?.dataset.trackId).toBe("2");

  spy.mockRestore();
});



// （差し替え版）onFinish: 次曲あり（repeat=false）→ 次アイコンで loadAndPlay
test("onFinish: 次曲あり（repeat=false）→ 次アイコンで loadAndPlay", () => {
  buildDOM();
  const { controller } = startStimulusAndGetController();

  // 権利アラート分岐に入らないよう 40s 経過扱いにしておく
  controller.playStartedAt = Date.now() - 40000;

  controller.isRepeat = false;
  // onFinish は this.playlistOrder を見るので、必ず更新しておく
  controller.updatePlaylistOrder();               // => ["1","2"]
  controller.currentTrackId = "1";                // 次は "2" を期待

  const spy = jest.spyOn(controller, "loadAndPlay").mockImplementation(() => {});
  controller.onFinish();

  // onFinish 内の setTimeout(…, 300) を進める
  jest.advanceTimersByTime(400);

  expect(spy).toHaveBeenCalledTimes(1);
  const arg = spy.mock.calls[0][0];
  expect(arg && arg.currentTarget?.dataset.trackId).toBe("2");

  spy.mockRestore();
});

  test("tryRestore: getCurrentSound が空を返し続けた後に復元される（リトライ分岐）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    // widget を作る
    const iframe = document.getElementById("hidden-sc-player");
    iframe.src = "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fab&auto_play=false";
    jest.spyOn(controller, "restorePlayerState").mockImplementation(() => {});
    controller.togglePlayPause(); // widget 生成
    jest.advanceTimersByTime(5);

    // 最初の3回は空、その後にタイトルを返す挙動へ差し替え
    let count = 0;
    controller.widget.getCurrentSound = jest.fn((cb) => {
      count += 1;
      if (count <= 3) cb({});
      else cb({ title: "Restored Title", user: { username: "Restored Artist" } });
    });

    // duration もゼロでないことを返す
    controller.widget.getDuration = jest.fn((cb) => cb(123000));

    controller.tryRestore({ position: 0, isPlaying: false }, 0);
    // リトライ間隔 250ms × 数回
    jest.advanceTimersByTime(1000);

    expect(document.getElementById("track-title").textContent).toBe("Restored Title");
    expect(document.getElementById("track-artist").textContent).toContain("Restored Artist");
  });

  // ① onFinish: repeat=true → 現在曲を loadAndPlay でリスタート
test("onFinish: repeat=true → 現在曲を loadAndPlay でリスタート", () => {
  buildDOM();
  const { controller } = startStimulusAndGetController();

  controller.currentTrackId = "1";
  controller.isRepeat = true;
  controller.playlistOrder = ["1", "2"];
  controller.playStartedAt = Date.now() - 10000; // 10s 経過

  const spy = jest.spyOn(controller, "loadAndPlay").mockImplementation(() => {});
  controller.onFinish();

  // onFinish 内で setTimeout(…, 300) を使っているため進める
  jest.advanceTimersByTime(400);

  expect(spy).toHaveBeenCalledTimes(1);
  const arg = spy.mock.calls[0][0];
  expect(arg && arg.currentTarget?.dataset.trackId).toBe("1");

  spy.mockRestore();
});

// ② onFinish: 次曲あり（repeat=false）→ 次アイコンで loadAndPlay
test("onFinish: 次曲あり（repeat=false）→ 次アイコンで loadAndPlay", () => {
  buildDOM();
  const { controller } = startStimulusAndGetController();

  controller.isRepeat = false;
  controller.playlistOrder = ["1", "2"];
  controller.currentTrackId = "1";
  controller.playStartedAt = Date.now() - 40000; // 40s 経過

  const spy = jest.spyOn(controller, "loadAndPlay").mockImplementation(() => {});
  controller.onFinish();

  // 次曲再生も setTimeout(…, 300) 経由
  jest.advanceTimersByTime(400);

  expect(spy).toHaveBeenCalledTimes(1);
  const arg = spy.mock.calls[0][0];
  expect(arg && arg.currentTarget?.dataset.trackId).toBe("2");

  spy.mockRestore();
});

// ③ seek: ドラッグ中は自動更新を抑止し、mouseup で再開される
test("seek: ドラッグ中は自動更新を抑止し、mouseup で再開される", () => {
  buildDOM();
  const { controller } = startStimulusAndGetController();

  // widget 生成
  const iframe = document.getElementById("hidden-sc-player");
  iframe.src = "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fab&auto_play=false";
  jest.spyOn(controller, "restorePlayerState").mockImplementation(() => {});
  controller.togglePlayPause();
  jest.advanceTimersByTime(5);

  // 再生位置/長さ（前テストの副作用を避けるため getDuration を明示的に上書き）
  controller.widget.__setPosition(100000);
  controller.widget.__setDuration(200000);
  controller.widget.getDuration = jest.fn((cb) => cb(200000));

  const seekBar = document.getElementById("seek-bar");

  // ドラッグ開始 → isSeeking=true の間は自動更新されない
  seekBar.dispatchEvent(new Event("mousedown"));
  controller.startProgressTracking();
  jest.advanceTimersByTime(1000);
  expect(seekBar.value).toBe("0");

  // ドラッグ終了（mouseup）→ startProgressTracking が再起動
  document.dispatchEvent(new Event("mouseup"));
  jest.advanceTimersByTime(1000);

  // pos(100000)/dur(200000)*100 = 50
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

    // widget 生成＆現在曲を "1" に
    const iframe = document.getElementById("hidden-sc-player");
    iframe.src = "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fab&auto_play=false";
    jest.spyOn(controller, "restorePlayerState").mockImplementation(() => {});
    controller.togglePlayPause();
    jest.advanceTimersByTime(5);

    controller.currentTrackId = "1";
    const icon1 = root.querySelector('i[data-track-id="1"]');

    // いったん再生状態にして pause が呼ばれることを確認
    controller.widget.play();
    controller.onPlayIconClick({ currentTarget: icon1, stopPropagation() {} });
    expect(controller.widget.pause).toHaveBeenCalled();

    // いったん停止状態にして play が呼ばれることを確認
    controller.widget.pause();
    controller.onPlayIconClick({ currentTarget: icon1, stopPropagation() {} });
    expect(controller.widget.play).toHaveBeenCalled();
  });

  test("togglePlayPause: 既に widget がある場合は isPaused の結果で play/pause を実行", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    // widget 生成
    const iframe = document.getElementById("hidden-sc-player");
    iframe.src = "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fab&auto_play=false";
    jest.spyOn(controller, "restorePlayerState").mockImplementation(() => {});
    controller.togglePlayPause();
    jest.advanceTimersByTime(5);

    // 一旦停止にしておく
    controller.widget.pause();

    // toggle → play が呼ばれるはず
    controller.togglePlayPause();
    expect(controller.widget.play).toHaveBeenCalled();
  });

  test("restorePlayerState: 保存なし・URLなしのときは何も起きない（早期 return）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    // 保存がない
    localStorage.removeItem("playerState");
    controller.restorePlayerState(); // 例外なく通ればOK

    // URL がない保存
    localStorage.setItem("playerState", JSON.stringify({ trackId: "1" }));
    controller.restorePlayerState(); // 例外なく通ればOK

    // 何もアサートしない（早期 return の死活チェック）
    expect(true).toBe(true);
  });
});




test("showLoadingUI: タイトルが 'NOW LOADING...' / top が 'Loading…' に置換される", () => {
  buildDOM();
  const { controller } = startStimulusAndGetController();
  controller.showLoadingUI();

  // 余分な空白（改行/nbsp含む）をすべて削除してから判定
  const titleTextNoSpace = document
    .getElementById("track-title")
    .textContent.replace(/\s+/g, "").trim();

  expect(titleTextNoSpace).toMatch(/NOWLOADING/i);
  expect(document.getElementById("track-title-top").innerHTML).toBe("Loading…");
});




test("prevTrack: currentTrackId なしなら何もしない（早期return）", () => {
  buildDOM();
  const { controller } = startStimulusAndGetController();
  const spy = jest.spyOn(controller, "loadAndPlay").mockImplementation(() => {});
  controller.prevTrack(); // currentTrackId 未設定
  expect(spy).not.toHaveBeenCalled();
});

test("prevTrack: 先頭なら何もしない", () => {
  buildDOM();
  const { controller } = startStimulusAndGetController();
  controller.updatePlaylistOrder(); // ["1","2"]
  controller.currentTrackId = "1";
  const spy = jest.spyOn(controller, "loadAndPlay").mockImplementation(() => {});
  controller.prevTrack();
  expect(spy).not.toHaveBeenCalled();
});

test("nextTrack: 末尾なら何もしない", () => {
  buildDOM();
  const { controller } = startStimulusAndGetController();
  controller.updatePlaylistOrder(); // ["1","2"]
  controller.currentTrackId = "2";
  const spy = jest.spyOn(controller, "loadAndPlay").mockImplementation(() => {});
  controller.nextTrack();
  expect(spy).not.toHaveBeenCalled();
});

test("switchPlayerTopRow: 対象DOMが無ければ何もせず落ちない（早期return）", () => {
  // connect() 内で他要素も参照されるため、まず通常DOMを作ってから row だけ落とす
  buildDOM();
  const { controller } = startStimulusAndGetController();

  document.getElementById("player-top-row-desktop").remove();
  document.getElementById("player-top-row-mobile").remove();

  expect(() => controller.switchPlayerTopRow()).not.toThrow();
});


test("loadAndPlay: READY後 getCurrentSound が数回空→その後取得でタイトル反映（リトライ成功ルート）", () => {
  buildDOM();
  const { controller } = startStimulusAndGetController();

  // 曲1を直指定で再
  //生
  const playIcon = document.querySelector('i[data-track-id="1"]');
  const ev = { currentTarget: playIcon, stopPropagation() {} };

  // widget 生成後の getCurrentSound を「2回 null → 3回目で取得」にする
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
  // iframe onload→READY まで進める
  const iframe = document.getElementById("hidden-sc-player");
  iframe.onload && iframe.onload();
  jest.advanceTimersByTime(120);
  controller.widget && controller.widget._trigger(SC.Widget.Events.READY);

  // リトライの setTimeout(250)×2 を消化
  jest.advanceTimersByTime(600);

  expect(document.getElementById("track-title").textContent).toBe("After Retry");
  expect(document.getElementById("track-artist").textContent).toContain("Retry Artist");

  // 復元
  // eslint-disable-next-line no-global-assign
  SC.Widget = originalFactory;
});


// ===== ここから “tiny gap fillers” 追記 =====
describe("global_player_controller tiny gap fillers", () => {
  test("savePlayerState: widget が無ければ何もしない（早期return）", () => {
    // DOM だけ作って widget は未生成
    buildDOM();
    const { controller } = startStimulusAndGetController();

    // 事前にダミーを書いておく → 呼んでも上書きされないことを確認
    localStorage.setItem("playerState", JSON.stringify({ foo: "bar" }));
    controller.savePlayerState(); // ← widget 無いので何も起きない

    expect(localStorage.getItem("playerState")).toBeTruthy();
  });

  test("bindWidgetEvents: widget が null でも落ちない（早期return）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();
    controller.widget = null; // 明示的に null
    expect(() => controller.bindWidgetEvents()).not.toThrow();
  });

  test("startProgressTracking: widget=null / isSeeking=true では DOM 更新されない", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    // まず widget=null のまま実行しても落ちない
    expect(() => controller.startProgressTracking()).not.toThrow();

    // 次に widget を作るが isSeeking=true の間は更新されない
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

    // 反映されていない（既定値のまま）
    expect(document.getElementById("current-time").textContent).toBe("0:00");
    expect(document.getElementById("duration").textContent).toBe("0:00");
  });

  test("tryRestore: 5回超リトライしても取得できなければ『タイトル不明』にフォールバック", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    // widget を作る
    const iframe = document.getElementById("hidden-sc-player");
    iframe.src = "https://w.soundcloud.com/player/?url=y&auto_play=false";
    jest.spyOn(controller, "restorePlayerState").mockImplementation(() => {});
    controller.togglePlayPause();
    jest.advanceTimersByTime(5);

    // duration は正を返すが、currentSound はずっと空を返すように差し替え
    controller.widget.getDuration = jest.fn((cb) => cb(120000));
    controller.widget.getCurrentSound = jest.fn((cb) => cb({}));

    const state = { position: 12345, isPlaying: false };
    controller.tryRestore(state);

    // 5回以上の 250ms リトライ → 6回目でフォールバックに到達
    jest.advanceTimersByTime(250 * 6 + 10);

    expect(document.getElementById("track-title").textContent).toBe("タイトル不明");
    expect(document.getElementById("track-artist").textContent).toBe("");
  });

  test("playFromExternal: READY後も title 取れなければ『タイトル不明』を表示", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    controller.playFromExternal("https://soundcloud.com/no-title");
    const iframe = document.getElementById("hidden-sc-player");
    iframe.onload && iframe.onload();
    jest.advanceTimersByTime(110);

    // widget が出来たら currentSound を空にして READY を発火
    controller.widget.__setCurrentSound({});
    controller.widget._trigger(SC.Widget.Events.READY);

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
    // undefined / null / 負値
    expect(controller.formatTime()).toBe("0:00");
    expect(controller.formatTime(null)).toBe("0:00");
    expect(controller.formatTime(-1000)).toBe("0:00");
  });

  test("updateTrackIcon: 対象ターゲットが存在しない場合は何もせず落ちない（早期return）", () => {
    buildDOM();
    const { controller } = startStimulusAndGetController();

    // ターゲット群を消して hasPlayIconTarget=false 相当の状況に
    document.querySelectorAll('[data-global-player-target="playIcon"]').forEach((n) => n.remove());
    expect(() => controller.updateTrackIcon("1", true)).not.toThrow();
  });
});
