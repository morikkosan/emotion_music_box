// spec/javascripts/globals/swal_my_create.test.js
import { getByText } from "@testing-library/dom";

// jsdom では Bootstrap が動かないので、Modal だけモックして global に差す
beforeAll(() => {
  global.bootstrap = {
    Modal: class {
      constructor(el) {
        this._el = el;
        this._shown = false;
      }
      show() { this._shown = true; }
      hide() { this._shown = false; }
      static getOrCreateInstance(el) { return new this(el); }
    }
  };

  // 本物の自作 Swal を読み込む（window.Swal を定義する）
  // パスは実ファイルの場所に合わせてください
  require("../../../app/javascript/custom/swal_my_create.js");
});

afterEach(() => {
  document.body.innerHTML = "";
  jest.restoreAllMocks();
});

describe("swal_my_create (window.Swal)", () => {
  test("OK ボタンのみ: タイトル/本文/アイコンが描画され、OKで isConfirmed: true", async () => {
    // 実行
    const p = window.Swal.fire({
      title: "確認",
      text: "実行しますか？",
      icon: "success",
      confirmButtonText: "OK"
    });

    // DOM が追加されたことを確認（タイトルと本文）
    const modal = document.getElementById("swal-fake-modal");
    expect(modal).toBeInTheDocument();

    // タイトルと本文のテキスト
    getByText(modal, /確認/);
    getByText(modal, /実行しますか？/);

    // アイコン（success）相当が入っているか（.cyber-icon.success）
    expect(modal.querySelector(".cyber-icon.success")).not.toBeNull();

    // OK をクリック
    const okBtn = document.getElementById("swal-fake-modal-ok");
    expect(okBtn).toBeInTheDocument();
    okBtn.click();

    // Promise が isConfirmed: true で解決される
    await expect(p).resolves.toEqual({ isConfirmed: true });

    // 少し待ってモーダルDOMが消える（実装で setTimeout 500ms）
    await new Promise(r => setTimeout(r, 10)); // 実際はアニメなしなので少しでOK
  });

  test("キャンセルあり: Cancel クリックで isConfirmed: false", async () => {
    const p = window.Swal.fire({
      title: "削除",
      text: "本当に削除しますか？",
      icon: "error",
      confirmButtonText: "削除する",
      showCancelButton: true,
      cancelButtonText: "やめる"
    });

    const modal = document.getElementById("swal-fake-modal");
    expect(modal).toBeInTheDocument();

    // Cancel ボタンがある
    const cancelBtn = document.getElementById("swal-fake-modal-cancel");
    expect(cancelBtn).toBeInTheDocument();
    getByText(modal, /やめる/);

    // Cancel クリック
    cancelBtn.click();

    // isConfirmed: false で解決
    await expect(p).resolves.toEqual({ isConfirmed: false });
  });

  test("×（閉じる）ボタンで isConfirmed: false", async () => {
    const p = window.Swal.fire({
      title: "情報",
      text: "閉じるテスト",
      icon: "info",
      confirmButtonText: "OK"
    });

    const modal = document.getElementById("swal-fake-modal");
    expect(modal).toBeInTheDocument();

    // 閉じるボタン
    const closeBtn = modal.querySelector(".btn-close");
    expect(closeBtn).toBeInTheDocument();

    closeBtn.click();

    await expect(p).resolves.toEqual({ isConfirmed: false });
  });
});
