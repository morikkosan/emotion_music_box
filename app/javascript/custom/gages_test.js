"use strict";

// HPバーの更新関数（グローバルに）
window.updateHPBar = function () {
  const hpBar = document.getElementById("hp-bar");
  const hpStatusText = document.getElementById("hp-status-text");
  const barWidthDisplay = document.getElementById("bar-width-display");
  

  if (!hpBar || !hpStatusText) return;

  let storedHP = localStorage.getItem("hpPercentage");
  let hpPercentage = (storedHP !== null && !isNaN(parseFloat(storedHP)))
    ? parseFloat(storedHP)
    : 50;

  hpPercentage = Math.min(100, Math.max(0, hpPercentage));
  const barWidth = hpPercentage + "%";

  hpBar.style.width = barWidth;
  hpBar.dataset.width = barWidth;

  if (barWidthDisplay) barWidthDisplay.innerText = barWidth;

  if (hpPercentage <= 20) {
    hpBar.style.backgroundColor = "red";
    hpStatusText.innerText = "🆘 ストレス危険 🆘";
  } else if (hpPercentage <= 40) {
    hpBar.style.backgroundColor = "yellow";
    hpStatusText.innerText = "🏥 ちょっと休みましょ 🏥";
  } else if (hpPercentage <= 70) {
    hpBar.style.backgroundColor = "#9ACD32";
    hpStatusText.innerText = "♪ おつかれさまです ♪";
  } else {
    hpBar.style.backgroundColor = "green";
    hpStatusText.innerText = "🩺 メンタル正常 🌿";
  }
};

// おすすめページに遷移（実際のバーの見た目から取得）
window.goToRecommended = function () {
  const hpBar = document.getElementById("hp-bar");
  if (!hpBar) {
    alert("HPバーが見つかりません");
    return;
  }

const widthStr = hpBar.dataset.width || hpBar.style.width;
  
  const hp = parseInt(widthStr);      // → 85

  //console.log("🔥 表示中のバーから取得したHP値:", hp);

  if (!isNaN(hp)) {
    window.location.href = `/emotion_logs/recommended?hp=${hp}`;
  } else {
    alert("HPゲージの値が取得できませんでした");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  ////console.log("📦 DOMContentLoaded 発火 → HPバー更新");
  window.updateHPBar();
});

document.addEventListener("turbo:load", () => {
  //console.log("🚀 turbo:load 発火 → HPバー更新");
  window.updateHPBar();
});


//console.log("✅ HPバー更新スクリプト読み込み完了");
