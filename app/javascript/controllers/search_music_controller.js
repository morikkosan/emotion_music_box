// app/javascript/controllers/search_music_controller.js
import { Controller } from "@hotwired/stimulus";
import { Turbo } from "@hotwired/turbo-rails";
import * as bootstrap from "bootstrap";

export default class extends Controller {
  static targets = ["query", "results", "audio", "track", "loading", "section"];

  /* =============================
   * ライフサイクル
   * ===========================*/
  connect () {
    //console.log("🎧 search_music_controller connected");
    this.currentPage   = 1;
    this.searchResults = [];
  }

  /* =============================
   * 検索処理
   * ===========================*/
  async search () {
    const q = this.queryTarget.value.trim();
    if (!q) { alert("検索ワードを入力してください"); return; }

    this.loadingTarget.style.display = "";
    try {
      const res  = await fetch(`/soundcloud/search?q=${encodeURIComponent(q)}`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin"
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      this.searchResults = json;
      this.currentPage   = 1;
      this.renderPage();
    } catch (e) {
      console.error("検索エラー:", e);
      alert("検索に失敗しました：" + e.message);
    } finally {
      this.loadingTarget.style.display = "none";
    }
  }

  /* =============================
   * 検索結果ページ描画
   * ===========================*/
  renderPage () {
    this.resultsTarget.innerHTML = "";
    if (this.searchResults.length === 0) {
      this.resultsTarget.innerHTML = "<p>該当する音楽が見つかりませんでした。</p>";
      return;
    }

    const perPage = 10;
    const start   = (this.currentPage - 1) * perPage;
    const page    = this.searchResults.slice(start, start + perPage);

    page.forEach(track => {
      const div = document.createElement("div");
      div.classList.add("track-result", "mb-3");
      div.innerHTML = `
        <div class=\"d-flex align-items-center\">\n          <img src=\"${track.artwork_url || "https://placehold.jp/100x100.png"}\" class=\"img-thumbnail me-3\" style=\"width:100px;height:100px;\">\n          <div>\n            <p><strong>${track.title}</strong><br>${track.user.username}</p>\n            <a href=\"${track.permalink_url}\" class=\"btn btn-info btn-sm\" target=\"_blank\">SoundCloudで再生</a>\n            <button type=\"button\" class=\"btn btn-success btn-sm\" data-action=\"search-music#select\" data-audio=\"${track.permalink_url}\" data-name=\"${track.title}\" data-artist=\"${track.user.username}\">選択or視聴</button>\n          </div>\n        </div>\n        <div class=\"player-slot mt-2\"></div><hr/>`;
      this.resultsTarget.appendChild(div);
    });

    const total = Math.ceil(this.searchResults.length / perPage);
    const nav   = document.createElement("div");
    nav.classList.add("pagination-controls", "my-3");

    if (this.currentPage > 1) {
      const prev = document.createElement("button");
      prev.type = "button";
      prev.className = "btn btn-secondary me-2";
      prev.textContent = "前へ";
      prev.dataset.action = "search-music#prevPage";
      nav.appendChild(prev);
    }
    const info = document.createElement("span");
    info.textContent = `ページ ${this.currentPage} / ${total}`;
    nav.appendChild(info);
    if (this.currentPage < total) {
      const next = document.createElement("button");
      next.type = "button";
      next.className = "btn btn-secondary ms-2";
      next.textContent = "次へ";
      next.dataset.action = "search-music#nextPage";
      nav.appendChild(next);
    }
    this.resultsTarget.appendChild(nav);
  }
  prevPage () { if (this.currentPage > 1) { this.currentPage--; this.renderPage(); } }
  nextPage () { if (this.currentPage * 10 < this.searchResults.length) { this.currentPage++; this.renderPage(); } }

  /* =============================
   * 曲選択 → プレイヤー表示
   * ===========================*/
  select (e) {
    const { audio, name, artist } = e.target.dataset;
    this.audioTarget.value  = audio;
    this.trackTarget.value  = `${name} - ${artist}`;
    document.querySelectorAll(".player-slot").forEach(s => s.innerHTML = "");

    const slot = e.target.closest(".track-result").querySelector(".player-slot");
    slot.innerHTML = `<iframe width=\"100%\" height=\"166\" scrolling=\"no\" frameborder=\"no\" allow=\"autoplay\" src=\"https://w.soundcloud.com/player/?url=${encodeURIComponent(audio)}&auto_play=true\"></iframe><button type=\"button\" class=\"btn btn-primary mt-2\" data-action=\"search-music#confirm\">この曲にする</button>`;
    slot.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* =============================
   * 検索フォーム → 記録フォーム
   * ===========================*/
  async confirm () {
    await this.fetchAndSwap(`/emotion_logs/form_switch.turbo_stream?music_url=${encodeURIComponent(this.audioTarget.value)}&track_name=${encodeURIComponent(this.trackTarget.value)}`);
  }

  /* =============================
   * 記録フォーム → 検索フォームへ戻る（モーダル作り直し）
   * ===========================*/
  async backToSearch () {
    // 旧モーダルを閉じる
    const modalEl = document.getElementById("modal-container");
    if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).hide();

    // 新しい検索フォーム付きモーダルを取得
    const res = await fetch("/emotion_logs/new.turbo_stream", {
      headers: { Accept: "text/vnd.turbo-stream.html" },
      credentials: "same-origin"
    });
    if (!res.ok) { alert("検索フォーム再取得に失敗"); return; }

    Turbo.renderStreamMessage(await res.text());

    const newModal = document.getElementById("modal-container");
    if (newModal) bootstrap.Modal.getOrCreateInstance(newModal).show();

    if (window.Stimulus?.enhance && newModal) {
      const content = document.getElementById("modal-content");
      if (content) window.Stimulus.enhance(content);
    }
  }

  /* =============================
   * Turbo Stream 取得＆モーダル更新（confirm 用）
   * ===========================*/
  async fetchAndSwap(url) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "text/vnd.turbo-stream.html" },
        credentials: "same-origin"
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      Turbo.renderStreamMessage(await res.text());

      if (window.Stimulus?.enhance) {
        const content = document.getElementById("modal-content");
        if (content) window.Stimulus.enhance(content);
      }

      const modal = document.getElementById("modal-container");
      if (modal) bootstrap.Modal.getOrCreateInstance(modal).show();

    } catch (e) {
      console.error("モーダル切替エラー:", e);
      alert("モーダル切替に失敗しました");
    }
  }
}
