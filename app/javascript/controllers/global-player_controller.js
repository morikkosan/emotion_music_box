/* eslint-env browser */
/* global SC */

import { Controller } from "@hotwired/stimulus";

/**
 * @typedef {Object} SCWidget
 * @property {(event:string, handler:Function)=>void} bind
 * @property {(event:string)=>void} unbind
 * @property {()=>void} play
 * @property {()=>void} pause
 * @property {(cb:(paused:boolean)=>void)=>void} isPaused
 * @property {(cb:(ms:number)=>void)=>void} getDuration
 * @property {(cb:(ms:number)=>void)=>void} getPosition
 * @property {(cb:(sound?:{ title?:string, user?:{ username?:string } })=>void)=>void} getCurrentSound
 * @property {(ms:number)=>void} seekTo
 * @property {(pct:number)=>void} setVolume
 */

export default class extends Controller {
  static targets = ["trackImage", "playIcon"];

  // === 内部フラグ ===
  __dbgEnabled = null;
  __dbgEl = null;
  __hls = null;
  __loginShowing = false; // 二重表示防止

  // ===== 基本ユーティリティ =====
  _getOAuthToken() {
    try {
      const m = document.querySelector('meta[name="soundcloud-oauth-token"]');
      const t1 = m?.content?.trim();
      if (t1) return t1;
      const t2 = (typeof window.soundcloudToken === "string") ? window.soundcloudToken.trim() : "";
      if (t2) return t2;
      return "";
    } catch(_) { return ""; }
  }
  _q(sel, root = null) { return (root || this.element || document).querySelector(sel); }
  _qa(sel, root = null) { return Array.from((root || this.element || document).querySelectorAll(sel)); }
  _container() { return this.element || this._q(".playlist-container") || document; }
  _isIOS() {
    try {
      return /iPad|iPhone|iPod/.test(navigator.userAgent)
        || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    } catch (_) { return false; }
  }
  _normalizeTrackUrl(raw) {
    try {
      const u = new URL(raw);
      ["utm_source","utm_medium","utm_campaign","utm_term","utm_content"].forEach(k=>u.searchParams.delete(k));
      return u.toString();
    } catch(_) { return raw; }
  }
  _log(...args){ try{ console.info("[global-player]", ...args);}catch(_){} }

  // === 画面内デバッグ（#gpdebug で有効化）========================
  _debugEnabled() {
    try {
      if (this.__dbgEnabled != null) return this.__dbgEnabled;
      const on =
        location.hash.includes("gpdebug") ||
        localStorage.getItem("gpdebug") === "1" ||
        window.__showPlayerDebug === true ||
        window.EMOMU_DEBUG === true;
      this.__dbgEnabled = !!on;
      return this.__dbgEnabled;
    } catch { return false; }
  }
  _debugInit() {
    if (!this._debugEnabled() || this.__dbgEl) return;
    const el = document.createElement("div");
    el.id = "gp-debug";
    el.className = "gp-debug"; // ← すべてCSS側で
    el.setAttribute("role","status");
    el.setAttribute("aria-live","polite");
    document.body.appendChild(el);
    this.__dbgEl = el;
    this._debugSnapshot("init");
  }
  _debug(...args) {
    if (!this._debugEnabled()) return;
    try {
      this.__dbgEl ||= document.getElementById("gp-debug");
      if (!this.__dbgEl) return;
      const line = document.createElement("div");
      line.textContent = args.map(a=>{
        try { return (typeof a === "object") ? JSON.stringify(a) : String(a); }
        catch { return String(a); }
      }).join(" ");
      this.__dbgEl.appendChild(line);
      this.__dbgEl.scrollTop = this.__dbgEl.scrollHeight;
    } catch {}
  }
  _debugSnapshot(tag="snap") {
    if (!this._debugEnabled()) return;
    const info = {
      tag,
      ios: this._isIOS(),
      hasToken: this._hasOAuthToken(),
      scClientId: !!this._scClientId,
      shouldUseApi: this._shouldUseApi(),
      needsHandshake: this._needsHandshake(),
      forceWidgetOnly: !!window.__forceWidgetOnly,
      hasWidget: !!this.widget,
      hasAudioEl: !!this.audio,
      currentTrackId: this.currentTrackId || null
    };
    this._debug("state", info);
  }
  // ============================================================

  get _scClientId() {
    try {
      const d = this.element?.dataset?.scClientId || document.body?.dataset?.scClientId;
      if (d) return String(d).trim();
      const meta1 = document.querySelector('meta[name="soundcloud-client-id"]');
      if (meta1?.content) return meta1.content.trim();
      const meta2 = document.querySelector('meta[name="sc-client-id"]');
      if (meta2?.content) return meta2.content.trim();
      if (window.SOUNDCLOUD_CLIENT_ID) return String(window.SOUNDCLOUD_CLIENT_ID);
      if (window.SC_CLIENT_ID) return String(window.SC_CLIENT_ID);
    } catch (_) {}
    return "";
  }

  _hasOAuthToken() {
    try {
      const t = this._getOAuthToken();
      if (typeof t !== "string") return false;
      const v = t.trim();
      if (v.length === 0) return false;
      if (/^(undefined|null)$/i.test(v)) return false;
      return true;
    } catch (_) { return false; }
  }

  // === ログイン判定＆ログイン導線 ==========================
  _isLoggedIn() {
    try {
      if (this._hasOAuthToken()) return true; // SC連携トークンがあれば実質ログイン済み
      const b = document.body;
      if (b?.classList?.contains("logged-in")) return true;
      if (b?.dataset?.loggedIn === "true") return true;
      const metaUser = document.querySelector('meta[name="current-user-id"]')?.content?.trim();
      if (metaUser) return true;
      if (typeof window.CURRENT_USER_ID === "number" || (typeof window.CURRENT_USER_ID === "string" && window.CURRENT_USER_ID)) return true;
    } catch(_) {}
    return false;
  }

  // 🔰 ここを“モーダルコントローラーへ委譲”に修正
  _promptLogin() {
    const now = Date.now();
    if (this.__loginShowing) return;
    if (window.__loginGuardTs && (now - window.__loginGuardTs) < 800) return; // 0.8sデバウンス
    this.__loginShowing = true;
    window.__loginGuardTs = now;

    // グローバルにブロードキャスト → modal_controller.js 側で受けてモーダル表示
    window.dispatchEvent(new CustomEvent("app:login-required", {
      detail: { source: "global-player" }
    }));

    // 表示本体はモーダル側が管理するので即解除
    setTimeout(() => { this.__loginShowing = false; }, 100);
  }

  _requireLogin(e = null) {
    if (this._isLoggedIn()) return false;
    e?.preventDefault?.();
    e?.stopPropagation?.();
    this._promptLogin();
    this.stopOnlyPlayer?.(); // 念のため即停止（
    return true;
  }
  // ============================================================

  // === ここが重要：API直再生フラグ
  _shouldUseApi() {
    if (window.__forceWidgetOnly) return false;
    return this._hasOAuthToken(); // トークンがある環境はAPI直再生
  }

  // iOS かつ APIが使えない時だけハンドシェイク表示
  _needsHandshake() { return this._isIOS() && !this._shouldUseApi(); }
  _markHandshakeDone() {}
  _hideScreenCover() {
    try {
      const cover = document.getElementById("screen-cover-loading");
      if (cover) { cover.classList.add("is-hidden"); cover.setAttribute("aria-hidden", "true"); }
    } catch (_) {}
  }

  _showHandshakeHint() {
    if (this._hintEl || !this._needsHandshake()) return;
    const el = document.createElement("div");
    el.id = "sc-handshake-hint";
    el.className = "sc-handshake-hint"; // ← CSSで装飾
    el.textContent = "iPhone：下のSoundCloudプレイヤー内の ▶ をタップして再生を許可してください。曲ごとに最初の1回だけ必要です。";
    el.addEventListener("click", () => this._hideHandshakeHint());
    document.body.appendChild(el);
    this._hintEl = el;
    this._setIframeVisibility(true); // 一時的に出す
    this._debug("needs handshake (iOS widget visible)");
  }
  _hideHandshakeHint() { try { this._hintEl?.remove(); } catch(_) {} this._hintEl = null; }

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

  // ===== iOSオーディオ解錠（保険） =====
  _setupIOSAudioUnlock() {
    try {
      if (!this._isIOS() || window.__iosAudioUnlocked) return;
      const unlock = () => {
        if (window.__iosAudioUnlocked) return;
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) throw new Error("No AudioContext");
          const ctx = new AudioCtx(); const osc = ctx.createOscillator(); const gain = ctx.createGain();
          gain.gain.value = 0.0001; osc.connect(gain).connect(ctx.destination); osc.start(0);
          setTimeout(()=>{ try { osc.stop(0); ctx.close(); } catch(_) {} window.__iosAudioUnlocked = true; }, 50);
        } catch(_) {}
        window.removeEventListener("touchend", unlock, true);
        window.removeEventListener("click", unlock, true);
      };
      window.addEventListener("touchend", unlock, true);
      window.addEventListener("click", unlock, true);
    } catch (_) {}
  }

  _primeAudioForIOS() {
    if (!this._isIOS()) return;
    const a = this._ensureMedia({useVideo:false});
    if (a.__primed) return;
    try {
      a.muted = true;
      a.autoplay = false;
      const p = a.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          try { a.pause(); } catch(_) {}
          a.currentTime = 0;
          a.__primed = true;
          this._debug("audio primed");
        }).catch(()=>{});
      } else {
        try { a.pause(); } catch(_) {}
        a.currentTime = 0;
        a.__primed = true;
        this._debug("audio primed (sync)");
      }
    } catch(_) {}
  }

  // ======== Media要素（audio/video） =========
  _ensureMedia({ useVideo = false } = {}) {
    const tag = useVideo ? "video" : "audio";
    if (this.media && this.media.tagName?.toLowerCase() === tag) return this.media;

    if (this.media) { try { this.media.pause(); } catch(_) {} try { this.media.remove(); } catch(_) {} }

    const el = document.createElement(tag);
    el.preload = "metadata";
    el.crossOrigin = "anonymous";
    el.playsInline = true;
    el.setAttribute("webkit-playsinline","true");
    el.autoplay = false;
    el.classList.add("media-hidden"); // ← CSSで非表示に
    document.body.appendChild(el);

    el.addEventListener("play", this._onAudioPlay);
    el.addEventListener("pause", this._onAudioPause);
    el.addEventListener("ended", this._onAudioEnded);
    el.addEventListener("timeupdate", this._onAudioTime);
    el.addEventListener("durationchange", this._onAudioDur);

    this.media = el;
    this.audio = el;
    return el;
  }

  // ===== HLS/Progressiveの再生器（hls.js 対応） =====
  async _playViaMedia({ streamUrl, useVideo = false, resumeMs = 0 }) {
    const el = this._ensureMedia({ useVideo });
    el.muted = true;
    el.autoplay = false;

    const isHls = useVideo;
    const canNativeHls = !!el.canPlayType && el.canPlayType('application/vnd.apple.mpegurl');

    if (isHls && !canNativeHls && window.Hls && window.Hls.isSupported()) {
      if (this.__hls) { try { this.__hls.destroy(); } catch(_) {} this.__hls = null; }
      const hls = new window.Hls({ maxBufferLength: 30 });
      hls.attachMedia(el);
      hls.loadSource(streamUrl);
      this.__hls = hls;
    } else {
      if (el.src !== streamUrl) {
        el.src = streamUrl;
        try { await el.load?.(); } catch(_) {}
      }
    }

    if (resumeMs > 0) { try { el.currentTime = resumeMs / 1000; } catch(_) {} }

    try {
      await el.play();
    } catch (e1) {
      try { await el.play(); } catch (e2) { throw e2; }
    }

    const unmute = () => { el.muted = false; el.removeEventListener("playing", unmute); };
    el.addEventListener("playing", unmute);

    setTimeout(() => {
      try {
        if (el.paused && (el.readyState >= 2)) {
          this._debug("retry play once (early pause)");
          el.play().catch(()=>{});
        }
      } catch(_) {}
    }, 600);

    if (this._debugEnabled()) {
      const log = (ev) => this._debug("media", ev.type, { rs: el.readyState, ct: el.currentTime });
      ["waiting","stalled","suspend","abort","emptied","error"].forEach(t => {
        el.addEventListener(t, log, { once: true });
      });
    }

    if (this.volumeBar && !this._isIOS()) {
      const v = Math.max(0, Math.min(1, Number(this.volumeBar.value)/100 || 1));
      el.volume = v;
    }
  }

  // ---------- SoundCloud API（プロキシ） ----------
  _authHeaders() {
    if (!this._hasOAuthToken()) return {};
    const tok = this._getOAuthToken();
    return { "X-SC-OAUTH": tok, "Authorization": `OAuth ${tok}` };
  }

  async _resolveStreamUrl(trackUrl) {
    const cleanUrl = this._normalizeTrackUrl(trackUrl);
    try {
      this._log("resolve (proxy only) →", cleanUrl);
      this._debug("resolve start", { via:"proxy", hasToken: this._hasOAuthToken() });

      const r1 = await fetch(`/sc/resolve?url=${encodeURIComponent(cleanUrl)}`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: this._authHeaders()
      });
      if (!r1.ok) {
        const txt = await r1.text().catch(()=> "");
        this._log("resolve fail detail", { status: r1.status, body: txt.slice(0,800) });
        throw new Error(`proxy resolve non-OK ${r1.status}`);
      }
      const track = await r1.json();

      // メタ更新
      this._currentSoundMeta = { title: track?.title, user: { username: track?.user?.username } };

      const trans = Array.isArray(track?.media?.transcodings) ? track.media.transcodings : [];
      if (!trans.length) { this._debug("no transcodings"); throw new Error("No transcodings available"); }

      const byProto = (p) => trans.find(t => new RegExp(p, "i").test(t?.format?.protocol || ""));
      const chosen = (byProto("hls") || byProto("progressive"));
      if (!chosen?.url) { this._debug("no suitable transcoding"); throw new Error("No suitable transcoding"); }

      const streamLocatorViaProxy = `/sc/stream?locator=${encodeURIComponent(chosen.url)}`;
      this._log("stream locator (proxy) →", streamLocatorViaProxy);
      this._debug("stream locator start", { via:"proxy", proto: chosen?.format?.protocol });

      const r2 = await fetch(streamLocatorViaProxy, {
        cache: "no-store",
        credentials: "same-origin",
        headers: this._authHeaders()
      });
      if (!r2.ok) {
        const txt = await r2.text().catch(()=> "");
        this._log("stream fail detail", { status: r2.status, body: txt.slice(0,800) });
        throw new Error(`proxy stream non-OK ${r2.status}`);
      }
      const j2 = await r2.json();

      if (!j2?.url) { this._debug("no final stream url"); throw new Error("No stream URL in response"); }
      this._log("final stream url", j2.url);
      this._debug("final url resolved");
      return { url: j2.url, isHls: /hls/i.test(chosen?.format?.protocol || "") };
    } catch (e) {
      this._log("SoundCloud proxy resolve/stream error", e);
      this._debug("resolve proxy error", String(e));
      throw e;
    }
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
    this._disposeAudio();

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
    this._removeIOSVolumeHint();
  };

  // ★ プレイヤーだけ安全に止める（UIイベントは残す）
  stopOnlyPlayer() {
    try {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
      this.unbindWidgetEvents();
      this.widget = null;
      if (this.audio) { try { this.audio.pause(); } catch(_) {} }
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
    // デバッグ初期化＆簡易スイッチ
    this._debugInit();
    if (location.hash.includes("gpclear")) { localStorage.removeItem("playerState"); this._debug("playerState cleared"); }
    if (location.hash.includes("gpwidget")) { window.__forceWidgetOnly = true; this._debug("force widget only = true"); }
    if (location.hash.includes("gpapi"))    { window.__forceWidgetOnly = false; this._debug("force widget only = false"); }
    this._debug("connect");

    document.addEventListener("turbo:before-cache", this.cleanup, { once: true });
    if (document.body.classList.contains("playlist-show-page")) {
      localStorage.removeItem("playerState");
    }

    // ログイン後にウィジェット固定から復帰
    if (this._hasOAuthToken()) window.__forceWidgetOnly = false;

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
      const target = e.target.closest("[data-track-id]"); if (!target) return;
      if (
        target.matches('[data-global-player-target="playIcon"], .play-overlay-icon') ||
        target.classList.contains("fa") ||
        target.dataset.playUrl
      ) {
        if (this._requireLogin(e)) return; // ← 必ず event を渡す
        if (target.dataset.trackId && !target.dataset.playUrl) {
          this.onPlayIconClick({ currentTarget: target, stopPropagation(){} });
        } else {
          this.loadAndPlay({ currentTarget: target, stopPropagation(){} });
        }
      }
    };
    this._container()?.addEventListener("click", this._onIconClickDelegated);

    // 外部検索から再生
    window.addEventListener("play-from-search", (e) => {
      if (this._requireLogin(e)) return;
      this.playFromExternal(e.detail.playUrl);
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
    this._footerGuardMO.observe(this._container() || document, { childList:true, subtree:true });
    this._updatePlayButton();

    // Media Session
    try {
      if ("mediaSession" in navigator) {
        navigator.mediaSession.setActionHandler("previoustrack", () => this.prevTrack());
        navigator.mediaSession.setActionHandler("nexttrack",     () => this.nextTrack());
      }
    } catch(_) {}

    // --- iOS専用：音量スライダーを隠し、ヒントを表示 ---
    if (this._isIOS()) {
      this._setupIOSVolumeUI();
    } else {
      this._removeIOSVolumeHint();
      this._showVolumeBar();
    }

    if (window.SC?.Widget) this.restorePlayerState();
    else window.addEventListener("load", () => this.restorePlayerState?.());
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
    const current = this.formatTime(posMs), total = this.formatTime(durMs);
    this.seekBar.setAttribute("aria-valuetext", durMs ? `${current} / ${total}` : current);
  }
  updateVolumeAria(valueStr) {
    if (!this.volumeBar) return;
    this.volumeBar.setAttribute("aria-valuenow", String(valueStr));
    this.volumeBar.setAttribute("aria-valuetext", `${valueStr}%`);
  }

  // ---------- 状態保存 / 復元 ----------
  savePlayerState() {
    try {
      if (this._shouldUseApi() && this.audio) {
        const state = {
          trackId:   this.currentTrackId,
          trackUrl:  this._lastResolvedTrackUrl || null,
          position:  Math.floor((this.audio.currentTime||0)*1000),
          duration:  Math.floor((this.audio.duration||0)*1000),
          isPlaying: !this.audio.paused,
          apiMode:   true
        };
        localStorage.setItem("playerState", JSON.stringify(state));
        return;
      }
    } catch (_) {}
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
            apiMode:   false
          };
          localStorage.setItem("playerState", JSON.stringify(state));
        });
      });
    } catch (_) {}
  }

  tryRestore(state, retry = 0) {
    if (state?.apiMode && this._shouldUseApi()) {
      if (!state.trackUrl) return;
      this._resumeAudioFromState(state).catch(() => this._fallbackToWidgetFromAudio());
      return;
    }
    if (!this.widget) return setTimeout(() => this.tryRestore(state, retry), 300);
    this.widget.getDuration((dur) => {
      if (!dur) return setTimeout(() => this.tryRestore(state, retry), 300);
      this.widget.getCurrentSound((s) => { if (s?.title) this._applySoundMetadata(s); else if (retry < 5) return setTimeout(() => this.tryRestore(state, retry+1), 250); });
      this.widget.seekTo(state.position || 0);
      if (!state.isPlaying) this.widget.pause();
      this.setPlayPauseAria(state.isPlaying);
      const percent = dur ? Math.round(((state.position||0)/dur)*100) : 0;
      this.updateSeekAria(percent, state.position||0, dur);
    });
  }

  async _resumeAudioFromState(state) {
    const url = this._extractOriginalPlayUrl(state.trackUrl) || state.trackUrl;
    if (!url) return;
    this.bottomPlayer?.classList.remove("d-none");
    this.resetPlayerUI();
    await this._playViaApi(url, { resumeMs: state.position || 0, autoStart: state.isPlaying }).catch(()=>{
      window.__forceWidgetOnly = true;
      this._fallbackToWidgetFromAudio(url);
    });
  }
  _extractOriginalPlayUrl(embedUrl) {
    try { if (!embedUrl) return null; const u = new URL(embedUrl); const inner = u.searchParams.get("url"); if (inner) return decodeURIComponent(inner); } catch(_) {}
    return null;
  }

  restorePlayerState() {
    const saved = localStorage.getItem("playerState"); if (!saved) return;
    const state = JSON.parse(saved); if (!state.trackUrl) return;
    this.currentTrackId = state.trackId || null;
    this.bottomPlayer?.classList.remove("d-none");

    if (state.apiMode && this._shouldUseApi()) {
      this._resumeAudioFromState(state).catch(() => this._fallbackToWidgetFromAudio());
      return;
    }

    // ここから下は“最終手段としての”ウィジェット復元
    if (this.widget) { this.unbindWidgetEvents(); clearInterval(this.progressInterval); this.widget = null; }
    const visible = this._needsHandshake();
    this.iframeElement = this.replaceIframeWithNew(visible); if (!this.iframeElement) return;
    this.iframeElement.src = state.trackUrl.replace("&auto_play=true","&auto_play=false");
    this.resetPlayerUI();
    if (visible) this._showHandshakeHint();

    this.iframeElement.onload = () => {
      setTimeout(() => {
        try { this.widget = SC.Widget(this.iframeElement); }
        catch(_) { return setTimeout(() => this.restorePlayerState(), 150); }
        this.widget.bind(SC.Widget.Events.READY, () => {
          this.widget.getCurrentSound((s)=>this._applySoundMetadata(s));
          this.widget.seekTo(state.position||0);
          if (state.isPlaying && !this._needsHandshake()) this._forcePlay(); else this.widget.pause();
          this.bindWidgetEvents(); this.startProgressTracking(); this.changeVolume({ target: this.volumeBar });
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

  // ---------- 強制再生（Autoplay対策） ----------
  _forcePlay(maxTries = 5) {
    if (!this.widget) return;
    let tries = 0;
    const tick = () => {
      if (!this.widget) return;
      this.widget.isPaused((paused) => {
        if (!paused) return;
        try { this.widget.play(); } catch(_) {}
        tries += 1;
        if (tries < maxTries) setTimeout(tick, 220);
      });
    };
    setTimeout(tick, 50);
  }

  // ---------- iframeの可視制御 ----------
  _setIframeVisibility(show) {
    const ifr = this.iframeElement || document.getElementById("hidden-sc-player");
    if (!ifr) return;
    ifr.classList.toggle("sc-visible", !!show);
    ifr.classList.toggle("sc-hidden", !show);
  }

  // ---------- iframe作成 ----------
  replaceIframeWithNew(visible) {
    const oldIframe = document.getElementById("hidden-sc-player");
    const parent = (oldIframe && oldIframe.parentNode) || (this.bottomPlayer && this.bottomPlayer.parentNode) || document.body;
    if (oldIframe) this._safeNukeIframe(oldIframe);
    const newIframe = document.createElement("iframe");
    newIframe.id = "hidden-sc-player";
    newIframe.classList.add("sc-keepalive");
    newIframe.allow = "autoplay; encrypted-media";
    newIframe.frameBorder = "no";
    newIframe.scrolling = "no";
    parent.appendChild(newIframe);
    this.iframeElement = newIframe;
    this._setIframeVisibility(!!visible);
    return newIframe;
  }

  // ---------- 外部 URL 再生 ----------
  async playFromExternal(playUrl) {
    if (this._requireLogin()) return;
    this.bottomPlayer?.classList.remove("d-none"); this.bottomPlayer?.offsetHeight;
    if (this.widget) { this.unbindWidgetEvents(); clearInterval(this.progressInterval); this.widget = null; }

    if (this._shouldUseApi()) {
      this.resetPlayerUI();
      this._debug("playFromExternal via API");
      await this._playViaApi(playUrl).catch((err) => {
        this._log("playFromExternal API failed → fallback", err);
        this._debug("playFromExternal API failed → fallback", String(err));
        window.__forceWidgetOnly = true;
        this._fallbackToWidgetFromAudio(playUrl);
      });
      return;
    }

    // 最終手段（トークン無しの場合のみ）
    const show = this._needsHandshake(); if (show) this._showHandshakeHint();
    this.iframeElement = this.replaceIframeWithNew(show); if (!this.iframeElement) { alert("iframe 生成に失敗しました"); return; }
    this.resetPlayerUI();
    this.iframeElement.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(playUrl)}&auto_play=${show ? "false" : "true"}`;
    if (!show) this._setIframeVisibility(false);

    this.iframeElement.onload = () => {
      setTimeout(() => {
        try { this.widget = SC.Widget(this.iframeElement); } catch(_) { return setTimeout(() => this.playFromExternal(playUrl), 120); }
        this.widget.bind(SC.Widget.Events.READY, () => {
          const getSound = (retry=0) => {
            this.widget.getCurrentSound((s) => { if (s?.title) this._applySoundMetadata(s); else if (retry<6) setTimeout(()=>getSound(retry+1),180); });
          };
          getSound();
          this.bindWidgetEvents();
          if (!show) this._forcePlay();
          this.startProgressTracking(); this.changeVolume({ target: this.volumeBar }); this.savePlayerState();
          this._debug("playFromExternal via widget");
        });
      }, 100);
    };
  }

  // ---------- タイル/アイコンから再生 ----------
  async loadAndPlay(event) {
    if (this._requireLogin(event)) return;
    event?.stopPropagation?.();
    if (this._isIOS()) this._primeAudioForIOS();

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

    this.stopOnlyPlayer();
    this._debug("loadAndPlay", { trackId: this.currentTrackId, url: trackUrl });

    if (this._shouldUseApi()) {
      this._log("API mode start");
      this._debug("API mode start");
      await this._playViaApi(trackUrl).catch((err) => {
        this._log("loadAndPlay API failed → fallback", err);
        this._debug("loadAndPlay API failed → fallback", String(err));
        window.__forceWidgetOnly = true;
        this._fallbackToWidgetFromAudio(trackUrl, el);
      });
      return;
    }

    // 最終手段（トークン無し時）
    const show = this._needsHandshake(); if (show) this._showHandshakeHint();
    this.iframeElement = this.replaceIframeWithNew(show); if (!this.iframeElement) return;
    this.iframeElement.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(trackUrl)}&auto_play=${show ? "false" : "true"}`;
    if (!show) this._setIframeVisibility(false);

    this.iframeElement.onload = () => {
      setTimeout(() => {
        try { this.widget = SC.Widget(this.iframeElement); } catch(_) { return setTimeout(() => this.loadAndPlay({ currentTarget: el, stopPropagation(){} }), 120); }
        this.widget.bind(SC.Widget.Events.READY, () => {
          const trySetTitle = (retry=0) => {
            this.widget.getCurrentSound((s) => { if (s?.title) this._applySoundMetadata(s); else if (retry<6) return setTimeout(()=>trySetTitle(retry+1),180); });
          };
          trySetTitle();
          this.bindWidgetEvents();
          if (!show) this._forcePlay();
          this.startProgressTracking(); this.changeVolume({ target: this.volumeBar });
          this.updateTrackIcon(this.currentTrackId, !show); this.setPlayPauseAria(!show); this.savePlayerState();
          this._debug("playing via widget", { handshake: show });
        });
      }, 100);
    };
  }

  // ---------- API 再生本体 ----------
  async _playViaApi(playUrl, opts = {}) {
    const { resumeMs = 0 } = opts;
    this._lastResolvedTrackUrl = playUrl;

    let streamUrl, isHls = false;
    try {
      const r = await this._resolveStreamUrl(playUrl);
      streamUrl = r.url; isHls = !!r.isHls;
    } catch (err) {
      this._log("resolve/stream failed → fallback", err);
      this._debug("resolve/stream failed → fallback", String(err));
      this.hideLoadingUI();
      this._fallbackToWidgetFromAudio(playUrl);
      return;
    }

    try {
      this._debug("play via API", { isHls });
      await this._playViaMedia({ streamUrl, useVideo: isHls, resumeMs });
    } catch (e) {
      this._log("media play failed → fallback", e);
      this._debug("media play failed → fallback", String(e));
      this.hideLoadingUI();
      this._fallbackToWidgetFromAudio(playUrl);
      return;
    }

    // 成功：widget破棄＆不可視
    try {
      this.unbindWidgetEvents();
      this.widget = null;
      const old = document.getElementById("hidden-sc-player");
      this._safeNukeIframe(old);
      this.iframeElement = null;
      this._hideHandshakeHint();
    } catch(_) {}
    window.__forceWidgetOnly = false;

    // 進捗（API版に上書き）
    this.startProgressTracking = () => {
      clearInterval(this.progressInterval);
      this.progressInterval = setInterval(() => {
        if (!this.audio || this.isSeeking) return;
        const pos = Math.floor((this.audio.currentTime||0)*1000);
        const dur = Math.floor((this.audio.duration||0)*1000);
        if (dur > 0) {
          const percent = Math.round((pos/dur)*100);
          if (this.seekBar) this.seekBar.value = String(percent);
          if (this.currentTimeEl) this.currentTimeEl.textContent = this.formatTime(pos);
          if (this.durationEl) this.durationEl.textContent = this.formatTime(dur);
          this.updateSeekAria(percent, pos, dur);
        }
        this.savePlayerState();
      }, 1000);
    };

    // 解決済みメタがあれば即表示
    if (this._currentSoundMeta?.title) this._applySoundMetadata(this._currentSoundMeta);

    // 音量/UI
    this.changeVolume({ target: this.volumeBar });
    this.startProgressTracking();
    this.updateTrackIcon(this.currentTrackId, true);
    this.setPlayPauseAria(true);
    this.hideLoadingUI();
    this._debug("playing via API");
    this.savePlayerState();
  }

  _fallbackToWidgetFromAudio(trackUrl, el = null) {
    this._disposeAudio();
    const url = trackUrl || this._lastResolvedTrackUrl; if (!url) return;

    const show = this._isIOS();
    if (show) this._showHandshakeHint();

    this.iframeElement = this.replaceIframeWithNew(show); if (!this.iframeElement) return;
    this.iframeElement.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(this._normalizeTrackUrl(url))}&auto_play=${show ? "false" : "true"}`;
    if (!show) this._setIframeVisibility(false);

    this.iframeElement.onload = () => {
      setTimeout(() => {
        try { this.widget = SC.Widget(this.iframeElement); } catch(_) { return; }
        this.widget.bind(SC.Widget.Events.READY, () => {
          this.bindWidgetEvents();
          if (!show) this._forcePlay();
          this.startProgressTracking(); this.changeVolume({ target: this.volumeBar });
          this.updateTrackIcon(this.currentTrackId, !show); this.setPlayPauseAria(!show); this.savePlayerState();
          this._debug("fallback → widget");
        });
      }, 80);
    };
  }

  // ---------- トグル ----------
  togglePlayPause(event) {
    if (this._requireLogin(event)) return;
    event?.stopPropagation?.();
    if (this._isIOS()) this._primeAudioForIOS();

    if (this._shouldUseApi()) {
      const a = this._ensureMedia({ useVideo: (this.media?.tagName?.toLowerCase() === "video") });
      if (!a.src && !this.__hls) { alert("プレイヤーが初期化されていません。もう一度曲を選んでください。"); return; }
      if (a.paused) a.play().catch(()=>alert("再生に失敗しました。もう一度タップしてください。"));
      else a.pause();
      setTimeout(()=>this.savePlayerState(), 300);
      return;
    }

    // トークン無しのときだけ widget モード
    if (!this.widget) {
      this.iframeElement = document.getElementById("hidden-sc-player");
      if (this.iframeElement && this.iframeElement.src) {
        try { this.widget = SC.Widget(this.iframeElement); this.bindWidgetEvents(); if (typeof this.restorePlayerState === "function") this.restorePlayerState(); }
        catch { alert("プレイヤーの初期化に失敗しました。もう一度曲を選んでください。"); return; }
      } else { alert("プレイヤーが初期化されていません。もう一度曲を選んでください。"); return; }
    }

    if (this._needsHandshake()) { this._showHandshakeHint(); this._setIframeVisibility(true); return; }

    this.widget.isPaused((paused) => {
      if (paused) { this.widget.play(); setTimeout(()=>this._forcePlay(2),120); } else { this.widget.pause(); }
      setTimeout(()=>this.savePlayerState(), 500);
    });
  }

  // ---------- SC Widget イベント ----------
  onPlay = () => {
    if (this._needsHandshake()) {
      this._markHandshakeDone();
      this._hideHandshakeHint();
      this._setIframeVisibility(false);
    }
    this.playPauseIcon?.classList.replace("fa-play","fa-pause");
    this.updateTrackIcon(this.currentTrackId, true);
    this.setPlayPauseAria(true);
    this.playStartedAt = Date.now();
    this.startWaveformAnime();
    this.widget.getCurrentSound((s) => { if (s?.title) this._applySoundMetadata(s); });
    this._debugSnapshot("widget onPlay");
    this.savePlayerState();
  };
  onPause = () => {
    this.playPauseIcon?.classList.replace("fa-pause","fa-play");
    this.updateTrackIcon(this.currentTrackId, false);
    this.setPlayPauseAria(false);
    this.stopWaveformAnime();
    this._debugSnapshot("widget onPause");
    this.savePlayerState();
  };
  onFinish = () => {
    const playedMs = this.playStartedAt ? Date.now()-this.playStartedAt : 0;
    this.stopWaveformAnime();
    if (playedMs < 32000 && playedMs > 5000) {
      alert("この曲の視聴は30秒までです（権利制限）");
    }
    this.playPauseIcon?.classList.replace("fa-pause","fa-play");
    this.updateTrackIcon(this.currentTrackId,false);
    this.setPlayPauseAria(false);
    clearInterval(this.progressInterval);
    this.playStartedAt = null;

    if (this.isRepeat) {
      const icon = this.playIconTargets.find((icn)=>icn.dataset.trackId==this.currentTrackId)
        || this._q(`[data-track-id="${CSS.escape(String(this.currentTrackId))}"]`, this._container());
      icon && setTimeout(()=>this.loadAndPlay({ currentTarget: icon, stopPropagation(){} }),300);
      return;
    }
    this.updatePlaylistOrder();
    const curIdx = this.playlistOrder.indexOf(this.currentTrackId);
    const nextId = this.playlistOrder[curIdx+1];
    if (nextId) {
      const icon = this.playIconTargets.find((icn)=>icn.dataset.trackId==nextId)
        || this._q(`[data-track-id="${CSS.escape(String(nextId))}"]`, this._container());
      icon && setTimeout(()=>this.loadAndPlay({ currentTarget: icon, stopPropagation(){} }),300);
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
          node.classList.add("fa-play"); node.classList.remove("fa-pause");
        }
      });
      return;
    }
    this.playIconTargets.forEach((icn) => {
      if (icn.dataset.trackId == trackId) {
        icn.classList.toggle("fa-play", !playing);
        icn.classList.toggle("fa-pause", playing);
      } else {
        icn.classList.add("fa-play"); icn.classList.remove("fa-pause");
      }
    });
  }

  bindWidgetEvents() {
    if (!this.widget) return;
    try {
      this.widget.unbind(SC.Widget.Events.PLAY);
      this.widget.unbind(SC.Widget.Events.PAUSE);
      this.widget.unbind(SC.Widget.Events.FINISH);
    } catch(_) {}
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
          const percent = Math.round((pos/dur)*100);
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
    const percent = Number(e?.target?.value ?? this.seekBar?.value ?? 0);
    this.isSeeking = true;

    if (this._shouldUseApi() && this.audio) {
      const dur = Math.max(0, (this.audio.duration||0)*1000); if (!dur) { this.isSeeking=false; return; }
      const ms = Math.max(0, Math.min(dur, Math.round((percent/100)*dur)));
      try { this.audio.currentTime = ms/1000; } catch(_) {}
      this.currentTimeEl && (this.currentTimeEl.textContent = this.formatTime(ms));
      this.updateSeekAria(percent, ms, dur);
      setTimeout(()=>{ this.isSeeking=false; }, 50);
      return;
    }

    if (!this.widget || !this.seekBar) return;
    this.widget.getDuration((dur) => {
      if (!dur) { this.isSeeking=false; return; }
      const ms = Math.max(0, Math.min(dur, Math.round((percent/100)*dur)));
      this.widget.seekTo(ms);
      this.currentTimeEl && (this.currentTimeEl.textContent = this.formatTime(ms));
      this.updateSeekAria(percent, ms, dur);
      setTimeout(()=>{ this.isSeeking=false; }, 50);
    });
  }

  changeVolume(e) {
    const val = Number(e?.target?.value ?? this.volumeBar?.value ?? 100);
    const clamped = Math.max(0, Math.min(100, val));

    // iOS は本体ボタンで調整
    if (this._isIOS()) { this.updateVolumeAria(String(clamped)); return; }

    if (this._shouldUseApi() && this.audio) { try { this.audio.volume = clamped/100; } catch(_) {} this.updateVolumeAria(String(clamped)); return; }
    try { this.widget?.setVolume?.(clamped); } catch(_) {}
    this.updateVolumeAria(String(clamped));
  }

  // ---------- プレイアイコン ----------
  onPlayIconClick(evt) { this.loadAndPlay(evt); }

  formatTime(ms) {
    const n = Number(ms); if (!Number.isFinite(n) || n <= 0) return "0:00";
    const sec = Math.floor(n/1000); const m = Math.floor(sec/60); const s = sec%60;
    return `${m}:${s.toString().padStart(2,"0")}`;
  }

  // ---------- 前後 ----------
  prevTrack(event) {
    if (this._requireLogin(event)) return;
    event?.stopPropagation?.(); this.updatePlaylistOrder();
    if (!this.playlistOrder?.length) return;
    if (!this.currentTrackId) {
      const lastId = this.playlistOrder[this.playlistOrder.length-1];
      const icon = this.playIconTargets.find((icn)=>icn.dataset.trackId==lastId) || this._q(`[data-track-id="${CSS.escape(String(lastId))}"]`, this._container());
      icon && this.loadAndPlay({ currentTarget: icon, stopPropagation(){} }); return;
    }
    const idx = this.playlistOrder.indexOf(this.currentTrackId);
    if (idx > 0) {
      const icon = this.playIconTargets.find((icn)=>icn.dataset.trackId==this.playlistOrder[idx-1]) || this._q(`[data-track-id="${CSS.escape(String(this.playlistOrder[idx-1]))}"]`, this._container());
      icon && this.loadAndPlay({ currentTarget: icon, stopPropagation(){} }); return;
    }
    const lastId2 = this.playlistOrder[this.playlistOrder.length-1];
    const icon2 = this.playIconTargets.find((icn)=>icn.dataset.trackId==lastId2) || this._q(`[data-track-id="${CSS.escape(String(lastId2))}"]`, this._container());
    icon2 && this.loadAndPlay({ currentTarget: icon2, stopPropagation(){} });
  }

  nextTrack(event) {
    if (this._requireLogin(event)) return;
    event?.stopPropagation?.(); this.updatePlaylistOrder();
    if (!this.playlistOrder?.length) return;
    if (!this.currentTrackId) {
      const firstId = this.playlistOrder[0];
      const icon = this.playIconTargets.find((icn)=>icn.dataset.trackId==firstId) || this._q(`[data-track-id="${CSS.escape(String(firstId))}"]`, this._container());
      icon && this.loadAndPlay({ currentTarget: icon, stopPropagation(){} }); return;
    }
    const idx = this.playlistOrder.indexOf(this.currentTrackId);
    if (idx < this.playlistOrder.length-1 && idx >= 0) {
      const nextId = this.playlistOrder[idx+1];
      const icon = this.playIconTargets.find((icn)=>icn.dataset.trackId==nextId) || this._q(`[data-track-id="${CSS.escape(String(nextId))}"]`, this._container());
      icon && this.loadAndPlay({ currentTarget: icon, stopPropagation(){} }); return;
    }
    const firstId2 = this.playlistOrder[0];
    const icon2 = this.playIconTargets.find((icn)=>icn.dataset.trackId==firstId2) || this._q(`[data-track-id="${CSS.escape(String(firstId2))}"]`, this._container());
    icon2 && this.loadAndPlay({ currentTarget: icon2, stopPropagation(){} });
  }

  playFirstTrack(event) {
  if (this._requireLogin(event)) return;
  event?.stopPropagation?.(); this.updatePlaylistOrder();
  if (!this.playlistOrder?.length) return;
  const firstId = this.playlistOrder[0];
  const icon =
    this.playIconTargets.find((icn) => icn.dataset.trackId == firstId) ||
    this._q(`[data-track-id="${CSS.escape(String(firstId))}"]`, this._container());
  if (icon) this.loadAndPlay({ currentTarget: icon, stopPropagation(){} });
  }

  // レイアウト切替（クラス切替のみ）
  switchPlayerTopRow() {
    const isMobile = window.innerWidth <= 768;
    const desktopRow = document.getElementById("player-top-row-desktop");
    const mobileRow  = document.getElementById("player-top-row-mobile");
    if (!desktopRow || !mobileRow) return;
    desktopRow.classList.toggle("is-hidden", isMobile);
    mobileRow.classList.toggle("is-hidden", !isMobile);
  }

  // ---------- UI表示 ----------
  showLoadingUI() {
    this.playPauseIcon?.classList.add("is-hidden");
    this.playPauseButton?.setAttribute("disabled","disabled");
    this.playPauseButton?.setAttribute("aria-disabled","true");
    this.bottomPlayer?.setAttribute("aria-busy","true");
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
    this.playPauseButton?.setAttribute("aria-disabled","false");
    this.bottomPlayer?.setAttribute("aria-busy","false");
    this.loadingArea?.classList.add("is-hidden");
    this.neonCharacter?.classList.add("is-hidden");
    this.trackTitleEl?.classList.remove("is-hidden");
    this.trackTitleTopEl?.classList.remove("is-hidden");
    this.trackArtistEl?.classList.remove("is-hidden");
    this._hideScreenCover();
  }
  resetPlayerUI() {
    this.currentTimeEl && (this.currentTimeEl.textContent = "0:00");
    this.durationEl && (this.durationEl.textContent   = "0:00");
    this.seekBar && (this.seekBar.value = 0);
    this.updateSeekAria(0,0,0);
    if (this.hasPlayIconTarget) this.playIconTargets.forEach((icn)=>{ icn.classList.add("fa-play"); icn.classList.remove("fa-pause"); });
    this.playPauseIcon?.classList.add("fa-play");
    this.playPauseIcon?.classList.remove("fa-pause");
    this.setPlayPauseAria(false);
    this.showLoadingUI();
  }

  // ---------- シャッフル / リピート ----------
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
    this.playlistOrder = this.trackImageTargets.map((img)=>img.dataset.trackId).filter(Boolean);
    if (!this.playlistOrder.length) {
      const nodes = this._qa(".playlist-container [data-track-id][data-play-url]", this._container());
      this.playlistOrder = nodes.map((n)=>String(n.dataset.trackId)).filter(Boolean);
    }
    if (this.isShuffle) {
      for (let i=this.playlistOrder.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [this.playlistOrder[i],this.playlistOrder[j]]=[this.playlistOrder[j],this.playlistOrder[i]]; }
    }
  }

  // 波形アニメ
  startWaveformAnime() {
    if (!this.waveformCtx) return;
    this.waveformAnimating = true;
    const ctx = this.waveformCtx, W=this.waveformCanvas.width, H=this.waveformCanvas.height;
    let t = 0;
    const animate = () => {
      if (!this.waveformAnimating) return;
      ctx.clearRect(0,0,W,H);
      ctx.save(); ctx.strokeStyle = "#10ffec"; ctx.lineWidth = 2; ctx.beginPath();
      for (let x=0; x<W; x+=4) {
        const y = H/2 + Math.sin((x+t)/7)*(H/2.5)*(0.7+0.3*Math.sin(x/17 + t/13));
        ctx.lineTo(x,y);
      }
      ctx.stroke(); ctx.restore(); t += 0.7; requestAnimationFrame(animate);
    };
    animate();
  }

  stopWaveformAnime() {
    this.waveformAnimating = false;
    this.waveformCtx && this.waveformCtx.clearRect(0,0,this.waveformCanvas.width,this.waveformCanvas.height);
  }

  // ====== 内部ヘルパー ======
  _disposeAudio() {
    try { if (this.__hls) { this.__hls.destroy(); this.__hls = null; } } catch(_) {}
    try {
      if (this.media) { try { this.media.pause(); } catch(_) {}
        try { this.media.removeAttribute("src"); this.media.load?.(); } catch(_) {}
        try { this.media.remove(); } catch(_) {}
      }
    } catch(_) {}
    this.audio = null;
    this.media = null;
  }

  _onAudioPlay = () => {
    this.playPauseIcon?.classList.replace("fa-play","fa-pause");
    this.updateTrackIcon(this.currentTrackId, true);
    this.setPlayPauseAria(true);
  };
  _onAudioPause = () => {
    this.playPauseIcon?.classList.replace("fa-pause","fa-play");
    this.updateTrackIcon(this.currentTrackId, false);
    this.setPlayPauseAria(false);
  };
  _onAudioEnded = () => { this.onFinish(); };
  _onAudioTime  = () => {};
  _onAudioDur   = () => {};

  _setupIOSVolumeUI() {
    try { document.body.classList.add("is-ios"); } catch(_) {}

    if (this.volumeBar) {
      this.volumeBar.setAttribute("hidden","hidden");
      this.volumeBar.setAttribute("aria-hidden","true");
      this.volumeBar.setAttribute("disabled","disabled");
      this.volumeBar.classList.add("is-hidden");
      try { this.volumeBar.removeEventListener("input", this._onVolumeInput); } catch(_) {}
    }

    if (!document.getElementById("ios-volume-hint")) {
      const hint = document.createElement("div");
      hint.id = "ios-volume-hint";
      hint.className = "ios-volume-hint";
      hint.setAttribute("role","note");
      hint.setAttribute("aria-live","polite");
      hint.textContent = "iPhone / iPad は本体の音量ボタンで調整してください";
      const container = this.bottomPlayer?.querySelector(".bottom-player-extra-controls") || this.bottomPlayer || document.body;
      container?.appendChild(hint);
    }
  }

  _removeIOSVolumeHint() {
    try { document.getElementById("ios-volume-hint")?.remove(); } catch(_) {}
  }

  _showVolumeBar() {
    if (!this.volumeBar) return;
    this.volumeBar.removeAttribute("hidden");
    this.volumeBar.removeAttribute("aria-hidden");
    this.volumeBar.removeAttribute("disabled");
    this.volumeBar.classList.remove("is-hidden");
    try { this.volumeBar.removeEventListener("input", this._onVolumeInput); } catch(_) {}
    this.volumeBar.addEventListener("input", this._onVolumeInput);
  }
}
