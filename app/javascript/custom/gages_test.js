"use strict";

// HPバーの更新関数（グローバルに）
window.updateHPBar = function () {
  console.log("✅ HPバー更新開始");

  const hpBar = document.getElementById("hp-bar");
  const hpStatusText = document.getElementById("hp-status-text");
  const barWidthDisplay = document.getElementById("bar-width-display");

  if (!hpBar || !hpStatusText) {
    console.warn("⚠️ HPバーかステータス表示要素が見つかりません");
    return;
  }

  // 必ず最新のlocalStorage値を参照
  let storedHP = localStorage.getItem("hpPercentage");
  let hpPercentage = (storedHP !== null && storedHP !== "" && !isNaN(parseFloat(storedHP)))
    ? parseFloat(storedHP)
    : 50;

  // 値を0〜100に制限
  hpPercentage = Math.min(100, Math.max(0, hpPercentage));
  const barWidth = hpPercentage + "%";

  // バーの幅を更新
  hpBar.style.width = barWidth;

  // 数値表示（％）
  if (barWidthDisplay) {
    barWidthDisplay.innerText = barWidth;
  }

  // 色とメッセージを値に応じて変える
  if (hpPercentage <= 20) {
    hpBar.style.backgroundColor = "red";
    hpStatusText.innerText = "🆘 ストレス危険 🆘";
    hpStatusText.style.color = "red";
  } else if (hpPercentage <= 40) {
    hpBar.style.backgroundColor = "yellow";
    hpStatusText.innerText = "🏥 ちょっと休みましょ 🏥";
    hpStatusText.style.color = "orange";
  } else if (hpPercentage <= 70) {
    hpBar.style.backgroundColor = "#9ACD32";
    hpStatusText.innerText = "♪ おつかれさまです ♪";
    hpStatusText.style.color = "orange";
  } else {
    hpBar.style.backgroundColor = "green";
    hpStatusText.innerText = "🩺 メンタル正常 🌿";
    hpStatusText.style.color = "green";
  }
};

// ページ読み込み時の初期化（localStorage値を反映して表示だけ）
document.addEventListener("DOMContentLoaded", () => {
  window.updateHPBar();
});

console.log("✅ HPバー更新スクリプト読み込み完了");
