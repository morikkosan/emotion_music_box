/**
 * submit_handler_controller テスト（網羅版 + 追加分岐）
 * - actions未配線スタブのため submit は controller.submit(fakeEvent) を直接呼ぶ
 * - connect の 100ms setTimeout は fake timers を先に有効化してから connect()
 * - date の change を実際に dispatch し、value の setter 呼び出しで行17をカバー
 * - 分岐網羅: hasSubmitTarget=false / dateInputなし / loader無し / updateHPBar無し /
 *             res.json() 例外 / hpInput空文字 + hpDelta / hpPercentage / 他
 */

import { Application } from "@hotwired/stimulus";

jest.mock("bootstrap", () => ({
  Toast: { getOrCreateInstance: jest.fn(() => ({ show: jest.fn() })) },
  Modal: { getOrCreateInstance: jest.fn(() => ({ show: jest.fn(), hide: jest.fn() })) },
}));
import * as bootstrap from "bootstrap";
import ControllerClass from "controllers/submit_handler_controller";

// マイクロタスク排出
const drainMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe("submit_handler_controller", () => {
  let app, formEl, controller;
  let submitBtn, dateInput, loaderEl, hpInput;
  let originalLocation;

  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = "";
    localStorage.clear();

    if (!window.Swal) {
      window.Swal = { fire: jest.fn().mockResolvedValue({ isConfirmed: true }) };
    } else {
      window.Swal.fire = jest.fn().mockResolvedValue({ isConfirmed: true });
    }
    window.updateHPBar = jest.fn();

    originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true, writable: true, value: { href: "https://test.local/initial" },
    });

    // --- form & targets ---
    formEl = document.createElement("form");
    formEl.setAttribute("data-controller", "submit-handler");
    formEl.action = "/logs";

    submitBtn = document.createElement("button");
    submitBtn.type = "submit";
    submitBtn.disabled = true; // connectでfalseへ
    submitBtn.setAttribute("data-submit-handler-target", "submit");
    formEl.appendChild(submitBtn);

    dateInput = document.createElement("input");
    dateInput.type = "date";
    formEl.appendChild(dateInput);

    hpInput = document.createElement("input");
    hpInput.type = "number";
    hpInput.name = "emotion_log[hp]";
    hpInput.value = "55";
    formEl.appendChild(hpInput);

    loaderEl = document.createElement("div");
    loaderEl.id = "loading-overlay";
    loaderEl.className = "view-hidden";
    document.body.appendChild(loaderEl);

    document.body.appendChild(formEl);

    // Stimulus 起動
    app = Application.start();
    app.register("submit-handler", ControllerClass);
    controller = app.getControllerForElementAndIdentifier(formEl, "submit-handler");

    global.fetch = jest.fn();
  });

  afterEach(() => {
    app && app.stop();
    Object.defineProperty(window, "location", {
      configurable: true, writable: true, value: originalLocation,
    });
    jest.useRealTimers();
  });

  // helper: controller.submit直叩き
  const submitNow = () => controller.submit({ preventDefault: () => {} });

  // ---- connect ----
  test("connect: submit enable / date に 100ms 後 change 追加（＋実発火で setter 呼び出し）", () => {
    expect(submitBtn.disabled).toBe(false);

    jest.useFakeTimers();
    const addSpy = jest.spyOn(dateInput, "addEventListener");

    controller.connect(); // 100ms の setTimeout を再設定
    jest.advanceTimersByTime(99);
    expect(addSpy).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(addSpy).toHaveBeenCalledWith("change", expect.any(Function));

    const setSpy = jest.spyOn(HTMLInputElement.prototype, "value", "set");
    dateInput.value = "2025-08-14";
    setSpy.mockClear();
    dateInput.dispatchEvent(new Event("change", { bubbles: true }));
    expect(setSpy).toHaveBeenCalledTimes(1);
  });

  // ---- getHPFromForm ----
  test("getHPFromForm: 各セレクタで取得・数値化・clamp / 不正は null", () => {
    expect(controller.getHPFromForm(formEl)).toBe(55);

    hpInput.remove();
    const hpByName = document.createElement("input");
    hpByName.name = "hp";
    hpByName.value = "120";
    formEl.appendChild(hpByName);
    expect(controller.getHPFromForm(formEl)).toBe(100);

    hpByName.remove();
    const hpById = document.createElement("input");
    hpById.id = "hp-input";
    hpById.value = "-10";
    formEl.appendChild(hpById);
    expect(controller.getHPFromForm(formEl)).toBe(0);

    hpById.remove();
    const hpByCls = document.createElement("input");
    hpByCls.className = "js-hp-input";
    hpByCls.value = "42.7";
    formEl.appendChild(hpByCls);
    expect(controller.getHPFromForm(formEl)).toBe(42.7);

    hpByCls.value = "NaN";
    expect(controller.getHPFromForm(formEl)).toBe(null);

    hpByCls.remove();
    expect(controller.getHPFromForm(formEl)).toBe(null);
  });

  // ---- saveHPBeforeFetch ----
  test("saveHPBeforeFetch: 保存 & updateHPBar / 未検出は log", () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    hpInput.value = "88";
    controller.saveHPBeforeFetch(formEl);
    expect(localStorage.getItem("hpPercentage")).toBe("88");
    expect(window.updateHPBar).toHaveBeenCalled();

    hpInput.remove();
    controller.saveHPBeforeFetch(formEl);
    expect(logSpy).toHaveBeenCalled();
  });

  test("saveHPBeforeFetch: updateHPBar 未定義でも例外なく進む(false側)", () => {
    window.updateHPBar = undefined;      // ← false側に倒す
    const input = formEl.querySelector('[name="emotion_log[hp]"]');
    input.value = "77";
    expect(() => controller.saveHPBeforeFetch(formEl)).not.toThrow();
    expect(localStorage.getItem("hpPercentage")).toBe("77");
  });

  test("hpDelta → hpPercentage を同テスト内で連続で踏む（取りこぼし防止）", async () => {
    // hpDelta（フォームHP空 → 直前保存は 0 扱い）
    const input = formEl.querySelector('[name="emotion_log[hp]"]');
    input.value = "";
    global.fetch.mockResolvedValueOnce({
      ok: true, json: async () => ({
        success: true, message: "OK", hp_today: false, redirect_url: "/tmp1", hpDelta: 7
      }),
    });
    window.Swal.fire = jest.fn().mockResolvedValue({});
    controller.submit({ preventDefault: () => {} });
    await drainMicrotasks();
    expect(localStorage.getItem("hpPercentage")).toBe("57");

    // hpPercentage（遅延リダイレクト分）
    global.fetch.mockResolvedValueOnce({
      ok: true, json: async () => ({
        success: true, message: "OK", hp_today: true, redirect_url: "/tmp2", hpPercentage: 64
      }),
    });
    jest.useFakeTimers();
    controller.submit({ preventDefault: () => {} });
    await drainMicrotasks();
    jest.runOnlyPendingTimers();
    await drainMicrotasks();
    expect(localStorage.getItem("hpPercentage")).toBe("64");
  });

  // ---- submit: 成功（hp_today=true）----
  test("submit 成功（hp_today=true）: 前保存→Swal→playlist-toast→再保存→1500ms後 redirect", async () => {
    formEl.id = "playlist-form";
    const toast = document.createElement("div");
    toast.id = "save-toast";
    const toastBody = document.createElement("div");
    toastBody.className = "toast-body";
    toast.appendChild(toastBody);
    document.body.appendChild(toast);

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true, message: "OK!", hp_today: true, redirect_url: "/done",
        hpDelta: 999, hpPercentage: 1,
      }),
    });

    jest.useFakeTimers();
    submitNow();

    expect(loaderEl.classList.contains("view-hidden")).toBe(false);
    expect(submitBtn.disabled).toBe(true);
    expect(localStorage.getItem("hpPercentage")).toBe("55");

    await drainMicrotasks();

    expect(window.Swal.fire).toHaveBeenCalled();
    expect(bootstrap.Toast.getOrCreateInstance).toHaveBeenCalled();
    const toastInst = bootstrap.Toast.getOrCreateInstance.mock.results[0].value;
    expect(toastBody.textContent).toContain("プレイリストを作成しました！");
    expect(toastInst.show).toHaveBeenCalled();

    expect(localStorage.getItem("hpPercentage")).toBe("55");

    jest.runOnlyPendingTimers();
    await drainMicrotasks();
    expect(window.location.href).toBe("/done");

    await drainMicrotasks();
    expect(loaderEl.classList.contains("view-hidden")).toBe(true);
    expect(window.updateHPBar).toHaveBeenCalled();
  });

  // ---- submit: 成功（フォームHPなし → hpDelta）----
  test("submit 成功（フォームHPなし）: hpDelta を適用（50 + 10 = 60）", async () => {
    hpInput.value = ""; // 前保存 0（falsy）
    localStorage.setItem("hpPercentage", "30"); // 直前保存で 0 に上書き

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true, message: "OK!", hp_today: false, redirect_url: "/next", hpDelta: 10,
      }),
    });

    window.Swal.fire = jest.fn().mockResolvedValue({});
    submitNow();
    await drainMicrotasks();

    expect(localStorage.getItem("hpPercentage")).toBe("60");
    expect(window.updateHPBar).toHaveBeenCalled();
    expect(window.Swal.fire).toHaveBeenCalled();
    expect(window.location.href).toBe("/next");
  });

  // ---- submit: 失敗 data.success=false ----
  test("submit 失敗: エラーSwal & enable戻す", async () => {
    global.fetch.mockResolvedValue({
      ok: true, json: async () => ({ success: false, errors: ["a", "b"] }),
    });

    submitNow();
    await drainMicrotasks();

    expect(window.Swal.fire).toHaveBeenCalled();
    expect(submitBtn.disabled).toBe(false);
  });

  // ---- submit: 通信エラー ----
  test("submit 通信エラー: エラーSwal & enable戻す", async () => {
    global.fetch.mockRejectedValue(new Error("network down"));

    submitNow();
    await drainMicrotasks();

    expect(window.Swal.fire).toHaveBeenCalled();
    expect(submitBtn.disabled).toBe(false);
  });

  // ---- finally 共通 ----
  test("submit finally: loader 非表示 & updateHPBar", async () => {
    global.fetch.mockResolvedValue({
      ok: true, json: async () => ({ success: true, message: "OK!", hp_today: true, redirect_url: "/r" }),
    });

    submitNow();
    await drainMicrotasks();
    await drainMicrotasks();

    expect(loaderEl.classList.contains("view-hidden")).toBe(true);
    expect(window.updateHPBar).toHaveBeenCalled();
  });

  // ---- フォームHPなし & hpPercentage fallback ----
  test("submit 成功（フォームHPなし）: hpPercentage fallback（hp_today=true → タイマー必要）", async () => {
    hpInput.value = "";
    global.fetch.mockResolvedValue({
      ok: true, json: async () => ({
        success: true, message: "OK!", hp_today: true, redirect_url: "/percent", hpPercentage: 64,
      }),
    });

    jest.useFakeTimers();
    submitNow();

    await drainMicrotasks();
    expect(localStorage.getItem("hpPercentage")).toBe("64");

    jest.runOnlyPendingTimers();
    await drainMicrotasks();
    expect(window.location.href).toBe("/percent");
  });

  // ---- 追加: dateInput なしでもOK ----
  test("connect: dateInput なしでも例外なし", () => {
    jest.useFakeTimers();
    const form2 = document.createElement("form");
    form2.setAttribute("data-controller", "submit-handler");
    document.body.appendChild(form2);

    const app2 = Application.start();
    app2.register("submit-handler", ControllerClass);
    app2.getControllerForElementAndIdentifier(form2, "submit-handler");

    expect(() => jest.advanceTimersByTime(100)).not.toThrow();
    app2.stop();
  });

  // ---- 追加: hasSubmitTarget=false / loader 無し / updateHPBar 無し ----
  test("submit: ターゲット・loader・updateHPBar 無くても finally で例外なし（hp_today=false）", async () => {
    const form2 = document.createElement("form");
    form2.setAttribute("data-controller", "submit-handler");
    form2.action = "/logs2";
    document.body.appendChild(form2);

    document.getElementById("loading-overlay").remove();
    window.updateHPBar = undefined;

    const ctrl2 = app.getControllerForElementAndIdentifier(form2, "submit-handler");

    global.fetch = jest.fn().mockResolvedValue({
      ok: true, json: async () => ({ success: true, message: "OK", hp_today: false, redirect_url: "/after" }),
    });

    window.Swal.fire = jest.fn().mockResolvedValue({});
    ctrl2.submit({ preventDefault: () => {} });
    await drainMicrotasks();

    expect(window.location.href).toBe("/after");
  });

  // ---- 追加: res.ok=true だが json 例外 ----
  test("submit: res.ok=true でも json 例外 → エラー扱い", async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => { throw new Error("bad json"); } });

    submitNow();
    await drainMicrotasks();

    expect(window.Swal.fire).toHaveBeenCalled();
    expect(submitBtn.disabled).toBe(false);
  });

  // ---- 追加: hpInput 空文字 → hpDelta=5（hp_today=false） ----
  test("submit: hpInput 空 → hpDelta=5 適用（50+5=55）", async () => {
    hpInput.value = "";
    localStorage.removeItem("hpPercentage");

    global.fetch.mockResolvedValue({
      ok: true, json: async () => ({ success: true, message: "OK!", hp_today: false, redirect_url: "/delta", hpDelta: 5 }),
    });

    window.Swal.fire = jest.fn().mockResolvedValue({});
    submitNow();
    await drainMicrotasks();

    expect(localStorage.getItem("hpPercentage")).toBe("55");
    expect(window.location.href).toBe("/delta");
  });

  // === 追加1: playlist-form だが #save-toast 無し（Toast未呼び） ===
  test("submit 成功: playlist-form だが #save-toast 無しでも落ちない（Toast未呼び）", async () => {
    formEl.id = "playlist-form";
    // #save-toast を作らない

    global.fetch.mockResolvedValue({
      ok: true, json: async () => ({ success: true, message: "OK!", hp_today: true, redirect_url: "/ok1" }),
    });

    jest.useFakeTimers();
    submitNow();
    await drainMicrotasks();

    expect(bootstrap.Toast.getOrCreateInstance).not.toHaveBeenCalled();

    jest.runOnlyPendingTimers();
    await drainMicrotasks();
    expect(window.location.href).toBe("/ok1");
  });

  // === 追加2: hpInput はあるが不正値（NaN）→ 強制保存スキップ ===
  test("submit 成功: hpInput 不正値（NaN）→ 強制保存スキップでも正常完了", async () => {
    hpInput.value = "abc"; // Number(...) が NaN → getHPFromForm() は null

    global.fetch.mockResolvedValue({
      ok: true, json: async () => ({ success: true, message: "OK!", hp_today: true, redirect_url: "/ok2" }),
    });

    jest.useFakeTimers();
    submitNow();
    await drainMicrotasks();

    jest.runOnlyPendingTimers();
    await drainMicrotasks();
    expect(window.location.href).toBe("/ok2");
  });

  // === 追加3: フォームHP無し & hpDelta/hpPercentage 未定義 → 何も更新しない ===
  test("submit 成功: フォームHP無し & hpDelta/hpPercentage 無し → 何も更新しない", async () => {
    hpInput.remove();
    localStorage.setItem("hpPercentage", "40"); // 既存値

    global.fetch.mockResolvedValue({
      ok: true, json: async () => ({ success: true, message: "OK!", hp_today: false, redirect_url: "/noop" }),
    });

    window.Swal.fire = jest.fn().mockResolvedValue({});
    submitNow();
    await drainMicrotasks();

    expect(localStorage.getItem("hpPercentage")).toBe("40");
    expect(window.location.href).toBe("/noop");
  });

  // === 追加4: redirect_url 無し + hp_today=false → 位置は変わらない ===
  test("submit 成功: redirect_url 無し + hp_today=false → location 不変", async () => {
    const initial = window.location.href;

    global.fetch.mockResolvedValue({
      ok: true, json: async () => ({ success: true, message: "OK!", hp_today: false /* redirect_url 無し */ }),
    });

    window.Swal.fire = jest.fn().mockResolvedValue({});
    submitNow();
    await drainMicrotasks();

    expect(window.Swal.fire).toHaveBeenCalled();
    expect(window.location.href).toBe(initial);
  });
});
