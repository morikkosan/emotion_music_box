document.addEventListener("DOMContentLoaded", function () {
  function createComment(text) {
    const commentContainer = document.getElementById("comment-container");
    const comment = document.createElement("div");
    comment.className = "comment";
    comment.textContent = text;

    // ランダムな高さに配置
    const containerHeight = commentContainer.clientHeight;
    const topPosition = Math.random() * (containerHeight - 20); // 30pxは文字の高さ
    comment.style.top = `${topPosition}px`;

    // 画面外の右端に配置
    comment.style.left = "100%";
    commentContainer.appendChild(comment);

    // アニメーション
    gsap.to(comment, {
      duration: 10,
      x: -window.innerWidth - 200,
      ease: "linear",
      onComplete: () => {
        commentContainer.removeChild(comment);
      },
    });
  }

  // 一定間隔でコメントを生成
  setInterval(() => {
    createComment("いらいら");
  }, 10000);
});
