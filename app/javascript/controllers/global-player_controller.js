/* eslint-env browser */
/* global SC, Swal */

/**
 * @typedef {{
 *   bind: (event:string, handler:Function) => void,
 *   unbind: (event:string) => void,
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

  // ===== 共通ユーティリティ =====
  _q(sel, root = null) { return (root || this.element || document).querySelector(sel); }
  _qa(sel, root = null) { return Array.from((root || this.element || document).querySelectorAll(sel)); }
  _container() { return this.element || this._q(".playlist-container") || document; }
  _isIOS() {
    try {
      return /iPad|iPhone|iPod/.test(navigator.userAgent)
        || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    } catch { return false; }
  }
  _hideScreenCover() {
    try {
      const cover = document.getElementById("screen-cover-loading");
      if (cover) {
        cover.style.display = "none";
        cover.setAttribute("aria-hidden", "true");
      }
    } catch (_) {}
  }

  // ---- 画面内簡易ログ（Macなし用） ----
  _setupInlineLogger() {
    try {
      const params = new URLSearchParams(location.search);
      if (!params.has("iosdebug")) return;
      if (document.getElementById("ios-log")) return;

      const log = document.createElement("pre");
      log.id = "ios-log";
      Object.assign(log.style, {
        position: "fixed",
        bottom: "8px",
        left: "8px",
        right: "8px",
        maxHeight: "45vh",
        overflow: "auto",
        padding: "8px",
        background: "rgba(0,0,0,0.75)",
        color: "#0f0",
        fontSize: "12px",
        zIndex: 99999,
        border: "1px solid #0f0",
        borderRadius: "6px"
      });
      log.setAttribute("aria-live", "polite");
      log.textContent = "[iosdebug] logger ready\n";
      document.body.appendChild(log);
      this._log = (msg) => {
        const t = new Date().toLocaleTimeString();
        log.textContent += `[${t}] ${msg}\n`;
        log.scrollTop = log.scrollHeight;
      };
    } catch (_) {}
  }
  _log = (_msg) => {}; // デフォルトは無効（?iosdebug=1 で有効化）

  // === 旧 iframe を安全に破棄 ===
  _safeNukeIframe(iframe) {
    try {
      if (!iframe) return;
      iframe.src = "about:blank";
      iframe.removeAttribute("src");
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    } catch (_) {}
  }

  // === メタデータ反映共通 ===
  _applySoundMetadata(sound) {
    if (sound?.title) {
      this.setTrackTitle(sound.title);
      const artist = sound.user?.username ? `— ${sound.user.username}` : "";
      this.setArtist(artist);
      this.hideLoadingUI();
    } else {
      this.setTrackTitle("タイトル不明");
      this.setArtist("");
      this.hideLoadingUI();
    }
  }

  // === unbind 共通 ===
  unbindWidgetEvents() {
    if (!this.widget) return;
    try {
      this.widget.unbind(SC.Widget.Events.PLAY);
      this.widget.unbind(SC.Widget.Events.PAUSE);
      this.widget.unbind(SC.Widget.Events.FINISH);
    } catch (_) {}
  }

  // === iOS: オーディオ解錠 + セッション常時キープ ===
  _setupIOSAudioUnlock() {
    try {
      if (!this._isIOS()) return;
      if (window.__iosAudioUnlocked) return;

      const unlock = () => {
        if (window.__iosAudioUnlocked) return;
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) throw new Error("No AudioContext");
          // 1) 解錠用に一瞬ならす
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          gain.gain.value = 0.0001;
          osc.connect(gain).connect(ctx.destination);
          osc.start(0);
          setTimeout(() => {
            try { osc.stop(0); } catch (_) {}
            // 2) セッション常時キープ用に、別Contextを持続（極小音、実質無音）
            try {
              this._iosKeepAliveCtx = new AudioCtx();
              const o2 = this._iosKeepAliveCtx.createOscillator();
              const g2 = this._iosKeepAliveCtx.createGain();
              g2.gain.value = 0.0001;
              o2.connect(g2).connect(this._iosKeepAliveCtx.destination);
              o2.start(0);
              this._iosKeepAliveOsc = o2;
              this._iosKeepAliveGain = g2;
              this._log("iOS keep-alive started");
            } catch (_) {}
            try { ctx.close(); } catch (_) {}
            window.__iosAudioUnlocked = true;

            // 待機中なら再生を促す（既存挙動不変）
            try {
              if (this.widget && typeof this.widget.play === "function") {
                this.widget.isPaused((p) => { if (p) this.widget.play(); });
              }
            } catch (_) {}
          }, 50);
        } catch (_) {
        } finally {
          window.removeEventListener("touchend", unlock, true);
          window.removeEventListener("click", unlock, true);
        }
      };

      window.addEventListener("touchend", unlock, true);
      window.addEventListener("click", unlock, true);
    } catch (_) {}
  }

  // === keep-alive の微調整（再生中はそのまま / 停止時は出力0のまま）===
  _onPlaybackStateChange(isPlaying) {
    if (!this._iosKeepAliveGain) return;
    try {
      // 音は常に無音（0.0001）でOK。停止時もセッションは維持。
      this._iosKeepAliveGain.gain.value = isPlaying ? 0.0001 : 0.0001;
      this._log(`keep-alive gain set (isPlaying=${isPlaying})`);
    } catch (_) {}
  }

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

    if (document.body.classList.contains("playlist-show-page")) {
      localStorage.removeItem("playerState");
    }

    this._setupInlineLogger(); // ← ?iosdebug=1 で可視ログ
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
    this.widget           = null;
    this.progressInterval = null;
    this.isSeeking        = false;
    this.playStartedAt    = null;

    this.isRepeat  = false;
    this.isShuffle = false;

    this.updatePlaylistOrder();

    this.waveformCanvas  = document.getElementById("waveform-anime");
    this.waveformCtx     = this.waveformCanvas?.getContext("2d");
    this.waveformAnimating = false;

    this._setupIOSAudioUnlock();

    // ===== シークバー操作 =====
    this._onMouseUpSeek = () => {
      if (this.isSeeking) {
        this.isSeeking = false;
        this.startProgressTracking();
      }
    };
    this.seekBar?.addEventListener("mousedown", () => {
      this.isSeeking = true;
      clearInterval(this.progressInterval);
    });
    document.addEventListener("mouseup", this._onMouseUpSeek);

    // ===== 保険ハンドラ =====
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

    // 画像/アイコンのクリック委譲
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

    // 外部検索
    window.addEventListener("play-from-search", (e) => {
      const { playUrl } = e.detail;
      this.playFromExternal(playUrl);
    });

    this.switchPlayerTopRow();
    window.addEventListener("resize", () => {
      this.switchPlayerTopRow();
      if (this.waveformCanvas) {
        this.waveformCanvas.width  = this.waveformCanvas.offsetWidth;
        this.waveformCanvas.height = this.waveformCanvas.offsetHeight;
      }
    });

    // フラグ表示初期化
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

    // A11y 初期ラベル
    this.setPlayPauseAria(false);
    this.updateSeekAria(0, 0, 0);
    this.updateVolumeAria(this.volumeBar?.value ?? "100");

    // フッター「再生」活性/非活性
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

    this.restorePlayerState();
    this._log("controller connected");
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
            trackUrl:  this.iframeElement?.src,
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

    if (this.widget) {
      this.unbindWidgetEvents();
      clearInterval(this.progressInterval);
      this.widget = null;
    }
    this.iframeElement = this.replaceIframeWithNew();
    if (!this.iframeElement) return;

    this.iframeElement.src = state.trackUrl.replace("&auto_play=true", "&auto_play=false");
    this.resetPlayerUI();

    const init = () => {
      try {
        this.widget = SC.Widget(this.iframeElement);
      } catch (_) {
        return setTimeout(init, 120);
      }
      this.widget.bind(SC.Widget.Events.READY, () => {
        this.widget.getCurrentSound((sound) => {
          if (sound?.title) {
            this._applySoundMetadata(sound);
          } else {
            this._applySoundMetadata(undefined);
          }
          this.widget.seekTo(state.position || 0);
          state.isPlaying ? this.widget.play() : this.widget.pause();

          this.bindWidgetEvents();
          this.startProgressTracking();
          this.changeVolume({ target: this.volumeBar });
          this.updateTrackIcon(this.currentTrackId, state.isPlaying);
          this.setPlayPauseAria(state.isPlaying);
        });
      });
    };
    init();
  }

  setTrackTitle(title) {
    this.trackTitleEl    && (this.trackTitleEl.textContent    = title);
    this.trackTitleTopEl && (this.trackTitleTopEl.textContent = title);
  }

  // -------------- 外部 URL 再生 -----------------
  playFromExternal(playUrl) {
    this.bottomPlayer?.classList.remove("d-none");
    this.bottomPlayer?.offsetHeight;

    if (this.widget) {
      this.unbindWidgetEvents();
      clearInterval(this.progressInterval);
      this.widget = null;
    }

    this.iframeElement = this.replaceIframeWithNew();
    if (!this.iframeElement) {
      alert("iframe 生成に失敗しました");
      return;
    }

    this.iframeElement.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(playUrl)}&auto_play=false`;
    this.resetPlayerUI();

    const init = () => {
      try {
        this.widget = SC.Widget(this.iframeElement);
      } catch (_) {
        return setTimeout(init, 60);
      }

      // iOS: READY前に一度 play() を投げて “手動操作” の流れを維持
      try { this.widget.play(); } catch (_) {}

      this.widget.bind(SC.Widget.Events.READY, () => {
        const getSound = (retry = 0) => {
          this.widget.getCurrentSound((sound) => {
            if (sound?.title) {
              this._applySoundMetadata(sound);
            } else if (retry < 6) {
              setTimeout(() => getSound(retry + 1), 120);
            } else {
              this._applySoundMetadata(undefined);
            }
          });
        };
        getSound();

        this.bindWidgetEvents();
        this.startProgressTracking();
        this.changeVolume({ target: this.volumeBar });
        this.savePlayerState();
      });
    };
    init();
  }

  // -------------- トラック再生 -----------------
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

    this.resetPlayerUI();
    this.bottomPlayer?.classList.remove("d-none");
    this.currentTrackId = newTrackId || null;
    this.cleanup();

    if (this.widget) {
      this.unbindWidgetEvents();
      clearInterval(this.progressInterval);
      this.widget = null;
    }

    this.iframeElement = this.replaceIframeWithNew();
    if (!this.iframeElement) return;

    this.iframeElement.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(trackUrl)}&auto_play=false`;

    const init = () => {
      try {
        this.widget = SC.Widget(this.iframeElement);
      } catch (_) {
        return setTimeout(init, 60);
      }

      // iOS: READY前に軽く play() を当てて“操作中”を維持
      try { this.widget.play(); } catch (_) {}

      this.bindWidgetEvents();

      this.widget.bind(SC.Widget.Events.READY, () => {
        const trySetTitle = (retry = 0) => {
          this.widget.getCurrentSound((sound) => {
            if (sound?.title) {
              this._applySoundMetadata(sound);
            } else if (retry < 6) {
              return setTimeout(() => trySetTitle(retry + 1), 120);
            } else {
              this._applySoundMetadata(undefined);
            }
          });
        };
        trySetTitle();

        this.startProgressTracking();
        this.changeVolume({ target: this.volumeBar });
        this.updateTrackIcon(this.currentTrackId, true);
        this.setPlayPauseAria(true);
        this.savePlayerState();
      });
    };
    init();
  }

  // -------------- 再生/一時停止 -----------------
  togglePlayPause(event) {
    event?.stopPropagation?.();

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
      this._onPlaybackStateChange(!paused);
      setTimeout(() => this.savePlayerState(), 500);
    });
  }

  // -------------- イベント（SC Widget） -----------------
  onPlay = () => {
    this._log("SC:PLAY");
    this.playPauseIcon?.classList.replace("fa-play", "fa-pause");
    this.updateTrackIcon(this.currentTrackId, true);
    this.setPlayPauseAria(true);
    this.playStartedAt = Date.now();
    this.startWaveformAnime();
    this._onPlaybackStateChange(true);

    this.widget.getCurrentSound((sound) => {
      if (sound?.title && !this.trackTitleEl.textContent) {
        this._applySoundMetadata(sound);
      }
    });
    this.savePlayerState();
  };

  onPause = () => {
    this._log("SC:PAUSE");
    this.playPauseIcon?.classList.replace("fa-pause", "fa-play");
    this.updateTrackIcon(this.currentTrackId, false);
    this.setPlayPauseAria(false);
    this.stopWaveformAnime();
    this._onPlaybackStateChange(false);
    this.savePlayerState();
  };

  onFinish = () => {
    this._log("SC:FINISH");
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
    this._onPlaybackStateChange(false);

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

  /* ---------- アイコン更新 / バインド ---------- */
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
    } catch (_) {}
    this.widget.bind(SC.Widget.Events.PLAY,   this.onPlay);
    this.widget.bind(SC.Widget.Events.PAUSE,  this.onPause);
    this.widget.bind(SC.Widget.Events.FINISH, this.onFinish);
  }

  /* ---------- 再生位置 / 時間表示 ---------- */
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

  /* ---------- 前後トラック ---------- */
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

  // ==================================================
  //  iOS: display:none を避けて不可視配置
  // ==================================================
  replaceIframeWithNew() {
    const oldIframe = document.getElementById("hidden-sc-player");
    const parent =
      (oldIframe && oldIframe.parentNode) ||
      (this.bottomPlayer && this.bottomPlayer.parentNode) ||
      document.body;

    if (oldIframe) {
      this._safeNukeIframe(oldIframe);
    }

    const newIframe = document.createElement("iframe");
    newIframe.id = "hidden-sc-player";

    if (!this._isIOS()) {
      newIframe.classList.add("is-hidden");
    } else {
      Object.assign(newIframe.style, {
        position: "absolute",
        width: "1px",
        height: "1px",
        opacity: "0",
        pointerEvents: "none",
        left: "-9999px",
        top: "-9999px"
      });
      newIframe.setAttribute("aria-hidden", "true");
      newIframe.tabIndex = -1;
    }

    newIframe.allow = "autoplay; encrypted-media";
    newIframe.frameBorder = "no";
    newIframe.scrolling = "no";
    newIframe.width = "100%";
    newIframe.height = "166";

    parent.appendChild(newIframe);
    return newIframe;
  }

  switchPlayerTopRow() {
    const isMobile  = window.innerWidth <= 768;
    const desktopRow = document.getElementById("player-top-row-desktop");
    const mobileRow  = document.getElementById("player-top-row-mobile");
    if (!desktopRow || !mobileRow) return;

    desktopRow.style.display = isMobile ? "none" : "flex";
    mobileRow.style.display  = isMobile ? "flex" : "none";
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
}
