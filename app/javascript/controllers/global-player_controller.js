/* eslint-env browser */ 
/* global SC, Swal */

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
  abortController = null;

    // ★追加：検索モーダルからの再生イベント用ハンドラ（this にバインドされた関数）
  _onPlayFromSearch = (e) => {
    const url = e?.detail?.playUrl;
    if (!url) return;
    if (this._requireLogin()) return;
    this.playFromExternal(url);
  };

    // ★ 追加: フォーム投稿完了時にプレイヤーを完全リセットするハンドラ
  _onRecordSubmitted = () => {
    try {
      // まずプレイヤー本体（API / widget / audio）を止める
      this.stopOnlyPlayer?.();

      // 進捗タイマーも完全停止
      if (this.progressInterval) {
        clearInterval(this.progressInterval);
        this.progressInterval = null;
      }

      // 自動復元用の保存状態を捨てる
      try {
        localStorage.removeItem("playerState");
      } catch (_) {}

      // ボトムプレイヤー自体も一旦隠す（邪魔なら）
      if (this.bottomPlayer) {
        this.bottomPlayer.classList.add("d-none");
        this.bottomPlayer.setAttribute("aria-hidden", "true");
        this.bottomPlayer.setAttribute("inert", "");
      }

      // iOS用ヒントやハンドシェイクメッセージも念のため消す
      this._hideHandshakeHint?.();
      this._removeIOSVolumeHint?.();

      // widget用 iframe も念のため削除 （stopOnlyPlayer でもやっているが保険）
      try {
        const ifr = document.getElementById("hidden-sc-player");
        if (ifr) {
          ifr.src = "about:blank";
          ifr.removeAttribute("src");
          ifr.remove();
        }
        this.iframeElement = null;
      } catch (_) {}
    } catch (_) {
      // ここでの例外は完全に無視（ユーザー操作を邪魔しない）
    }
  };



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
  _log(/* ...args */) { /* no-op */ }
  // もしくはデバッグスイッチに連動させたい場合
  // _log(...args){ if (!this._debugEnabled()) return; try{ console.info("[global-player]", ...args);}catch(_){} }
  // ★追加: 統一ポップアップ（Swalがあればそれを使う）
  _notify({icon="info", title="", text=""} = {}) {
    // 連打防止（800ms）
    const now = Date.now();
    if (window.__gpNotifyTs && (now - window.__gpNotifyTs) < 800) return;
    window.__gpNotifyTs = now;

    if (typeof Swal?.fire === "function") {
      return Swal.fire({
        icon, title, text,
        confirmButtonText: "閉じる",
        customClass: {
          popup:  "cyber-popup",
          title:  "cyber-title",
          htmlContainer: "cyber-text",
          confirmButton: "cyber-btn-ok"
        },
        buttonsStyling: false
      });
    } else {
      alert(title ? `${title}\n\n${text||""}` : (text || ""));
    }
  }

  // === 画面内デバッグ：ここだけ空実装 ========================
  _debugEnabled() { return false; }
  _debugInit() { this.__dbgEl = null; }
  _debug(/* ...args */) {}
  _debugSnapshot(/* tag="snap" */) {}
  // ==========================================================

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
  _getLoginUrl() {
    const m = document.querySelector('meta[name="login-url"]')?.content?.trim();
    if (m) return m;
    const d = document.body?.dataset?.loginUrl;
    if (d) return d;
    return "/login";
  }

  __loginShowing = false;

  _promptLogin() {
    const msg = "ログインが必要です。ログインしますか？";
    const loginUrl = this._getLoginUrl();

    // ローディングカバーが残っていたら消す
    this._hideScreenCover();

    // デバウンス & 多重表示防止（0.8s）
    const now = Date.now();
    if (this.__loginShowing) return;
    if (window.__loginGuardTs && (now - window.__loginGuardTs) < 800) return;
    this.__loginShowing = true;
    window.__loginGuardTs = now;

    // 1) SweetAlert2 がある場合
    if (typeof Swal?.fire === "function") {
      Swal.fire({
        icon: "info",
        title: "再生するにはログインが必要です",
        text: "上部のログインか新規登録を行ってください",
        showCancelButton: false,
        confirmButtonText: "閉じる",
        didClose: () => {},
        customClass: {
          popup:  "cyber-popup",
          title:  "cyber-title",
          htmlContainer: "cyber-text",
          confirmButton: "cyber-btn-ok"
        },
        buttonsStyling: false
      }).finally(() => { this.__loginShowing = false; });
      return;
    }

    // 2) 簡易カスタムポップアップ
    try {
      const id = "login-popup-min";
      if (document.getElementById(id)) { this.__loginShowing = false; return; }

      const wrap = document.createElement("div");
      wrap.id = id;
      wrap.className = "gp-overlay";

      const box  = document.createElement("div");
      box.className = "gp-modal";

      const h    = document.createElement("div");
      h.className = "gp-modal-title";
      h.textContent = "ログインしてください";

      const p    = document.createElement("p");
      p.className = "gp-modal-text";
      p.textContent = "再生するにはログインが必要です。";

      const btns = document.createElement("div");
      btns.className = "gp-modal-actions";

      const btnClose = document.createElement("button");
      btnClose.type = "button";
      btnClose.className = "btn gp-btn gp-btn-secondary";
      btnClose.textContent = "閉じる";

      btns.appendChild(btnClose);
      box.appendChild(h);
      box.appendChild(p);
      box.appendChild(btns);

      wrap.appendChild(box);
      document.body.appendChild(wrap);

      const close = () => { try { wrap.remove(); } catch(_) {} this.__loginShowing = false; };
      btnClose.addEventListener("click", close);
      wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });

      return;
    } catch(_) {
      // fallthrough to confirm
    }

    // 3) 最終フォールバック
    try {
      if (window.confirm(msg)) window.location.href = loginUrl;
    } finally {
      this.__loginShowing = false;
    }
  }

  _requireLogin(e = null) {
    if (this._isLoggedIn()) return false;
    e?.preventDefault?.();
    e?.stopPropagation?.();
    this._promptLogin();
    return true;
  }
  // ============================================================

  // === ここが重要：API直再生フラグ（全環境で採用） ===
  _shouldUseApi() {
    if (window.__forceWidgetOnly) return false;
    return this._hasOAuthToken(); // トークンがある環境はAPI直再生
  }

  // iOS かつ APIが使えない（＝手動許可が必要）時だけハンドシェイク表示
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
    el.className = "sc-handshake-hint"; // ← すべてCSS側で
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

  // --- 追加：どこから呼んでも確実にアンミュートする保険 ---
  _reallyUnmute(el) {
    try {
      if (!el) return;
      el.muted = false;
      if (!this._isIOS()) {
        const v = this.volumeBar ? Math.max(0, Math.min(1, Number(this.volumeBar.value)/100 || 1)) : 1;
        el.volume = v;
      }
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
          // ★プライム後は無音状態を持ち越さない
          a.muted = false;
          a.__primed = true;
          this._debug("audio primed + unmuted");
        }).catch(()=>{ /* noop */ });
      } else {
        try { a.pause(); } catch(_) {}
        a.currentTime = 0;
        a.muted = false; // 同上
        a.__primed = true;
        this._debug("audio primed (sync) + unmuted");
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

    // ---- 初期化：最初から“音が出る側”を強制 ----
    el.muted = false;
    el.autoplay = false;

    // iOS以外は希望音量を先に反映
    if (!this._isIOS() && this.volumeBar) {
      const v = Math.max(0, Math.min(1, Number(this.volumeBar.value)/100 || 1));
      try { el.volume = v; } catch(_) {}
    }

    // HLSなら video / Safari以外は hls.js
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

    // ---- どのイベント順でも確実にアンミュートされるよう多重フック ----
    const unmuteOnce = () => {
      this._reallyUnmute(el);
      el.removeEventListener("playing", unmuteOnce);
      el.removeEventListener("canplay", unmuteOnce);
      el.removeEventListener("loadeddata", unmuteOnce);
      el.removeEventListener("canplaythrough", unmuteOnce);
      el.removeEventListener("loadedmetadata", unmuteOnce);
    };
    el.addEventListener("playing",        unmuteOnce);
    el.addEventListener("canplay",        unmuteOnce);
    el.addEventListener("loadeddata",     unmuteOnce);
    el.addEventListener("canplaythrough", unmuteOnce);
    el.addEventListener("loadedmetadata", unmuteOnce);

    // ---- 再生：resolve後にも“明示アンミュート”でダブル保証 ----
    try {
      await el.play();
      this._reallyUnmute(el);
    } catch (_e1) {
      try {
        await new Promise(r => setTimeout(r, 150));
        await el.play();
        this._reallyUnmute(el);
      } catch (e2) {
        throw e2;
      }
    }

    // ---- 早期停止対策：readyStateは十分・pausedなら1回だけキック ----
    setTimeout(() => {
      try {
        if (el.readyState >= 2 && el.paused) {
          this._debug("retry play once (early pause)");
          el.play().then(() => this._reallyUnmute(el)).catch(()=>{});
        }
      } catch(_) {}
    }, 600);

    if (this._debugEnabled()) {
      const log = (ev) => this._debug("media", ev.type, { rs: el.readyState, ct: el.currentTime, muted: el.muted });
      ["waiting","stalled","suspend","abort","emptied","error"].forEach(t => {
        el.addEventListener(t, log, { once: true });
      });
    }

    // 成功後にもう一度音量を明示（非iOS）
    if (this.volumeBar && !this._isIOS()) {
      const v = Math.max(0, Math.min(1, Number(this.volumeBar.value)/100 || 1));
      try { el.volume = v; } catch(_) {}
    }
  }

  // ---------- SoundCloud API: resolve → stream URL（プロキシのみ） ----------
  _authHeaders() {
    if (!this._hasOAuthToken()) return {};
    const tok = this._getOAuthToken();
    return { "X-SC-OAUTH": tok, "Authorization": `OAuth ${tok}` };
  }

  // ★追加: 削除判定ヘルパ
  _looksDeleted({status, bodyText, trackJson}) {
    try {
      if (status === 404 || status === 410) return true;
      const t = (bodyText || "").toLowerCase();
      if (/not\s*found|deleted|removed|gone|does\s*not\s*exist/.test(t)) return true;
      const policy = (trackJson?.policy || "").toString().toLowerCase();
      const state  = (trackJson?.state  || "").toString().toLowerCase();
      if (policy.includes("blocked") || policy.includes("block")) return false; // ブロックは別扱い
      if (state.includes("removed") || state.includes("deleted")) return true;
      // media.transcodings が完全にゼロで、かつ streamable=false 等も“実質不可”
      if (trackJson && Array.isArray(trackJson?.media?.transcodings) && trackJson.media.transcodings.length === 0) {
        // 明確な deleted までは断定しない
        return false;
      }
    } catch(_) {}
    return false;
  }

  async _resolveStreamUrl(trackUrl) {
    const cleanUrl = this._normalizeTrackUrl(trackUrl);
    try {
      this.abortController?.abort();
      this.abortController = new AbortController();


      this._log("resolve (proxy only) →", cleanUrl);
      this._debug("resolve start", { via:"proxy", hasToken: this._hasOAuthToken() });

      const r1 = await fetch(`/sc/resolve?url=${encodeURIComponent(cleanUrl)}`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: this._authHeaders(),
        signal: this.abortController.signal
      });
      if (!r1.ok) {
        const txt = await r1.text().catch(()=> "");
        this._log("resolve fail detail", { status: r1.status, body: txt.slice(0,800) });

        // ★変更: 404/410など→“削除”として扱うフラグ付きエラーを投げる
        const del = this._looksDeleted({ status: r1.status, bodyText: txt });
        const err = new Error(`proxy resolve non-OK ${r1.status}`);
        if (del) err.__deleted = true;
        throw err;
      }
      const track = await r1.json();

      // ★追加: track JSON内容からも削除相当を判定
      if (this._looksDeleted({ status: 200, bodyText: "", trackJson: track })) {
        const err = new Error("track seems deleted");
        err.__deleted = true;
        throw err;
      }

      // メタ更新
      this._currentSoundMeta = { title: track?.title, user: { username: track?.user?.username } };

      // transcodings → /sc/stream
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
        headers: this._authHeaders(),
        signal: this.abortController.signal
      });
      if (!r2.ok) {
        const txt = await r2.text().catch(()=> "");
        this._log("stream fail detail", { status: r2.status, body: txt.slice(0,800) });

        // ★変更: ここでも 404/410 等を“削除”扱いに昇格
        const del = this._looksDeleted({ status: r2.status, bodyText: txt });
        const err = new Error(`proxy stream non-OK ${r2.status}`);
        if (del) err.__deleted = true;
        throw err;
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
    // ページ切り替え前に「ページ側のイベント」だ
    // け外す
    this.abortController?.abort();  // ← ★ loading中でも即中断！
    
    clearInterval(this.progressInterval);
    this.progressInterval = null;

    try {
      this.seekBar?.removeEventListener("input", this._onSeekInput);
      this.volumeBar?.removeEventListener("input", this._onVolumeInput);
      this._prevBtn?.removeEventListener("click", this._onPrevClick);
      this._nextBtn?.removeEventListener("click", this._onNextClick);
      this._container()?.removeEventListener("click", this._onIconClickDelegated);
      document.removeEventListener("mouseup", this._onMouseUpSeek);
    } catch (_) {}

    try {
      document.removeEventListener("turbo:render", this._updatePlayButton);
      document.removeEventListener("turbo:frame-load", this._updatePlayButton);
      document.removeEventListener("turbo:submit-end", this._updatePlayButton);
      this._footerGuardMO?.disconnect();
      this._footerGuardMO = null;
    } catch (_) {}

    // 見た目系の後始末だけ残す
    this._hideHandshakeHint();
    this._removeIOSVolumeHint();
  };

  // ★ 追加：ログイン時のみプレーヤーを表示
  _showBottomPlayerIfLoggedIn() {
    if (!this._isLoggedIn()) return;
    const bp = this.bottomPlayer || document.getElementById("bottom-player");
    if (!bp) return;
    try {
      bp.classList.remove("d-none");
      bp.removeAttribute("inert");
      bp.setAttribute("aria-hidden", "false");
    } catch (_) {}
  }

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

  _isNavigatingAway = false;


  connect() {

    this._isNavigatingAway = false;
  window.addEventListener("beforeunload", this.cleanup);
    
    // ========== ① 追加: 次ページ到着の“種別”フック & 判定 ==========
    try {
      if (!sessionStorage.getItem("__gp_nav_hooks_set")) {
        // Turbo 管轄の遷移（visit/リンク）
        window.addEventListener("turbo:before-visit", () => {
          try { sessionStorage.setItem("__gp_last_nav_kind", "turbo"); } catch(_) {}
        });

        // ハード遷移（beforeunloadはTurboでは基本走らない）
        window.addEventListener("beforeunload", () => {
          try { sessionStorage.setItem("__gp_last_nav_kind", "hard"); } catch(_) {}
        });

        // data-turbo="false" / target付き / 別オリジン / download属性 などの保険
        window.addEventListener("click", (ev) => {
          const a = ev.target?.closest?.("a[href]");
          if (!a) return;
          const isExternalWin = /_blank|_top|_parent/i.test(a.target || "");
          const turboOff     = a.getAttribute("data-turbo") === "false";
          const downloadAttr = a.hasAttribute("download");
          const newOrigin    = a.origin && a.origin !== location.origin;
          if (isExternalWin || turboOff || downloadAttr || newOrigin) {
            try { sessionStorage.setItem("__gp_last_nav_kind", "hard"); } catch(_) {}
          }
        }, true);

        sessionStorage.setItem("__gp_nav_hooks_set", "1");
      }
    } catch (_) {}

    let _arrivedByTurbo = false;
try {
  const k = sessionStorage.getItem("__gp_last_nav_kind");
  if (k === "turbo") {
    _arrivedByTurbo = true;
  } else if (k === "hard") {
    _arrivedByTurbo = false;
  } else {
    // ★ フォールバック:
    //   nav_kind が取れなくても、同一オリジンの referrer から来ていれば
    //   Turbo 経由の遷移とみなして扱う
    const ref = document.referrer;
    if (ref) {
      try {
        const refUrl = new URL(ref);
        if (refUrl.origin === window.location.origin) {
          _arrivedByTurbo = true;
        }
      } catch (_) {}
    }
  }
  sessionStorage.removeItem("__gp_last_nav_kind"); // 一度使ったら消す
} catch (_) {}
this.__arrivedByTurbo = _arrivedByTurbo;


    // ========== ② 追加: フルリロード到着なら“初期化のみ”（自動復元しない） ==========
    if (!this.__arrivedByTurbo) {
      try {
        this.stopOnlyPlayer?.();
        this._disposeAudio?.();

        const ifr = document.getElementById("hidden-sc-player");
        if (ifr) this._safeNukeIframe(ifr);
        this.iframeElement = null;

        const bp = document.getElementById("bottom-player");
        if (bp) {
          bp.classList.add("d-none");
          bp.setAttribute("aria-hidden","true");
          bp.setAttribute("inert","");
        }

        // 必要なら前ページの状態を完全に捨てる
        // localStorage.removeItem("playerState");
      } catch(_) {}
    }

    // ★ 追記：このページはプレイヤー禁止なら、何も初期化しないで即終了
    if (this._chromeOff()) {
      this._disableCompletely();
      return;
    }

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
      if (target.matches('[data-global-player-target="playIcon"], .play-overlay-icon') || target.classList.contains("fa") || target.dataset.playUrl) {
        if (this._requireLogin(e)) return; // ← e を渡して遷移を止める
        if (target.dataset.trackId && !target.dataset.playUrl) this.onPlayIconClick({ currentTarget: target, stopPropagation(){} });
        else this.loadAndPlay({ currentTarget: target, stopPropagation(){} });
      }
    };
    this._container()?.addEventListener("click", this._onIconClickDelegated);

    // 外部検索から再生
window.addEventListener("play-from-search", this._onPlayFromSearch);
    // ★ 追加: フォーム投稿完了 → プレイヤー停止・状態リセット
    window.addEventListener("emomu:record-submitted", this._onRecordSubmitted);



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

    // ★ 未ログイン時はプレーヤーを一切表示しない（安全ガード）
    if (!this._isLoggedIn()) {
      this.bottomPlayer?.classList.add("d-none");
      try { this._setIframeVisibility(false); } catch(_) {}
    }

    // ========== ③ 変更: 自動復元は Turbo 到着時のみ ==========
    if (this.__arrivedByTurbo) {
      if (window.SC?.Widget) this.restorePlayerState();
      else window.addEventListener("load", () => this.restorePlayerState?.());
    }
  }

  // ---------- A11y ----------



  disconnect() {
    // ページ離脱時の cleanup フック解除
    window.removeEventListener("beforeunload", this.cleanup);

    // 検索モーダル → 再生 のイベント
    window.removeEventListener("play-from-search", this._onPlayFromSearch);

    // ★ 追加: 投稿完了 → プレイヤー停止 のイベント
    window.removeEventListener("emomu:record-submitted", this._onRecordSubmitted);

    // 既存の後始末処理
    this.cleanup();
  }




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


  // ★ 新規追加：APIモード用の startProgressTracking を先にセットする
_prepareApiProgressTracking() {
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
}


  async _resumeAudioFromState(state) {
    const url = this._extractOriginalPlayUrl(state.trackUrl) || state.trackUrl;
    if (!url) return;
    this._showBottomPlayerIfLoggedIn();
    this.resetPlayerUI();
    // ★ Turbo遷移初回だけ startProgressTracking が古いままになるため、先にAPI版へ差し替える
    this._prepareApiProgressTracking();
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
    // ★ 未ログイン時は一切復元しない（=表示もしない）
    if (!this._isLoggedIn()) return;

    const saved = localStorage.getItem("playerState"); if (!saved) return;
    const state = JSON.parse(saved); if (!state.trackUrl) return;
    this.currentTrackId = state.trackId || null;
    this._showBottomPlayerIfLoggedIn();

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

    this._disposeAudio();


    
    this._showBottomPlayerIfLoggedIn(); this.bottomPlayer?.offsetHeight;
    if (this.widget) { this.unbindWidgetEvents(); clearInterval(this.progressInterval); this.widget = null; }

    if (this._shouldUseApi()) {
      this.resetPlayerUI();
      this._debug("playFromExternal via API");
      await this._playViaApi(playUrl).catch((err) => {
        // ★変更: 削除フラグならポップアップ出して中止。その他はフォールバック。
        if (err?.__deleted) {
          this.hideLoadingUI();
          this._notify({ icon: "warning", title: "再生できません", text: "この音楽はSoundCloud上で削除されています。" });
          this.updateTrackIcon(this.currentTrackId, false);
          this.setPlayPauseAria(false);
          return;
        }
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
    this._showBottomPlayerIfLoggedIn();
    this.currentTrackId = newTrackId || null;

    this.stopOnlyPlayer();
    this._debug("loadAndPlay", { trackId: this.currentTrackId, url: trackUrl });

    if (this._shouldUseApi()) {
      this._log("API mode start");
      this._debug("API mode start");
      await this._playViaApi(trackUrl).catch((err) => {
        // ★変更: 削除なら通知して中止。その他はフォールバック。
        if (err?.__deleted) {
          this.hideLoadingUI();
          this._notify({ icon: "warning", title: "再生できません", text: "この音楽はSoundCloud上で削除されています。" });
          this.updateTrackIcon(this.currentTrackId, false);
          this.setPlayPauseAria(false);
          return;
        }
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
      // ★変更: 削除フラグはここで通知して中止。それ以外は従来フォールバックへ委譲（呼び出し側で処理）
      if (err?.__deleted) {
        throw err; // 呼び出し側で通知＆停止
      }
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
    // 曲名・アーティストを即表示（解決済みメタがあれば）
    if (this._currentSoundMeta?.title) this._applySoundMetadata(this._currentSoundMeta);

    // 音量/UI（iOSはvolumeいじらない）
    this.changeVolume({ target: this.volumeBar });
    this.startProgressTracking();
    this.updateTrackIcon(this.currentTrackId, true);
    this.setPlayPauseAria(true);
    this.hideLoadingUI();
    this._debug("playing via API");
    this.savePlayerState();
  }

  _fallbackToWidgetFromAudio(trackUrl, _el = null) {
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

    // iOS では audio.volume は制御不可。UIだけ同期し、早期return。
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
    const icon = this.playIconTargets.find((icn)=>icn.dataset.trackId==firstId) || this._q(`[data-track-id="${CSS.escape(String(firstId))}"]`, this._container());
    icon && this.loadAndPlay({ currentTarget: icon, stopPropagation(){} });
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

  // 波形アニメ（そのまま）
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

  // ====== ここから：内部ヘルパー（追加） ======

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


 _onAudioTime = () => {
  try {
    if (!this.audio || this.isSeeking) return;

    const pos = Math.floor((this.audio.currentTime || 0) * 1000);
    const dur = Math.floor((this.audio.duration || 0) * 1000);
    if (dur > 0) {
      const percent = Math.round((pos / dur) * 100);
      if (this.seekBar) this.seekBar.value = String(percent);
      if (this.currentTimeEl) this.currentTimeEl.textContent = this.formatTime(pos);
      if (this.durationEl) this.durationEl.textContent = this.formatTime(dur);
      this.updateSeekAria(percent, pos, dur);
    }
  } catch (_) {}
};

_onAudioDur = () => {
  // duration が更新されたら UI を即更新するだけ（プレイヤー制御はしない）
  try {
    if (!this.audio) return;
    const dur = Math.floor((this.audio.duration || 0) * 1000);
    if (dur > 0 && this.durationEl) {
      this.durationEl.textContent = this.formatTime(dur);
    }
  } catch (_) {}
};


  _setupIOSVolumeUI() {

    if (!this._isLoggedIn()) return;

    try { document.body.classList.add("is-ios"); } catch(_) {}

    if (this.volumeBar) {
      this.volumeBar.setAttribute("hidden","hidden");
      this.volumeBar.setAttribute("aria-hidden","true");
      this.volumeBar.setAttribute("disabled","disabled");
      this.volumeBar.classList.add("is-hidden"); // ← CSSで非表示
      try { this.volumeBar.removeEventListener("input", this._onVolumeInput); } catch(_) {}
    }

    if (!document.getElementById("ios-volume-hint")) {
      const hint = document.createElement("div");
      hint.id = "ios-volume-hint";
      hint.className = "ios-volume-hint";
      hint.setAttribute("role","note");
      hint.setAttribute("aria-live","polite");
      hint.textContent = "本体ボタンで音量";
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
    this.volumeBar.classList.remove("is-hidden"); // ← CSSで表示
    try { this.volumeBar.removeEventListener("input", this._onVolumeInput); } catch(_) {}
    this.volumeBar.addEventListener("input", this._onVolumeInput);
  }

  // ======== ここから：プレイヤーを完全停止・非表示にするための追加ヘルパ ========

  // 1) この配列に「プレイヤーを出したくないパス」を正規表現で列挙
  //   例: /terms, /privacy, /cookie, /legal は全ブロック
    // 1) この配列に「プレイヤーを出したくないパス」を正規表現で列挙
  //   例: /terms, /privacy, /cookie, /legal, /edit, /contact/new などは全ブロック
  static DISABLE_PATHS = [
    // 既存: 規約・ポリシー系
    /^\/terms(?:\/)?$/i,
    /^\/privacy(?:\/)?$/i,
    /^\/cookie(?:\/)?$/i,
    /^\/legal(?:\/.*)?$/i,

    // 追加: プロフィール編集（Devise + path: "" の場合）
    /^\/edit(?:\/)?$/i,

    // 追加: お問い合わせ（単数 resource :contact）
    /^\/contact\/new(?:\/)?$/i,  // フォームページ
    /^\/contact(?:\/)?$/i,       // 送信後に /contact へリダイレクトする場合の保険
  ];


  // 2) パス一致でオフ
  _chromeOffByPath() {
    try {
      const p = location.pathname || "/";
      return (this.constructor.DISABLE_PATHS || []).some((re) => re.test(p));
    } catch (_) { return false; }
  }

  // 3) body のクラスでオフ（任意：レイアウトが class を付ける場合）
  _chromeOffByBodyClass() {
    try { return document.body?.classList?.contains("page--legal-chrome-off"); } catch(_) { return false; }
  }

  // 4) <body data-chrome-off="true"> でもオフ（インライン script ではない属性）
  _chromeOffByDataAttr() {
    try { return String(document.body?.dataset?.chromeOff || "").toLowerCase() === "true"; } catch(_) { return false; }
  }

  // 総合判定
  _chromeOff() {
    return this._chromeOffByPath() || this._chromeOffByBodyClass() || this._chromeOffByDataAttr();
  }

  // プレイヤーを完全に止め、DOMも非表示化（イベント未登録段階で呼ばれても安全）
  _disableCompletely() {
    try { this.stopOnlyPlayer?.(); } catch(_) {}

    try {
      // 下部プレイヤーを確実に隠す＋操作不能化
      const bp = document.getElementById("bottom-player");
      if (bp) {
        bp.classList.add("d-none");
        bp.setAttribute("aria-hidden", "true");
        bp.setAttribute("inert", "");
      }
    } catch(_) {}

    try {
      // 隠しSC iframe を破棄
      const ifr = document.getElementById("hidden-sc-player");
      if (ifr) {
        ifr.src = "about:blank";
        ifr.removeAttribute("src");
        ifr.remove();
      }
      this.iframeElement = null;
    } catch(_) {}

    try {
      // ★ 追加：iOS音量ヒントが残っていたら消す
      document.getElementById("ios-volume-hint")?.remove();
    } catch(_) {}
  }

}
