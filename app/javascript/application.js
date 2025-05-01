console.log("JavaScript is loaded successfully!");
// app/javascript/packs/application.js
import Rails from "@rails/ujs";
Rails.start();
import "@hotwired/turbo-rails";
import "./controllers";
import * as bootstrap from "bootstrap";
window.bootstrap = bootstrap;

// import "chartkick/chart.js"; // Chartkickを利用するために必要
import "./custom/comments";
import "./custom/gages_test";
import "./custom/flash_messages";  // パスが正しいか確認

// Turboを完全に無効化
document.addEventListener("turbo:load", function () {
  // Turbo.session.drive = false;
  console.log("Turbo is disabled");

  const button = document.getElementById("search-button");
  if (button) {
    button.addEventListener("click", () => {
      searchMusicWithPagination();
    });
    button.dataset.listenerAdded = "true"; // ← これがガード

  }
});
// turbo:frame-render を使って差し替え後に必ずモーダルを開く
// document.addEventListener("turbo:frame-render", function (event) {
//   if (event.target.id === "modal") {
//     const modalEl = event.target.querySelector(".modal");
//     if (modalEl) {
//       const modal = new bootstrap.Modal(modalEl);
//       modal.show();
//       console.log("✅ モーダル表示成功");
//     } else {
//       console.warn("❌ modal-container が見つかりませんでした");
//     }
//   }
// });



document.addEventListener("turbo:load", () => {
  console.log("✅ Turbo loaded OK");
});
// ✅ ページネーション用の変数
let currentPage = 1;
let searchResults = [];

/** 
 * 1) 日本語の検索ワードを翻訳してJamendo APIで検索
 *    - 検索中… を表示し、完了後に消す
**/

async function getSoundCloudClientID() {
  try {
    // RailsのサーバーからクライアントIDを取得
    const response = await fetch("/soundcloud_client_id");
    const data = await response.json();
    return data.client_id; // クライアントIDを返す
  } catch (error) {
    console.error("SoundCloud Client IDを取得できませんでした:", error);
    return null; // エラー発生時はnullを返す
  }
}

async function searchMusicWithPagination() {
  const clientId = await getSoundCloudClientID();
  if (!clientId) {
    alert("SoundCloud API キーが取得できません");
    return;
  }

  const query = document.getElementById("music-search")?.value.trim();
  if (!query) {
    alert("検索ワードを入力してください");
    return;
  }

  console.log("🔍 検索ワード:", query);

  const loadingIndicator = document.getElementById("loading-indicator");
  if (loadingIndicator) loadingIndicator.style.display = "block";

  try {
    // 翻訳は使わないので、直接 query を使用
    const searchQuery = query;
    const url = `https://api.soundcloud.com/tracks?q=${encodeURIComponent(searchQuery)}&limit=50`;
  
    // アクセストークンを追加
    const token = window.soundcloudToken;
  
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `OAuth ${token}`,
      },
    });
    
    
    const data = await response.json();

    if (Array.isArray(data)) {
      searchResults = data.map(track => ({
        name: track.title,
        artist_name: track.user.username,
        // ⚠ これだと埋め込みプレーヤーに無効
        // audio: track.streamable ? `${track.stream_url}?client_id=${clientId}` : null,
    
        // ✅ 公式プレーヤーで有効な公開URLを使う
        audio: track.permalink_url, // ←埋め込みにはこちらを使う
        permalink: track.permalink_url
      }));
    } else {
      console.error("Unexpected response format:", data);
      alert("音楽情報の取得に失敗しました");
    }

    currentPage = 1;
    displaySearchResults();

  } catch (error) {
    console.error("検索エラー:", error);
    alert("検索に失敗しました。");
  } finally {
    if (loadingIndicator) loadingIndicator.style.display = "none";
  }
}






/**
 * 2) 翻訳API (MyMemory) で日本語→英語
// **/
// async function translateText(text) {
//   const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ja|en`;
//   try {
//     console.log("📡 翻訳APIリクエスト:", url);
//     const response = await fetch(url);
//     const data = await response.json();

//     if (data.responseData && data.responseData.translatedText) {
//       console.log("✅ 翻訳成功:", data.responseData.translatedText);
//       return data.responseData.translatedText;
//     } else {
//       console.warn("⚠️ 翻訳APIのレスポンスに翻訳結果がありません。");
//       return text;
//     }
//   } catch (error) {
//     console.error("翻訳エラー:", error);
//     return text;
//   }
// }

/**
 * 3) 検索結果を表示 (ページネーション対応)
**/
window.displaySearchResults = function() {
  const container = document.getElementById("search-results");
  if (!container) return;

  container.innerHTML = ""; // 既存の検索結果をクリア

  if (!searchResults || searchResults.length === 0) {
    container.innerHTML = "<p>該当する音楽が見つかりませんでした。</p>";
    return;
  }

  // 1ページに表示する件数
  const itemsPerPage = 10;
  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const paginatedResults = searchResults.slice(start, end);

  paginatedResults.forEach(track => {
    const audioUrl = track.audio;
    const permalink = track.permalink; // SoundCloudのページURL

    const trackElement = document.createElement("div");
    trackElement.innerHTML = `
      <p><strong>${track.name}</strong> - ${track.artist_name}</p>
      <a href="${permalink}" target="_blank" class="btn btn-sm btn-info mt-2">
        SoundCloudで再生
      </a>
      ${audioUrl ? `<button class="btn btn-sm btn-success mt-2"
            type="button"
            onclick="selectMusic('${audioUrl}', '${track.name}', '${track.artist_name}', this)">
        選択
      </button>` : ""}
      <hr>
    `;
    container.appendChild(trackElement);
  });

  // ページネーションボタン
  displayPaginationControls(container);
};



/** ページネーションボタン描画 */
function displayPaginationControls(container) {
  const totalPages = Math.ceil(searchResults.length / 10);
  const paginationContainer = document.createElement("div");
  paginationContainer.classList.add("pagination-controls");

  if (currentPage > 1) {
    paginationContainer.innerHTML += `<button class="btn btn-secondary mt-2" onclick="prevPage()">前へ</button> `;
  }

  paginationContainer.innerHTML += ` <span>ページ ${currentPage} / ${totalPages}</span> `;

  if (currentPage < totalPages) {
    paginationContainer.innerHTML += `<button class="btn btn-secondary mt-2" onclick="nextPage()">次へ</button>`;
  }

  container.appendChild(paginationContainer);
}

/** 次のページ */
window.nextPage = function() {
  if (currentPage * 10 < searchResults.length) {
    currentPage++;
    displaySearchResults();
  }
};

/** 前のページ */
window.prevPage = function() {
  if (currentPage > 1) {
    currentPage--;
    displaySearchResults();
  }
};

/**
 * 4) 「選択」ボタンを押したとき
 *    - ミニプレイヤー (audio controls) を表示
 *    - 「この曲にする」ボタン
 */
window.selectMusic = function(audioUrl, trackName, artistName, button) {
  console.log("選択した音楽のURL:", audioUrl);

  // hidden input (#selected-audio) にURLをセット（送信時に使う）
  const audioInput = document.getElementById("selected-audio");
  if (audioInput) {
    audioInput.value = audioUrl;
  }

  // 既存のミニプレイヤーを全部消す
  document.querySelectorAll(".music-player-container").forEach(player => player.remove());

  // ミニプレイヤー用要素を作成
  const trackElement = button.parentElement;
  const playerContainer = document.createElement("div");
  playerContainer.classList.add("music-player-container");
  playerContainer.setAttribute("data-turbo", "false"); // ← 追加

  // 🔹 SoundCloud の埋め込みプレーヤーのURLを作成
  // 🔸 audioUrl には `track.permalink_url` が入っている想定
  const embedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(audioUrl)}`;

  playerContainer.innerHTML = `
<iframe
    width="600"
    height="166"
    scrolling="no"
    frameborder="no"
    allow="autoplay"
    src="${embedUrl}">
  </iframe>



  <button class="btn btn-sm btn-primary mt-2" type="button"
    onclick="chooseTrack('${audioUrl}', '${trackName}', '${artistName}')">
    この曲にする
  </button>
`;


  trackElement.appendChild(playerContainer);

  alert(`「${trackName}」を選択しました！`);
};




/**
 * 5) 「この曲にする」ボタン
 *    - フォームのテキストボックス(#selected-track)に選んだ曲名を表示
 *    - 検索欄 (#search-section) を閉じる
 */
window.chooseTrack = function(audioUrl, trackName, artistName) {
  console.log("この曲に決定:", audioUrl);

  // 選択した曲名を表示
  const trackField = document.getElementById("selected-track");
  if (trackField) {
    trackField.value = `${trackName} / ${artistName}`;
  }

  alert(`「${trackName}」を選択しました！`);

  // 🔹 選択後に検索UIを非表示にする
  const searchSection = document.getElementById("search-section");
  if (searchSection) {
    searchSection.style.display = "none";
  }
};


function toggleMiniAudio() {
  const audio = document.getElementById("mini-audio");
  const button = document.getElementById("mini-audio-button");

  if (audio) {
    if (audio.paused) {
      audio.play();
      button.innerText = "⏸ 停止";
    } else {
      audio.pause();
      button.innerText = "🔊 再生";
    }
  } else {
    console.warn("音楽プレーヤーが見つかりません");
  }
}


// ✅ グローバル登録
window.getSoundCloudClientID = getSoundCloudClientID;
window.searchMusicWithPagination = searchMusicWithPagination;
window.displaySearchResults = displaySearchResults;
window.translateText = translateText;
window.selectMusic = selectMusic;
window.chooseTrack = chooseTrack;
window.toggleMusic = null;  // 使わないならnullにしておいてもOK
window.nextPage = nextPage;
window.prevPage = prevPage;
// import "@hotwired/turbo-rails"
