// ==========================
// 例1：おすすめボタン
// ==========================
window.goToRecommended = function () {
  const storedHP = localStorage.getItem("hpPercentage");
  const hp = parseInt(storedHP);
  if (!isNaN(hp)) {
    window.location.href = `/emotion_logs/recommended?hp=${hp}`;
  } else {
    alert("HPゲージの値が取得できませんでした（localStorageに保存されていません）");
  }
};

function goToRecommended(e) {
  e.preventDefault();
  window.goToRecommended();
}

function setupRecommendedBtn() {
  document.querySelectorAll('.go-to-recommended-btn').forEach(btn => {
    btn.removeEventListener('click', goToRecommended);
    btn.addEventListener('click', goToRecommended);
  });
}

// ==========================
// 例2：ページを閉じるボタン
// ==========================
window.closeWindow = function () {
  window.close();
};

function closeWindowHandler(e) {
  e.preventDefault();
  window.closeWindow();
}

function setupCloseWindowBtn() {
  document.querySelectorAll('.close-window-btn').forEach(btn => {
    btn.removeEventListener('click', closeWindowHandler);
    btn.addEventListener('click', closeWindowHandler);
  });
}

// ==========================
// 例3：プレイリスト削除ボタンのconfirm
// ==========================
function confirmPlaylistDelete(e) {
  if (!confirm("本当にこのプレイリストを削除しますか？")) {
    e.preventDefault();
  }
}

function setupPlaylistDeleteBtns() {
  document.querySelectorAll('.playlist-delete-btn').forEach(btn => {
    btn.removeEventListener('click', confirmPlaylistDelete);
    btn.addEventListener('click', confirmPlaylistDelete);
  });
}

// ==========================
// 例4：アカウント削除ボタン confirm
// ==========================
function confirmAccountDelete(e) {
  if (!confirm("本当にアカウントを削除しますか？この操作は取り消せません。")) {
    e.preventDefault();
  }
}

function setupAccountDeleteBtn() {
  document.querySelectorAll('.account-delete-btn').forEach(btn => {
    btn.removeEventListener('click', confirmAccountDelete);
    btn.addEventListener('click', confirmAccountDelete);
  });
}

// ==========================
// EMOTIONセレクト自動送信
// ==========================
function handleAutoSubmitEmotion(e) {
  e.target.form.submit();
}

function setupAutoSubmitEmotion() {
  document.querySelectorAll('.auto-submit-emotion').forEach(select => {
    select.removeEventListener('change', handleAutoSubmitEmotion);
    select.addEventListener('change', handleAutoSubmitEmotion);
  });
}

// ==========================
// まとめて初期化
// ==========================
function setupInlineHandlers() {
  setupRecommendedBtn();
  setupCloseWindowBtn();
  setupPlaylistDeleteBtns();
  setupAccountDeleteBtn();
  console.log("setupInlineHandlers ran.");
}

// Turboページ遷移対応
document.addEventListener('DOMContentLoaded', setupInlineHandlers);
document.addEventListener('turbo:load', setupInlineHandlers);
