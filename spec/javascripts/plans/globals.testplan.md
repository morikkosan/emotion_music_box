# グローバル関数・window 拡張のテスト設計

## 目的
アプリ内で `window` にぶら下げている関数や値の振る舞いを回帰テストする。

## 対象
- `window.goToRecommended(params)` ページ遷移関数
- `window.updateHPBar()` HPバー更新
- `subscribeToPushNotifications()` Push通知登録

## 命名・配置規約
- テストは `spec/javascripts/globals/<name>.test.js` に置く
- 関数ごとに1ファイル、関連するDOMは `beforeEach` で生成

## テストの基本テンプレ
```js
import { renderHTML } from "../helpers/dom";

describe("【関数名】", () => {
  beforeEach(() => {
    // 必要なDOMを用意
    renderHTML(`<!-- 必要なDOM要素 -->`);
    localStorage.setItem("hpPercentage", "50"); // 必要に応じて
  });

  test("期待する結果", () => {
    // 実行
    // window.updateHPBar();

    // 検証
    // expect(...).toBe(...);
  });
});
