// app/javascript/controllers/search_music_controller.js
import { Controller } from "@hotwired/stimulus";
import { Turbo } from "@hotwired/turbo-rails";
import * as bootstrap from "bootstrap";

// --- 追加: テスト実行時だけ console.error を抑制するヘルパー ---
const __isTest__ =
  typeof process !== "undefined" &&
  process.env &&
  !!process.env.JEST_WORKER_ID; // Jest が必ず入れてくれる環境変数

const logError = (...args) => { if (!__isTest__) console.error(...args); };
// ---------------------------------------------------------------

export default class extends Controller {
  static targets = ["query", "results", "audio", "track", "loading", "section"];

  connect () {
    this.currentPage = 1;
    this.searchResults = [];
    // ローディングを必ず非表示で初期化（出っぱなし防止）
    this._toggleLoading(false);
  }

  async search () {
    const q = this.queryTarget.value.trim();
    if (!q) { alert("検索ワードを入力してください"); return; }

    // ローディングON（is-hidden除去 + 入力/ボタンdisable）
    this._toggleLoading(true);

    try {
      const res = await fetch(`/soundcloud/search?q=${encodeURIComponent(q)}`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin"
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      this.searchResults = json;
      this.currentPage = 1;
      this.renderPage();
    } catch (e) {
      logError("検索エラー:", e);
      alert("検索に失敗しました：" + e.message);
    } finally {
      // ローディングOFF（is-hidden付与 + 入力/ボタンenable）
      this._toggleLoading(false);
    }
  }

  renderPage () {
    this.resultsTarget.innerHTML = "";
    if (this.searchResults.length === 0) {
      this.resultsTarget.innerHTML = "<p>該当する音楽が見つかりませんでした。</p>";
      return;
    }

    const perPage = 10;
    const start = (this.currentPage - 1) * perPage;
    const page = this.searchResults.slice(start, start + perPage);

    page.forEach(track => {
      const div = document.createElement("div");
      div.classList.add("track-result", "mb-3");

      const wrapper = document.createElement("div");
      wrapper.classList.add("d-flex", "align-items-center");

      const img = document.createElement("img");
      img.src = track.artwork_url || "https://placehold.jp/100x100.png";
      img.classList.add("img-thumbnail", "me-3");
      img.style.width = "100px";
      img.style.height = "100px";

      const info = document.createElement("div");
      const p = document.createElement("p");
      p.innerHTML = `<strong>${track.title}</strong><br>${track.user.username}`;

      const a = document.createElement("a");
      a.href = track.permalink_url;
      a.className = "btn btn-info btn-sm";
      a.textContent = "SoundCloudで再生";
      a.target = "_blank";
      a.style.minWidth = "100px";
      a.style.fontSize = "13px";
      a.style.padding = "0.25em 0.7em";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-success btn-lg";
      btn.textContent = "選択or視聴";
      btn.dataset.action = "search-music#select";
      btn.dataset.audio = track.permalink_url;
      btn.dataset.playUrl = track.permalink_url; // グローバル側の委譲でも拾える保険
      btn.dataset.name = track.title;
      btn.dataset.artist = track.user.username;
      btn.dataset.trackId = track.id;
      btn.style.fontSize = "1.1rem";
      btn.style.minWidth = "140px";
      btn.style.marginLeft = "8px";

      info.appendChild(p);
      info.appendChild(a);
      info.appendChild(btn);

      wrapper.appendChild(img);
      wrapper.appendChild(info);

      const playerSlot = document.createElement("div");
      playerSlot.className = "player-slot mt-2";

      const hr = document.createElement("hr");

      div.appendChild(wrapper);
      div.appendChild(playerSlot);
      div.appendChild(hr);

      this.resultsTarget.appendChild(div);
    });

    const total = Math.ceil(this.searchResults.length / perPage);
    const nav = document.createElement("div");
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

  prevPage () {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.renderPage();
    }
  }

  nextPage () {
    if (this.currentPage * 10 < this.searchResults.length) {
      this.currentPage++;
      this.renderPage();
    }
  }

  // ★ iPhoneでもロード後に止まらないために：
  //   1) タップの同一ジェスチャ内で iOS 無音解錠
  //   2) すぐに play-from-search を dispatch
  //   3) その後にフォーム値やUIを更新
  select(e) {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    // 1) iOSのオーディオ制限を同期的に解除
    this._primeIOSAutoplay();

    // 2) 同一ジェスチャ内に dispatch（ここで SoundCloud iframe が auto_play で動く）
    const target = e.currentTarget || e.target;
    const { audio, name, artist } = target.dataset;

    window.dispatchEvent(new CustomEvent("play-from-search", {
      detail: { trackId: audio, playUrl: audio }
    }));

    // 3) 以降はUIの更新
    this.audioTarget.value = audio;
    this.trackTarget.value = `${name} - ${artist}`;
    document.querySelectorAll(".player-slot").forEach(s => s.innerHTML = "");

    const slot = target.closest(".track-result").querySelector(".player-slot");
    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "btn btn-primary mt-2 btn-lg";
    confirmBtn.textContent = "この曲にする";
    confirmBtn.dataset.action = "search-music#confirm";
    confirmBtn.style.minWidth = "120px";

    slot.appendChild(confirmBtn);
    slot.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async confirm () {
    await this.fetchAndSwap(`/emotion_logs/form_switch.turbo_stream?music_url=${encodeURIComponent(this.audioTarget.value)}&track_name=${encodeURIComponent(this.trackTarget.value)}`);
  }

  async backToSearch () {
    const modalEl = document.getElementById("modal-container");
    if (modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).hide();

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
      logError("モーダル切替エラー:", e);
      alert("モーダル切替に失敗しました");
    }
  }

  // ===== ローディング表示制御 =====
  _toggleLoading(show) {
    if (this.hasSectionTarget) {
      this.sectionTarget.setAttribute("aria-busy", show ? "true" : "false");
    }
    if (this.hasLoadingTarget) {
      this.loadingTarget.classList.toggle("is-hidden", !show);
    }

    if (this.hasQueryTarget) this.queryTarget.disabled = !!show;
    const btn = this.element.querySelector('[data-action~="search-music#search"]');
    if (btn) btn.disabled = !!show;
  }

  // ===== iPhone自動再生対策（global_player と整合）=====
  _isIOS() {
    return /iP(hone|ad|od)/i.test(navigator.userAgent) ||
           (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  _primeIOSAutoplay() {
    if (!this._isIOS()) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        const ctx = new AC();
        ctx.resume?.();
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
        setTimeout(() => { try { src.stop(0); } catch(_){} }, 30);
      } else {
        const a = new Audio();
        a.muted = true;
        a.src = "data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAA";
        a.play().catch(()=>{});
        setTimeout(() => { try { a.pause(); } catch(_){} }, 30);
      }
    } catch(_) {}
  }
}
