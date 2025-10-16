/* eslint-env browser */
/* global SC, Swal */

/**
 * @typedef {Object} SCWidget
 * @property {(event:string, handler:Function) => void} bind
 * @property {(event:string) => void} unbind
 * @property {() => void} play
 * @property {() => void} pause
 * @property {(cb:(paused:boolean)=>void) => void} isPaused
 * @property {(cb:(ms:number)=>void) => void} getDuration
 * @property {(cb:(ms:number)=>void) => void} getPosition
 * @property {(cb:(sound?:{ title?:string, user?:{ username?:string }, permalink_url?:string, uri?:string })=>void) => void} getCurrentSound
 * @property {(ms:number) => void} seekTo
 * @property {(pct:number) => void} setVolume
 * @property {(url:string, opts?:Record<string, unknown>) => void} load
 */

/**
 * @typedef {{ trackId:string|null, trackUrl?:string, position:number, duration:number, isPlaying:boolean }} PlayerState
 */

// app/javascript/controllers/global_player_controller.js
import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["trackImage", "playIcon"];

  // ===== ユーティリティ =====
  _q(sel, root = null) {
    return (root || this.element || document).querySelector(sel);
  }
  _qa(sel, root = null) {
    return Array.from((root || this.element || document).querySelectorAll(sel));
  }
  _container() {
    return this.element || this._q(".playlist-container") || document;
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
  _isIOS() {
    return /iP(hone|ad|od)/i.test(navigator.userAgent)
      || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
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
      this.hideLoadingUI();
    } else {
      this.setTrackTitle("タイトル不明");
      this.setArtist("");
      this.hideLoadingUI();
    }
  }
  unbindWidgetEvents() {
    if (!this.widget) return;
    try {
      this.widget.unbind(SC.Widget.Events.PLAY);
      this.widget.unbind(SC.Widget.Events.PAUSE);
      this.widget.unbind(SC.Widget.Events.FINISH);
    } catch (_) {}
  }
  _iosLoadOpts(url) {
    return {
      auto_play: true,
      url,
      hide_related: true,
      show_comments: false,
      buying: false,
      sharing: false,
      show_teaser: false
    };
  }

  // ===== ライフサイクル =====
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
      // iOSは後でload()再利用のためwidgetを保持、それ以外は破棄
      if (!this._isIOS()) this.widget = null;
    }

    // iOSはiframe再利用／その他は破棄
    try {
      const old = document.getElementById("hidden-sc-player");
      if (!this._isIOS()) {
        this._safeNukeIframe(old);
        this.iframeElement = null;
      } else {
        this.iframeElement = old || null;
      }
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

    // DOM参照
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
    this.waveformCanvas  = document.getElementById("waveform-anime");
    this.waveformCtx     = this.waveformCanvas?.getContext("2d");

    // 状態
    this.currentTrackId   = null;
    this.widget           = null;
    this.progressInterval = null;
    this.isSeeking        = false;
    this.playStartedAt    = null;
    this.waveformAnimating = false;
    this.isRepeat  = false;
    this.isShuffle = false;

    this.updatePlaylistOrder();

    // シークバーのドラッグ
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

    // 保険ハンドラ
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

    // 画像/アイコンのイベント委譲
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

    // 検索から再生
    window.addEventListener("play-from-search", (e) => {
      const { playUrl } = e.detail;
      this.playFromExternal(playUrl);
    });

    // レイアウト切替
    this.switchPlayerTopRow();
    window.addEventListener("resize", () => {
      this.switchPlayerTopRow();
      if (this.waveformCanvas) {
        this.waveformCanvas.width  = this.waveformCanvas.offsetWidth;
        this.waveformCanvas.height = this.waveformCanvas.offsetHeight;
      }
    });

    // 初期UI
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
    this.setPlayPauseAria(false);
    this.updateSeekAria(0, 0, 0);
    this.updateVolumeAria(this.volumeBar?.value ?? "100");

    // フッター再生ボタン可否
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

    // 復元
    this.restorePlayerState();
    console.log("[connect] global-player controller initialized");
  }

  // ===== A11y =====
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

  // ===== 状態保存/復元 =====
  _ensurePlayerUrl(u) {
    try {
      const obj = new URL(u);
      if (obj.hostname === "w.soundcloud.com") return u; // 既にプレイヤーURL
      const p = new URL("https://w.soundcloud.com/player/");
      p.searchParams.set("url", u);
      return p.toString();
    } catch { return u; }
  }
  _forceAutoPlay(u, flag) {
    try {
      const urlObj = new URL(u);
      urlObj.searchParams.set("auto_play", flag ? "true" : "false");
      return urlObj.toString();
    } catch { return u; }
  }

  savePlayerState() {
    if (!this.widget) return;
    try {
      this.widget.getPosition((pos) => {
        this.widget.getDuration((dur) => {
          this.widget.getCurrentSound((sound) => {
            const permalink = sound?.permalink_url || sound?.uri;
            const isPlaying = this.playPauseIcon?.classList.contains("fa-pause");
            let trackUrl = this.iframeElement?.src || "";
            // 安定したプレイヤーURLを生成（auto_playは現在状態に合わせる）
            if (permalink) {
              try {
                const u = new URL("https://w.soundcloud.com/player/");
                u.searchParams.set("url", permalink);
                u.searchParams.set("auto_play", isPlaying ? "true" : "false");
                trackUrl = u.toString();
              } catch (_) {}
            }
            /** @type {PlayerState} */
            const state = {
              trackId:   this.currentTrackId,
              trackUrl,
              position:  pos ?? 0,
              duration:  dur ?? 0,
              isPlaying,
            };
            localStorage.setItem("playerState", JSON.stringify(state));
          });
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

    /** @type {PlayerState} */
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

    // iOSは復元で自動再生させない
    const base = this._ensurePlayerUrl(state.trackUrl);
    const url  = this._isIOS() ? this._forceAutoPlay(base, false) : base;

    this.iframeElement.src = url;
    this.resetPlayerUI();

    this.iframeElement.onload = () => {
      setTimeout(() => {
        try {
          this.widget = SC.Widget(this.iframeElement);
        } catch (_) {
          return setTimeout(() => this.restorePlayerState(), 150);
        }

        this.widget.bind(SC.Widget.Events.READY, () => {
          this.widget.getCurrentSound((sound) => {
            if (sound?.title) this._applySoundMetadata(sound);
            else this._applySoundMetadata(undefined);
          });

          this.widget.seekTo(state.position || 0);

          if (!this._isIOS() && state.isPlaying) this.widget.play();
          else if (this._isIOS() && !state.isPlaying) this.widget.pause();

          this.bindWidgetEvents();
          this.startProgressTracking();
          this.changeVolume({ target: this.volumeBar });

          this.updateTrackIcon(this.currentTrackId, !this._isIOS() && state.isPlaying);
          this.setPlayPauseAria(!this._isIOS() && state.isPlaying);
        });
      }, 150);
    };
  }

  setTrackTitle(title) {
    this.trackTitleEl    && (this.trackTitleEl.textContent    = title);
    this.trackTitleTopEl && (this.trackTitleTopEl.textContent = title);
  }

  // ===== 再生（外部URL） =====
  playFromExternal(playUrl) {
    this.bottomPlayer?.classList.remove("d-none");
    this.bottomPlayer?.offsetHeight;

    // iOS fast-path: 既存widget+iframeがあれば load()
    if (this._isIOS() && this.widget && this.iframeElement) {
      this.resetPlayerUI();
      this.bindWidgetEvents();
      this.widget.load(playUrl, this._iosLoadOpts(playUrl));
      this.startProgressTracking();
      this.changeVolume({ target: this.volumeBar });
      this.savePlayerState();
      return;
    }

    // 通常ルート
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

    this.iframeElement.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(playUrl)}&auto_play=true`;
    this.resetPlayerUI();

    this.iframeElement.onload = () => {
      setTimeout(() => {
        try {
          this.widget = SC.Widget(this.iframeElement);
        } catch (_) {
          return setTimeout(() => this.playFromExternal(playUrl), 120);
        }

        this.widget.bind(SC.Widget.Events.READY, () => {
          const getSound = (retry = 0) => {
            this.widget.getCurrentSound((sound) => {
              if (sound?.title) this._applySoundMetadata(sound);
              else if (retry < 6) setTimeout(() => getSound(retry + 1), 180);
              else this._applySoundMetadata(undefined);
            });
          };
          getSound();

          this.bindWidgetEvents();
          if (!this._isIOS()) this.widget.play();

          this.startProgressTracking();
          this.changeVolume({ target: this.volumeBar });
          this.savePlayerState();
        });
      }, 100);
    };
  }

  // ===== 再生（リストから） =====
  loadAndPlay(event) {
    event?.stopPropagation?.();
    this.updatePlaylistOrder();

    const el = event?.currentTarget;
    const newTrackId = el?.dataset?.trackId;
    let trackUrl = el?.dataset?.playUrl;

    if (!trackUrl && newTrackId) {
      const img = this.trackImageTargets?.find((t) => t.dataset.trackId == newTrackId);
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

    // cleanup（iOSはwidget/iframe保持）
    this.cleanup();

    // iOS fast-path: widget+iframe健在ならload()
    if (this._isIOS() && this.widget && this.iframeElement) {
      this.bindWidgetEvents();
      this.widget.load(trackUrl, this._iosLoadOpts(trackUrl));
      this.startProgressTracking();
      this.changeVolume({ target: this.volumeBar });
      this.updateTrackIcon(this.currentTrackId, true);
      this.setPlayPauseAria(true);
      this.savePlayerState();
      return;
    }

    // 通常ルート
    if (this.widget) {
      this.unbindWidgetEvents();
      clearInterval(this.progressInterval);
      this.widget = null;
    }

    this.iframeElement = this.replaceIframeWithNew();
    if (!this.iframeElement) return;

    this.iframeElement.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(trackUrl)}&auto_play=true`;

    this.iframeElement.onload = () => {
      setTimeout(() => {
        try {
          this.widget = SC.Widget(this.iframeElement);
        } catch (_) {
          return setTimeout(() => this.loadAndPlay({ currentTarget: el, stopPropagation() {} }), 120);
        }

        this.widget.bind(SC.Widget.Events.READY, () => {
          const trySetTitle = (retry = 0) => {
            this.widget.getCurrentSound((sound) => {
              if (sound?.title) this._applySoundMetadata(sound);
              else if (retry < 6) return setTimeout(() => trySetTitle(retry + 1), 180);
              else this._applySoundMetadata(undefined);
            });
          };
          trySetTitle();

          this.bindWidgetEvents();
          if (!this._isIOS()) this.widget.play();

          this.startProgressTracking();
          this.changeVolume({ target: this.volumeBar });
          this.updateTrackIcon(this.currentTrackId, true);
          this.setPlayPauseAria(true);
          this.savePlayerState();
        });
      }, 100);
    };
  }

  // ===== トグル =====
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
      setTimeout(() => this.savePlayerState(), 500);
    });
  }

  // ===== シーク/音量 =====
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

  // ===== クリック =====
  onPlayIconClick(event) {
    event.stopPropagation();
    const icon = event.currentTarget;
    const trackId = icon.dataset.trackId;

    if (this.currentTrackId === trackId && this.widget) {
      this.widget.isPaused((paused) => {
        if (paused) this.widget.play();
        else this.widget.pause();
      });
      return;
    }
    this.loadAndPlay(event);
  }

  // ===== ウィジェットイベント =====
  onPlay = () => {
    this.playPauseIcon?.classList.replace("fa-play", "fa-pause");
    this.updateTrackIcon(this.currentTrackId, true);
    this.setPlayPauseAria(true);
    this.playStartedAt = Date.now();
    this.startWaveformAnime();

    this.widget.getCurrentSound((sound) => {
      if (sound?.title && !this.trackTitleEl.textContent) this._applySoundMetadata(sound);
    });
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
    } catch (_) {}
    this.widget.bind(SC.Widget.Events.PLAY,   this.onPlay);
    this.widget.bind(SC.Widget.Events.PAUSE,  this.onPause);
    this.widget.bind(SC.Widget.Events.FINISH, this.onFinish);
  }

  // ===== 進捗 =====
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

  // ===== 前後トラック =====
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

  // ===== レイアウト切替 =====
  switchPlayerTopRow() {
    const isMobile  = window.innerWidth <= 768;
    const desktopRow = document.getElementById("player-top-row-desktop");
    const mobileRow  = document.getElementById("player-top-row-mobile");
    if (!desktopRow || !mobileRow) return;

    desktopRow.style.display = isMobile ? "none" : "flex";
    mobileRow.style.display  = isMobile ? "flex" : "none";
  }

  // ===== iframe作成（iPhoneは再利用） =====
  replaceIframeWithNew() {
    const oldIframe = document.getElementById("hidden-sc-player");
    const parent =
      (oldIframe && oldIframe.parentNode) ||
      (this.bottomPlayer && this.bottomPlayer.parentNode) ||
      document.body;

    // iOSは既存iframeがあれば再利用
    if (this._isIOS() && oldIframe) return oldIframe;

    if (oldIframe) this._safeNukeIframe(oldIframe);

    const newIframe = document.createElement("iframe");
    newIframe.id = "hidden-sc-player";
    newIframe.classList.add("is-hidden");
    newIframe.allow = "autoplay; encrypted-media";
    newIframe.setAttribute("playsinline", "true");
    newIframe.setAttribute("webkit-playsinline", "true");
    newIframe.frameBorder = "no";
    newIframe.scrolling = "no";
    newIframe.width = "100%";
    newIframe.height = "166";

    parent.appendChild(newIframe);
    return newIframe;
  }

  // ===== UI表示 =====
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
    if (this.seekBar) {
      this.seekBar.value = "0";
      this.updateSeekAria(0, 0, 0);
    }
    if (this.hasPlayIconTarget) {
      this.playIconTargets.forEach((icn) => {
        icn.classList.add("fa-play");
        icn.classList.remove("fa-pause");
      });
    } else {
      this._qa("[data-track-id]", this._container()).forEach((node) => {
        node.classList?.add("fa-play");
        node.classList?.remove("fa-pause");
      });
    }
    this.playPauseIcon?.classList.add("fa-play");
    this.playPauseIcon?.classList.remove("fa-pause");
    this.setPlayPauseAria(false);
    this.showLoadingUI();
  }

  // ===== プレイリスト順 =====
  updatePlaylistOrder() {
    this.playlistOrder = (this.trackImageTargets || [])
      .map((img) => img?.dataset?.trackId)
      .filter(Boolean);

    if (!this.playlistOrder?.length) {
      const nodes = this._qa("[data-track-id][data-play-url]", this._container());
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

  // ===== 波形アニメ =====
  startWaveformAnime() {
    if (!this.waveformCanvas || !this.waveformCtx) return;
    this.waveformAnimating = true;

    const ctx = this.waveformCtx;
    const getW = () => this.waveformCanvas.width  || this.waveformCanvas.offsetWidth  || 0;
    const getH = () => this.waveformCanvas.height || this.waveformCanvas.offsetHeight || 0;

    let t = 0;
    const animate = () => {
      if (!this.waveformAnimating) return;
      const W = getW(), H = getH();
      if (!W || !H) { requestAnimationFrame(animate); return; }

      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < W; x += 4) {
        const y = H / 2 + Math.sin((x + t) / 7) * (H / 2.5) * (0.7 + 0.3 * Math.sin(x / 17 + t / 13));
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
      t += 0.7;
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }
  stopWaveformAnime() {
    this.waveformAnimating = false;
    if (this.waveformCanvas && this.waveformCtx) {
      this.waveformCtx.clearRect(0, 0, this.waveformCanvas.width || 0, this.waveformCanvas.height || 0);
    }
  }
}