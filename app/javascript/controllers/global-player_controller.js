/* eslint-env browser */
/* global SC, Swal */

/**
 * @typedef {{
 *   bind: (event:string, handler:Function) => void,
 *   unbind: (event:string) => void,
 *   load: (url:string, opts?:Record<string, any>) => void,
 *   play: () => void,
 *   pause: () => void,
 *   isPaused: (cb:(paused:boolean)=>void) => void,
 *   getDuration: (cb:(ms:number)=>void) => void,
 *   getPosition: (cb:(ms:number)=>void) => void,
 *   getCurrentSound: (cb:(sound?:{ title?:string, user?:{ username?:string } })=>void) => void,
 *   seekTo: (ms:number) => void,
 *   setVolume: (pct:number) => void
 * }} SCWidget
 * @typedef {{ trackId:string|null, trackUrl?:string, position:number, duration:number, isPlaying:boolean }} PlayerState
 */

// app/javascript/controllers/global_player_controller.js
import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["trackImage", "playIcon"];

  // ===== ユーティリティ =====
  _q(sel, root = null) { return (root || this.element || document).querySelector(sel); }
  _qa(sel, root = null) { return Array.from((root || this.element || document).querySelectorAll(sel)); }
  _container() { return this.element || this._q(".playlist-container") || document; }

  _hideScreenCover() {
    try {
      const cover = document.getElementById("screen-cover-loading");
      if (cover) { cover.style.display = "none"; cover.setAttribute("aria-hidden", "true"); }
    } catch (_) {}
  }

  _safeNukeIframe(iframe) {
    try {
      if (!iframe) return;
      iframe.src = "about:blank";
      iframe.removeAttribute("src");
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    } catch (_) {}
  }

  _applySoundMetadata(sound) {
    if (sound?.title) {
      this.setTrackTitle(sound.title);
      const artist = sound.user?.username ? `— ${sound.user.username}` : "";
      this.setArtist(artist);
    } else {
      this.setTrackTitle("タイトル不明");
      this.setArtist("");
    }
    this.hideLoadingUI();
  }

  unbindWidgetEvents() {
    if (!this.widget) return;
    try {
      this.widget.unbind(SC.Widget.Events.PLAY);
      this.widget.unbind(SC.Widget.Events.PAUSE);
      this.widget.unbind(SC.Widget.Events.FINISH);
      this.widget.unbind(SC.Widget.Events.READY);
    } catch (_) {}
  }

  isIOS() {
    try {
      return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    } catch (_) {
      return false;
    }
  }

  /**
   * iOSの「ユーザー操作内のみ再生可」を一度だけ解錠する
   * - UIは変更しない
   * - 二重実行防止
   */
  primeSoundCloudOnce = (firstUrl) => {
    return new Promise((resolve) => {
      if (!this.isIOS() || window.__scPrimed) return resolve(true);

      const finish = () => { window.__scPrimed = true; resolve(true); };

      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          gain.gain.value = 0.0001;
          osc.connect(gain).connect(ctx.destination);
          osc.start(0);
          setTimeout(() => { try { osc.stop(); ctx.close(); } catch (_) {} finish(); }, 50);
          return;
        }
      } catch (_) {}

      try {
        // 最終フォールバック（ミュートの<video>を瞬間再生）
        const v = document.createElement("video");
        v.muted = true; v.playsInline = true; v.setAttribute("playsinline", "");
        v.style.position = "absolute"; v.style.left = "-9999px"; v.width = 1; v.height = 1;
        const src = document.createElement("source");
        src.src = "data:video/mp4;base64,";
        v.appendChild(src);
        document.body.appendChild(v);
        const p = v.play();
        if (p && typeof p.then === "function") {
          p.then(() => { v.pause(); v.remove(); finish(); }).catch(() => { v.remove(); finish(); });
        } else { v.remove(); finish(); }
      } catch (_) { finish(); }
    });
  };

  cleanup = () => {
    clearInterval(this.progressInterval);
    try {
      this.seekBar?.removeEventListener("input", this._onSeekInput);
      this.volumeBar?.removeEventListener("input", this._onVolumeInput);
      this._prevBtn?.removeEventListener("click", this._onPrevClick);
      this._nextBtn?.removeEventListener("click", this._onNextClick);
      this._container()?.removeEventListener("click", this._onIconClickDelegated);
      document.removeEventListener("mouseup", this._onMouseUpSeek);
    } catch (_) {}

    if (this.widget) {
      this.unbindWidgetEvents();
      this.widget = null;
    }

    try {
      const old = document.getElementById("hidden-sc-player");
      this._safeNukeIframe(old);
      this.iframeElement = null;
    } catch (_) {}

    try {
      document.removeEventListener("turbo:render", this._updatePlayButton);
      document.removeEventListener("turbo:frame-load", this._updatePlayButton);
      document.removeEventListener("turbo:submit-end", this._updatePlayButton);
      this._footerGuardMO?.disconnect();
      this._footerGuardMO = null;
    } catch (_) {}
  };

  setArtist(text) {
    this.trackArtistEl && (this.trackArtistEl.textContent = text);
    const mobile = document.getElementById("track-artist-mobile");
    mobile && (mobile.textContent = text);
  }

  connect() {
    document.addEventListener("turbo:before-cache", this.cleanup, { once: true });

    // showページでキャッシュリセット（既存仕様維持）
    if (document.body.classList.contains("playlist-show-page")) {
      localStorage.removeItem("playerState");
    }

    // 各種要素
    this.iframeElement   = document.getElementById("hidden-sc-player");
    this.bottomPlayer    = document.getElementById("bottom-player");
    this.playPauseButton = document.getElementById("play-pause-button");
    this.playPauseIcon   = document.getElementById("play-pause-icon");
    this.trackTitleEl    = document.getElementById("track-title");
    this.trackTitleTopEl = document.getElementById("track-title-top");
    this.trackArtistEl   = document.getElementById("track-artist");
    this.seekBar         = document.getElementById("seek-bar");
    this.currentTimeEl   = document.getElementById("current-time");
    this.durationEl      = document.getElementById("duration");
    this.volumeBar       = document.getElementById("volume-bar");
    this.loadingArea     = document.getElementById("loading-spinner");
    this.neonCharacter   = document.querySelector(".neon-character-spinbox");

    this.currentTrackId   = null;
    /** @type {SCWidget|null} */
    this.widget           = null;
    this.progressInterval = null;
    this.isSeeking        = false;
    this.playStartedAt    = null;

    this.isRepeat  = false;
    this.isShuffle = false;

    this.updatePlaylistOrder();

    // 波形（既存）
    this.waveformCanvas  = document.getElementById("waveform-anime");
    this.waveformCtx     = this.waveformCanvas?.getContext("2d");
    this.waveformAnimating = false;

    // シークバーのドラッグ制御（既存）
    this._onMouseUpSeek = () => {
      if (this.isSeeking) { this.isSeeking = false; this.startProgressTracking(); }
    };
    this.seekBar?.addEventListener("mousedown", () => {
      this.isSeeking = true;
      clearInterval(this.progressInterval);
    });
    document.addEventListener("mouseup", this._onMouseUpSeek);

    // 保険ハンドラ（既存）
    this._onSeekInput   = (e) => this.seek(e);
    this._onVolumeInput = (e) => this.changeVolume(e);
    this._onPrevClick   = (e) => this.prevTrack(e);
    this._onNextClick   = (e) => this.nextTrack(e);

    this.seekBar?.addEventListener("input", this._onSeekInput);
    this.volumeBar?.addEventListener("input", this._onVolumeInput);

    this._prevBtn = document.getElementById("prev-track-button");
    this._nextBtn = document.getElementById("next-track-button");
    this._prevBtn?.addEventListener("click", this._onPrevClick);
    this._nextBtn?.addEventListener("click", this._onNextClick);

    // タイル画像/再生アイコンのイベント委譲（既存）
    this._onIconClickDelegated = (e) => {
      const target = e.target.closest("[data-track-id]");
      if (!target) return;
      if (
        target.matches('[data-global-player-target="playIcon"], .play-overlay-icon') ||
        target.classList.contains("fa") ||
        target.dataset.playUrl
      ) {
        if (target.dataset.trackId && !target.dataset.playUrl) {
          this.onPlayIconClick({ currentTarget: target, stopPropagation() {} });
        } else {
          this.loadAndPlay({ currentTarget: target, stopPropagation() {} });
        }
      }
    };
    this._container()?.addEventListener("click", this._onIconClickDelegated);

    // 外部検索から再生（既存）
    window.addEventListener("play-from-search", (e) => {
      const { playUrl } = e.detail;
      this.playFromExternal(playUrl);
    });

    // レイアウト（既存）
    this.switchPlayerTopRow();
    window.addEventListener("resize", () => {
      this.switchPlayerTopRow();
      if (this.waveformCanvas) {
        this.waveformCanvas.width  = this.waveformCanvas.offsetWidth;
        this.waveformCanvas.height = this.waveformCanvas.offsetHeight;
      }
    });

    // 初期の見た目をフラグと同期（既存）
    const shuffleBtn = document.getElementById("shuffle-button");
    if (shuffleBtn) {
      shuffleBtn.classList.toggle("active", this.isShuffle);
      shuffleBtn.setAttribute("aria-pressed", String(this.isShuffle));
    }
    const repeatBtn = document.getElementById("repeat-button");
    if (repeatBtn) {
      repeatBtn.classList.toggle("active", this.isRepeat);
      repeatBtn.setAttribute("aria-pressed", String(this.isRepeat));
    }

    // A11y 初期ラベル（既存）
    this.setPlayPauseAria(false);
    this.updateSeekAria(0, 0, 0);
    this.updateVolumeAria(this.volumeBar?.value ?? "100");

    // フッター「再生」の活性/非活性（既存）
    this._updatePlayButton = () => {
      const btn = document.querySelector(".mobile-footer-menu .playfirst");
      if (!btn) return;
      const has = !!(this._container()?.querySelector("[data-track-id]"));
      btn.toggleAttribute("disabled", !has);
      btn.setAttribute("aria-disabled", String(!has));
      btn.classList.toggle("is-disabled", !has);
    };
    document.addEventListener("turbo:render", this._updatePlayButton);
    document.addEventListener("turbo:frame-load", this._updatePlayButton);
    document.addEventListener("turbo:submit-end", this._updatePlayButton);
    this._footerGuardMO = new MutationObserver(() => queueMicrotask(this._updatePlayButton));
    this._footerGuardMO.observe(this._container() || document, { childList: true, subtree: true });
    this._updatePlayButton();

    // ★ 常駐 iframe & widget 初期化（ここが今回の要）
    this.iframeElement = this.iframeElement || this.replaceIframeWithNew();
    const baseSrc = "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fsoundcloud%2Flikes&auto_play=false&visual=false&show_teaser=false";
    this.iframeElement.src = baseSrc;
    this.iframeElement.onload = () => {
      try {
        this.widget = SC.Widget(this.iframeElement);
        this.bindWidgetEvents();
      } catch (_) {}
    };

    // 既存の復元（※widget準備後でも先でもOK。READY待ちで再試行するため）
    this.restorePlayerState();

    console.log("[connect] global-player controller initialized");
  }

  // ---------- A11y ----------
  setPlayPauseAria(isPlaying) {
    if (!this.playPauseButton) return;
    this.playPauseButton.setAttribute("aria-label", isPlaying ? "一時停止" : "再生");
  }

  updateSeekAria(percent, posMs, durMs) {
    if (!this.seekBar) return;
    const p = Math.max(0, Math.min(100, Math.round(percent)));
    this.seekBar.setAttribute("aria-valuenow", String(p));
    const current = this.formatTime(posMs);
    const total   = this.formatTime(durMs);
    this.seekBar.setAttribute("aria-valuetext", durMs ? `${current} / ${total}` : current);
  }

  updateVolumeAria(valueStr) {
    if (!this.volumeBar) return;
    const v = String(valueStr);
    this.volumeBar.setAttribute("aria-valuenow", v);
    this.volumeBar.setAttribute("aria-valuetext", `${v}%`);
  }

  // -------------- 状態保存 / 復元 -----------------
  savePlayerState() {
    if (!this.widget) return;
    try {
      this.widget.getPosition((pos) => {
        this.widget.getDuration((dur) => {
          const state = {
            trackId:   this.currentTrackId,
            trackUrl:  this._lastTrackUrl || this.iframeElement?.src,
            position:  pos ?? 0,
            duration:  dur ?? 0,
            isPlaying: this.playPauseIcon?.classList.contains("fa-pause"),
          };
          localStorage.setItem("playerState", JSON.stringify(state));
        });
      });
    } catch (_) {}
  }

  tryRestore(state, retry = 0) {
    if (!this.widget) return setTimeout(() => this.tryRestore(state, retry), 300);

    this.widget.getDuration((dur) => {
      if (!dur) return setTimeout(() => this.tryRestore(state, retry), 300);

      this.widget.getCurrentSound((sound) => {
        if (sound?.title) {
          this._applySoundMetadata(sound);
        } else if (retry < 5) {
          return setTimeout(() => this.tryRestore(state, retry + 1), 250);
        } else {
          this._applySoundMetadata(undefined);
        }
      });

      this.widget.seekTo(state.position || 0);
      if (!state.isPlaying) this.widget.pause();
      this.setPlayPauseAria(state.isPlaying);
      const percent = dur ? Math.round(((state.position || 0) / dur) * 100) : 0;
      this.updateSeekAria(percent, state.position || 0, dur);
    });
  }

  restorePlayerState() {
    const saved = localStorage.getItem("playerState");
    if (!saved) return;

    const state = JSON.parse(saved);
    if (!state.trackUrl) return;

    this.currentTrackId = state.trackId || null;
    this.bottomPlayer?.classList.remove("d-none");

    // widget がまだの場合に備え、遅延実行
    const doLoad = () => {
      if (!this.widget) return setTimeout(doLoad, 150);

      try {
        this.resetPlayerUI();
        this._lastTrackUrl = state.trackUrl;
        // 復元時は自動再生しない
        this.widget.load(state.trackUrl, {
          auto_play: false,
          visual: false,
          show_teaser: false,
          single_active: true,
          hide_related: true,
          show_comments: false
        });

        // READY後に各種同期
        const onReady = () => {
          try {
            this.widget.getCurrentSound((sound) => this._applySoundMetadata(sound || undefined));
            this.widget.seekTo(state.position || 0);
            state.isPlaying ? this.widget.play() : this.widget.pause();

            this.bindWidgetEvents();
            this.startProgressTracking();
            this.changeVolume({ target: this.volumeBar });

            this.updateTrackIcon(this.currentTrackId, state.isPlaying);
            this.setPlayPauseAria(state.isPlaying);
          } catch (_) {}
        };

        // READYを一度待つ（バインドがまだなら一時的に）
        try {
          this.widget.bind(SC.Widget.Events.READY, onReady);
        } catch (_) { setTimeout(onReady, 200); }
      } catch (_) {
        setTimeout(doLoad, 200);
      }
    };
    doLoad();
  }

  setTrackTitle(title) {
    this.trackTitleEl    && (this.trackTitleEl.textContent    = title);
    this.trackTitleTopEl && (this.trackTitleTopEl.textContent = title);
  }

  // -------------- iframe（常駐・非display:none） -----------------
  replaceIframeWithNew() {
    const oldIframe = document.getElementById("hidden-sc-player");
    const parent =
      (oldIframe && oldIframe.parentNode) ||
      (this.bottomPlayer && this.bottomPlayer.parentNode) ||
      document.body;

    if (oldIframe) { this._safeNukeIframe(oldIframe); }

    const ifr = document.createElement("iframe");
    ifr.id = "hidden-sc-player";

    // ★ display:none は使わない（iOSが再生を止めやすい）
    // 見えないけど“表示状態”に置く
    ifr.style.position = "absolute";
    ifr.style.left = "-9999px";
    ifr.style.width = "1px";
    ifr.style.height = "1px";
    ifr.style.opacity = "0";
    ifr.style.pointerEvents = "none";

    ifr.allow = "autoplay; encrypted-media";
    ifr.setAttribute("playsinline", "");
    ifr.setAttribute("webkit-playsinline", "");
    ifr.frameBorder = "no";
    ifr.scrolling = "no";
    ifr.width = "100%";
    ifr.height = "166";

    parent.appendChild(ifr);
    return ifr;
  }

  // -------------- UI 表示 -----------------
  showLoadingUI() {
    this.playPauseIcon?.classList.add("is-hidden");
    this.playPauseButton?.setAttribute("disabled", "disabled");
    this.playPauseButton?.setAttribute("aria-disabled", "true");
    this.bottomPlayer?.setAttribute("aria-busy", "true");
    this.loadingArea?.classList.remove("is-hidden");
    this.neonCharacter?.classList.remove("is-hidden");

    if (this.trackTitleEl) {
      this.trackTitleEl.innerHTML = `
        <span class="neon-wave">
          <span>N</span><span>O</span><span>W</span>
          <span>&nbsp;</span>
          <span>L</span><span>O</span><span>A</span><span>D</span>
          <span>I</span><span>N</span><span>G</span>
          <span>.</span><span>.</span><span>.</span>
        </span>`;
      this.trackTitleEl.classList.remove("is-hidden");
    }
    this.trackTitleTopEl && (this.trackTitleTopEl.innerHTML = "Loading…");
    this.trackArtistEl && this.trackArtistEl.classList.add("is-hidden");
  }

  hideLoadingUI() {
    this.playPauseIcon?.classList.remove("is-hidden");
    this.playPauseButton?.removeAttribute("disabled");
    this.playPauseButton?.setAttribute("aria-disabled", "false");
    this.bottomPlayer?.setAttribute("aria-busy", "false");
    this.loadingArea?.classList.add("is-hidden");
    this.neonCharacter?.classList.add("is-hidden");
    this.trackTitleEl?.classList.remove("is-hidden");
    this.trackTitleTopEl?.classList.remove("is-hidden");
    this.trackArtistEl?.classList.remove("is-hidden");
    this._hideScreenCover();
  }

  resetPlayerUI() {
    this.currentTimeEl && (this.currentTimeEl.textContent = "0:00");
    this.durationEl && (this.durationEl.textContent = "0:00");
    this.seekBar && (this.seekBar.value = 0);
    this.updateSeekAria(0, 0, 0);

    if (this.hasPlayIconTarget) {
      this.playIconTargets.forEach((icn) => {
        icn.classList.add("fa-play");
        icn.classList.remove("fa-pause");
      });
    }
    this.playPauseIcon?.classList.add("fa-play");
    this.playPauseIcon?.classList.remove("fa-pause");
    this.setPlayPauseAria(false);
    this.showLoadingUI();
  }

  // -------------- トラック再生（widget.load方式） -----------------
  loadAndPlay(event) {
    event?.stopPropagation?.();
    this.updatePlaylistOrder();

    const el = event?.currentTarget;
    const newTrackId = el?.dataset?.trackId;
    let trackUrl = el?.dataset?.playUrl;

    if (!trackUrl && newTrackId) {
      const img = this.trackImageTargets.find((t) => t.dataset.trackId == newTrackId);
      trackUrl = img?.dataset.playUrl;
    }
    if (!trackUrl && newTrackId) {
      const node = this._q(`[data-track-id="${CSS.escape(String(newTrackId))}"][data-play-url]`, this._container());
      trackUrl = node?.dataset?.playUrl;
    }
    if (!trackUrl) return;

    // iOS 初回はプライム（ユーザーのタップ中に呼ばれる想定）
    const doPlay = () => {
      this.resetPlayerUI();
      this.bottomPlayer?.classList.remove("d-none");
      this.currentTrackId = newTrackId || null;
      this._lastTrackUrl = trackUrl;

      const ensure = () => {
        if (!this.widget) return setTimeout(ensure, 120);
        try {
          this.widget.load(trackUrl, {
            auto_play: true,
            visual: false,
            show_teaser: false,
            single_active: true,
            buying: false,
            liking: false,
            download: false,
            sharing: false,
            show_comments: false,
            hide_related: true
          });
          this.startProgressTracking();
          this.changeVolume({ target: this.volumeBar });
          this.updateTrackIcon(this.currentTrackId, true);
          this.setPlayPauseAria(true);
          this.savePlayerState();
        } catch (_) { setTimeout(ensure, 120); }
      };
      ensure();
    };

    if (this.isIOS() && !window.__scPrimed) {
      this.primeSoundCloudOnce(trackUrl).then(doPlay);
    } else {
      doPlay();
    }
  }

  // -------------- 外部 URL 再生（widget.load方式） -----------------
  playFromExternal(playUrl) {
    const doPlay = () => {
      this.bottomPlayer?.classList.remove("d-none");
      this.bottomPlayer?.offsetHeight;

      this._lastTrackUrl = playUrl;

      const ensure = () => {
        if (!this.widget) return setTimeout(ensure, 120);
        try {
          this.widget.load(playUrl, {
            auto_play: true,
            visual: false,
            show_teaser: false,
            single_active: true,
            buying: false,
            liking: false,
            download: false,
            sharing: false,
            show_comments: false,
            hide_related: true
          });
          this.resetPlayerUI();
          this.bindWidgetEvents();
          this.startProgressTracking();
          this.changeVolume({ target: this.volumeBar });
          this.savePlayerState();
        } catch (_) { setTimeout(ensure, 120); }
      };

      this.iframeElement = this.iframeElement || this.replaceIframeWithNew();
      if (!this.widget) {
        try { this.widget = SC.Widget(this.iframeElement); } catch (_) {}
      }
      ensure();
    };

    if (this.isIOS() && !window.__scPrimed) {
      this.primeSoundCloudOnce(playUrl).then(doPlay);
    } else {
      doPlay();
    }
  }

  // -------------- 再生/一時停止 -----------------
  togglePlayPause(event) {
    event?.stopPropagation?.();

    const go = () => {
      if (!this.widget) {
        this.iframeElement = document.getElementById("hidden-sc-player");
        if (this.iframeElement && this.iframeElement.src && this.iframeElement.src !== "") {
          try {
            this.widget = SC.Widget(this.iframeElement);
            this.bindWidgetEvents();
            if (typeof this.restorePlayerState === "function") {
              this.restorePlayerState();
            }
          } catch (_e) {
            alert("プレイヤーの初期化に失敗しました。もう一度曲を選んでください。");
            return;
          }
        } else {
          alert("プレイヤーが初期化されていません。もう一度曲を選んでください。");
          return;
        }
      }

      this.widget.isPaused((paused) => {
        paused ? this.widget.play() : this.widget.pause();
        setTimeout(() => this.savePlayerState(), 500);
      });
    };

    if (this.isIOS() && !window.__scPrimed) {
      this.primeSoundCloudOnce(this._lastTrackUrl).then(go);
    } else {
      go();
    }
  }

  // -------------- SC Widget イベント -----------------
  onPlay = () => {
    this.playPauseIcon?.classList.replace("fa-play", "fa-pause");
    this.updateTrackIcon(this.currentTrackId, true);
    this.setPlayPauseAria(true);
    this.playStartedAt = Date.now();
    this.startWaveformAnime();

    this.widget?.getCurrentSound((sound) => {
      if (sound?.title && !this.trackTitleEl?.textContent) {
        this._applySoundMetadata(sound);
      }
    });
    this.hideLoadingUI();
    this.savePlayerState();
  };

  onPause = () => {
    this.playPauseIcon?.classList.replace("fa-pause", "fa-play");
    this.updateTrackIcon(this.currentTrackId, false);
    this.setPlayPauseAria(false);
    this.stopWaveformAnime();
    this.savePlayerState();
  };

  onFinish = () => {
    const playedMs = this.playStartedAt ? Date.now() - this.playStartedAt : 0;
    this.stopWaveformAnime();

    if (playedMs < 32000 && playedMs > 5000) {
      (window.Swal)
        ? Swal.fire({ icon: "info", title: "試聴終了", text: "この曲の視聴は30秒までです（権利制限）" })
        : alert("この曲の視聴は30秒までです（権利制限）");
    }

    this.playPauseIcon?.classList.replace("fa-pause", "fa-play");
    this.updateTrackIcon(this.currentTrackId, false);
    this.setPlayPauseAria(false);
    clearInterval(this.progressInterval);
    this.playStartedAt = null;

    if (this.isRepeat) {
      const icon = this.playIconTargets.find((icn) => icn.dataset.trackId == this.currentTrackId)
        || this._q(`[data-track-id="${CSS.escape(String(this.currentTrackId))}"]`, this._container());
      icon && setTimeout(() => this.loadAndPlay({ currentTarget: icon, stopPropagation() {} }), 300);
      return;
    }

    this.updatePlaylistOrder();
    const curIdx = this.playlistOrder.indexOf(this.currentTrackId);
    const nextId = this.playlistOrder[curIdx + 1];
    if (nextId) {
      const icon = this.playIconTargets.find((icn) => icn.dataset.trackId == nextId)
        || this._q(`[data-track-id="${CSS.escape(String(nextId))}"]`, this._container());
      icon && setTimeout(() => this.loadAndPlay({ currentTarget: icon, stopPropagation() {} }), 300);
      return;
    }

    this.bottomPlayer?.classList.add("d-none");
    this.savePlayerState();
  };

  updateTrackIcon(trackId, playing) {
    if (!this.hasPlayIconTarget) {
      this._qa('[data-track-id]', this._container()).forEach((node) => {
        if (!node.classList) return;
        if (node.dataset.trackId == trackId) {
          node.classList.toggle("fa-play", !playing);
          node.classList.toggle("fa-pause", playing);
        } else {
          node.classList.add("fa-play");
          node.classList.remove("fa-pause");
        }
      });
      return;
    }
    this.playIconTargets.forEach((icn) => {
      if (icn.dataset.trackId == trackId) {
        icn.classList.toggle("fa-play", !playing);
        icn.classList.toggle("fa-pause", playing);
      } else {
        icn.classList.add("fa-play");
        icn.classList.remove("fa-pause");
      }
    });
  }

  bindWidgetEvents() {
    if (!this.widget) return;
    try {
      this.widget.unbind(SC.Widget.Events.PLAY);
      this.widget.unbind(SC.Widget.Events.PAUSE);
      this.widget.unbind(SC.Widget.Events.FINISH);
      this.widget.unbind(SC.Widget.Events.READY);
    } catch (_) {}
    this.widget.bind(SC.Widget.Events.READY,  () => { /* READY受信でUI更新はload側で実施 */ });
    this.widget.bind(SC.Widget.Events.PLAY,   this.onPlay);
    this.widget.bind(SC.Widget.Events.PAUSE,  this.onPause);
    this.widget.bind(SC.Widget.Events.FINISH, this.onFinish);
  }

  // ---------- 再生位置 / 時間表示 ----------
  startProgressTracking() {
    clearInterval(this.progressInterval);
    this.progressInterval = setInterval(() => {
      if (!this.widget || this.isSeeking) return;
      this.widget.getPosition((pos) => {
        this.widget.getDuration((dur) => {
          if (!dur) return;
          const percent = Math.round((pos / dur) * 100);
          if (this.seekBar) this.seekBar.value = String(percent);
          if (this.currentTimeEl) this.currentTimeEl.textContent = this.formatTime(pos);
          if (this.durationEl) this.durationEl.textContent = this.formatTime(dur);
          this.updateSeekAria(percent, pos, dur);
        });
      });
      this.savePlayerState();
    }, 1000);
  }

  formatTime(ms) {
    const n = Number(ms);
    if (!Number.isFinite(n) || n <= 0) return "0:00";
    const sec = Math.floor(n / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  // ---------- 前後トラック ----------
  prevTrack(event) {
    event?.stopPropagation?.();
    this.updatePlaylistOrder();
    if (!this.playlistOrder?.length) return;

    if (!this.currentTrackId) {
      const lastId = this.playlistOrder[this.playlistOrder.length - 1];
      const icon = this.playIconTargets.find((icn) => icn.dataset.trackId == lastId)
        || this._q(`[data-track-id="${CSS.escape(String(lastId))}"]`, this._container());
      icon && this.loadAndPlay({ currentTarget: icon, stopPropagation() {} });
      return;
    }

    const idx = this.playlistOrder.indexOf(this.currentTrackId);
    if (idx > 0) {
      const icon = this.playIconTargets.find((icn) => icn.dataset.trackId == this.playlistOrder[idx - 1])
        || this._q(`[data-track-id="${CSS.escape(String(this.playlistOrder[idx - 1]))}"]`, this._container());
      icon && this.loadAndPlay({ currentTarget: icon, stopPropagation() {} });
      return;
    }

    const lastId2 = this.playlistOrder[this.playlistOrder.length - 1];
    const icon2 = this.playIconTargets.find((icn) => icn.dataset.trackId == lastId2)
      || this._q(`[data-track-id="${CSS.escape(String(lastId2))}"]`, this._container());
    icon2 && this.loadAndPlay({ currentTarget: icon2, stopPropagation() {} });
  }

  nextTrack(event) {
    event?.stopPropagation?.();
    this.updatePlaylistOrder();
    if (!this.playlistOrder?.length) return;

    if (!this.currentTrackId) {
      const firstId = this.playlistOrder[0];
      const icon = this.playIconTargets.find((icn) => icn.dataset.trackId == firstId)
        || this._q(`[data-track-id="${CSS.escape(String(firstId))}"]`, this._container());
      icon && this.loadAndPlay({ currentTarget: icon, stopPropagation() {} });
      return;
    }

    const idx = this.playlistOrder.indexOf(this.currentTrackId);
    if (idx < this.playlistOrder.length - 1 && idx >= 0) {
      const nextId = this.playlistOrder[idx + 1];
      const icon = this.playIconTargets.find((icn) => icn.dataset.trackId == nextId)
        || this._q(`[data-track-id="${CSS.escape(String(nextId))}"]`, this._container());
      icon && this.loadAndPlay({ currentTarget: icon, stopPropagation() {} });
      return;
    }

    const firstId2 = this.playlistOrder[0];
    const icon2 = this.playIconTargets.find((icn) => icn.dataset.trackId == firstId2)
      || this._q(`[data-track-id="${CSS.escape(String(firstId2))}"]`, this._container());
    icon2 && this.loadAndPlay({ currentTarget: icon2, stopPropagation() {} });
  }

  playFirstTrack(event) {
    event?.stopPropagation?.();
    this.updatePlaylistOrder();
    if (!this.playlistOrder?.length) return;

    const firstId = this.playlistOrder[0];
    const icon = this.playIconTargets.find((icn) => icn.dataset.trackId == firstId)
      || this._q(`[data-track-id="${CSS.escape(String(firstId))}"]`, this._container());
    icon && this.loadAndPlay({ currentTarget: icon, stopPropagation() {} });
  }

  // ---------- 波形 ----------
  startWaveformAnime() {
    if (!this.waveformCtx) return;
    this.waveformAnimating = true;

    const ctx = this.waveformCtx;
    const W   = this.waveformCanvas.width;
    const H   = this.waveformCanvas.height;
    let t     = 0;

    const animate = () => {
      if (!this.waveformAnimating) return;
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.strokeStyle = "#10ffec";
      ctx.lineWidth   = 2;
      ctx.beginPath();
      for (let x = 0; x < W; x += 4) {
        const y = H / 2 + Math.sin((x + t) / 7) * (H / 2.5) * (0.7 + 0.3 * Math.sin(x / 17 + t / 13));
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
      t += 0.7;
      requestAnimationFrame(animate);
    };
    animate();
  }

  stopWaveformAnime() {
    this.waveformAnimating = false;
    this.waveformCtx && this.waveformCtx.clearRect(0, 0, this.waveformCanvas.width, this.waveformCanvas.height);
  }

  // ---------- プレイリスト順 ----------
  updatePlaylistOrder() {
    this.playlistOrder = this.trackImageTargets.map((img) => img.dataset.trackId).filter(Boolean);
    if (!this.playlistOrder.length) {
      const nodes = this._qa(".playlist-container [data-track-id][data-play-url]", this._container());
      this.playlistOrder = nodes.map((n) => String(n.dataset.trackId)).filter(Boolean);
    }
    if (this.isShuffle) this.shufflePlaylistOrder();
  }

  shufflePlaylistOrder() {
    for (let i = this.playlistOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.playlistOrder[i], this.playlistOrder[j]] = [this.playlistOrder[j], this.playlistOrder[i]];
    }
  }

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    const btn = document.getElementById("shuffle-button");
    if (btn) {
      btn.classList.toggle("active", this.isShuffle);
      btn.setAttribute("aria-pressed", String(this.isShuffle));
    }
    this.updatePlaylistOrder();
  }

  toggleRepeat() {
    this.isRepeat = !this.isRepeat;
    const btn = document.getElementById("repeat-button");
    if (btn) {
      btn.classList.toggle("active", this.isRepeat);
      btn.setAttribute("aria-pressed", String(this.isRepeat));
    }
  }

  /* レイアウト切替（既存のまま） */
  switchPlayerTopRow() {
    const isMobile  = window.innerWidth <= 768;
    const desktopRow = document.getElementById("player-top-row-desktop");
    const mobileRow  = document.getElementById("player-top-row-mobile");
    if (!desktopRow || !mobileRow) return;

    desktopRow.style.display = isMobile ? "none" : "flex";
    mobileRow.style.display  = isMobile ? "flex" : "none";
  }

  // ---------- シーク / 音量 ----------
  seek(event) {
    if (!this.widget) return;
    const raw = Number(event.target.value);
    const percent = Math.max(0, Math.min(100, Math.round(raw)));
    this.widget.getDuration((dur) => {
      if (!dur) return;
      const newMs = (percent / 100) * dur;
      this.widget.seekTo(newMs);
      this.updateSeekAria(percent, newMs, dur);
      this.savePlayerState();
    });
  }

  changeVolume(event) {
    if (!this.widget) return;
    const raw = Number(event.target.value);
    const percent = Math.max(0, Math.min(100, Math.round(raw)));
    this.widget.setVolume(percent);
    this.updateVolumeAria(String(percent));
  }

  onPlayIconClick(event) {
    event.stopPropagation();
    const icon = event.currentTarget;
    const trackId = icon.dataset.trackId;

    if (this.currentTrackId === trackId && this.widget) {
      this.widget.isPaused((paused) => { paused ? this.widget.play() : this.widget.pause(); });
      return;
    }
    this.loadAndPlay(event);
  }
}
