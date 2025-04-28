"use strict";
console.log("✅ gages_test.js is loaded!");

let hpPercentage = 0; // 初期HP

// 🚀 HPバーの更新関数を `window` に登録
window.updateHPBar = function () {
  console.log("✅ HPバーの更新開始");
  console.time("HPバー更新");

  const hpBar = document.getElementById("hp-bar");
  const hpStatusText = document.getElementById("hp-status-text");

  if (!hpBar || !hpStatusText) {
    console.warn("⚠️ HPバーまたはステータステキストが見つかりません。（フォームページなら無視）");
    console.timeEnd("HPバー更新");
    return;
  }

  let storedHP = localStorage.getItem("hpPercentage");
  hpPercentage = storedHP ? parseFloat(storedHP) : 0;

  let normalizedHP = Math.max(-100, Math.min(100, hpPercentage));
  let barWidth = ((normalizedHP + 100) / 2) + "%";

  console.log(`🎯 更新後の HP値: ${normalizedHP}, HPバーの幅: ${barWidth}`);
// barWidth の値を `index.html.erb` に表示
const barWidthDisplay = document.getElementById("bar-width-display");
if (barWidthDisplay) {
    barWidthDisplay.innerText = barWidth; // 👈 ここでストレス値を表示
}
  hpBar.style.transition = "width 0.5s ease-in-out"; // ⏳ アニメーションを短縮
  hpBar.style.width = barWidth;

  // 🌟 HP値に応じて色とメッセージを変更
  if (normalizedHP <= -30) {
    hpBar.style.backgroundColor = "red";
    hpStatusText.innerText = "🆘 ストレス危険 🆘";
    hpStatusText.style.color = "red";
  } else if (normalizedHP <= 0) {
    hpBar.style.backgroundColor = "yellow";
    hpStatusText.innerText = "🏥 ちょっと休みましょ 🏥";
    hpStatusText.style.color = "orange";
  } else if (normalizedHP <= 70) {
    hpBar.style.backgroundColor = "#9ACD32";
    hpStatusText.innerText = "♪ おつかれさまです ♪";
    hpStatusText.style.color = "orange";
  } else {
    hpBar.style.backgroundColor = "green";
    hpStatusText.innerText = "🩺 メンタル正常 🌿";
    hpStatusText.style.color = "green";
  }

  // **localStorage に保存**
  requestAnimationFrame(() => {
    localStorage.setItem("hpPercentage", normalizedHP.toString());
    console.log("💾 localStorage に保存:", localStorage.getItem("hpPercentage"));
  });

  console.timeEnd("HPバー更新");
};
 
// ✅ `index` ページで HP を復元
+ document.addEventListener("DOMContentLoaded", function () {

  console.log("✅ turbo:load が発火！");

  let savedHP = localStorage.getItem("hpPercentage");
  if (savedHP === null) {
    console.warn("⚠️ `turbo:load` で `hpPercentage` が取得できません。デフォルト値を使用します。");
  }
  hpPercentage = savedHP ? parseFloat(savedHP) : 0;

  console.log("🔄 `turbo:load` で取得した `hpPercentage`:", hpPercentage);

  if (!isNaN(hpPercentage)) {
    window.updateHPBar();
  }
});

// ✅ フォーム送信時に `hpPercentage` を更新し、リダイレクトする
document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("emotion-form");
  if (form) {
    console.log("✅ emotion-form が見つかりました！");

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      console.log("✅ Form submit event triggered");

      const formData = new FormData(form);
      const submitButton = form.querySelector('input[type="submit"]');
      submitButton.disabled = true;

      try {
        console.time("フォーム送信");
        const response = await fetch(form.action, {
          method: form.method,
          body: formData,
          headers: {
            "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]').content,
          },
        });
        console.timeEnd("フォーム送信");
 
        const data = await response.json();
        console.log("🚀 サーバーレスポンス:", data);

        if (data.success) { 
          console.log("✅ HP値を更新:", data.hpPercentage);

          hpPercentage += parseFloat(data.hpPercentage);
          window.updateHPBar();

          requestAnimationFrame(() => {
            localStorage.setItem("hpPercentage", hpPercentage.toString());
            console.log("💾 `localStorage` に保存された `hpPercentage`:", localStorage.getItem("hpPercentage"));
          });

          // **感情記録の保存メッセージを表示**
          setTimeout(() => alert(data.message), 100); // 遅延を加えて UX 改善

          // **リダイレクト**
          setTimeout(() => {
            console.log("🔄 `emotion_logs` にリダイレクト");
            window.location.href = data.redirect_url;
          }, 500);
        } else {
          console.error("❌ 感情記録の保存に失敗:", data.errors.join(", "));
          setTimeout(() => alert("感情記録の保存に失敗しました: " + data.errors.join(", ")), 100);
        }
      } catch (error) {
        console.error("❌ フォーム送信中のエラー:", error);
      } finally {
        submitButton.disabled = false;
      }
    });
  }
});

// ✅ `window.updateHPBar` をグローバルに登録
console.log("✅ updateHPBar is now available globally:", typeof window.updateHPBar);
