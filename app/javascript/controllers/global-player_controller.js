import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["trackImage", "playIcon"]

  connect() {
    this.iframeElement = document.getElementById("hidden-sc-player")
    this.bottomPlayer = document.getElementById("bottom-player")
    this.playPauseIcon = document.getElementById("play-pause-icon")
    this.trackTitleEl = document.getElementById("track-title")
    this.trackArtistEl = document.getElementById("track-artist")
    this.seekBar = document.getElementById("seek-bar")
    this.currentTimeEl = document.getElementById("current-time")
    this.durationEl = document.getElementById("duration")
    this.volumeBar = document.getElementById("volume-bar")
    this.currentTrackId = null
    this.widget = null
    this.progressInterval = null
    this.isSeeking = false

    // seekバー操作
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
    // 音量バー
    this.volumeBar?.addEventListener("input", (e) => this.changeVolume(e))
    // シークバー
    this.seekBar?.addEventListener("input", (e) => this.seek(e))
    // 再生/停止ボタン
    document.getElementById("play-pause-button")?.addEventListener("click", (e) => this.togglePlayPause(e))
  }

  loadAndPlay(event) {
    event.stopPropagation()
    const icon = event.currentTarget
    const trackId = icon.dataset.trackId
    const img = this.trackImageTargets.find(t => t.dataset.trackId === trackId)
    const trackUrl = img?.dataset.playUrl
    if (!trackUrl) return

    // UI更新
    this.bottomPlayer.classList.remove("d-none")
    this.updateTrackIcon(trackId, true)
    this.currentTrackId = trackId
    const title = img?.closest(".card-body")?.querySelector(".button")?.textContent?.trim() || "タイトル不明"
    const artist = img?.closest(".card")?.querySelector(".card-header strong")?.textContent?.trim() || "unknown"
    this.trackTitleEl.textContent = title
    this.trackArtistEl.textContent = artist

    // 既存intervalを絶対クリア
    clearInterval(this.progressInterval)
    this.progressInterval = null

    // ---- Widget初期化は「onload→READY」まで絶対待つ！ ----
    this.iframeElement.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(trackUrl)}&auto_play=true`
    this.iframeElement.onload = () => {
      this.widget = SC.Widget(this.iframeElement)
      this.widget.bind(SC.Widget.Events.READY, () => {
        this.bindWidgetEvents()
        this.widget.play()
        this.startProgressTracking()
        // ボリューム反映
        this.changeVolume({target: this.volumeBar})
      })
    }
  }

  togglePlayPause(event) {
    event?.stopPropagation()
    if (!this.widget) return
    this.widget.isPaused(paused => {
      if (paused) {
        this.widget.play()
      } else {
        this.widget.pause()
      }
    })
  }

  seek(event) {
    if (!this.widget) return
    const percent = event.target.value
    this.widget.getDuration(duration => {
      if (!duration) return
      const newTime = (percent / 100) * duration
      this.widget.seekTo(newTime)
    })
  }

  changeVolume(event) {
    if (!this.widget) return
    const volume = event.target.value / 100
    this.widget.setVolume(volume * 100)
  }

  onPlay = () => {
    this.playPauseIcon.classList.replace("fa-play", "fa-pause")
    this.updateTrackIcon(this.currentTrackId, true)
  }
  onPause = () => {
    this.playPauseIcon.classList.replace("fa-pause", "fa-play")
    this.updateTrackIcon(this.currentTrackId, false)
  }
  onFinish = () => {
    this.playPauseIcon.classList.replace("fa-pause", "fa-play")
    this.updateTrackIcon(this.currentTrackId, false)
    this.bottomPlayer.classList.add("d-none")
    clearInterval(this.progressInterval)
  }

  updateTrackIcon(trackId, playing) {
    const icon = this.playIconTargets.find(i => i.dataset.trackId === trackId)
    if (icon) {
      icon.classList.toggle("fa-play", !playing)
      icon.classList.toggle("fa-pause", playing)
    }
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
      this.widget.getPosition(position => {
        this.widget.getDuration(duration => {
          if (!duration || duration === 0) return
          this.seekBar.value = (position / duration) * 100
          this.currentTimeEl.textContent = this.formatTime(position)
          this.durationEl.textContent = this.formatTime(duration)
        })
      })
    }, 500)
  }

  formatTime(ms) {
    if (!ms) return "0:00"
    const sec = Math.floor(ms / 1000)
    const min = Math.floor(sec / 60)
    const remainingSec = sec % 60
    return `${min}:${remainingSec.toString().padStart(2, "0")}`
  }
}
