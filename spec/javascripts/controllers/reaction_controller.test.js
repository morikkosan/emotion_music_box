/**
 * reaction_controller DOM副作用テスト（安定版）
 * - 期待するユーザー可視の副作用のみを検証
 *   - ボタンのクラス切替（sorena: success / それ以外: info）
 *   - カウントの即時更新
 *   - fetch の呼び出し内容（URL, method, headers, credentials）
 *   - サーバーNG/通信失敗でもUIはロールバックしない
 *
 * メモ：
 *  - 本プロジェクトの Stimulus スタブは targets のみ自動配線
 *    → controller.commentIdValue / controller.kindValue はテスト側で直接セット
 */

import { Application } from "@hotwired/stimulus";
import ReactionController from "controllers/reaction_controller";

describe("reaction_controller", () => {
  let app;
  let root;
  let btn;
  let countEl;
  let controller;

  // ★ 修正: setImmediate を使わず、queueMicrotask があればそれを、なければ setTimeout(0)
  const flushPromises = () =>
    new Promise((resolve) => {
      if (typeof queueMicrotask === "function") {
        queueMicrotask(resolve);
      } else {
        setTimeout(resolve, 0);
      }
    });

  beforeEach(() => {
    // DOM初期化
    document.body.innerHTML = "";
    // CSRFメタタグ
    const meta = document.createElement("meta");
    meta.setAttribute("name", "csrf-token");
    meta.setAttribute("content", "TESTTOKEN");
    document.head.appendChild(meta);

    // Stimulusアプリ起動
    app = Application.start();

    // ルート要素（data-controller）
    root = document.createElement("div");
    root.setAttribute("data-controller", "reaction");

    // button / count targets
    btn = document.createElement("button");
    btn.type = "button";
    // デフォルトは sorena 相当（outline-success）
    btn.className = "btn btn-outline-success";
    btn.setAttribute("data-reaction-target", "button");

    countEl = document.createElement("span");
    countEl.setAttribute("data-reaction-target", "count");
    countEl.textContent = "3";

    root.appendChild(btn);
    root.appendChild(countEl);
    document.body.appendChild(root);

    // コントローラ登録＆インスタンス取得
    app.register("reaction", ReactionController);
    controller = app.getControllerForElementAndIdentifier(root, "reaction");

    // スタブは values 自動配線をしないため手動で代入
    controller.commentIdValue = 123;
    controller.kindValue = "sorena";

    // fetchモック
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ status: "ok" }),
    });
  });

  afterEach(() => {
    app && app.stop();
    // 追加したCSRFメタを掃除
    document.head
      .querySelectorAll('meta[name="csrf-token"]')
      .forEach((el) => el.remove());
    jest.restoreAllMocks();
  });

  test("sorena: OFF→ON で btn-success + active-reaction 付与 & カウント+1（即時）", async () => {
    // 事前状態: OFF（outline-success, activeなし, count=3）
    expect(btn.classList.contains("active-reaction")).toBe(false);
    expect(countEl.textContent).toBe("3");

    controller.toggle({ preventDefault: jest.fn() });

    // 即時UI更新を確認
    expect(countEl.textContent).toBe("4");
    expect(btn.classList.contains("btn-success")).toBe(true);
    expect(btn.classList.contains("active-reaction")).toBe(true);
    expect(btn.classList.contains("btn-outline-success")).toBe(false);

    // fetch が正しく呼ばれたか
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "/comments/123/toggle_reaction?kind=sorena",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Accept: "application/json",
          "X-CSRF-Token": "TESTTOKEN",
        }),
        credentials: "same-origin",
      })
    );

    await flushPromises(); // サーバー応答後もUIロールバックしないことを再確認
    expect(countEl.textContent).toBe("4");
    expect(btn.classList.contains("btn-success")).toBe(true);
    expect(btn.classList.contains("active-reaction")).toBe(true);
  });

  test("sorena: ON→OFF で btn-outline-success に戻り & カウント-1（下限0）", () => {
    // 事前状態: ON（solid + active, count=1）
    btn.className = "btn btn-success active-reaction";
    countEl.textContent = "1";

    controller.toggle({ preventDefault: jest.fn() });

    expect(countEl.textContent).toBe("0");
    expect(btn.classList.contains("active-reaction")).toBe(false);
    expect(btn.classList.contains("btn-outline-success")).toBe(true);
    expect(btn.classList.contains("btn-success")).toBe(false);
  });

  test("sorena: カウントが0の時にOFFしても0未満にならない（下限0を維持）", () => {
    // 事前状態: ON だが count=0
    btn.className = "btn btn-success active-reaction";
    countEl.textContent = "0";

    controller.toggle({ preventDefault: jest.fn() });

    expect(countEl.textContent).toBe("0"); // 負数にならない
    expect(btn.classList.contains("active-reaction")).toBe(false);
    expect(btn.classList.contains("btn-outline-success")).toBe(true);
  });

  test("非sorena(kind=iiなど): OFF→ON は info 系クラスに切替（outline→solid + active）", () => {
    // kind を info 側に
    controller.kindValue = "ii";
    // 初期は outline-info
    btn.className = "btn btn-outline-info";
    countEl.textContent = "5";

    controller.toggle({ preventDefault: jest.fn() });

    expect(countEl.textContent).toBe("6");
    expect(btn.classList.contains("btn-info")).toBe(true);
    expect(btn.classList.contains("active-reaction")).toBe(true);
    expect(btn.classList.contains("btn-outline-info")).toBe(false);

    // fetch URL の kind が ii になっていること
    expect(global.fetch).toHaveBeenCalledWith(
      "/comments/123/toggle_reaction?kind=ii",
      expect.any(Object)
    );
  });

  test("非sorena(kind=iiなど): ON→OFF は outline-info に戻り & カウント-1", () => {
    controller.kindValue = "ii";
    btn.className = "btn btn-info active-reaction";
    countEl.textContent = "9";

    controller.toggle({ preventDefault: jest.fn() });

    expect(countEl.textContent).toBe("8");
    expect(btn.classList.contains("active-reaction")).toBe(false);
    expect(btn.classList.contains("btn-outline-info")).toBe(true);
    expect(btn.classList.contains("btn-info")).toBe(false);
  });

  test("サーバー応答が {status:'ng'} でもUIロールバックしない", async () => {
    global.fetch.mockResolvedValueOnce({
      json: async () => ({ status: "ng" }),
    });

    controller.toggle({ preventDefault: jest.fn() });

    // 即時UI更新後
    expect(countEl.textContent).toBe("4");
    expect(btn.classList.contains("btn-success")).toBe(true);
    expect(btn.classList.contains("active-reaction")).toBe(true);

    // thenチェーン完了を待っても変わらない
    await flushPromises();

    expect(countEl.textContent).toBe("4");
    expect(btn.classList.contains("btn-success")).toBe(true);
    expect(btn.classList.contains("active-reaction")).toBe(true);
  });

  test("fetch が通信エラー（reject）でもUIロールバックしない", async () => {
    global.fetch.mockRejectedValueOnce(new Error("network down"));

    controller.toggle({ preventDefault: jest.fn() });

    // 即時UI更新後
    expect(countEl.textContent).toBe("4");
    expect(btn.classList.contains("btn-success")).toBe(true);
    expect(btn.classList.contains("active-reaction")).toBe(true);

    await flushPromises();

    // 変わらないこと
    expect(countEl.textContent).toBe("4");
    expect(btn.classList.contains("btn-success")).toBe(true);
    expect(btn.classList.contains("active-reaction")).toBe(true);
  });
});
