import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [
    "query",    // 検索ワード入力
    "results",  // 結果表示エリア
    "audio",    // hidden 音声URL
    "track",    // hidden 曲名
    "loading",  // 로딩イン디케ータ
    "section",  // フォーム全体（選択後に非表示）
    "player"
  ]

  connect() {
    console.log("🎧 search_music_controller connected")
    this.currentPage   = 1
    this.searchResults = []
  }

  // 検索ボタン押下時に呼ばれる
  async search() {
    const q = this.queryTarget.value.trim();
    if (!q) { alert("検索ワードを入力してください"); return; }

    this.loadingTarget.style.display = "";

    try {
      const res = await fetch(
        `/soundcloud/search?q=${encodeURIComponent(q)}`, {
          headers: { "Accept": "application/json" },
          credentials: "same-origin"
        }
      );

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      this.searchResults = json;
      this.currentPage   = 1;
      this._renderPage();
    } catch (e) {
      console.error("検索エラー:", e);
      alert("検索に失敗しました： " + e.message);
    } finally {
      this.loadingTarget.style.display = "none";
    }
  }

  // ページごとに結果を描画
  _renderPage() {
    this.resultsTarget.innerHTML = ""
    if (this.searchResults.length === 0) {
      this.resultsTarget.innerHTML =
        "<p>該当する音楽が見つかりませんでした。</p>"
      return
    }

    const perPage = 10
    const start   = (this.currentPage - 1) * perPage
    const page    = this.searchResults.slice(start, start + perPage)

    page.forEach(track => {
      const div = document.createElement("div")
      div.classList.add("mb-3")
      div.innerHTML = `
        <p><strong>${track.title}</strong> - ${track.user.username}</p>
        <a
          href="${track.permalink_url}"
          class="btn btn-info btn-sm mt-2"
          target="_blank"
        >SoundCloudで再生</a>
        <button
          type="button"
          class="btn btn-success btn-sm mt-2"
          data-action="search-music#select"
          data-audio="${track.permalink_url}"
          data-name="${track.title}"
          data-artist="${track.user.username}"
        >選択</button>
        <hr/>
      `
      this.resultsTarget.appendChild(div)
    })

    // ページャー
    const total = Math.ceil(this.searchResults.length / perPage)
    const nav   = document.createElement("div")
    nav.classList.add("pagination-controls", "my-3")

    if (this.currentPage > 1) {
      const prev = document.createElement("button")
      prev.type            = "button"
      prev.className       = "btn btn-secondary me-2"
      prev.textContent     = "前へ"
      prev.dataset.action  = "search-music#prevPage"
      nav.appendChild(prev)
    }

    const info = document.createElement("span")
    info.textContent = `ページ ${this.currentPage} / ${total}`
    nav.appendChild(info)

    if (this.currentPage < total) {
      const next = document.createElement("button")
      next.type           = "button"
      next.className      = "btn btn-secondary ms-2"
      next.textContent    = "次へ"
      next.dataset.action = "search-music#nextPage"
      nav.appendChild(next)
    }

    this.resultsTarget.appendChild(nav)
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--
      this._renderPage()
    }
  }

  nextPage() {
    if (this.currentPage * 10 < this.searchResults.length) {
      this.currentPage++
      this._renderPage()
    }
  }

  // 「選択」ボタン押下時
  select(e) {
    console.log("⚡️ select fired:", e.target, "playerTarget:", this.playerTarget)

    const { audio, name, artist } = e.target.dataset

    // hidden fields
    this.audioTarget.value = audio
    this.trackTarget.value = `${name} - ${artist}`

    // プレイヤー + 確認ボタン
    this.playerTarget.innerHTML = `
      <iframe
        width="100%"
        height="166"
        scrolling="no"
        frameborder="no"
        allow="autoplay"
        src="https://w.soundcloud.com/player/?url=${encodeURIComponent(audio)}&auto_play=true">
      </iframe>
      <button
        type="button"
        class="btn btn-primary mt-2"
        data-action="search-music#confirm"
      >この曲にする</button>
    `
    this.playerTarget.scrollIntoView({ behavior: 'smooth' })

    console.log("▶ 挿入後の playerTarget.innerHTML:", this.playerTarget.innerHTML)

  }

  // 「この曲にする」ボタン押下時
  confirm() {
    // モーダル・検索UIを閉じる
    this.sectionTarget.style.display = "none"
  }
}
