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

  // ★追加：iOS無音解錠フラグ（クラスフィールド）
  _iosUnlocked = false;

  // ===== 追加: フォールバック用ユーティリティ =====
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
    // ローディング覆いが閉じない保険（別コントローラが落ちても畳む）
    try {
      const cover = document.getElementById("screen-cover-loading");
      if (cover) {
        cover.style.display = "none";
        cover.setAttribute("aria-hidden", "true");
      }
    } catch (_) {}
  }

  // === 追加：iOS判定 & 無音“解錠” ===
  _isIOS() {
    return /iP(hone|ad|od)/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }
  /**
   * iOSの自動再生ブロックを、ユーザータップ中に“無音1ショット再生(約39ms)”で解除。
   * 何度も実行されないようフラグでガード。
   */
  async _primeIOSAutoplay() {
    if (!this._isIOS() || this._iosUnlocked) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        const ctx = new AC();
        await ctx.resume().catch(() => {});
        const buf = ctx.createBuffer(1, 1, 22050); // 1サンプルの無音
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
        setTimeout(() => {
          try { src.stop(0); } catch (_) {}
        }, 39);
        this._iosUnlocked = true;
        return;
      }
      // 保険：<audio muted> でも解錠トライ
      const a = new Audio();
      a.muted = true;
      a.src = "data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAA"; // 無音データ
      await a.play().catch(() => {});
      setTimeout(() => { try { a.pause(); } catch (_) {} }, 39);
      this._iosUnlocked = true;
    } catch (_) {
      // 失敗しても致命ではない（次のタップでまた試す）
    }
  }

  // === 追加：旧 iframe を安全に破棄（SCのpostMessage先を断つ）===
  _safeNukeIframe(iframe) {
    try {
      if (!iframe) return;
      iframe.src = "about:blank";           // 内部処理を停止
      iframe.removeAttribute("src");        // 参照を切る
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe); // DOMから除去
    } catch (_) {}
  }

  // === 追加：メタデータ反映の共通化（挙動は既存と同じ） ===
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

  // === 追加：unbind を一本化（bindWidgetEvents は既存のまま利用） ===
  unbindWidgetEvents() {
    if (!this.widget) return;
    try {
      this.widget.unbind(SC.Widget.Events.PLAY);
      this.widget.unbind(SC.Widget.Events.PAUSE);
      this.widget.unbind(SC.Widget.Events.FINISH);
    } catch (_) {}
  }

  cleanup = () => {
    clearInterval(this.progressInterval);

    // 追加: 手動付与したイベントリスナを確実に解除
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

    // ★追加：旧iframeを「空→除去」してpostMessageノイズを抑止
    try {
      const old = document.getElementById("hidden-sc-player");
      this._safeNukeIframe(old);
      this.iframeElement = null;
    } catch (_) {}

    // ★追加：フッターの再生ボタン有効/無効監視の後始末
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

    // showページでキャッシュリセット
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

    // ===== シークバーのドラッグ制御（従来通り）=====
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

    // ====== 追加: data-action取りこぼし時の“保険”ハンドラ ======
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

    // 追加: タイル画像/再生アイコンのクリックが届かないケースのフォールバック（イベント委譲）
    this._onIconClickDelegated = (e) => {
      const target = e.target.closest("[data-track-id]");
      if (!target) return;
      // 再生アイコン or 画像いずれも拾う
      if (
        target.matches('[data-global-player-target="playIcon"], .play-overlay-icon') ||
        target.classList.contains("fa") ||
        target.dataset.playUrl
      ) {
        // すでにアイコンなら onPlayIconClick、画像なら loadAndPlay を直接呼ぶ
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

    // ★iOS解錠を確実にする：最初のタップ/クリックで一度だけ解錠
    window.addEventListener("touchstart", () => this._primeIOSAutoplay(), { once: true, passive: true });
    window.addEventListener("click", () => this._primeIOSAutoplay(), { once: true });

    this.switchPlayerTopRow();
    window.addEventListener("resize", () => {
      this.switchPlayerTopRow();
      if (this.waveformCanvas) {
        this.waveformCanvas.width  = this.waveformCanvas.offsetWidth;
        this.waveformCanvas.height = this.waveformCanvas.offsetHeight;
      }
    });

    // 初期の見た目をフラグと同期
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

    // ★追加：曲の有無でフッター「再生」を有効/無効に切替（既存ロジック非変更）
    this._updatePlayButton = () => {
      const btn = document.querySelector(".mobile-footer-menu .playfirst");
      if (!btn) return;
      const has = !!(this._container()?.querySelector("[data-track-id]"));
      btn.toggleAttribute("disabled", !has);
      btn.setAttribute("aria-disabled", String(!has));
      btn.classList.toggle("is-disabled", !has); // 見た目用（CSS側で任意）
    };
    document.addEventListener("turbo:render", this._updatePlayButton);
    document.addEventListener("turbo:frame-load", this._updatePlayButton);
    document.addEventListener("turbo:submit-end", this._updatePlayButton);
    this._footerGuardMO = new MutationObserver(() => queueMicrotask(this._updatePlayButton));
    this._footerGuardMO.observe(this._container() || document, { childList: true, subtree: true });
    this._updatePlayButton();
    // ★追加ここまで

    this.restorePlayerState();
    console.log("[connect] global-player controller initialized");
  }

  // ---------- A11y: ヘルパ ----------
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

    this.iframeElement.onload = () => {
      setTimeout(() => {
        try {
          this.widget = SC.Widget(this.iframeElement);
        } catch (_) {
          // READY前で失敗したら少し待って再試行
          return setTimeout(() => this.restorePlayerState(), 150);
        }

        this.widget.bind(SC.Widget.Events.READY, () => {
          this.widget.getCurrentSound((sound) => {
            if (sound?.title) {
              this._applySoundMetadata(sound);
            } else {
              this._applySoundMetadata(undefined);
            }
            this.widget.seekTo(state.position || 0);

            // ★iOSではここで勝手に再生を開始しない（ユーザー明示のトグルに委ねる）
            if (!this._isIOS()) {
              state.isPlaying ? this.widget.play() : this.widget.pause();
            } else {
              if (!state.isPlaying) this.widget.pause();
            }

            this.bindWidgetEvents();
            this.startProgressTracking();
            this.changeVolume({ target: this.volumeBar });

            // ★修正：UIは実際に再生する可能性（iOS除外）でのみ「再生中」表示
            const willPlay = !this._isIOS() && state.isPlaying;
            this.updateTrackIcon(this.currentTrackId, willPlay);
            this.setPlayPauseAria(willPlay);
          });
        });
      }, 150);
    };
  }

  setTrackTitle(title) {
    this.trackTitleEl    && (this.trackTitleEl.textContent    = title);
    this.trackTitleTopEl && (this.trackTitleTopEl.textContent = title);
  }

  // -------------- 外部 URL 再生 -----------------
  playFromExternal(playUrl) {
    // ★追加：この発火の文脈でiOS解錠
    this._primeIOSAutoplay();

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
              if (sound?.title) {
                this._applySoundMetadata(sound);
              } else if (retry < 6) {
                setTimeout(() => getSound(retry + 1), 180);
              } else {
                this._applySoundMetadata(undefined);
              }
            });
          };
          getSound();

          this.bindWidgetEvents();

          // ★iOSでは明示playを呼ばない（auto_playに委ねる）
          if (!this._isIOS()) {
            this.widget.play();
          }

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

  // -------------- シャッフル / リピート -----------------
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
    // まずはStimulusのtargetsから
    this.playlistOrder = this.trackImageTargets.map((img) => img.dataset.trackId).filter(Boolean);

    // ★ フォールバック: targets が空でも DOM 直走査で順序を作る
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
    this._hideScreenCover(); // ★ 覆いの畳み込みを最終保証
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

  // -------------- iframe差し替え -----------------
  replaceIframeWithNew() {
    const oldIframe = document.getElementById("hidden-sc-player");
    const parent =
      (oldIframe && oldIframe.parentNode) ||
      (this.bottomPlayer && this.bottomPlayer.parentNode) ||
      document.body;

    // 旧iframeがあれば安全破棄（空→除去）
    if (oldIframe) {
      this._safeNukeIframe(oldIframe);
    }

    // 新規 iframe 作成（属性は従来通り＋iOS向け強化）
    const newIframe = document.createElement("iframe");
    newIframe.id = "hidden-sc-player";
    newIframe.classList.add("is-hidden");
    // ★強化：iOSでの自動再生を通しやすくするヒント
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

  // -------------- トラック再生関連 -----------------
  loadAndPlay(event) {
    event?.stopPropagation?.();
    // ★追加：このタップの文脈でiOSを解錠（39msの無音）
    this._primeIOSAutoplay();

    this.updatePlaylistOrder();

    const el = event?.currentTarget;
    const newTrackId = el?.dataset?.trackId;
    // 1) playUrlをまず直接拾う
    let trackUrl = el?.dataset?.playUrl;

    // 2) targets から補完
    if (!trackUrl && newTrackId) {
      const img = this.trackImageTargets.find((t) => t.dataset.trackId == newTrackId);
      trackUrl = img?.dataset.playUrl;
    }
    // 3) DOM直参照でフォールバック
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

    this.iframeElement.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(trackUrl)}&auto_play=true`;

    this.iframeElement.onload = () => {
      setTimeout(() => {
        try {
          this.widget = SC.Widget(this.iframeElement);
        } catch (_) {
          // READY前で失敗 → 少し待ってリトライ
          return setTimeout(() => this.loadAndPlay({ currentTarget: el, stopPropagation() {} }), 120);
        }

        this.widget.bind(SC.Widget.Events.READY, () => {
          const trySetTitle = (retry = 0) => {
            this.widget.getCurrentSound((sound) => {
              if (sound?.title) {
                this._applySoundMetadata(sound);
              } else if (retry < 6) {
                return setTimeout(() => trySetTitle(retry + 1), 180);
              } else {
                this._applySoundMetadata(undefined);
              }
            });
          };
          trySetTitle();
          this.bindWidgetEvents();

          // ★iOSではここで明示 play() を呼ばない（auto_play に委ねる）
          if (!this._isIOS()) {
            this.widget.play();
          }

          this.startProgressTracking();
          this.changeVolume({ target: this.volumeBar });

          // ★修正：iOSではonPlayが来るまで「再生中」UIにしない
          const willPlay = !this._isIOS();
          this.updateTrackIcon(this.currentTrackId, willPlay);
          this.setPlayPauseAria(willPlay);

          this.savePlayerState();
        });
      }, 100);
    };
  }

  // -------------- プレイ/ポーズトグル -----------------
  togglePlayPause(event) {
    console.log("togglePlayPause発火", event);
    console.log("this.widget", this.widget);

    event?.stopPropagation?.();
    // ★追加：トグル直前の文脈でiOS解錠
    this._primeIOSAutoplay();

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
      this.widget.isPaused((paused) => {
        if (paused) {
          this.widget.play();
        } else {
          this.widget.pause();
        }
      });
      return;
    }
    this.loadAndPlay(event);
  }

  /* ---------- 再生イベント ---------- */
  onPlay = () => {
    console.log("onPlayイベント発火！");

    this.playPauseIcon?.classList.replace("fa-play", "fa-pause");
    this.updateTrackIcon(this.currentTrackId, true);
    this.setPlayPauseAria(true);
    this.playStartedAt = Date.now();
    this.startWaveformAnime();

    this.widget.getCurrentSound((sound) => {
      if (sound?.title && !this.trackTitleEl.textContent) {
        this._applySoundMetadata(sound);
      }
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

    /* --- 自動再生 / リピート / シャッフル --- */
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
      // targetsがない場合でも、見える範囲のアイコンを直接更新（任意）
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

  /* ---------- 前後トラック（フォールバック強化） ---------- */
  prevTrack(event) {
    event?.stopPropagation?.();
    this.updatePlaylistOrder();
    if (!this.playlistOrder?.length) return;

    // currentTrackId未セットでも「最後の曲」を再生できるように
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

    // 先頭の時は最後へ（UX的フォールバック）
    const lastId2 = this.playlistOrder[this.playlistOrder.length - 1];
    const icon2 = this.playIconTargets.find((icn) => icn.dataset.trackId == lastId2)
      || this._q(`[data-track-id="${CSS.escape(String(lastId2))}"]`, this._container());
    icon2 && this.loadAndPlay({ currentTarget: icon2, stopPropagation() {} });
  }

  nextTrack(event) {
    event?.stopPropagation?.();
    this.updatePlaylistOrder();
    if (!this.playlistOrder?.length) return;

    // currentTrackId未セットでも「最初の曲」を再生できるように
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

    // 最後の時は最初へ（UX的フォールバック）
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
