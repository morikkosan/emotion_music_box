import { renderHTML } from "../helpers/dom";

// 実際の window.updateHPBar をテスト
describe("window.updateHPBar", () => {
  beforeAll(() => {
    // 本番の実装を読み込む（パスは実ファイルに合わせる）
    require("../../../app/javascript/custom/gages_test.js");
  });

  test("デフォルト（localStorageなし）→ 50% #9ACD32 ・「おつかれ」", () => {
    renderHTML(`
      <div>
        <div id="hp-bar"></div>
        <span id="bar-width-display"></span>
        <span id="bar-width-display-mobile"></span>
        <p id="hp-status-text"></p>
      </div>
    `);

    localStorage.clear(); // 値なし → 50%

    window.updateHPBar();

    const bar = document.getElementById("hp-bar");
    expect(bar.style.width).toBe("50%");
    expect(bar.dataset.width).toBe("50%");
    // 50% は実装上 <=70% の分岐 → #9ACD32 / 「♪ おつかれさまです ♪」
    expect(bar.style.backgroundColor).toBe("rgb(154, 205, 50)"); // jsdomはrgb表記に正規化される
    expect(document.getElementById("hp-status-text").textContent)
      .toContain("おつかれ");
  });

  test("10% → 赤・危険文言", () => {
    renderHTML(`
      <div>
        <div id="hp-bar"></div>
        <span id="bar-width-display"></span>
        <p id="hp-status-text"></p>
      </div>
    `);

    localStorage.setItem("hpPercentage", "10");

    window.updateHPBar();

    const bar = document.getElementById("hp-bar");
    expect(bar.style.width).toBe("10%");
    expect(bar.style.backgroundColor).toBe("red");
    expect(document.getElementById("hp-status-text").textContent)
      .toContain("危険");
  });
});
