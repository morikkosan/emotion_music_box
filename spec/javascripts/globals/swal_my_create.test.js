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
  // moduleNameMapper（^custom/…）が効くのでエイリアスでOK
  require("custom/swal_my_create.js");
});

afterEach(() => {
  document.body.innerHTML = "";
  jest.restoreAllMocks();
});

describe("swal_my_create (window.Swal)", () => {
  test("OK ボタンのみ: タイトル/本文/アイコン(success)が描画され、OKで isConfirmed: true", async () => {
    const p = window.Swal.fire({
      title: "確認",
      text: "実行しますか？",
      icon: "success",
      confirmButtonText: "OK"
    });

    const modal = document.getElementById("swal-fake-modal");
    expect(modal).toBeInTheDocument();

    // タイトルと本文のテキスト
    getByText(modal, /確認/);
    getByText(modal, /実行しますか？/);

    // アイコン（success）
    expect(modal.querySelector(".cyber-icon.success")).not.toBeNull();

    // OK をクリック
    const okBtn = document.getElementById("swal-fake-modal-ok");
    expect(okBtn).toBeInTheDocument();
    okBtn.click();

    await expect(p).resolves.toEqual({ isConfirmed: true });

    // 実装上は 500ms 後に remove されるが、ここでは待たない
  });

  test("キャンセルあり: Cancel クリックで isConfirmed: false（icon: error）", async () => {
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

    await expect(p).resolves.toEqual({ isConfirmed: false });
  });

  test("×（閉じる）ボタンで isConfirmed: false（icon: info→デフォルト分岐）", async () => {
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

  test("icon: question 分岐 ＋ 既存モーダルの除去分岐（2回連続 fire）", async () => {
    // 1回目：question アイコン
    const p1 = window.Swal.fire({
      title: "問い合わせ",
      text: "どちらにしますか？",
      icon: "question",
      confirmButtonText: "はい"
    });

    const modal1 = document.getElementById("swal-fake-modal");
    expect(modal1).toBeInTheDocument();
    // question アイコンが描画される
    expect(modal1.querySelector(".cyber-icon.question")).not.toBeNull();

    // 1つ目を OK して resolve（DOM は即時 remove ではない）
    const ok1 = document.getElementById("swal-fake-modal-ok");
    ok1.click();
    await expect(p1).resolves.toEqual({ isConfirmed: true });

    // 2回目：既存の #swal-fake-modal を先に remove してから再生成される分岐を踏む
    const p2 = window.Swal.fire({
      title: "第二",
      text: "置き換え確認",
      icon: "success",
      confirmButtonText: "OK"
    });

    const modal2 = document.getElementById("swal-fake-modal");
    expect(modal2).toBeInTheDocument();
    // question → success に置き換わったことを確認
    expect(modal2.querySelector(".cyber-icon.success")).not.toBeNull();
    expect(getByText(modal2, /第二/)).toBeTruthy();

    // DOM上に同じIDが重複していない（=前のが remove 済み）
    expect(document.querySelectorAll("#swal-fake-modal").length).toBe(1);

    // 後片付け
    document.getElementById("swal-fake-modal-ok").click();
    await expect(p2).resolves.toEqual({ isConfirmed: true });
  });

  // ← 追加：text が未指定（falsy）でも空文字で描画される分岐を踏む
  test("text 未指定でも描画される（text || '' の falsy 経路）", async () => {
    const p = window.Swal.fire({
      title: "本文なし",
      // text を渡さない → falsy 分岐
      icon: "success",
      confirmButtonText: "OK"
    });

    const modal = document.getElementById("swal-fake-modal");
    expect(modal).toBeInTheDocument();

    const bodySpan = modal.querySelector(".cyber-text");
    expect(bodySpan).toBeInTheDocument();
    expect(bodySpan.textContent).toBe("");

    // OK で resolve
    document.getElementById("swal-fake-modal-ok").click();
    await expect(p).resolves.toEqual({ isConfirmed: true });
  });
});
