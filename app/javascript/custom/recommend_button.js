// app/javascript/custom/recommend_button.js
document.addEventListener("turbo:load", () => {
  const recommendButton = document.getElementById("show-recommendations-btn");
  if (!recommendButton) return;
  if (recommendButton.dataset.bound === "1") return;
  recommendButton.dataset.bound = "1";

  recommendButton.addEventListener("click", () => {
    const storedHP = localStorage.getItem("hpPercentage");
    const hp = parseInt(storedHP, 10);
    if (!isNaN(hp)) {
      window.location.href = `/emotion_logs?hp=${hp}`;
    } else {
      alert("HPゲージの値が取得できませんでした（localStorageに保存されていません）");
    }
  });
});
