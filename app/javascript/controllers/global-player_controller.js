// app/javascript/controllers/global_player_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["trackImage", "playIcon"]

  connect() {
    this.iframeElement    = document.getElementById("hidden-sc-player")
    this.bottomPlayer     = document.getElementById("bottom-player")
    this.playPauseIcon    = document.getElementById("play-pause-icon")
    this.trackTitleEl     = document.getElementById("track-title")
    this.trackArtistEl    = document.getElementById("track-artist")
    this.seekBar          = document.getElementById("seek-bar")
    this.currentTimeEl    = document.getElementById("current-time")
    this.durationEl       = document.getElementById("duration")
    this.volumeBar        = document.getElementById("volume-bar")
    this.loadingArea      = document.getElementById("loading-spinner")
    this.neonCharacter    = document.querySelector(".neon-character-spinbox")
    this.currentTrackId   = null
    this.widget           = null
    this.progressInterval = null
    this.isSeeking        = false
    this.playStartedAt    = null

    this.isRepeat  = false
    this.isShuffle = false

    this.updatePlaylistOrder()

    this.waveformCanvas   = document.getElementById('waveform-anime')
    this.waveformCtx      = this.waveformCanvas?.getContext('2d')
    this.waveformAnimating = false

    // シークバー操作
    this.seekBar?.addEventListener("mousedown", () => {
      this.isSeeking = true
      clearInterval(this.progressInterval)
    })
    document.addEventListener("mouseup", () => {
      if (this.isSeeking) {
        this.isSeeking = false
        this.startProgressTracking()
      }
    })
    this.volumeBar?.addEventListener("input", (e) => this.changeVolume(e))
    this.seekBar?.addEventListener("input", (e) => this.seek(e))

    // 外部検索結果から再生
    window.addEventListener("play-from-search", (e) => {
      const { playUrl } = e.detail
      this.playFromExternal(playUrl)
    })

    console.log("[connect] global-playerコントローラ初期化完了")
  }

  // ─────────────────────────────────────────────────────────────
  // 「検索結果から再生」用メソッド。ここを追加！
  playFromExternal(playUrl) {
    // 下部プレーヤーを表示
    this.bottomPlayer?.classList.remove("d-none")

    // 既存Widgetクリア
    if (this.widget) {
      this.widget.unbind(SC.Widget.Events.PLAY)
      this.widget.unbind(SC.Widget.Events.PAUSE)
      this.widget.unbind(SC.Widget.Events.FINISH)
      clearInterval(this.progressInterval)
      this.widget = null
    }

    // iframe差し替え
    this.iframeElement = this.replaceIframeWithNew()
    if (!this.iframeElement) {
      alert("iframe生成に失敗しました")
      return
    }

    // SoundCloudプレイヤーURLセット＆自動再生
    this.iframeElement.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(playUrl)}&auto_play=true`

    // UIリセット＆widgetイベント登録
    this.resetPlayerUI()
    this.iframeElement.onload = () => {
      setTimeout(() => {
        this.widget = SC.Widget(this.iframeElement)
        this.widget.bind(SC.Widget.Events.READY, () => {
          // タイトル取得
          this.widget.getCurrentSound((sound) => {
            if (sound && sound.title) {
              this.trackTitleEl.textContent  = sound.title
              this.trackArtistEl.textContent = sound.user?.username
                ? `— ${sound.user.username}` : ""
            } else {
              this.trackTitleEl.textContent  = "タイトル不明"
              this.trackArtistEl.textContent = ""
            }
            this.hideLoadingUI()
          })
          this.bindWidgetEvents()
          this.widget.play()
          this.startProgressTracking()
          this.changeVolume({ target: this.volumeBar })
        })
      }, 100)
    }
  }
  // ─────────────────────────────────────────────────────────────

  startWaveformAnime() {
    if (!this.waveformCtx) return
    this.waveformAnimating = true
    const ctx = this.waveformCtx
    const W   = this.waveformCanvas.width
    const H   = this.waveformCanvas.height
    let t     = 0
    const animate = () => {
      if (!this.waveformAnimating) return
      ctx.clearRect(0, 0, W, H)
      ctx.save()
      ctx.strokeStyle = "#10ffec"
      ctx.lineWidth   = 2
      ctx.beginPath()
      for (let x = 0; x < W; x += 4) {
        const y = H/2 + Math.sin((x+t)/7) * (H/2.5) * (0.7 + 0.3*Math.sin((x/17)+t/13))
        ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.restore()
      t += 0.7
      requestAnimationFrame(animate)
    }
    animate()
  }

  stopWaveformAnime() {
    this.waveformAnimating = false
    if (this.waveformCtx) {
      this.waveformCtx.clearRect(0, 0,
        this.waveformCanvas.width, this.waveformCanvas.height)
    }
  }

  toggleShuffle(e) {
    this.isShuffle = !this.isShuffle
    document.getElementById("shuffle-button")
      ?.classList.toggle("active", this.isShuffle)
    this.updatePlaylistOrder()
    console.log("[toggleShuffle]", this.isShuffle)
  }

  toggleRepeat(e) {
    this.isRepeat = !this.isRepeat
    document.getElementById("repeat-button")
      ?.classList.toggle("active", this.isRepeat)
    console.log("[toggleRepeat]", this.isRepeat)
  }

  updatePlaylistOrder() {
    this.playlistOrder = this.trackImageTargets.map(img => img.dataset.trackId)
    if (this.isShuffle) this.shufflePlaylistOrder()
  }
  shufflePlaylistOrder() {
    for (let i = this.playlistOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[this.playlistOrder[i], this.playlistOrder[j]] =
        [this.playlistOrder[j], this.playlistOrder[i]]
    }
  }

  showLoadingUI() {
    this.playPauseIcon && (this.playPauseIcon.style.display = "none")
    this.loadingArea   && (this.loadingArea.style.display   = "inline-flex")
    this.neonCharacter && (this.neonCharacter.style.display = "inline-block")
    if (this.trackTitleEl) {
      this.trackTitleEl.innerHTML = `
        <span class="neon-wave">
          <span>N</span><span>O</span><span>W</span>
          <span>&nbsp;</span>
          <span>L</span><span>O</span><span>A</span><span>D</span>
          <span>I</span><span>N</span><span>G</span>
          <span>.</span><span>.</span><span>.</span>
        </span>`
      this.trackTitleEl.style.display = "block"
    }
    if (this.trackArtistEl) {
      this.trackArtistEl.textContent = ""
      this.trackArtistEl.style.display = "none"
    }
  }

  hideLoadingUI() {
    this.playPauseIcon && (this.playPauseIcon.style.display = "")
    this.loadingArea   && (this.loadingArea.style.display   = "none")
    this.neonCharacter && (this.neonCharacter.style.display = "none")
    this.trackTitleEl  && (this.trackTitleEl.style.display  = "")
    this.trackArtistEl && (this.trackArtistEl.style.display = "")
  }

  resetPlayerUI() {
    console.log("[resetPlayerUI] UI初期化します")
    this.currentTimeEl && (this.currentTimeEl.textContent = "0:00")
    this.durationEl    && (this.durationEl.textContent    = "0:00")
    this.seekBar       && (this.seekBar.value            = 0)
    if (this.hasPlayIconTarget) {
      this.playIconTargets.forEach(icn => {
        icn.classList.add("fa-play")
        icn.classList.remove("fa-pause")
      })
    }
    this.playPauseIcon?.classList.add("fa-play")
    this.playPauseIcon?.classList.remove("fa-pause")
    this.showLoadingUI()
  }

  replaceIframeWithNew() {
    const oldIframe = document.getElementById("hidden-sc-player")
    if (!oldIframe) return null
    const parent    = oldIframe.parentNode
    const newIframe = document.createElement("iframe")
    newIframe.id         = "hidden-sc-player"
    newIframe.style.display = "none"
    newIframe.allow      = "autoplay"
    newIframe.frameBorder= "no"
    newIframe.scrolling  = "no"
    newIframe.width      = "100%"
    newIframe.height     = "166"
    parent.replaceChild(newIframe, oldIframe)
    return newIframe
  }

  loadAndPlay(event) {
    event.stopPropagation()
    this.updatePlaylistOrder()

    const icon       = event.currentTarget
    const newTrackId = icon.dataset.trackId
    const img        = this.trackImageTargets.find(t => t.dataset.trackId == newTrackId)
    const trackUrl   = img?.dataset.playUrl
    if (!trackUrl) {
      console.warn("[loadAndPlay] trackUrl missing", { img })
      return
    }

    this.resetPlayerUI()
    this.bottomPlayer?.classList.remove("d-none")
    this.currentTrackId = newTrackId

    // widgetクリア
    if (this.widget) {
      this.widget.unbind(SC.Widget.Events.PLAY)
      this.widget.unbind(SC.Widget.Events.PAUSE)
      this.widget.unbind(SC.Widget.Events.FINISH)
      clearInterval(this.progressInterval)
      this.widget = null
    }

    // iframe差し替え
    this.iframeElement = this.replaceIframeWithNew()
    if (!this.iframeElement) {
      alert("iframe生成に失敗しました")
      return
    }

    this.iframeElement.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(trackUrl)}&auto_play=true`

    this.iframeElement.onload = () => {
      setTimeout(() => {
        this.widget = SC.Widget(this.iframeElement)
        this.widget.bind(SC.Widget.Events.READY, () => {
          const trySetTitle = (retry = 0) => {
            this.widget.getCurrentSound(sound => {
              if (sound?.title) {
                this.trackTitleEl.textContent  = sound.title
                this.trackArtistEl.textContent = sound.user?.username
                  ? `— ${sound.user.username}` : ""
                this.hideLoadingUI()
              } else if (retry < 5) {
                setTimeout(() => trySetTitle(retry + 1), 250)
              } else {
                this.trackTitleEl.textContent  = "タイトル不明"
                this.trackArtistEl.textContent = ""
                this.hideLoadingUI()
              }
            })
          }
          trySetTitle()
          this.bindWidgetEvents()
          this.widget.play()
          this.startProgressTracking()
          this.changeVolume({ target: this.volumeBar })
          this.updateTrackIcon(this.currentTrackId, true)
        })
      }, 100)
    }
  }

  togglePlayPause(event) {
    event?.stopPropagation()
    if (!this.widget) return
    this.widget.isPaused(paused => {
      if (paused) this.widget.play()
      else        this.widget.pause()
    })
  }

  seek(event) {
    if (!this.widget) return
    const percent = event.target.value
    this.widget.getDuration(dur => {
      if (!dur) return
      this.widget.seekTo((percent / 100) * dur)
    })
  }

  changeVolume(event) {
    if (!this.widget) return
    const vol = event.target.value / 100
    this.widget.setVolume(vol * 100)
  }

  onPlay = () => {
    this.playPauseIcon?.classList.replace("fa-play", "fa-pause")
    this.updateTrackIcon(this.currentTrackId, true)
    this.playStartedAt = Date.now()
    this.startWaveformAnime()
    this.widget.getCurrentSound(sound => {
      if (sound?.title && !this.trackTitleEl.textContent) {
        this.trackTitleEl.textContent  = sound.title
        this.trackArtistEl.textContent = sound.user?.username
          ? `— ${sound.user.username}` : ""
        this.hideLoadingUI()
      }
    })
  }

  onPause = () => {
    this.playPauseIcon?.classList.replace("fa-pause", "fa-play")
    this.updateTrackIcon(this.currentTrackId, false)
    this.stopWaveformAnime()
  }

  onFinish = () => {
    const finishedAt = Date.now()
    const playedMs   = this.playStartedAt
      ? finishedAt - this.playStartedAt : 0
    this.stopWaveformAnime()

    if (playedMs < 32000 && playedMs > 5000) {
      if (window.Swal) {
        Swal.fire({
          icon: 'info',
          title: '試聴終了',
          text:  'この曲の視聴は30秒までです（権利制限）',
          confirmButtonText: 'OK'
        })
      } else {
        alert("この曲の視聴は30秒までです（権利制限）")
      }
    }

    this.playPauseIcon?.classList.replace("fa-pause", "fa-play")
    this.updateTrackIcon(this.currentTrackId, false)
    clearInterval(this.progressInterval)
    this.playStartedAt = null

    // 自動再生・リピート・シャッフルロジック
    if (this.isRepeat) {
      const icon = this.playIconTargets.find(icn =>
        icn.dataset.trackId == this.currentTrackId)
      if (icon) {
        return setTimeout(() =>
          this.loadAndPlay({ currentTarget: icon, stopPropagation() {} }), 300)
      }
    }

    const curIdx = this.playlistOrder.indexOf(this.currentTrackId)
    const nextId = this.playlistOrder[curIdx + 1]
    if (nextId) {
      const icon = this.playIconTargets.find(icn =>
        icn.dataset.trackId == nextId)
      if (icon) {
        return setTimeout(() =>
          this.loadAndPlay({ currentTarget: icon, stopPropagation() {} }), 300)
      }
    }

    this.bottomPlayer?.classList.add("d-none")
  }

  updateTrackIcon(trackId, playing) {
    if (!this.hasPlayIconTarget) return
    this.playIconTargets.forEach(icn => {
      if (icn.dataset.trackId == trackId) {
        icn.classList.toggle("fa-play", !playing)
        icn.classList.toggle("fa-pause", playing)
      } else {
        icn.classList.add("fa-play")
        icn.classList.remove("fa-pause")
      }
    })
  }

  bindWidgetEvents() {
    if (!this.widget) return
    this.widget.unbind(SC.Widget.Events.PLAY)
    this.widget.unbind(SC.Widget.Events.PAUSE)
    this.widget.unbind(SC.Widget.Events.FINISH)
    this.widget.bind(SC.Widget.Events.PLAY, this.onPlay)
    this.widget.bind(SC.Widget.Events.PAUSE, this.onPause)
    this.widget.bind(SC.Widget.Events.FINISH, this.onFinish)
  }

  startProgressTracking() {
    clearInterval(this.progressInterval)
    this.progressInterval = setInterval(() => {
      if (!this.widget || this.isSeeking) return
      this.widget.getPosition(pos => {
        this.widget.getDuration(dur => {
          if (!dur) return
          this.seekBar       && (this.seekBar.value      = (pos / dur) * 100)
          this.currentTimeEl && (this.currentTimeEl.textContent = this.formatTime(pos))
          this.durationEl    && (this.durationEl.textContent    = this.formatTime(dur))
        })
      })
    }, 500)
  }

  formatTime(ms) {
    const sec = Math.floor((ms||0) / 1000)
    const min = Math.floor(sec / 60)
    const rem = sec % 60
    return `${min}:${rem.toString().padStart(2,"0")}`
  }

  prevTrack(event) {
    event?.stopPropagation()
    this.updatePlaylistOrder()
    if (!this.currentTrackId || !this.playlistOrder?.length) return
    const idx = this.playlistOrder.indexOf(this.currentTrackId)
    if (idx > 0) {
      const icon = this.playIconTargets.find(icn =>
        icn.dataset.trackId == this.playlistOrder[idx - 1])
      icon && this.loadAndPlay({ currentTarget: icon, stopPropagation(){} })
    }
  }

  nextTrack(event) {
    event?.stopPropagation()
    this.updatePlaylistOrder()
    if (!this.currentTrackId || !this.playlistOrder?.length) return
    const idx = this.playlistOrder.indexOf(this.currentTrackId)
    if (idx < this.playlistOrder.length - 1) {
      const icon = this.playIconTargets.find(icn =>
        icn.dataset-trackId == this.playlistOrder[idx + 1])
      icon && this.loadAndPlay({ currentTarget: icon, stopPropagation(){} })
    }
  }

  playFirstTrack(event) {
    event?.stopPropagation()
    this.updatePlaylistOrder()
    if (!this.playlistOrder?.length) return
    const icon = this.playIconTargets.find(icn =>
      icn.dataset-trackId == this.playlistOrder[0])
    icon && this.loadAndPlay({ currentTarget: icon, stopPropagation(){} })
  }
}
