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
 */

import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["trackImage", "playIcon"];

  // ---------- ユーティリティ ----------
  _q(sel, root = null) { return (root || this.element || document).querySelector(sel); }
  _qa(sel, root = null) { return Array.from((root || this.element || document).querySelectorAll(sel)); }
  _container() { return this.element || this._q(".playlist-container") || document; }
  _isIOS() {
    try {
      return /iPad|iPhone|iPod/.test(navigator.userAgent)
        || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    } catch (_) { return false; }
  }
  // iOSは「毎回」ハンドシェイク必須に変更（新規iframeごとに再許可が安定）
  _needsHandshake() { return this._isIOS(); }
  _markHandshakeDone() {
    // 以前は sessionStorage で永続化していたが、iOSはiframe再生成で無効化されやすいので保持しない
    // ここでは何もしない（互換のため関数は残す）
  }
  _hideScreenCover() {
    try {
      const cover = document.getElementById("screen-cover-loading");
      if (cover) { cover.style.display = "none"; cover.setAttribute("aria-hidden", "true"); }
    } catch (_) {}
  }

  // 小さなヒントバナー（iOSのみ表示）
  _showHandshakeHint() {
    if (this._hintEl || !this._isIOS()) return;
    const el = document.createElement("div");
    el.id = "sc-handshake-hint";
    el.style.position = "fixed";
    el.style.left = "12px";
    el.style.right = "12px";
    el.style.bottom = "12px";
    el.style.zIndex = "99999";
    el.style.padding = "10px 12px";
    el.style.fontSize = "14px";
    el.style.borderRadius = "10px";
    el.style.background = "rgba(0,0,0,0.85)";
    el.style.color = "#fff";
    el.style.lineHeight = "1.5";
    el.style.boxShadow = "0 4px 16px rgba(0,0,0,.25)";
    el.style.textAlign = "center";
    el.textContent = "iPhone：下のSoundCloudプレイヤー内の ▶ をタップして再生を許可してください。曲ごとに最初の1回だけ必要です。";
    el.addEventListener("click", () => this._hideHandshakeHint());
    document.body.appendChild(el);
    this._hintEl = el;
  }
  _hideHandshakeHint() {
    try { this._hintEl?.remove(); } catch(_) {}
    this._hintEl = null;
  }

  // 旧 iframe を安全に破棄
  _safeNukeIframe(iframe) {
    try {
      if (!iframe) return;
      iframe.src = "about:blank";
      iframe.removeAttribute("src");
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    } catch (_) {}
  }

  // メタデータ反映
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

  // unbind 一本化
  unbindWidgetEvents() {
    if (!this.widget) return;
    try {
      this.widget.unbind(SC.Widget.Events.PLAY);
      this.widget.unbind(SC.Widget.Events.PAUSE);
      this.widget.unbind(SC.Widget.Events.FINISH);
    } catch (_) {}
  }

  // AudioContextで静音ワンショット（失敗しても無害）
  _setupIOSAudioUnlock() {
    try {
      if (!this._isIOS()) return;
      if (window.__iosAudioUnlocked) return;
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
          setTimeout(() => {
            try { osc.stop(0); ctx.close(); } catch (_) {}
            window.__iosAudioUnlocked = true;
          }, 50);
        } catch (_) {}
        window.removeEventListener("touchend", unlock, true);
        window.removeEventListener("click", unlock, true);
      };
      window.addEventListener("touchend", unlock, true);
      window.addEventListener("click", unlock, true);
    } catch (_) {}
  }

  // ======== iOS用：iframe“画面内1px駐車”ユーティリティ（CSSは変えない）========
  _parkIframeInViewportTiny() {
    if (!this._isIOS() || !this.iframeElement) return;
    try {
      const s = this.iframeElement.style;
      // 画面内・底辺・不可視・1px・タップ無効化（CSSよりインラインが優先される）
      s.position = "fixed";
      s.left     = "0";
      s.bottom   = "0";
      s.width    = "1px";
      s.height   = "1px";
      s.opacity  = "0";
      s.pointerEvents = "none";
      s.zIndex   = "1";
      // sc-visible は外す（166pxの高さを解除）
      this.iframeElement.classList.remove("sc-visible");
    } catch (_) {}
  }
  _moveIframeOffscreen() {
    if (!this._isIOS() || !this.iframeElement) return;
    try {
      const s = this.iframeElement.style;
      // 元の「画面外退避」に戻す（停止/終了後）
      s.position = "";
      s.left = "";
      s.bottom = "";
      s.width = "";
      s.height = "";
      s.opacity = "";
      s.pointerEvents = "";
      s.zIndex = "";
      // sc-keepalive のCSSが left:-10000px を適用する
    } catch (_) {}
  }

  // -------- ライフサイクル --------
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

    if (this.widget) { this.unbindWidgetEvents(); this.widget = null; }

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

    this._hideHandshakeHint();
  };

  // ★ プレイヤーだけ安全に止める（UIイベントは残す）
  stopOnlyPlayer() {
    try {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
      this.unbindWidgetEvents();
      this.widget = null;
    } catch (_) {}

    try {
      const old = document.getElementById("hidden-sc-player");
      this._safeNukeIframe(old);
      this.iframeElement = null;
    } catch (_) {}
  }

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

    // シークバー
    this._onMouseUpSeek = () => { if (this.isSeeking) { this.isSeeking = false; this.startProgressTracking(); } };
    this.seekBar?.addEventListener("mousedown", () => { this.isSeeking = true; clearInterval(this.progressInterval); });
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

    // 外部検索から再生
    window.addEventListener("play-from-search", (e) => {
      const { playUrl } = e.detail;
      this.playFromExternal(playUrl);
    });

    // レイアウト
    this.switchPlayerTopRow();
    window.addEventListener("resize", () => {
      this.switchPlayerTopRow();
      if (this.waveformCanvas) {
        this.waveformCanvas.width  = this.waveformCanvas.offsetWidth;
        this.waveformCanvas.height = this.waveformCanvas.offsetHeight;
      }
    });

    // 見た目同期
    const shuffleBtn = document.getElementById("shuffle-button");
    if (shuffleBtn) { shuffleBtn.classList.toggle("active", this.isShuffle); shuffleBtn.setAttribute("aria-pressed", String(this.isShuffle)); }
    const repeatBtn = document.getElementById("repeat-button");
    if (repeatBtn) { repeatBtn.classList.toggle("active", this.isRepeat); repeatBtn.setAttribute("aria-pressed", String(this.isRepeat)); }

    this.setPlayPauseAria(false);
    this.updateSeekAria(0, 0, 0);
    this.updateVolumeAria(this.volumeBar?.value ?? "100");

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

    // ▼ SCの読み込み遅延に備える
    if (window.SC?.Widget) {
      this.restorePlayerState();
    } else {
      window.addEventListener("load", () => this.restorePlayerState?.());
    }
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

  // ---------- 状態保存 / 復元 ----------
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
        if (sound?.title) this._applySoundMetadata(sound);
        else if (retry < 5) return setTimeout(() => this.tryRestore(state, retry + 1), 250);
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

    if (this.widget) { this.unbindWidgetEvents(); clearInterval(this.progressInterval); this.widget = null; }
    // 復元でも iOS は可視で読み込んで手動再生に誘導（安定第一）
    const visible = this._needsHandshake();
    this.iframeElement = this.replaceIframeWithNew(visible);
    if (!this.iframeElement) return;

    // 復元時はauto_play=false（iOSは毎回手動）
    this.iframeElement.src = state.trackUrl.replace("&auto_play=true", "&auto_play=false");
    this.resetPlayerUI();
    if (visible) this._showHandshakeHint();

    this.iframeElement.onload = () => {
      setTimeout(() => {
        try { this.widget = SC.Widget(this.iframeElement); }
        catch (_) { return setTimeout(() => this.restorePlayerState(), 150); }

        this.widget.bind(SC.Widget.Events.READY, () => {
          this.widget.getCurrentSound((sound) => this._applySoundMetadata(sound));
          this.widget.seekTo(state.position || 0);

          if (state.isPlaying && !this._needsHandshake()) {
            this._forcePlay();
          } // iOSはウィジェット内▶で再生

          this.bindWidgetEvents();
          this.startProgressTracking();
          this.changeVolume({ target: this.volumeBar });
          this.updateTrackIcon(this.currentTrackId, state.isPlaying && !this._needsHandshake());
          this.setPlayPauseAria(state.isPlaying && !this._needsHandshake());
        });
      }, 150);
    };
  }

  setTrackTitle(title) {
    this.trackTitleEl    && (this.trackTitleEl.textContent    = title);
    this.trackTitleTopEl && (this.trackTitleTopEl.textContent = title);
  }

  // ---------- 強制再生（Autoplayブロック対策の軽いリトライ） ----------
  _forcePlay(maxTries = 5) {
    if (!this.widget) return;
    let tries = 0;
    const tick = () => {
      if (!this.widget) return;
      this.widget.isPaused((paused) => {
        if (!paused) return; // 再生できてる
        try { this.widget.play(); } catch (_) {}
        tries += 1;
        if (tries < maxTries) setTimeout(tick, 220);
      });
    };
    // READY直後に1回、以降は短い間隔で再確認
    setTimeout(tick, 50);
  }

  // ---------- iframe作成（visible=true で見せる） ----------
  replaceIframeWithNew(visible) {
    const oldIframe = document.getElementById("hidden-sc-player");
    const parent =
      (oldIframe && oldIframe.parentNode) ||
      (this.bottomPlayer && this.bottomPlayer.parentNode) ||
      document.body;

    if (oldIframe) this._safeNukeIframe(oldIframe);

    const newIframe = document.createElement("iframe");
    newIframe.id = "hidden-sc-player";
    newIframe.classList.add("sc-keepalive");
    if (visible) newIframe.classList.add("sc-visible");

    newIframe.allow = "autoplay; encrypted-media";
    newIframe.frameBorder = "no";
    newIframe.scrolling = "no";

    parent.appendChild(newIframe);
    return newIframe;
  }

  // ---------- 外部 URL 再生 ----------
  playFromExternal(playUrl) {
    this.bottomPlayer?.classList.remove("d-none");
    this.bottomPlayer?.offsetHeight;

    if (this.widget) { this.unbindWidgetEvents(); clearInterval(this.progressInterval); this.widget = null; }

    // iOSは毎回ハンドシェイク（＝可視でload、auto_play=false）
    const show = this._needsHandshake();
    if (show) this._showHandshakeHint();

    this.iframeElement = this.replaceIframeWithNew(show);
    if (!this.iframeElement) { alert("iframe 生成に失敗しました"); return; }

    this.resetPlayerUI();
    this.iframeElement.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(playUrl)}&auto_play=${show ? "false" : "true"}`;

    this.iframeElement.onload = () => {
      setTimeout(() => {
        try { this.widget = SC.Widget(this.iframeElement); }
        catch (_) { return setTimeout(() => this.playFromExternal(playUrl), 120); }

        this.widget.bind(SC.Widget.Events.READY, () => {
          const getSound = (retry = 0) => {
            this.widget.getCurrentSound((sound) => {
              if (sound?.title) this._applySoundMetadata(sound);
              else if (retry < 6) setTimeout(() => getSound(retry + 1), 180);
            });
          };
          getSound();

          this.bindWidgetEvents();

          if (!show) {
            this._forcePlay();
          } // iOSはウィジェット内▶で再生

          this.startProgressTracking();
          this.changeVolume({ target: this.volumeBar });
          this.savePlayerState();
        });
      }, 100);
    };
  }

  // ---------- トラック再生（タイル/アイコン） ----------
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

    // ★ プレイヤーだけ止める（UIイベントは殺さない）
    this.stopOnlyPlayer();

    if (this.widget) { this.unbindWidgetEvents(); clearInterval(this.progressInterval); this.widget = null; }

    const show = this._needsHandshake(); // iOSは常にtrue
    if (show) this._showHandshakeHint();

    this.iframeElement = this.replaceIframeWithNew(show);
    if (!this.iframeElement) return;

    this.iframeElement.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(trackUrl)}&auto_play=${show ? "false" : "true"}`;

    this.iframeElement.onload = () => {
      setTimeout(() => {
        try { this.widget = SC.Widget(this.iframeElement); }
        catch (_) { return setTimeout(() => this.loadAndPlay({ currentTarget: el, stopPropagation() {} }), 120); }

        this.widget.bind(SC.Widget.Events.READY, () => {
          const trySetTitle = (retry = 0) => {
            this.widget.getCurrentSound((sound) => {
              if (sound?.title) this._applySoundMetadata(sound);
              else if (retry < 6) return setTimeout(() => trySetTitle(retry + 1), 180);
            });
          };
          trySetTitle();

          this.bindWidgetEvents();

          if (!show) {
            this._forcePlay();
          } // iOSはウィジェット内▶で再生

          this.startProgressTracking();
          this.changeVolume({ target: this.volumeBar });
          this.updateTrackIcon(this.currentTrackId, !show);
          this.setPlayPauseAria(!show);
          this.savePlayerState();
        });
      }, 100);
    };
  }

  // ---------- トグル ----------
  togglePlayPause(event) {
    event?.stopPropagation?.();

    if (!this.widget) {
      this.iframeElement = document.getElementById("hidden-sc-player");
      if (this.iframeElement && this.iframeElement.src) {
        try {
          this.widget = SC.Widget(this.iframeElement);
          this.bindWidgetEvents();
          if (typeof this.restorePlayerState === "function") this.restorePlayerState();
        } catch (_e) {
          alert("プレイヤーの初期化に失敗しました。もう一度曲を選んでください。");
          return;
        }
      } else {
        alert("プレイヤーが初期化されていません。もう一度曲を選んでください。");
        return;
      }
    }

    // iOSでハンドシェイク前は外側トグルでの再生は行わず、プレイヤー内を案内
    if (this._needsHandshake()) {
      this._showHandshakeHint();
      try { this.iframeElement?.classList.add("sc-visible"); } catch (_) {}
      return;
    }

    this.widget.isPaused((paused) => {
      if (paused) {
        this.widget.play();
        setTimeout(() => this._forcePlay(2), 120);
      } else {
        this.widget.pause();
      }
      setTimeout(() => this.savePlayerState(), 500);
    });
  }

  // ---------- SC Widget イベント ----------
  onPlay = () => {
    // iOS：再生が始まったら、ウィジェットを“画面内1px”に駐車して停止されないようにする
    if (this._isIOS()) {
      this._hideHandshakeHint();
      this._parkIframeInViewportTiny();
    } else {
      // iOS以外は従来通り、見せる必要はない
      try { this.iframeElement?.classList.remove("sc-visible"); } catch (_) {}
    }

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

    // iOS：終了時は元の画面外に戻す
    if (this._isIOS()) this._moveIframeOffscreen();

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

  // ---------- アイコン更新 / バインド ----------
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

  // ---------- 進行状況 ----------
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

  // ---------- シーク / ボリューム ----------
  seek(e) {
    if (!this.widget || !this.seekBar) return;
    const percent = Number(e?.target?.value ?? this.seekBar.value ?? 0);
    this.isSeeking = true;
    this.widget.getDuration((dur) => {
      if (!dur) { this.isSeeking = false; return; }
      const ms = Math.max(0, Math.min(dur, Math.round((percent / 100) * dur)));
      this.widget.seekTo(ms);
      this.currentTimeEl && (this.currentTimeEl.textContent = this.formatTime(ms));
      this.updateSeekAria(percent, ms, dur);
      // シーク確定後に追従再開
      setTimeout(() => { this.isSeeking = false; }, 50);
    });
  }

  changeVolume(e) {
    const val = Number(e?.target?.value ?? this.volumeBar?.value ?? 100);
    const clamped = Math.max(0, Math.min(100, val));
    try { this.widget?.setVolume?.(clamped); } catch (_) {}
    this.updateVolumeAria(String(clamped));
  }

  // ---------- プレイアイコン ----------
  onPlayIconClick(evt) {
    // 画像上の ▶ を押した時など
    this.loadAndPlay(evt);
  }

  formatTime(ms) {
    const n = Number(ms);
    if (!Number.isFinite(n) || n <= 0) return "0:00";
    const sec = Math.floor(n / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  // ---------- 前後 ----------
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

  // レイアウト切替
  switchPlayerTopRow() {
    const isMobile  = window.innerWidth <= 768;
    const desktopRow = document.getElementById("player-top-row-desktop");
    const mobileRow  = document.getElementById("player-top-row-mobile");
    if (!desktopRow || !mobileRow) return;
    desktopRow.style.display = isMobile ? "none" : "flex";
    mobileRow.style.display  = isMobile ? "flex" : "none";
  }

  // ---------- UI表示 ----------
  showLoadingUI() {
    this.playPauseIcon?.classList.add("is-hidden"); // ← ボタン内の見た目用
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

  // ---------- シャッフル / リピート ----------
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

  updatePlaylistOrder() {
    this.playlistOrder = this.trackImageTargets.map((img) => img.dataset.trackId).filter(Boolean);
    if (!this.playlistOrder.length) {
      const nodes = this._qa(".playlist-container [data-track-id][data-play-url]", this._container());
      this.playlistOrder = nodes.map((n) => String(n.dataset.trackId)).filter(Boolean);
    }
    if (this.isShuffle) {
      for (let i = this.playlistOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.playlistOrder[i], this.playlistOrder[j]] = [this.playlistOrder[j], this.playlistOrder[i]];
      }
    }
  }

  // 波形
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
}
