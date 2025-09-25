document.addEventListener("DOMContentLoaded", function () {
  function createComment(text) {
    const commentContainer = document.getElementById("comment-container");
    if (!commentContainer) return;

    // コメント要素を作成
    const comment = document.createElement("div");
    comment.className = "comment";
    comment.textContent = text;

    // コンテナの高さを取得（0 になりがちな場合は window.innerHeight を保険に）
    const containerHeight = commentContainer.clientHeight || window.innerHeight;

    // ランダムな縦位置（はみ出し防止で下限0）
    const baseTop = Math.max(0, containerHeight - 20); // 20は文字高さの想定
    const topPosition = Math.random() * baseTop;
    comment.style.top = `${topPosition}px`;

    // 画面外の右端に配置（従来どおり 100%）
    comment.style.position = "absolute";
    comment.style.left = "100%";
    commentContainer.appendChild(comment);

    // 実際のコメント幅を測って、移動距離を決定
    const commentWidth = comment.offsetWidth || 0;
    const travelX = window.innerWidth + commentWidth + 200; // ← 元の x: -window.innerWidth - 200 と等価（要素幅分も足してより確実）

    // Web Animations API で「右→左」へ等速で流す（10秒）
    const anim = comment.animate(
      [
        { transform: "translateX(0)" },
        { transform: `translateX(-${travelX}px)` }
      ],
      {
        duration: 10000,     // 10秒
        easing: "linear",
        fill: "forwards"
      }
    );

    // 終了したら要素を消す
    anim.onfinish = () => {
      if (comment.parentNode === commentContainer) {
        commentContainer.removeChild(comment);
      }
    };
  }

  // 一定間隔でコメントを生成（同じ間隔・文言のまま）
  setInterval(() => {
    createComment("いらいら");
  }, 10000);
});
