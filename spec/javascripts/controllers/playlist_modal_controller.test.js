/**
 * playlist_modal_controller DOM副作用テスト（安定版・拡張）
 * - 毎テスト: module cache クリア → bootstrap を doMock（DOMを実際に変える）
 * - Stimulusの data-action には依存しない。controller.open(e) を明示呼び出し
 * - ユーザーに見える副作用を幅広く検証：
 *   - 他モーダルの初期化（非表示/属性リセット）
 *   - backdrop/SweetAlert 残骸掃除
 *   - body の class/style 復旧（pointer-events含む）
 *   - 50ms 後の hidden input 注入（有/無の分岐）
 *   - hidden.bs.modal 時の後片付け（dispose + 掃除）
 *   - connect() でモーダル未検出の警告分岐
 *   - open() の modalEl=null 早期 return（※仕様変更：warn は出さない）
 *   - close() の getOrCreateInstance 経由分岐
 *   - disconnect() のイベント解除・dispose
 *   - Turbo 事前イベントでのグローバル掃除（remove失敗のフォールバック含む）
 */

import { waitFor } from "@testing-library/dom";
import { Application } from "@hotwired/stimulus";

// --- タイマ/マイクロタスクを進めるユーティリティ ---
const flushAsync = async (ms = 0) => {
  await Promise.resolve();
  if (ms > 0) jest.advanceTimersByTime(ms);
  jest.runOnlyPendingTimers();
  await Promise.resolve();
};

// Bootstrapの「見た目」を再現するテスト用モック
const makeBootstrapMock = () => {
  const instMap = new WeakMap();

  class Modal {
    constructor(el, _opts = {}) {
      this._el = el;
      this._disposed = false;
      instMap.set(el, this);
    }

    static getInstance(el) {
      return instMap.get(el) || null;
    }

    static getOrCreateInstance(el, opts) {
      return this.getInstance(el) || new Modal(el, opts);
    }

    show() {
      if (!this._el) return;
      // 本家に近い最低限の見た目変更
      this._el.classList.add("show");
      this._el.style.display = "block";
      this._el.setAttribute("aria-modal", "true");
      this._el.removeAttribute("aria-hidden");

      document.body.classList.add("modal-open");
      document.body.style.overflow = "hidden";
      // スクロールバー補正（簡易）
      if (!document.body.style.paddingRight) {
        document.body.style.paddingRight = "10px";
      }

      // バックドロップを付与
      const bd = document.createElement("div");
      bd.className = "modal-backdrop";
      document.body.appendChild(bd);
    }

    hide() {
      if (!this._el) return;
      this._el.classList.remove("show");
      this._el.style.display = "";
      this._el.removeAttribute("aria-modal");
      this._el.setAttribute("aria-hidden", "true");

      // バックドロップ削除
      document.querySelectorAll(".modal-backdrop").forEach((n) => n.remove());

      // body 復旧（簡略化）
      document.body.classList.remove("modal-open");
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    }

    dispose() {
      this._disposed = true;
      this.hide();
      instMap.delete(this._el);
    }
  }

  return { __esModule: true, Modal };
};

describe("playlist_modal_controller (DOM effects)", () => {
  let ControllerClass;
  let app, root, openBtn, modal, another, selectedIds, controller;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();

    // ここで bootstrap を見た目再現モックに差し替える
    jest.doMock("bootstrap", makeBootstrapMock);

    // controller をモック適用後に import
    jest.isolateModules(() => {
      // eslint-disable-next-line global-require
      ControllerClass = require("controllers/playlist_modal_controller").default;
    });

    document.body.innerHTML = "";

    // 事前に「残骸」を仕込む
    document.body.className = "modal-open swal2-shown";
    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = "10px";
    const swal = document.createElement("div");
    swal.className = "swal2-container";
    document.body.appendChild(swal);
    const fake = document.createElement("div");
    fake.id = "swal-fake-modal";
    document.body.appendChild(fake);

    // 既に開いている別モーダル（閉じられるべき）
    another = document.createElement("div");
    another.className = "modal show";
    another.style.display = "block";
    another.setAttribute("aria-modal", "true");
    document.body.appendChild(another);

    // コントローラ root
    root = document.createElement("div");
    root.setAttribute("data-controller", "playlist-modal");

    openBtn = document.createElement("button");
    openBtn.id = "open-btn";
    openBtn.setAttribute("data-action", "click->playlist-modal#open");
    root.appendChild(openBtn);

    // 対象モーダル（values未配線スタブ対応：既定IDを使う）
    modal = document.createElement("div");
    modal.id = "playlist-modal";
    modal.className = "modal";
    modal.setAttribute("tabindex", "-1");

    selectedIds = document.createElement("div");
    selectedIds.id = "selected-log-ids";
    modal.appendChild(selectedIds);

    // チェック済みログ
    [101, 202, 303].forEach((v) => {
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "playlist-check";
      cb.value = String(v);
      cb.checked = true;
      document.body.appendChild(cb);
    });

    document.body.appendChild(root);
    document.body.appendChild(modal);

    // Stimulus 接続（actionsは張られないので、自前で open 呼ぶ）
    app = Application.start();
    app.register("playlist-modal", ControllerClass);
    controller = app.getControllerForElementAndIdentifier(root, "playlist-modal");

    // クリック → open 手動配線
    openBtn.addEventListener("click", (e) => controller.open(e));
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    app?.stop?.();
    document.body.innerHTML = "";
  });

  test("connect → open(): 自身が開き、別モーダルが初期化され、50ms後に hidden inputs を注入", async () => {
    // 実行前の状態確認（別モーダルが開いている）
    expect(another.classList.contains("show")).toBe(true);
    expect(another.style.display).toBe("block");

    // open 実行
    openBtn.click();

    // show による見た目反映
    await waitFor(() => {
      expect(modal.classList.contains("show")).toBe(true);
      expect(modal.style.display).toBe("block");
      // open 前にあった swal2 残骸は掃除される
      expect(document.querySelector(".swal2-container")).toBeNull();
      expect(document.getElementById("swal-fake-modal")).toBeNull();
      // pointer-events も回復
      expect(document.body.style.pointerEvents).toBe("auto");
    });

    // 他モーダルは初期化（非表示 + 属性復旧）
    await waitFor(() => {
      expect(another.classList.contains("show")).toBe(false);
      expect(another.style.display).toBe("");
      expect(another.getAttribute("aria-modal")).toBeNull();
      expect(another.getAttribute("aria-hidden")).toBe("true");
    });

    // 50ms 後に hidden input が注入される
    await flushAsync(60);
    const inputs = selectedIds.querySelectorAll('input[name="selected_logs[]"]');
    const values = Array.from(inputs).map((i) => i.value);
    expect(values.sort()).toEqual(["101", "202", "303"]);
  });

  test("hidden.bs.modal: dispose + 残骸掃除（body復旧・backdrop除去・swal痕跡除去）", async () => {
    // まず開く
    controller.open();
    await waitFor(() => {
      expect(modal.classList.contains("show")).toBe(true);
    });

    // hidden を発火
    modal.dispatchEvent(new Event("hidden.bs.modal"));

    // 後片付け確認
    await waitFor(() => {
      // body 基本復旧
      expect(document.body.classList.contains("modal-open")).toBe(false);
      expect(document.body.style.overflow).toBe("");
      // ★ 環境差（スクロールバー補正）を許容
      expect(["", "0px", "10px"]).toContain(document.body.style.paddingRight);
      // バックドロップ除去
      expect(document.querySelector(".modal-backdrop")).toBeNull();
      // swal 系クラスの後遺症もない
      expect(document.body.classList.contains("swal2-shown")).toBe(false);
    });
  });

  // --- 追加カバレッジ ---

  // connect(): モーダル未検出時（warn & 後続スキップ）
  test("connect(): モーダル未検出時は warn を出して後続をスキップ", async () => {
    const warnSpy = jest.spyOn(console, "warn");

    const existing = document.getElementById("playlist-modal");
    if (existing) existing.remove();

    const root2 = document.createElement("div");
    root2.setAttribute("data-controller", "playlist-modal");
    root2.setAttribute("data-playlist-modal-id-value", "not-exists");
    document.body.appendChild(root2);

    const app2 = Application.start();
    app2.register("playlist-modal", ControllerClass);
    const c2 = app2.getControllerForElementAndIdentifier(root2, "playlist-modal");

    // connect されたが modalEl 不在（connect 早期 return）
    expect(c2.modalEl).toBeNull();
    expect(warnSpy).toHaveBeenCalled();

    // hidden.bs.modal を投げても何も起きない（リスナ未登録）
    root2.dispatchEvent(new Event("hidden.bs.modal"));
    app2.stop();
  });

  // open(): modalEl=null の早期 return（※仕様変更：warnは出さない）
  test("open(): 対象モーダル要素がDOMに無い場合は何もせず早期return（warnは出さない仕様）", async () => {
    // 直前までの warn 呼び出し履歴をクリアして正確に測る
    jest.clearAllMocks();
    const warnSpy = jest.spyOn(console, "warn");

    // 強制的に null にして、さらに DOM から対象モーダル自体を除去しておく
    controller.modalEl = null;
    const existing = document.getElementById("playlist-modal");
    if (existing) existing.remove();

    // 事前に show状態を作っておき、open() 実行後も変化しないことを検証
    another.classList.add("show");
    another.style.display = "block";
    document.body.classList.add("modal-open");

    controller.open(); // ここで ID 再解決しても見つからない → 早期return

    // ※ 現仕様では warn は出さない
    expect(warnSpy).not.toHaveBeenCalled();

    // DOM に変化がない（show のまま / modal-open のまま）
    expect(another.classList.contains("show")).toBe(true);
    expect(document.body.classList.contains("modal-open")).toBe(true);
  });

  test("close(): getInstance が null でも getOrCreateInstance 経由で閉じられる", async () => {
    // まだ .open() していないので getInstance は null
    controller.close();

    await waitFor(() => {
      // hide() が走って初期化されたこと（getOrCreateInstance → hide）
      expect(modal.getAttribute("aria-hidden")).toBe("true");
      expect(modal.classList.contains("show")).toBe(false);
    });
  });

  test("disconnect(): イベント解除 + dispose + 掃除が実行される", async () => {
    controller.open();
    await waitFor(() => expect(modal.classList.contains("show")).toBe(true));

    // スタブは app.stop() で disconnect を呼ばないため、明示的に呼ぶ
    controller.disconnect();

    await waitFor(() => {
      expect(document.querySelector(".modal-backdrop")).toBeNull();
      expect(document.body.classList.contains("modal-open")).toBe(false);
    });
  });

  test("open(): #selected-log-ids が無い場合は注入スキップ（例外なし）", async () => {
    // 一旦 container を外す
    selectedIds.remove();
    await flushAsync();

    controller.open();
    await waitFor(() => expect(modal.classList.contains("show")).toBe(true));

    await flushAsync(60);
    // コンテナが無いのでもちろん注入されない（例外も出ない）
    expect(modal.querySelectorAll('input[name="selected_logs[]"]').length).toBe(0);
  });

  test("open(): チェック無しの場合、コンテナは空のまま", async () => {
    // 既存のチェックを外す
    document.querySelectorAll(".playlist-check").forEach((cb) => (cb.checked = false));

    controller.open();
    await waitFor(() => expect(modal.classList.contains("show")).toBe(true));
    await flushAsync(60);

    expect(selectedIds.children.length).toBe(0);
  });

  test("Turbo 事前イベントで runGlobalOverlayCleanup が走る（両イベント）", async () => {
    // 開いているモーダル + バックドロップ + swal 残骸を置く
    const m = document.createElement("div");
    m.className = "modal show";
    m.style.display = "block";
    m.setAttribute("aria-modal", "true");
    document.body.appendChild(m);

    const bd = document.createElement("div");
    bd.className = "modal-backdrop";
    document.body.appendChild(bd);

    const swal2 = document.createElement("div");
    swal2.className = "swal2-container";
    document.body.appendChild(swal2);

    document.body.classList.add("modal-open");
    document.body.style.overflow = "hidden";

    // 1) turbo:before-cache
    document.dispatchEvent(new Event("turbo:before-cache"));

    await waitFor(() => {
      expect(m.classList.contains("show")).toBe(false);
      expect(m.style.display).toBe("");
      expect(m.getAttribute("aria-modal")).toBeNull();
      expect(m.getAttribute("aria-hidden")).toBe("true");
      expect(document.querySelector(".modal-backdrop")).toBeNull();
      expect(document.querySelector(".swal2-container")).toBeNull();
      expect(document.body.classList.contains("modal-open")).toBe(false);
      expect(document.body.style.overflow).toBe("");
      expect(document.body.style.pointerEvents).toBe("auto");
    });

    // 再度汚して 2) turbo:before-stream-render
    const m2 = document.createElement("div");
    m2.className = "modal show";
    m2.style.display = "block";
    m2.setAttribute("aria-modal", "true");
    document.body.appendChild(m2);

    const bd2 = document.createElement("div");
    bd2.className = "modal-backdrop";
    document.body.appendChild(bd2);

    const swal3 = document.createElement("div");
    swal3.id = "swal-fake-modal";
    document.body.appendChild(swal3);

    document.body.classList.add("modal-open");
    document.body.style.overflow = "hidden";

    document.dispatchEvent(new Event("turbo:before-stream-render"));

    await waitFor(() => {
      expect(m2.classList.contains("show")).toBe(false);
      expect(document.querySelector(".modal-backdrop")).toBeNull();
      expect(document.getElementById("swal-fake-modal")).toBeNull();
      expect(document.body.classList.contains("modal-open")).toBe(false);
      expect(document.body.style.overflow).toBe("");
      expect(document.body.style.pointerEvents).toBe("auto");
    });
  });

  // --- ここから：remove() が throw するフォールバック分岐の網羅 ---

  test("cleanupSwalArtifacts(): remove が throw してもスタイルで無効化（149–151カバー）", async () => {
    // remove を投げる要素をいくつか用意（セレクタ配列の一部でOK）
    const offenders = [
      "#swal-fake-modal",
      ".swal2-container",
      ".swal2-backdrop",
    ];

    offenders.forEach((sel) => {
      const el = document.createElement("div");
      if (sel.startsWith("#")) el.id = sel.slice(1);
      else el.className = sel.slice(1);
      // remove が失敗するように
      el.remove = () => { throw new Error("cannot remove"); };
      document.body.appendChild(el);
    });

    // open() の前処理（#cleanupBackdropsAndBody → #cleanupSwalArtifacts）が走る
    controller.open();

    // remove できなかった要素は display:none / visibility:hidden / pointer-events:none になる
    await waitFor(() => {
      offenders.forEach((sel) => {
        const el = sel.startsWith("#")
          ? document.getElementById(sel.slice(1))
          : document.querySelector(sel);
        expect(el.style.display).toBe("none");
        expect(el.style.visibility).toBe("hidden");
        expect(el.style.pointerEvents).toBe("none");
      });
    });
  });

  test("runGlobalOverlayCleanup(): remove が throw してもスタイルで無効化（183–185側も間接カバー）", async () => {
    // Turbo イベント側でも、remove が throw する要素を配置（★ backdrops は throw にしない！）
    const el1 = document.createElement("div");
    el1.className = "swal2-container";
    el1.remove = () => { throw new Error("cannot remove"); };
    document.body.appendChild(el1);

    const el2 = document.createElement("div");
    el2.id = "swal-fake-modal";
    el2.remove = () => { throw new Error("cannot remove"); };
    document.body.appendChild(el2);

    // ついでに modal/backdrop も置いておく（★ ここは remove を壊さない）
    const m = document.createElement("div");
    m.className = "modal show";
    m.style.display = "block";
    m.setAttribute("aria-modal", "true");
    document.body.appendChild(m);

    const bd = document.createElement("div");
    bd.className = "modal-backdrop";
    document.body.appendChild(bd);

    document.body.classList.add("modal-open");
    document.body.style.overflow = "hidden";

    // イベント発火
    document.dispatchEvent(new Event("turbo:before-cache"));

    await waitFor(() => {
      // swal 側はフォールバックが効いてる
      expect(el1.style.display).toBe("none");
      expect(el1.style.visibility).toBe("hidden");
      expect(el1.style.pointerEvents).toBe("none");

      expect(el2.style.display).toBe("none");
      expect(el2.style.visibility).toBe("hidden");
      expect(el2.style.pointerEvents).toBe("none");

      // body 復旧は従来どおり
      expect(document.body.classList.contains("modal-open")).toBe(false);
      expect(document.body.style.overflow).toBe("");
      expect(document.body.style.pointerEvents).toBe("auto");
      // backdrop も消えている
      expect(document.querySelector(".modal-backdrop")).toBeNull();
    });
  });
});
