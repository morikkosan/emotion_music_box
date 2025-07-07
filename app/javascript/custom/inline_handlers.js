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
// フラッシュSweetAlert表示
// ==========================
function showFlashSwal() {
  const flashContainer = document.querySelector("#flash-container");
  const flashNotice = flashContainer?.dataset.flashNotice || document.body.dataset.flashNotice;
  const flashAlert  = flashContainer?.dataset.flashAlert  || document.body.dataset.flashAlert;

  console.log("showFlashSwal called!");
  console.log("flashNotice:", flashNotice, "flashAlert:", flashAlert);

  if (!window.Swal) {
    console.warn("⚠️ SweetAlert2 (Swal) が読み込まれていません");
    return;
  }

  if (flashAlert === "すでにログイン済みです") return;

  if (flashAlert) {
    Swal.fire({
      title: "エラー ❌",
      text: flashAlert,
      icon: "error",
      confirmButtonText: "閉じる",
      background: "linear-gradient(135deg, #00b3ff, #ff0088)",
      color: "#fff",
      customClass: { popup: "cyber-popup" }
    });
    document.body.dataset.flashAlert = "";
    flashContainer?.remove();
    return;
  }

  if (flashNotice) {
    const key = `flashNotice:${flashNotice}`;
    if (!sessionStorage.getItem(key)) {
      Swal.fire({
        title: "成功 🎉",
        text: flashNotice,
        icon: "success",
        confirmButtonText: "OK",
        background: "linear-gradient(135deg, #00b3ff, #ff0088)",
        color: "#fff",
        timer: 3000,
        timerProgressBar: true,
        customClass: { popup: "cyber-popup" }
      });
      sessionStorage.setItem(key, "shown");
    }
    document.body.dataset.flashNotice = "";
    flashContainer?.remove();
  }
}

// ==========================
// まとめて初期化
// ==========================
function setupInlineHandlers() {
  setupRecommendedBtn();
  setupCloseWindowBtn();
  setupPlaylistDeleteBtns();
  setupAccountDeleteBtn();
  // 必要な初期化はここに増やしていく
  console.log("setupInlineHandlers ran.");
}

// Turboページ遷移対応
document.addEventListener('DOMContentLoaded', setupInlineHandlers);
document.addEventListener('turbo:load', setupInlineHandlers);

// フラッシュ監視
document.addEventListener("DOMContentLoaded", showFlashSwal);
document.addEventListener("turbo:load", showFlashSwal);
window.addEventListener("pageshow", showFlashSwal);

const observer = new MutationObserver((mutationsList) => {
  for (const mutation of mutationsList) {
    for (const node of mutation.addedNodes) {
      if (node.id === "flash-container") {
        console.log("MutationObserver: flash-container added!");
        showFlashSwal();
        return;
      }
    }
  }
});
observer.observe(document.body, {
  childList: true,
  subtree: true
});
