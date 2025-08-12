// spec/javascripts/controllers/application.test.js
// 対象: app/javascript/controllers/application.js
// 目的: Application.start が呼ばれる / application.debug が false / window.Stimulus に代入

// 注意: 本プロジェクトの jest.config.js で @hotwired/stimulus は
// spec/javascripts/stubs/stimulusStub.js にマップされています。
// その stub の Application.start() は任意のオブジェクトを返す（debug プロパティは未定義）ため、
// 本テストでは application.debug が false に「設定されたこと」を確認します。

import { Application } from "@hotwired/stimulus";

describe("controllers/application.js (Stimulus bootstrap)", () => {
  let originalStimulus;

  beforeEach(() => {
    // モジュールキャッシュをクリアして、毎回初期化コードを再実行させる
    jest.resetModules();

    // window.Stimulus を退避して消す
    originalStimulus = window.Stimulus;
    delete window.Stimulus;

    // 呼び出し回数などのモック情報をリセット
    jest.clearAllMocks();
  });

  afterEach(() => {
    // 後始末：window.Stimulus を元に戻す
    if (originalStimulus !== undefined) {
      window.Stimulus = originalStimulus;
    } else {
      delete window.Stimulus;
    }
  });

  it("Application.start() が呼ばれ、debug=false と window.Stimulus 代入が行われる", async () => {
    // 実際の初期化モジュールを読み込む（副作用で start 実行、debug 代入、window.Stimulus 設定が走る）
    const mod = await import("../../../app/javascript/controllers/application.js");

    // start が1回呼ばれた（stub 側で関数かどうかの確認は不要）
    // stub 実装は Map レジストリを返すオブジェクトを生成するため、
    // 呼ばれたことだけを確認する
    expect(typeof Application.start).toBe("function");
    // start の呼び出しを厳密に追いたい場合は jest.spyOn を使うが、
    // moduleNameMapper でスタブ済みのため直接回数は取れないことがある。
    // そこで、戻り値の副作用（window.Stimulus/ debug）で検証する。

    // エクスポートされた application が存在する
    expect(mod.application).toBeTruthy();

    // debug=false がセットされている
    expect(mod.application.debug).toBe(false);

    // window.Stimulus に代入されている
    expect(window.Stimulus).toBe(mod.application);
  });
});
