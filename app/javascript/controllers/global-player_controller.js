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
  _normalizeTrackUrl(raw) {
    try {
      const u = new URL(raw);
      ["utm_source","utm_medium","utm_campaign","utm_term","utm_content"].forEach(k=>u.searchParams.delete(k));
      return u.toString();
    } catch(_) { return raw; }
  }
  _log(...args){ try{ console.info("[global-player]", ...args);}catch(_){} }

  // ====== API再生フラグ/状態（iOS限定 → 全環境） ======
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
  // ← 修正：iOS専用ではなく、Client ID があれば常にAPI優先
  _shouldUseApi() { return !!this._scClientId && !window.__forceWidgetOnly; }
  _needsHandshake() { return this._isIOS() && !this._shouldUseApi(); } // iOSでWidgetを使うときだけ必要
  _markHandshakeDone() {}
  _hideScreenCover() {
    try {
      const cover = document.getElementById("screen-cover-loading");
      if (cover) { cover.style.display = "none"; cover.setAttribute("aria-hidden", "true"); }
    } catch (_) {}
  }

  // 小さなヒントバナー（iOSかつウィジェット使用時のみ）
  _showHandshakeHint() {
    if (this._hintEl || !this._needsHandshake()) return;
    const el = document.createElement("div");
    el.id = "sc-handshake-hint";
    Object.assign(el.style, {
      position:"fixed", left:"12px", right:"12px", bottom:"12px", zIndex:"99999",
      padding:"10px 12px", fontSize:"14px", borderRadius:"10px",
      background:"rgba(0,0,0,0.85)", color:"#fff", lineHeight:"1.5",
      boxShadow:"0 4px 16px rgba(0,0,0,.25)", textAlign:"center"
    });
    el.textContent = "iPhone：下のSoundCloudプレイヤー内の ▶ をタップして再生を許可してください。曲ごとに最初の1回だけ必要です。";
    el.addEventListener("click", () => this._hideHandshakeHint());
    document.body.appendChild(el);
    this._hintEl = el;
  }
  _hideHandshakeHint() { try { this._hintEl?.remove(); } catch(_) {} this._hintEl = null; }

  // 旧 iframe を安全に破棄
  _safeNukeIframe(iframe) {
    try {
      if (!iframe) return;
      iframe.src = "about:blank";
      iframe.removeAttribute("src");
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    } catch (_) {}
  }

  // メタデータ→UI
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

  // Widgetイベント解除
  unbindWidgetEvents() {
    if (!this.widget) return;
    try {
      this.widget.unbind(SC.Widget.Events.PLAY);
      this.widget.unbind(SC.Widget.Events.PAUSE);
      this.widget.unbind(SC.Widget.Events.FINISH);
    } catch (_) {}
  }

  // iOSオーディオアンロック（AudioContext）
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

  // iOSのユーザー操作直後に audio を「無音で一瞬再生」して再生権を確保
  _primeAudioForIOS() {
    if (!this._isIOS()) return;
    const a = this._ensureAudio();
    if (a.__primed) return;
    try {
      a.muted = true;
      const p = a.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          try { a.pause(); } catch(_) {}
          a.currentTime = 0;
          a.__primed = true;
        }).catch(()=>{});
      } else {
        try { a.pause(); } catch(_) {}
        a.currentTime = 0;
        a.__primed = true;
      }
    } catch(_) {}
  }

  // ======== API用：Audio要素 =========
  _ensureAudio() {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = "auto";
      this.audio.playsInline = true;
      this.audio.addEventListener("play", this._onAudioPlay);
      this.audio.addEventListener("pause", this._onAudioPause);
      this.audio.addEventListener("ended", this._onAudioEnded);
      this.audio.addEventListener("timeupdate", this._onAudioTime);
      this.audio.addEventListener("durationchange", this._onAudioDur);
      this.audio.addEventListener("error", (e) => {
        this._log("Audio error", e);
        if (!this.widget) this._fallbackToWidgetFromAudio();
      });
    }
    return this.audio;
  }
  _disposeAudio() {
    if (!this.audio) return;
    try { this.audio.pause(); this.audio.src=""; this.audio.removeAttribute("src"); } catch(_) {}
    try {
      this.audio.removeEventListener("play", this._onAudioPlay);
      this.audio.removeEventListener("pause", this._onAudioPause);
      this.audio.removeEventListener("ended", this._onAudioEnded);
      this.audio.removeEventListener("timeupdate", this._onAudioTime);
      this.audio.removeEventListener("durationchange", this._onAudioDur);
    } catch(_) {}
    this.audio = null;
  }
  _onAudioPlay = () => {
    this.playPauseIcon?.classList.replace("fa-play", "fa-pause");
    this.updateTrackIcon(this.currentTrackId, true);
    this.setPlayPauseAria(true);
    this.playStartedAt = Date.now();
    this.startWaveformAnime();
    if (this._currentSoundMeta) this._applySoundMetadata(this._currentSoundMeta);
    this.savePlayerState();
  };
  _onAudioPause = () => {
    this.playPauseIcon?.classList.replace("fa-pause", "fa-play");
    this.updateTrackIcon(this.currentTrackId, false);
    this.setPlayPauseAria(false);
    this.stopWaveformAnime();
    this.savePlayerState();
  };
  _onAudioEnded = () => {
    const playedMs = this.playStartedAt ? Date.now() - this.playStartedAt : 0;
    this.stopWaveformAnime();
    if (playedMs < 32000 && playedMs > 5000) {
      (window.Swal)
        ? Swal.fire({ icon:"info", title:"試聴終了", text:"この曲の視聴は30秒までです（権利制限）" })
        : alert("この曲の視聴は30秒までです（権利制限）");
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
    const nextId = this.playlistOrder[curIdx + 1];
    if (nextId) {
      const icon = this.playIconTargets.find((icn)=>icn.dataset.trackId==nextId)
        || this._q(`[data-track-id="${CSS.escape(String(nextId))}"]`, this._container());
      icon && setTimeout(()=>this.loadAndPlay({ currentTarget: icon, stopPropagation(){} }),300);
      return;
    }
    this.bottomPlayer?.classList.add("d-none");
    this.savePlayerState();
  };
  _onAudioTime = () => {
    if (!this.audio) return;
    const pos = Math.floor((this.audio.currentTime||0)*1000);
    const dur = Math.floor((this.audio.duration||0)*1000);
    if (dur > 0) {
      const percent = Math.round((pos/dur)*100);
      if (this.seekBar) this.seekBar.value = String(percent);
      if (this.currentTimeEl) this.currentTimeEl.textContent = this.formatTime(pos);
      if (this.durationEl) this.durationEl.textContent = this.formatTime(dur);
      this.updateSeekAria(percent, pos, dur);
    }
  };
  _onAudioDur = () => {
    if (!this.audio) return;
    const dur = Math.floor((this.audio.duration||0)*1000);
    if (this.durationEl) this.durationEl.textContent = this.formatTime(dur);
  };

  // ---------- SoundCloud API: resolve → stream URL（まず自サイトのプロキシを使う） ----------
  async _resolveStreamUrl(trackUrl) {
    const cid = this._scClientId;
    if (!cid) { this._log("client_id missing"); throw new Error("SoundCloud client_id is missing"); }

    const cleanUrl = this._normalizeTrackUrl(trackUrl);

    // ① 同一オリジンの軽量プロキシで /resolve を叩く
    const v2ViaProxy = `/sc/resolve?url=${encodeURIComponent(cleanUrl)}`;
    this._log("resolve (proxy) →", v2ViaProxy);

    let track;
    try {
      const r1 = await fetch(v2ViaProxy, { cache: "no-store", credentials: "same-origin" });
      if (!r1.ok) throw new Error(`proxy resolve non-OK ${r1.status}`);
      track = await r1.json();
    } catch (e) {
      this._log("proxy resolve error", e);
      // ② 保険で直アクセス
      const resolveApi = `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(cleanUrl)}&client_id=${encodeURIComponent(cid)}`;
      this._log("resolve (v2 direct) →", resolveApi);
      const r1b = await fetch(resolveApi, {
        credentials: "omit",
        mode: "cors",
        headers: { "Accept": "application/json" },
        referrerPolicy: "no-referrer"
      });
      if (!r1b.ok) throw new Error(`resolve failed: ${r1b.status}`);
      track = await r1b.json();
    }

    // メタ更新
    this._currentSoundMeta = { title: track?.title, user: { username: track?.user?.username } };

    // ③ v2 track の transcodings → /sc/stream でロケータ取得（HLS優先）
    const trans = Array.isArray(track?.media?.transcodings) ? track.media.transcodings : [];
    if (!trans.length) { this._log("no transcodings"); throw new Error("No transcodings available"); }

    const chosen = trans.find(t => /hls/i.test(t?.format?.protocol || "")) ||
                   trans.find(t => /progressive/i.test(t?.format?.protocol || ""));
    if (!chosen?.url) { this._log("no suitable transcoding"); throw new Error("No suitable transcoding"); }

    const streamLocatorViaProxy = `/sc/stream?locator=${encodeURIComponent(chosen.url)}`;
    this._log("stream locator (proxy) →", streamLocatorViaProxy);

    let j2;
    try {
      const r2 = await fetch(streamLocatorViaProxy, { cache: "no-store", credentials: "same-origin" });
      if (!r2.ok) throw new Error(`proxy stream non-OK ${r2.status}`);
      j2 = await r2.json();
    } catch (e) {
      this._log("proxy stream error", e);
      // ④ 保険で直アクセス
      const streamApi = `${chosen.url}?client_id=${encodeURIComponent(cid)}`;
      this._log("stream locator (direct) →", streamApi);
      const r2b = await fetch(streamApi, {
        credentials: "omit",
        mode: "cors",
        headers: { "Accept": "application/json" },
        referrerPolicy: "no-referrer"
      });
      if (!r2b.ok) throw new Error(`Stream location failed: ${r2b.status}`);
      j2 = await r2b.json();
    }

    if (!j2?.url) { this._log("no final stream url"); throw new Error("No stream URL in response"); }
    this._log("final stream url", j2.url);
    return { url: j2.url, isHls: /hls/i.test(chosen?.format?.protocol || "") };
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
  };

  // ★ プレイヤーだけ安全に止める（UIイベントは残す）
  stopOnlyPlayer() {
    try {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
      this.unbindWidgetEvents();
      this.widget = null;
      if (this.audio) this.audio.pause();
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
      const target = e.target.closest("[data-track-id]"); if (!target) return;
      if (target.matches('[data-global-player-target="playIcon"], .play-overlay-icon') || target.classList.contains("fa") || target.dataset.playUrl) {
        if (target.dataset.trackId && !target.dataset.playUrl) this.onPlayIconClick({ currentTarget: target, stopPropagation(){} });
        else this.loadAndPlay({ currentTarget: target, stopPropagation(){} });
      }
    };
    this._container()?.addEventListener("click", this._onIconClickDelegated);

    // 外部検索から再生
    window.addEventListener("play-from-search", (e) => this.playFromExternal(e.detail.playUrl));

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

    if (window.SC?.Widget) this.restorePlayerState();
    else window.addEventListener("load", () => this.restorePlayerState?.());

    // Media Session（対応環境のみ）
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.setActionHandler("previoustrack", () => this.prevTrack());
        navigator.mediaSession.setActionHandler("nexttrack", () => this.nextTrack());
        navigator.mediaSession.setActionHandler("play", () => this.togglePlayPause());
        navigator.mediaSession.setActionHandler("pause", () => this.togglePlayPause());
      } catch(_) {}
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
    await this._playViaApi(url, { resumeMs: state.position || 0, autoStart: state.isPlaying }).catch((err)=>{
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

  // ---------- 強制再生（WidgetのAutoplay対策） ----------
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

  // ---------- iframe作成 ----------
  replaceIframeWithNew(visible) {
    const oldIframe = document.getElementById("hidden-sc-player");
    const parent = (oldIframe && oldIframe.parentNode) || (this.bottomPlayer && this.bottomPlayer.parentNode) || document.body;
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
  async playFromExternal(playUrl) {
    this.bottomPlayer?.classList.remove("d-none"); this.bottomPlayer?.offsetHeight;
    if (this.widget) { this.unbindWidgetEvents(); clearInterval(this.progressInterval); this.widget = null; }

    if (this._shouldUseApi()) {
      this.resetPlayerUI();
      await this._playViaApi(playUrl).catch((err) => {
        this._log("playFromExternal API failed → fallback", err);
        window.__forceWidgetOnly = true;
        this._fallbackToWidgetFromAudio(playUrl);
      });
      return;
    }

    const show = this._needsHandshake(); if (show) this._showHandshakeHint();
    this.iframeElement = this.replaceIframeWithNew(show); if (!this.iframeElement) { alert("iframe 生成に失敗しました"); return; }
    this.resetPlayerUI();
    this.iframeElement.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(playUrl)}&auto_play=${show ? "false" : "true"}`;
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
        });
      }, 100);
    };
  }

  // ---------- タイル/アイコンクリックで再生 ----------
  async loadAndPlay(event) {
    event?.stopPropagation?.();

    // iOS: タップ直後にプライム実行（初回のみ）
    this._primeAudioForIOS();

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

    if (this._shouldUseApi()) {
      await this._playViaApi(trackUrl).catch((err) => {
        this._log("loadAndPlay API failed → fallback", err);
        window.__forceWidgetOnly = true;
        this._fallbackToWidgetFromAudio(trackUrl, el);
      });
      return;
    }

    const show = this._needsHandshake(); if (show) this._showHandshakeHint();
    this.iframeElement = this.replaceIframeWithNew(show); if (!this.iframeElement) return;
    this.iframeElement.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(trackUrl)}&auto_play=${show ? "false" : "true"}`;
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
        });
      }, 100);
    };
  }

  // ---------- API再生本体 ----------
  async _playViaApi(playUrl, opts = {}) {
    const { resumeMs = 0, autoStart = true } = opts;
    this._lastResolvedTrackUrl = playUrl;

    let streamUrl, isHls;
    try {
      ({ url: streamUrl, isHls } = await this._resolveStreamUrl(playUrl));
    } catch (err) {
      this._log("resolve/stream failed → fallback", err);
      this.hideLoadingUI();
      this._fallbackToWidgetFromAudio(playUrl);
      return;
    }

    const a = this._ensureAudio();
    a.src = streamUrl;
    a.crossOrigin = "anonymous";
    a.load();

    if (resumeMs > 0) { try { a.currentTime = resumeMs/1000; } catch(_) {} }

    // iOS 初回の自動再生制限に配慮
    const needsUnlock = this._isIOS();
    if (autoStart !== false) {
      if (needsUnlock) a.muted = true;
      try {
        await a.play();
      } catch (err1) {
        this._log("audio.play() rejected (1st)", err1);
        try {
          a.load(); await a.play();
        } catch (err2) {
          this._log("audio.play() rejected (2nd) → fallback", err2);
          if (needsUnlock) try { a.muted = false; } catch(_) {}
          this.hideLoadingUI();
          this._fallbackToWidgetFromAudio(playUrl);
          return;
        }
      }
      if (needsUnlock) setTimeout(()=>{ try { a.muted = false; } catch(_) {} }, 0);
    }

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

    // Media Session のメタ（対応環境のみ）
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: this._currentSoundMeta?.title || "",
          artist: this._currentSoundMeta?.user?.username || "",
          album: "",
          artwork: []
        });
      } catch(_) {}
    }

    this.changeVolume({ target: this.volumeBar });
    this.startProgressTracking();
    this.updateTrackIcon(this.currentTrackId, true);
    this.setPlayPauseAria(true);
    this.hideLoadingUI();
    this.savePlayerState();
  }

  _fallbackToWidgetFromAudio(trackUrl, el = null) {
    this._disposeAudio();
    const url = trackUrl || this._lastResolvedTrackUrl; if (!url) return;

    const show = this._isIOS();
    if (show) this._showHandshakeHint();

    this.iframeElement = this.replaceIframeWithNew(show); if (!this.iframeElement) return;
    this.iframeElement.classList.add("sc-visible");
    this.iframeElement.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(this._normalizeTrackUrl(url))}&auto_play=${show ? "false" : "true"}`;
    this.iframeElement.onload = () => {
      setTimeout(() => {
        try { this.widget = SC.Widget(this.iframeElement); } catch(_) { return; }
        this.widget.bind(SC.Widget.Events.READY, () => {
          this.bindWidgetEvents();
          if (!show) this._forcePlay();
          this.startProgressTracking(); this.changeVolume({ target: this.volumeBar });
          this.updateTrackIcon(this.currentTrackId, !show); this.setPlayPauseAria(!show); this.savePlayerState();
        });
      }, 80);
    };
  }

  // ---------- トグル ----------
  togglePlayPause(event) {
    event?.stopPropagation?.();

    // iOS: タップ直後にプライム実行
    this._primeAudioForIOS();

    if (this._shouldUseApi()) {
      const a = this._ensureAudio();
      if (!a.src) { alert("プレイヤーが初期化されていません。もう一度曲を選んでください。"); return; }
      if (a.paused) a.play().catch(()=>alert("再生に失敗しました。もう一度タップしてください。"));
      else a.pause();
      setTimeout(()=>this.savePlayerState(), 300);
      return;
    }

    if (!this.widget) {
      this.iframeElement = document.getElementById("hidden-sc-player");
      if (this.iframeElement && this.iframeElement.src) {
        try { this.widget = SC.Widget(this.iframeElement); this.bindWidgetEvents(); if (typeof this.restorePlayerState === "function") this.restorePlayerState(); }
        catch { alert("プレイヤーの初期化に失敗しました。もう一度曲を選んでください。"); return; }
      } else { alert("プレイヤーが初期化されていません。もう一度曲を選んでください。"); return; }
    }

    if (this._needsHandshake()) { this._showHandshakeHint(); try { this.iframeElement?.classList.add("sc-visible"); } catch(_) {} return; }

    this.widget.isPaused((paused) => {
      if (paused) { this.widget.play(); setTimeout(()=>this._forcePlay(2),120); } else { this.widget.pause(); }
      setTimeout(()=>this.savePlayerState(), 500);
    });
  }

  // ---------- SC Widget イベント ----------
  onPlay = () => {
    if (this._needsHandshake()) { this._markHandshakeDone(); this._hideHandshakeHint(); try { this.iframeElement?.classList.remove("sc-visible"); } catch(_) {} }
    this.playPauseIcon?.classList.replace("fa-play","fa-pause");
    this.updateTrackIcon(this.currentTrackId, true);
    this.setPlayPauseAria(true);
    this.playStartedAt = Date.now();
    this.startWaveformAnime();
    this.widget.getCurrentSound((s) => { if (s?.title && !this.trackTitleEl.textContent) this._applySoundMetadata(s); });
    this.savePlayerState();
  };
  onPause = () => {
    this.playPauseIcon?.classList.replace("fa-pause","fa-play");
    this.updateTrackIcon(this.currentTrackId, false);
    this.setPlayPauseAria(false);
    this.stopWaveformAnime();
    this.savePlayerState();
  };
  onFinish = () => {
    const playedMs = this.playStartedAt ? Date.now()-this.playStartedAt : 0;
    this.stopWaveformAnime();
    if (playedMs < 32000 && playedMs > 5000) {
      (window.Swal)
        ? Swal.fire({ icon:"info", title:"試聴終了", text:"この曲の視聴は30秒までです（権利制限）" })
        : alert("この曲の視聴は30秒までです（権利制限）");
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

  // ---------- 進行状況（Widget版） ----------
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
    event?.stopPropagation?.(); this.updatePlaylistOrder();
    if (!this.playlistOrder?.length) return;
    const firstId = this.playlistOrder[0];
    const icon = this.playIconTargets.find((icn)=>icn.dataset.trackId==firstId) || this._q(`[data-track-id="${CSS.escape(String(firstId))}"]`, this._container());
    icon && this.loadAndPlay({ currentTarget: icon, stopPropagation(){} });
  }

  // レイアウト切替
  switchPlayerTopRow() {
    const isMobile = window.innerWidth <= 768;
    const desktopRow = document.getElementById("player-top-row-desktop");
    const mobileRow  = document.getElementById("player-top-row-mobile");
    if (!desktopRow || !mobileRow) return;
    desktopRow.style.display = isMobile ? "none" : "flex";
    mobileRow.style.display  = isMobile ? "flex" : "none";
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

  // 波形
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
}
