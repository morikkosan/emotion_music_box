// app/javascript/controllers/global_player_controller.js

import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  // 以下のように `data-track-image-target` と `data-play-icon-target` を使うためには
  // HTML 側で image と icon に適切な属性を付ける必要があります。
  static targets = ["trackImage", "playIcon"]

  connect() {
    console.log("GlobalPlayerController connected")

    // ——— DOM 要素をキャッシュ ———
    this.iframeElement   = document.getElementById("hidden-sc-player")
    this.bottomPlayer    = document.getElementById("bottom-player")
    this.playPauseIcon   = document.getElementById("play-pause-icon")
    this.trackTitleEl    = document.getElementById("track-title")
    this.trackArtistEl   = document.getElementById("track-artist")
    this.seekBar         = document.getElementById("seek-bar")
    this.currentTimeEl   = document.getElementById("current-time")
    this.durationEl      = document.getElementById("duration")
    this.volumeBar       = document.getElementById("volume-bar")
    this.currentTrackId  = null
    this.widget          = null
    this.progressInterval= null
    this.isSeeking       = false

    // ——— seekバーの操作開始／終了を監視 ———
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

    // ——— 音量バーを変えたとき ———
    this.volumeBar?.addEventListener("input", (e) => this.changeVolume(e))

    // ——— シークバーを変えたとき ———
    this.seekBar?.addEventListener("input", (e) => this.seek(e))

    // ——— 下部の再生/停止ボタン ———
    document.getElementById("play-pause-button")
      ?.addEventListener("click", (e) => this.togglePlayPause(e))
  }

  // 「カード上の再生アイコン」をクリックしたときに読み込んで再生する
  loadAndPlay(event) {
    event.stopPropagation()
    const icon       = event.currentTarget
    const newTrackId = icon.dataset.trackId

    // data-track-image-target をもつ <img> の中から同じ trackId を探す
    const img = this.trackImageTargets.find(t => t.dataset.trackId === newTrackId)
    const trackUrl = img?.dataset.playUrl
    if (!trackUrl) return

    // 既にある全アイコンを「再生アイコン」に戻す
    this.playIconTargets.forEach(icn => {
      icn.classList.add("fa-play")
      icn.classList.remove("fa-pause")
    })

    // 下部プレーヤーを表示
    this.bottomPlayer.classList.remove("d-none")
    // 該当アイコンだけ「⏸」に
    this.updateTrackIcon(newTrackId, true)
    this.currentTrackId = newTrackId

    // 曲タイトル・アーティストを取得して表示
    const title  = img?.closest(".card-body")
                      ?.querySelector(".button")
                      ?.textContent?.trim() || "タイトル不明"
    const artist = img?.closest(".card")
                      ?.querySelector(".card-header strong")
                      ?.textContent?.trim() || "unknown"
    this.trackTitleEl.textContent  = title
    this.trackArtistEl.textContent = artist

    clearInterval(this.progressInterval)
    this.progressInterval = null

    // 隠し iframe に埋め込みプレーヤー URL をセットして読み込み（自動再生）
    this.iframeElement.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(trackUrl)}&auto_play=true`

    // onload 後に Widget を生成
    this.iframeElement.onload = () => {
      this.widget = SC.Widget(this.iframeElement)
      this.widget.bind(SC.Widget.Events.READY, () => {
        this.bindWidgetEvents()
        this.widget.play()
        this.startProgressTracking()
        this.changeVolume({ target: this.volumeBar })
      })
    }
  }

  // 下部プレーヤーの再生/停止アイコンをクリックしたとき
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

  // シークバーを動かしたとき
  seek(event) {
    if (!this.widget) return
    const percent = event.target.value
    this.widget.getDuration(duration => {
      if (!duration) return
      const newTime = (percent / 100) * duration
      this.widget.seekTo(newTime)
    })
  }

  // 音量バーを動かしたとき
  changeVolume(event) {
    if (!this.widget) return
    const volume = event.target.value / 100
    this.widget.setVolume(volume * 100) // Widget API は 0–100
  }

  // ————————————————————————————————
  // SoundCloud Widget の各種イベントハンドラ
  // ————————————————————————————————
  onPlay = () => {
    this.playPauseIcon.classList.add("fa-pause")
    this.playPauseIcon.classList.remove("fa-play")
    this.updateTrackIcon(this.currentTrackId, true)
  }

  onPause = () => {
    this.playPauseIcon.classList.add("fa-play")
    this.playPauseIcon.classList.remove("fa-pause")
    this.updateTrackIcon(this.currentTrackId, false)
  }

  onFinish = () => {
    this.playPauseIcon.classList.replace("fa-pause", "fa-play")
    this.updateTrackIcon(this.currentTrackId, false)
    this.bottomPlayer.classList.add("d-none")
    clearInterval(this.progressInterval)
  }

  // カード上のアイコン状態を切り替える（再生中は ⏸、停止中は ▶）
  updateTrackIcon(trackId, playing) {
    // まず全アイコンを▶に
    this.playIconTargets.forEach(icn => {
      icn.classList.add("fa-play")
      icn.classList.remove("fa-pause")
    })
    // 該当トラックID のアイコンだけ切り替え
    const icon = this.playIconTargets.find(i => i.dataset.trackId === trackId)
    if (icon) {
      icon.classList.toggle("fa-play", !playing)
      icon.classList.toggle("fa-pause", playing)
    }
  }

  // Widget イベントに再度バインド（PLAY, PAUSE, FINISH）
  bindWidgetEvents() {
    if (!this.widget) return
    this.widget.unbind(SC.Widget.Events.PLAY)
    this.widget.unbind(SC.Widget.Events.PAUSE)
    this.widget.unbind(SC.Widget.Events.FINISH)
    this.widget.bind(SC.Widget.Events.PLAY, this.onPlay)
    this.widget.bind(SC.Widget.Events.PAUSE, this.onPause)
    this.widget.bind(SC.Widget.Events.FINISH, this.onFinish)
  }

  // 再生中の進捗を定期的に取得してシークバー・時間表示を更新
  startProgressTracking() {
    clearInterval(this.progressInterval)
    this.progressInterval = setInterval(() => {
      if (!this.widget || this.isSeeking) return
      this.widget.getPosition(position => {
        this.widget.getDuration(duration => {
          if (!duration || duration === 0) return
          this.seekBar.value           = (position / duration) * 100
          this.currentTimeEl.textContent = this.formatTime(position)
          this.durationEl.textContent    = this.formatTime(duration)
        })
      })
    }, 500)
  }

  // ミリ秒を "M:SS" 形式に
  formatTime(ms) {
    if (!ms) return "0:00"
    const sec = Math.floor(ms / 1000)
    const min = Math.floor(sec / 60)
    const rem = sec % 60
    return `${min}:${rem.toString().padStart(2, "0")}`
  }
}
