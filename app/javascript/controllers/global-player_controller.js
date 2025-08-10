import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["trackImage", "playIcon"];

  cleanup = () => {
    clearInterval(this.progressInterval);
    if (this.widget) {
      this.widget.unbind(SC.Widget.Events.PLAY);
      this.widget.unbind(SC.Widget.Events.PAUSE);
      this.widget.unbind(SC.Widget.Events.FINISH);
      this.widget = null;
    }
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

    // シークバー
    this.seekBar?.addEventListener("mousedown", () => {
      this.isSeeking = true;
      clearInterval(this.progressInterval);
    });
    document.addEventListener("mouseup", () => {
      if (this.isSeeking) {
        this.isSeeking = false;
        this.startProgressTracking();
      }
    });
    this.volumeBar?.addEventListener("input",  (e) => this.changeVolume(e));
    this.seekBar  ?.addEventListener("input",  (e) => this.seek(e));

    // 前後トラック
    document.getElementById("prev-track-button")?.addEventListener("click", this.prevTrack.bind(this));
    document.getElementById("next-track-button")?.addEventListener("click", this.nextTrack.bind(this));

    // シャッフル / リピート
    document.getElementById("shuffle-button")?.addEventListener("click", this.toggleShuffle.bind(this));
    document.getElementById("repeat-button") ?.addEventListener("click", this.toggleRepeat.bind(this));

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

    this.restorePlayerState();
    console.log("[connect] global-player controller initialized");
  }

  // -------------- 状態保存 / 復元 -----------------
  savePlayerState() {
    if (!this.widget) return;
    this.widget.getPosition((pos) => {
      this.widget.getDuration((dur) => {
        const state = {
          trackId:   this.currentTrackId,
          trackUrl:  this.iframeElement?.src,
          position:  pos,
          duration:  dur,
          isPlaying: this.playPauseIcon?.classList.contains("fa-pause"),
        };
        localStorage.setItem("playerState", JSON.stringify(state));
      });
    });
  }

  tryRestore(state, retry = 0) {
    if (!this.widget) return setTimeout(() => this.tryRestore(state, retry), 300);

    this.widget.getDuration((dur) => {
      if (!dur) return setTimeout(() => this.tryRestore(state, retry), 300);

      this.widget.getCurrentSound((sound) => {
        if (sound?.title) {
          this.setTrackTitle(sound.title);
          const artist = sound.user?.username ? `— ${sound.user.username}` : "";
          this.setArtist(artist);
          this.hideLoadingUI();
        } else if (retry < 5) {
          return setTimeout(() => this.tryRestore(state, retry + 1), 250);
        } else {
          this.setTrackTitle("タイトル不明");
          this.setArtist("");
          this.hideLoadingUI();
        }
      });

      this.widget.seekTo(state.position);
      if (!state.isPlaying) this.widget.pause();
    });
  }

  restorePlayerState() {
    const saved = localStorage.getItem("playerState");
    if (!saved) return;

    const state = JSON.parse(saved);
    if (!state.trackUrl) return;

    this.currentTrackId = state.trackId;
    this.bottomPlayer?.classList.remove("d-none");

    // iframe 再生成
    if (this.widget) {
      this.widget.unbind(SC.Widget.Events.PLAY);
      this.widget.unbind(SC.Widget.Events.PAUSE);
      this.widget.unbind(SC.Widget.Events.FINISH);
      clearInterval(this.progressInterval);
      this.widget = null;
    }
    this.iframeElement = this.replaceIframeWithNew();
    if (!this.iframeElement) return;

    this.iframeElement.src = state.trackUrl.replace("&auto_play=true", "&auto_play=false");
    this.resetPlayerUI();

    this.iframeElement.onload = () => {
      setTimeout(() => {
        this.widget = SC.Widget(this.iframeElement);
        console.log("SC.Widget作成", this.widget, this.iframeElement);

        this.widget.bind(SC.Widget.Events.READY, () => {
          this.widget.getCurrentSound((sound) => {
            if (sound?.title) {
              this.setTrackTitle(sound.title);
              const artist = sound.user?.username ? `— ${sound.user.username}` : "";
              this.setArtist(artist);
            } else {
              this.setTrackTitle("タイトル不明");
              this.setArtist("");
            }
            this.hideLoadingUI();
            this.widget.seekTo(state.position);
            state.isPlaying ? this.widget.play() : this.widget.pause();

            this.bindWidgetEvents();
            this.startProgressTracking();
            this.changeVolume({ target: this.volumeBar });
            this.updateTrackIcon(this.currentTrackId, state.isPlaying);
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
    this.bottomPlayer?.classList.remove("d-none");
    this.bottomPlayer?.offsetHeight;

    if (this.widget) {
      this.widget.unbind(SC.Widget.Events.PLAY);
      this.widget.unbind(SC.Widget.Events.PAUSE);
      this.widget.unbind(SC.Widget.Events.FINISH);
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
        this.widget = SC.Widget(this.iframeElement);
        console.log("SC.Widget作成", this.widget, this.iframeElement);

        this.widget.bind(SC.Widget.Events.READY, () => {
          this.widget.getCurrentSound((sound) => {
            if (sound?.title) {
              this.setTrackTitle(sound.title);
              const artist = sound.user?.username ? `— ${sound.user.username}` : "";
              this.setArtist(artist);
            } else {
              this.setTrackTitle("タイトル不明");
              this.setArtist("");
            }
            this.hideLoadingUI();
          });

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
    document.getElementById("shuffle-button")?.classList.toggle("active", this.isShuffle);
    this.updatePlaylistOrder();
  }

  toggleRepeat() {
    this.isRepeat = !this.isRepeat;
    document.getElementById("repeat-button")?.classList.toggle("active", this.isRepeat);
  }

  updatePlaylistOrder() {
    this.playlistOrder = this.trackImageTargets.map((img) => img.dataset.trackId);
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
    this.playPauseIcon?.closest("button")?.setAttribute("disabled", "disabled"); // ←追加
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
    this.playPauseIcon?.closest("button")?.removeAttribute("disabled"); // ←追加
    this.loadingArea?.classList.add("is-hidden");
    this.neonCharacter?.classList.add("is-hidden");
    this.trackTitleEl?.classList.remove("is-hidden");
    this.trackTitleTopEl?.classList.remove("is-hidden");
    this.trackArtistEl?.classList.remove("is-hidden");
  }

  resetPlayerUI() {
    this.currentTimeEl && (this.currentTimeEl.textContent = "0:00");
    this.durationEl && (this.durationEl.textContent = "0:00");
    this.seekBar && (this.seekBar.value = 0);

    if (this.hasPlayIconTarget) {
      this.playIconTargets.forEach((icn) => {
        icn.classList.add("fa-play");
        icn.classList.remove("fa-pause");
      });
    }
    this.playPauseIcon?.classList.add("fa-play");
    this.playPauseIcon?.classList.remove("fa-pause");
    this.showLoadingUI();
  }

  // -------------- iframe差し替え -----------------
  replaceIframeWithNew() {
    const oldIframe = document.getElementById("hidden-sc-player");
    if (!oldIframe) return null;
    const parent = oldIframe.parentNode;
    const newIframe = document.createElement("iframe");
    newIframe.id = "hidden-sc-player";
    newIframe.classList.add("is-hidden");
    newIframe.allow = "autoplay";
    newIframe.frameBorder = "no";
    newIframe.scrolling = "no";
    newIframe.width = "100%";
    newIframe.height = "166";
    parent.replaceChild(newIframe, oldIframe);
    return newIframe;
  }

  // -------------- トラック再生関連 -----------------
  loadAndPlay(event) {
    event.stopPropagation();
    this.updatePlaylistOrder();

    const icon       = event.currentTarget;
    const newTrackId = icon.dataset.trackId;
    const img        = this.trackImageTargets.find((t) => t.dataset.trackId == newTrackId);
    const trackUrl   = img?.dataset.playUrl;
    if (!trackUrl) return;

    this.resetPlayerUI();
    this.bottomPlayer?.classList.remove("d-none");
    this.currentTrackId = newTrackId;
    this.cleanup();

    if (this.widget) {
      this.widget.unbind(SC.Widget.Events.PLAY);
      this.widget.unbind(SC.Widget.Events.PAUSE);
      this.widget.unbind(SC.Widget.Events.FINISH);
      clearInterval(this.progressInterval);
      this.widget = null;
    }

    this.iframeElement = this.replaceIframeWithNew();
    if (!this.iframeElement) return;

    this.iframeElement.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(trackUrl)}&auto_play=true`;

    this.iframeElement.onload = () => {
      setTimeout(() => {
        this.widget = SC.Widget(this.iframeElement);
        console.log("SC.Widget作成", this.widget, this.iframeElement);

        this.widget.bind(SC.Widget.Events.READY, () => {
          const trySetTitle = (retry = 0) => {
            this.widget.getCurrentSound((sound) => {
              if (sound?.title) {
                this.setTrackTitle(sound.title);
                const artist = sound.user?.username ? `— ${sound.user.username}` : "";
                this.setArtist(artist);
                this.hideLoadingUI();
              } else if (retry < 5) {
                return setTimeout(() => trySetTitle(retry + 1), 250);
              } else {
                this.setTrackTitle("タイトル不明");
                this.setArtist("");
                this.hideLoadingUI();
              }
            });
          };
          trySetTitle();
          this.bindWidgetEvents();
          this.widget.play();
          this.startProgressTracking();
          this.changeVolume({ target: this.volumeBar });
          this.updateTrackIcon(this.currentTrackId, true);
          this.savePlayerState();
        });
      }, 100);
    };
  }

  // -------------- プレイ/ポーズトグル -----------------
  togglePlayPause(event) {
  console.log("togglePlayPause発火", event);
  console.log("this.widget", this.widget);

  event?.stopPropagation();

  // ここでSC.Widgetを強制的に再生成（iframeがあれば）
  if (!this.widget) {
    this.iframeElement = document.getElementById("hidden-sc-player");
    // iframeが存在し、src属性が空でなければ
    if (this.iframeElement && this.iframeElement.src && this.iframeElement.src !== "") {
      try {
        this.widget = SC.Widget(this.iframeElement);
        this.bindWidgetEvents(); // 必ずイベントも再バインド
        // 状態がlocalStorageに保存されていれば復元
        if (typeof this.restorePlayerState === "function") {
          this.restorePlayerState();
        }
      } catch (e) {
        alert("プレイヤーの初期化に失敗しました。もう一度曲を選んでください。");
        return;
      }
    } else {
      alert("プレイヤーが初期化されていません。もう一度曲を選んでください。");
      return;
    }
  }

  // ここからは「this.widget」が必ず有効な状態
  this.widget.isPaused((paused) => {
    console.log("paused?", paused);
    paused ? this.widget.play() : this.widget.pause();
    setTimeout(() => this.savePlayerState(), 500);
  });
}


  seek(event) {
    if (!this.widget) return;
    const percent = event.target.value;
    this.widget.getDuration((dur) => {
      if (!dur) return;
      this.widget.seekTo((percent / 100) * dur);
      this.savePlayerState();
    });
  }

  changeVolume(event) {
    if (!this.widget) return;
    const vol = event.target.value / 100;
    this.widget.setVolume(vol * 100);
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
      console.log("onPlayイベント発火！"); // ★ここ追加

    this.playPauseIcon?.classList.replace("fa-play", "fa-pause");
    this.updateTrackIcon(this.currentTrackId, true);
    this.playStartedAt = Date.now();
    this.startWaveformAnime();

    this.widget.getCurrentSound((sound) => {
      if (sound?.title && !this.trackTitleEl.textContent) {
        this.setTrackTitle(sound.title);
        const artist = sound.user?.username ? `— ${sound.user.username}` : "";
        this.setArtist(artist);
        this.hideLoadingUI();
      }
    });
    this.savePlayerState();
  };

  onPause = () => {
      console.log("onPauseイベント発火！"); // ★ここ追加

    this.playPauseIcon?.classList.replace("fa-pause", "fa-play");
    this.updateTrackIcon(this.currentTrackId, false);
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
    clearInterval(this.progressInterval);
    this.playStartedAt = null;

    /* --- 自動再生 / リピート / シャッフル --- */
    if (this.isRepeat) {
      const icon = this.playIconTargets.find((icn) => icn.dataset.trackId == this.currentTrackId);
      icon && setTimeout(() => this.loadAndPlay({ currentTarget: icon, stopPropagation() {} }), 300);
      return;
    }

    const curIdx = this.playlistOrder.indexOf(this.currentTrackId);
    const nextId = this.playlistOrder[curIdx + 1];
    if (nextId) {
      const icon = this.playIconTargets.find((icn) => icn.dataset.trackId == nextId);
      icon && setTimeout(() => this.loadAndPlay({ currentTarget: icon, stopPropagation() {} }), 300);
      return;
    }

    this.bottomPlayer?.classList.add("d-none");
    this.savePlayerState();
  };

  /* ---------- アイコン更新 / バインド ---------- */
  updateTrackIcon(trackId, playing) {
    if (!this.hasPlayIconTarget) return;
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
    this.widget.unbind(SC.Widget.Events.PLAY);
    this.widget.unbind(SC.Widget.Events.PAUSE);
    this.widget.unbind(SC.Widget.Events.FINISH);
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
          this.seekBar       && (this.seekBar.value                   = (pos / dur) * 100);
          this.currentTimeEl && (this.currentTimeEl.textContent       = this.formatTime(pos));
          this.durationEl    && (this.durationEl.textContent          = this.formatTime(dur));
        });
      });
      this.savePlayerState();
    }, 1000);
  }

  formatTime(ms) {
    const sec = Math.floor((ms || 0) / 1000);
    return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;
  }

  /* ---------- 前後トラック ---------- */
  prevTrack(event) {
    event?.stopPropagation();
    this.updatePlaylistOrder();
    if (!this.currentTrackId) return;

    const idx = this.playlistOrder.indexOf(this.currentTrackId);
    if (idx > 0) {
      const icon = this.playIconTargets.find((icn) => icn.dataset.trackId == this.playlistOrder[idx - 1]);
      icon && this.loadAndPlay({ currentTarget: icon, stopPropagation() {} });
    }
  }

  nextTrack(event) {
    event?.stopPropagation();
    this.updatePlaylistOrder();
    if (!this.currentTrackId) return;

    const idx = this.playlistOrder.indexOf(this.currentTrackId);
    if (idx < this.playlistOrder.length - 1) {
      const icon = this.playIconTargets.find((icn) => icn.dataset.trackId == this.playlistOrder[idx + 1]);
      icon && this.loadAndPlay({ currentTarget: icon, stopPropagation() {} });
    }
  }

  playFirstTrack(event) {
    event?.stopPropagation();
    this.updatePlaylistOrder();
    if (!this.playlistOrder?.length) return;

    const icon = this.playIconTargets.find((icn) => icn.dataset.trackId == this.playlistOrder[0]);
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
