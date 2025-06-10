import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["trackImage", "playIcon"]

  connect() {
    // 初期キャッシュ
    this.iframeElement    = document.getElementById("hidden-sc-player")
    this.bottomPlayer     = document.getElementById("bottom-player")
    this.playPauseIcon    = document.getElementById("play-pause-icon")
    this.trackTitleEl     = document.getElementById("track-title")
    this.trackArtistEl    = document.getElementById("track-artist")
    this.seekBar          = document.getElementById("seek-bar")
    this.currentTimeEl    = document.getElementById("current-time")
    this.durationEl       = document.getElementById("duration")
    this.volumeBar        = document.getElementById("volume-bar")
    this.currentTrackId   = null
    this.widget           = null
    this.progressInterval = null
    this.isSeeking        = false
    this.cachedDuration   = null

    // seekバーの操作
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
    document.getElementById("play-pause-button")
      ?.addEventListener("click", (e) => this.togglePlayPause(e))

    console.log("[connect] global-playerコントローラ初期化完了")
  }

  // 全UIをリセット
  resetPlayerUI() {
    console.log("[resetPlayerUI] UI初期化します")
    this.trackTitleEl.textContent = "Now Loading..."
    this.trackArtistEl.textContent = ""
    this.currentTimeEl.textContent = "0:00"
    this.durationEl.textContent = "0:00"
    this.seekBar.value = 0
    this.playIconTargets.forEach(icn => {
      icn.classList.add("fa-play")
      icn.classList.remove("fa-pause")
    })
    this.playPauseIcon?.classList.add("fa-play")
    this.playPauseIcon?.classList.remove("fa-pause")
    this.cachedDuration = null  // ← ここで毎回リセット
  }

  // 追記: iframe差し替えヘルパー
  replaceIframeWithNew() {
    const oldIframe = document.getElementById("hidden-sc-player")
    if (oldIframe) {
      const parent = oldIframe.parentNode
      const newIframe = document.createElement("iframe")
      newIframe.id = "hidden-sc-player"
      newIframe.style.display = "none"
      newIframe.allow = "autoplay"
      newIframe.frameBorder = "no"
      newIframe.scrolling = "no"
      newIframe.width = "100%"
      newIframe.height = "166"
      parent.replaceChild(newIframe, oldIframe)
      return newIframe
    }
    return null
  }

  loadAndPlay(event) {
    event.stopPropagation()
    const icon       = event.currentTarget
    const newTrackId = icon.dataset.trackId
    const img = this.trackImageTargets.find(t => t.dataset.trackId == newTrackId)
    const trackUrl = img?.dataset.playUrl
    console.log("[loadAndPlay] クリック:", { newTrackId, trackUrl, img })
    if (!trackUrl) {
      console.warn("[loadAndPlay] trackUrlがありません！", { img })
      return
    }

    this.resetPlayerUI()
    this.bottomPlayer.classList.remove("d-none")
    this.currentTrackId = newTrackId

    // 既存Widget完全解除
    if (this.widget) {
      console.log("[loadAndPlay] 既存Widget解除")
      this.widget.unbind(SC.Widget.Events.PLAY)
      this.widget.unbind(SC.Widget.Events.PAUSE)
      this.widget.unbind(SC.Widget.Events.FINISH)
      clearInterval(this.progressInterval)
      this.widget = null
    }

    // 追加: ここでiframe自体を完全に作り直す！
    this.iframeElement = this.replaceIframeWithNew()
    if (!this.iframeElement) {
      alert("iframe生成に失敗しました")
      return
    }

    // [4] iframeリロード
    const playerUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(trackUrl)}&auto_play=true`
    console.log("[loadAndPlay] iframeリロード: ", playerUrl)
    this.iframeElement.src = playerUrl

    // [5] onload後にWidget初期化＋タイトル取得
    this.iframeElement.onload = () => {
      console.log("[iframe.onload] fired!")
      setTimeout(() => {
        this.widget = SC.Widget(this.iframeElement)
        console.log("[iframe.onload] Widget生成", this.widget)
        this.widget.bind(SC.Widget.Events.READY, () => {
          console.log("[Widget READY!]")
          const trySetTitle = (retry = 0) => {
            this.widget.getCurrentSound((sound) => {
              console.log(`[getCurrentSound][リトライ${retry}] sound=`, sound)
              // ★ duration をキャッシュ
              if (sound?.duration) this.cachedDuration = sound.duration;

              if (sound) {
                console.log("    sound.title:", sound.title)
                console.log("    sound.user:", sound.user)
              }
              if (sound?.title) {
                console.log("[getCurrentSound] タイトル取得成功:", sound.title)
                this.trackTitleEl.textContent  = sound.title
                this.trackArtistEl.textContent = sound.user?.username ? `— ${sound.user.username}` : ""
              } else {
                if (retry < 5) {
                  console.warn(`[getCurrentSound] タイトル未取得、リトライ ${retry + 1} ...`)
                  setTimeout(() => trySetTitle(retry + 1), 250)
                } else {
                  console.error("[getCurrentSound] タイトル取得できません: sound=", sound)
                  this.trackTitleEl.textContent  = "タイトル不明"
                  this.trackArtistEl.textContent = ""
                }
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
      }, 300)
    }
  }

  togglePlayPause(event) {
    event?.stopPropagation()
    if (!this.widget) {
      console.warn("[togglePlayPause] widgetなし")
      return
    }
    this.widget.isPaused(paused => {
      console.log("[togglePlayPause]", paused ? "再生開始" : "一時停止")
      if (paused) this.widget.play()
      else        this.widget.pause()
    })
  }

  seek(event) {
    if (!this.widget) {
      console.warn("[seek] widgetなし")
      return
    }
    const percent = event.target.value
    // ここだけは現在のdurationを使う（キャッシュなければAPI呼ぶ）
    const dur = this.cachedDuration;
    if (!dur) {
      // 念の為fallback（ごく稀なケースだけ）
      this.widget.getDuration(duration => {
        if (!duration) return
        this.widget.seekTo((percent / 100) * duration)
        console.log("[seek] シーク:", percent, duration)
      })
      return
    }
    this.widget.seekTo((percent / 100) * dur)
    console.log("[seek] シーク:", percent, dur)
  }

  changeVolume(event) {
    if (!this.widget) {
      console.warn("[changeVolume] widgetなし")
      return
    }
    const vol = event.target.value / 100
    this.widget.setVolume(vol * 100)
    console.log("[changeVolume] volume=", vol)
  }

  onPlay = () => {
    this.playPauseIcon.classList.replace("fa-play", "fa-pause")
    this.updateTrackIcon(this.currentTrackId, true)
    this.widget.getCurrentSound((sound) => {
      console.log("[onPlay][再取得]", sound)
      if (sound?.title && this.trackTitleEl.textContent === "Now Loading...") {
        this.trackTitleEl.textContent  = sound.title
        this.trackArtistEl.textContent = sound.user?.username ? `— ${sound.user.username}` : ""
        console.log("[onPlay] タイトル再取得OK:", sound.title)
      }
    })
  }
  onPause = () => {
    this.playPauseIcon.classList.replace("fa-pause", "fa-play")
    this.updateTrackIcon(this.currentTrackId, false)
    console.log("[onPause]")
  }
  onFinish = () => {
    this.playPauseIcon.classList.replace("fa-pause", "fa-play")
    this.updateTrackIcon(this.currentTrackId, false)
    this.bottomPlayer.classList.add("d-none")
    clearInterval(this.progressInterval)
    console.log("[onFinish] 再生終了")
  }

  updateTrackIcon(trackId, playing) {
    this.playIconTargets.forEach(icn => {
      if (icn.dataset.trackId == trackId) {
        icn.classList.toggle("fa-play", !playing)
        icn.classList.toggle("fa-pause", playing)
        console.log(`[updateTrackIcon] trackId=${trackId} → playing=${playing}`)
      } else {
        icn.classList.add("fa-play")
        icn.classList.remove("fa-pause")
      }
    })
  }

  bindWidgetEvents() {
    if (!this.widget) {
      console.warn("[bindWidgetEvents] widgetなし")
      return
    }
    this.widget.unbind(SC.Widget.Events.PLAY)
    this.widget.unbind(SC.Widget.Events.PAUSE)
    this.widget.unbind(SC.Widget.Events.FINISH)
    this.widget.bind(SC.Widget.Events.PLAY, this.onPlay)
    this.widget.bind(SC.Widget.Events.PAUSE, this.onPause)

    this.widget.bind(SC.Widget.Events.FINISH, this.onFinish)
    console.log("[bindWidgetEvents] イベントバインド完了")
  }

  startProgressTracking() {
    clearInterval(this.progressInterval)
    this.progressInterval = setInterval(() => {
      if (!this.widget || this.isSeeking) return
      this.widget.getPosition(pos => {
        this.widget.getDuration(dur => {
          if (!dur) return
          this.seekBar.value             = (pos / dur) * 100
          this.currentTimeEl.textContent = this.formatTime(pos)
          this.durationEl.textContent    = this.formatTime(dur)
        })
      })
    }, 500)
  }

  formatTime(ms) {
    if (!ms) return "0:00"
    const sec = Math.floor(ms / 1000)
    const min = Math.floor(sec / 60)
    const rem = sec % 60
    return `${min}:${rem.toString().padStart(2, "0")}`
  }
}
