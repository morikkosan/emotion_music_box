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

  // ===== Utils =====
  _q(sel, root = null) { return (root || this.element || document).querySelector(sel); }
  _qa(sel, root = null) { return Array.from((root || this.element || document).querySelectorAll(sel)); }
  _container() { return this.element || this._q(".playlist-container") || document; }
  _isIOS() {
    try {
      return /iPad|iPhone|iPod/.test(navigator.userAgent)
        || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    } catch (_) { return false; }
  }
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
    } catch (_) {}
  }

  // ===== iOS: AudioContext unlock（念のため維持。UIは変えない） =====
  _setupIOSAudioUnlock() {
    try {
      if (!this._isIOS()) return;
      if (typeof window === "undefined" || window.__iosAudioUnlocked) return;

      const unlock = () => {
        if (window.__iosAudioUnlocked) return;
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) throw new Error("No AudioContext");
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          gain.gain.value = 0.0001;
          osc.connect(gain).connect(ctx.destination);
          osc.start(0);
          setTimeout(() => { try { osc.stop(0); ctx.close(); } catch (_) {} ; window.__iosAudioUnlocked = true; }, 30);
        } catch (_) {}
        window.removeEventListener("touchend", unlock, true);
        window.removeEventListener("click", unlock, true);
      };

      window.addEventListener("touchend", unlock, true);
      window.addEventListener("click", unlock, true);
    } catch (_) {}
  }

  // ===== iOS: <audio> 再生系 =====
  _ensureAudio() {
    if (this.audio) return this.audio;
    const a = document.createElement("audio");
    a.id = "ios-hidden-audio";
    a.preload = "metadata";
    a.crossOrigin = "anonymous";
    a.playsInline = true; // iOS Safari
    a.autoplay = true;    // ユーザー操作直後の自動再生を許可
    a.setAttribute("webkit-playsinline", "true");
    a.style.display = "none";
    document.body.appendChild(a);
    this.audio = a;
    this._bindAudioEvents();
    return a;
  }

  _bindAudioEvents() {
    if (!this.audio || this._audioBound) return;
    this._audioBound = true;

    this.audio.addEventListener("play", () => {
      console.log("onPlayイベント発火！（iOS <audio>）");
      this.playPauseIcon?.classList.replace("fa-play", "fa-pause");
      this.updateTrackIcon(this.currentTrackId, true);
      this.setPlayPauseAria(true);
      this.playStartedAt = Date.now();
      this.startWaveformAnime();
      this.savePlayerState();
    });

    this.audio.addEventListener("pause", () => {
      console.log("onPauseイベント発火！（iOS <audio>）");
      this.playPauseIcon?.classList.replace("fa-pause", "fa-play");
      this.updateTrackIcon(this.currentTrackId, false);
      this.setPlayPauseAria(false);
      this.stopWaveformAnime();
      this.savePlayerState();
    });

    this.audio.addEventListener("timeupdate", () => {
      if (this.isSeeking) return;
      const pos = (this.audio.currentTime || 0) * 1000;
      const dur = (this.audio.duration || 0) * 1000;
      if (dur > 0) {
        const percent = Math.round((pos / dur) * 100);
        if (this.seekBar) this.seekBar.value = String(percent);
        if (this.currentTimeEl) this.currentTimeEl.textContent = this.formatTime(pos);
        if (this.durationEl) this.durationEl.textContent = this.formatTime(dur);
        this.updateSeekAria(percent, pos, dur);
      }
    });

    this.audio.addEventListener("ended", () => {
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

      // 既存と同じ自動遷移
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
    });

    // Media Session（ロック画面の前/次）
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.setActionHandler("play",  () => this.audio?.play());
        navigator.mediaSession.setActionHandler("pause", () => this.audio?.pause());
        navigator.mediaSession.setActionHandler("previoustrack", () => this.prevTrack());
        navigator.mediaSession.setActionHandler("nexttrack",     () => this.nextTrack());
      } catch (_) {}
    }
  }

  async _playViaAudio({ streamUrl, hlsUrl, title, artist, artwork }) {
    const a = this._ensureAudio();

    // Progressive を優先。無ければ HLS。
    const src = streamUrl || hlsUrl;
    if (!src) throw new Error("No stream URL for iOS");

    // 初回成功率向上：ミュート→play→canplayでアンミュート
    a.muted = true;

    if (a.src !== src) {
      a.src = src;
      try { await a.load?.(); } catch (_) {}
    }

    // Media Session metadata
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title:  title || "",
          artist: artist || "",
          artwork: artwork ? [{ src: artwork, sizes: "512x512", type: "image/png" }] : []
        });
      } catch (_) {}
    }

    // 音量／UI同期
    if (this.volumeBar) {
      const v = Math.max(0, Math.min(1, Number(this.volumeBar.value) / 100 || 1));
      a.volume = v;
    }

    // 再生（失敗したら muted を維持したままリトライ）
    try {
      await a.play();
    } catch (e) {
      // iOS 初回で稀に失敗するケースに備える
      try {
        await a.play();
      } catch (e2) {
        console.warn("[iOS audio] play() 失敗:", e2);
        throw e2;
      }
    }

    // 再生可能になったらアンミュート（聴こえるように）
    const unmute = () => { a.muted = false; a.removeEventListener("canplay", unmute); };
    a.addEventListener("canplay", unmute);
  }

  // ====== ライフサイクル ======
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

    // シークバーのドラッグ制御
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

    // クリック委譲（UIそのまま）
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

    // 外部検索から再生
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

    // 初期見た目とA11y
    const shuffleBtn = document.getElementById("shuffle-button");
    if (shuffleBtn) { shuffleBtn.classList.toggle("active", this.isShuffle); shuffleBtn.setAttribute("aria-pressed", String(this.isShuffle)); }
    const repeatBtn = document.getElementById("repeat-button");
    if (repeatBtn) { repeatBtn.classList.toggle("active", this.isRepeat); repeatBtn.setAttribute("aria-pressed", String(this.isRepeat)); }
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
    try {
      const state = {
        trackId:   this.currentTrackId,
        trackUrl:  this._isIOS() ? (this.audio?.src || "") : (this.iframeElement?.src || ""),
        position:  this._isIOS() ? Math.floor((this.audio?.currentTime || 0) * 1000) : 0,
        duration:  this._isIOS() ? Math.floor((this.audio?.duration || 0) * 1000) : 0,
        isPlaying: this.playPauseIcon?.classList.contains("fa-pause"),
      };
      localStorage.setItem("playerState", JSON.stringify(state));
    } catch (_) {}
  }

  tryRestore(state, retry = 0) {
    // iOS audio では使わない（復元時は自動再生しない）
    if (!this.widget) return;
    this.widget.getDuration((dur) => {
      if (!dur) return setTimeout(() => this.tryRestore(state, retry), 300);
      this.widget.getCurrentSound((sound) => {
        if (sound?.title) this._applySoundMetadata(sound);
        else if (retry < 5) return setTimeout(() => this.tryRestore(state, retry + 1), 250);
        else this._applySoundMetadata(undefined);
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

    if (this._isIOS()) {
      // iOS: audio での復元（自動再生はしない）
      this._ensureAudio();
      this.resetPlayerUI();
      try {
        this.audio.src = state.trackUrl;
      } catch (_) {}
      // 位置は復元するが、勝手に再生はしない
      const pos = (state.position || 0) / 1000;
      if (Number.isFinite(pos) && pos > 0) {
        const onMeta = () => {
          this.audio.currentTime = Math.min(pos, this.audio.duration || pos);
          this.audio.removeEventListener("loadedmetadata", onMeta);
        };
        this.audio.addEventListener("loadedmetadata", onMeta);
      }
      // UIだけ同期
      this.updateTrackIcon(this.currentTrackId, state.isPlaying);
      this.setPlayPauseAria(false);
      this.startProgressTracking();
      return;
    }

    // 非iOS: 既存Widgetの復元
    if (this.widget) {
      this.unbindWidgetEvents();
      clearInterval(this.progressInterval);
      this.widget = null;
    }
    this.iframeElement = this.replaceIframeWithNew();
    if (!this.iframeElement) return;

    this.iframeElement.src = state.trackUrl.replace("&auto_play=true", "&auto_play=false");
    this.resetPlayerUI();
    this.iframeElement.onload = () => {
      setTimeout(() => {
        try { this.widget = SC.Widget(this.iframeElement); }
        catch (_) { return setTimeout(() => this.restorePlayerState(), 150); }

        this.widget.bind(SC.Widget.Events.READY, () => {
          this.widget.getCurrentSound((sound) => {
            if (sound?.title) this._applySoundMetadata(sound);
            else this._applySoundMetadata(undefined);
            this.widget.seekTo(state.position || 0);
            state.isPlaying ? this.widget.play() : this.widget.pause();

            this.bindWidgetEvents();
            this.startProgressTracking();
            this.changeVolume({ target: this.volumeBar });

            this.updateTrackIcon(this.currentTrackId, state.isPlaying);
            this.setPlayPauseAria(state.isPlaying);
          });
        });
      }, 150);
    };
  }

  setTrackTitle(title) {
    this.trackTitleEl    && (this.trackTitleEl.textContent    = title);
    this.trackTitleTopEl && (this.trackTitleTopEl.textContent = title);
  }

  // -------------- 外部 URL 再生（検索など） -----------------
  playFromExternal(playUrl) {
    // 外部経路は従来のWidgetルート（iOSでもデータ属性に stream が無い想定のため）
    this.bottomPlayer?.classList.remove("d-none");
    this.bottomPlayer?.offsetHeight;

    if (this.widget) { this.unbindWidgetEvents(); clearInterval(this.progressInterval); this.widget = null; }

    this.iframeElement = this.replaceIframeWithNew();
    if (!this.iframeElement) { alert("iframe 生成に失敗しました"); return; }

    this.iframeElement.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(playUrl)}&auto_play=true`;
    this.resetPlayerUI();

    this.iframeElement.onload = () => {
      setTimeout(() => {
        try { this.widget = SC.Widget(this.iframeElement); }
        catch (_) { return setTimeout(() => this.playFromExternal(playUrl), 120); }

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
          this.widget.play();
          this.startProgressTracking();
          this.changeVolume({ target: this.volumeBar });
          this.savePlayerState();
        });
      }, 100);
    };
  }

  // -------------- 波形アニメーション -----------------
  startWaveformAnime() {
    if (!this.waveformCtx) return;
    this.waveformAnimating = true;
    const ctx = this.waveformCtx;
    const W = this.waveformCanvas.width, H = this.waveformCanvas.height;
    let t = 0;
    const animate = () => {
      if (!this.waveformAnimating) return;
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.strokeStyle = "#10ffec";
      ctx.lineWidth = 2;
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

  // -------------- シャッフル / リピート -----------------
  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    const btn = document.getElementById("shuffle-button");
    if (btn) { btn.classList.toggle("active", this.isShuffle); btn.setAttribute("aria-pressed", String(this.isShuffle)); }
    this.updatePlaylistOrder();
  }
  toggleRepeat() {
    this.isRepeat = !this.isRepeat;
    const btn = document.getElementById("repeat-button");
    if (btn) { btn.classList.toggle("active", this.isRepeat); btn.setAttribute("aria-pressed", String(this.isRepeat)); }
  }
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
      this.playIconTargets.forEach((icn) => { icn.classList.add("fa-play"); icn.classList.remove("fa-pause"); });
    }
    this.playPauseIcon?.classList.add("fa-play");
    this.playPauseIcon?.classList.remove("fa-pause");
    this.setPlayPauseAria(false);
    this.showLoadingUI();
  }

  // -------------- iframe 差し替え（非iOS用） -----------------
  replaceIframeWithNew() {
    const oldIframe = document.getElementById("hidden-sc-player");
    const parent = (oldIframe && oldIframe.parentNode)
      || (this.bottomPlayer && this.bottomPlayer.parentNode)
      || document.body;

    if (oldIframe) this._safeNukeIframe(oldIframe);

    const newIframe = document.createElement("iframe");
    newIframe.id = "hidden-sc-player";
    newIframe.classList.add("is-hidden");
    newIframe.allow = "autoplay; encrypted-media";
    newIframe.frameBorder = "no";
    newIframe.scrolling = "no";
    newIframe.width = "100%";
    newIframe.height = "166";
    parent.appendChild(newIframe);
    return newIframe;
  }

  // -------------- トラック再生（iOSは<audio>、それ以外はWidget） -----------------
  async loadAndPlay(event) {
    event?.stopPropagation?.();
    this.updatePlaylistOrder();

    const el = event?.currentTarget;
    const newTrackId = el?.dataset?.trackId;
    let playUrl  = el?.dataset?.playUrl;
    let streamUrl = el?.dataset?.streamUrl || el?.dataset?.hlsUrl; // ★iOS用（任意）

    if (!playUrl && newTrackId) {
      const img = this.trackImageTargets.find((t) => t.dataset.trackId == newTrackId);
      playUrl   = img?.dataset.playUrl || playUrl;
      streamUrl = img?.dataset.streamUrl || img?.dataset.hlsUrl || streamUrl;
    }
    if (!playUrl && newTrackId) {
      const node = this._q(`[data-track-id="${CSS.escape(String(newTrackId))}"][data-play-url]`, this._container());
      playUrl   = node?.dataset?.playUrl || playUrl;
      streamUrl = node?.dataset?.streamUrl || node?.dataset?.hlsUrl || streamUrl;
    }
    if (!playUrl) return;

    this.resetPlayerUI();
    this.bottomPlayer?.classList.remove("d-none");
    this.currentTrackId = newTrackId || null;

    // iOS: <audio> を優先（streamUrlが無い時はWidgetにフォールバック）
    if (this._isIOS() && (streamUrl || window.SC_IOS_STREAM_RESOLVER)) {
      try {
        // タイトル・アーティスト（DOMから拾う or 後でMediaSessionで上書き）
        const title  = (this._q(`[data-track-title][data-track-id="${CSS.escape(String(this.currentTrackId))}"]`)?.textContent || "").trim();
        const artist = (this._q(`[data-track-artist][data-track-id="${CSS.escape(String(this.currentTrackId))}"]`)?.textContent || "").trim();
        const artwork = this._q(`[data-track-artwork][data-track-id="${CSS.escape(String(this.currentTrackId))}"]`)?.getAttribute("data-track-artwork") || "";

        let resolved = streamUrl;
        if (!resolved && typeof window.SC_IOS_STREAM_RESOLVER === "function") {
          // 任意: 開発側で window.SC_IOS_STREAM_RESOLVER(playUrl) を定義しておけば、ここで取得して使える
          resolved = await window.SC_IOS_STREAM_RESOLVER(playUrl);
        }

        await this._playViaAudio({ streamUrl: resolved, title, artist, artwork });
        // UI同期
        this.setTrackTitle(title || this.trackTitleEl?.textContent || "");
        this.setArtist(artist || this.trackArtistEl?.textContent || "");
        this.hideLoadingUI();
        this.startProgressTracking();
        return;
      } catch (e) {
        console.warn("[iOS audio] フォールバック to Widget:", e);
        // 失敗時はWidgetルートにフォールバック
      }
    }

    // === 非iOS or iOSでstreamUrlなし: 従来のWidgetルート ===
    if (this.widget) { this.unbindWidgetEvents(); clearInterval(this.progressInterval); this.widget = null; }
    this.iframeElement = this.replaceIframeWithNew();
    if (!this.iframeElement) return;

    this.iframeElement.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(playUrl)}&auto_play=true`;

    this.iframeElement.onload = () => {
      setTimeout(() => {
        try { this.widget = SC.Widget(this.iframeElement); }
        catch (_) { return setTimeout(() => this.loadAndPlay({ currentTarget: el, stopPropagation() {} }), 120); }

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
          this.widget.play();
          this.startProgressTracking();
          this.changeVolume({ target: this.volumeBar });
          this.updateTrackIcon(this.currentTrackId, true);
          this.setPlayPauseAria(true);
          this.savePlayerState();
        });
      }, 80);
    };
  }

  // -------------- 再生/一時停止トグル -----------------
  togglePlayPause(event) {
    event?.stopPropagation?.();

    if (this._isIOS()) {
      // iOS: <audio>
      const a = this._ensureAudio();
      if (!a.src) return; // まだ曲を選んでいない
      if (a.paused) a.play(); else a.pause();
      setTimeout(() => this.savePlayerState(), 300);
      return;
    }

    // 非iOS: Widget
    if (!this.widget) {
      this.iframeElement = document.getElementById("hidden-sc-player");
      if (this.iframeElement && this.iframeElement.src) {
        try { this.widget = SC.Widget(this.iframeElement); this.bindWidgetEvents(); this.restorePlayerState?.(); }
        catch (_e) { alert("プレイヤーの初期化に失敗しました。もう一度曲を選んでください。"); return; }
      } else {
        alert("プレイヤーが初期化されていません。もう一度曲を選んでください。");
        return;
      }
    }
    this.widget.isPaused((paused) => { paused ? this.widget.play() : this.widget.pause(); setTimeout(() => this.savePlayerState(), 500); });
  }

  seek(event) {
    const raw = Number(event.target.value);
    const percent = Math.max(0, Math.min(100, Math.round(raw)));

    if (this._isIOS()) {
      const a = this._ensureAudio();
      const dur = a.duration || 0;
      if (!dur) return;
      const newSec = (percent / 100) * dur;
      a.currentTime = newSec;
      this.updateSeekAria(percent, newSec * 1000, dur * 1000);
      this.savePlayerState();
      return;
    }

    if (!this.widget) return;
    this.widget.getDuration((dur) => {
      if (!dur) return;
      const newMs = (percent / 100) * dur;
      this.widget.seekTo(newMs);
      this.updateSeekAria(percent, newMs, dur);
      this.savePlayerState();
    });
  }

  changeVolume(event) {
    const raw = Number(event.target.value);
    const percent = Math.max(0, Math.min(100, Math.round(raw)));

    if (this._isIOS()) {
      const a = this._ensureAudio();
      a.volume = percent / 100;
      this.updateVolumeAria(String(percent));
      return;
    }

    if (!this.widget) return;
    this.widget.setVolume(percent);
    this.updateVolumeAria(String(percent));
  }

  onPlayIconClick(event) {
    event.stopPropagation();
    const icon = event.currentTarget;
    const trackId = icon.dataset.trackId;

    if (this.currentTrackId === trackId) {
      return this.togglePlayPause(event);
    }
    this.loadAndPlay(event);
  }

  /* ---------- 再生イベント（Widget用） ---------- */
  onPlay = () => {
    console.log("onPlayイベント発火！");
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
    console.log("onPauseイベント発火！");
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
      if (this._isIOS()) {
        const a = this.audio;
        if (!a || this.isSeeking) return;
        const pos = (a.currentTime || 0) * 1000;
        const dur = (a.duration || 0) * 1000;
        if (!dur) return;
        const percent = Math.round((pos / dur) * 100);
        if (this.seekBar) this.seekBar.value = String(percent);
        if (this.currentTimeEl) this.currentTimeEl.textContent = this.formatTime(pos);
        if (this.durationEl) this.durationEl.textContent = this.formatTime(dur);
        this.updateSeekAria(percent, pos, dur);
        this.savePlayerState();
        return;
      }

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
    }, 750);
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

  /* ==================================================
   *  レイアウト（PC / モバイル）切替
   * ================================================== */
  switchPlayerTopRow() {
    const isMobile  = window.innerWidth <= 768;
    const desktopRow = document.getElementById("player-top-row-desktop");
    const mobileRow  = document.getElementById("player-top-row-mobile");
    if (!desktopRow || !mobileRow) return;
    desktopRow.style.display = isMobile ? "none" : "flex";
    mobileRow.style.display  = isMobile ? "flex" : "none";
  }
}
