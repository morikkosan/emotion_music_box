/**
 * push_controller 結合寄りテスト（DOM＋外部APIモック）
 * カバー範囲：
 *  - PushManager 無し → 早期 return
 *  - registerServiceWorker が null resolve → 早期 return
 *  - Notification.requestPermission = "denied" → 早期 return
 *  - 既存 subscription の unsubscribe が throw → warn して継続
 *  - 正常系：subscribe → fetch POST
 *  - 例外系：registerServiceWorker reject → console.error
 *  - _urlBase64ToUint8Array の動作確認
 *
 * 方針：
 *  - SUT（controllers/push_controller）は **各テスト内で動的 import**。
 *  - その前に「実ファイル（app/javascript/custom/register_service_worker.js）」を
 *    `require` して **jest.spyOn** で関数を差し替える。
 *    → 相対IDの解決ズレや mock のホイスト問題を回避。
 *  - 非同期は @testing-library/dom の waitFor で「呼ばれるまで」待つ。
 */

import { waitFor } from "@testing-library/dom";
import { Application } from "@hotwired/stimulus";
import path from "path";

// ---- ここはテストで使うパス（実ファイル）----
const RS_ABS_PATH = path.join(
  process.cwd(),
  "app/javascript/custom/register_service_worker.js"
);

// ---- ユーティリティ ----
const addMeta = (name, content) => {
  const m = document.createElement("meta");
  m.setAttribute("name", name);
  m.setAttribute("content", content);
  document.head.appendChild(m);
  return m;
};

const setupDom = ({
  vapid = "SGVsbG8", // "Hello" の URL-safe Base64（padding 無しOK）
  csrf = "csrf-token-123",
} = {}) => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  addMeta("vapid-public-key", vapid);
  addMeta("csrf-token", csrf);

  const root = document.createElement("div");
  root.setAttribute("data-controller", "push");
  document.body.appendChild(root);
  return root;
};

const makeRegistration = ({
  existingSubscription = null,
  subscribeImpl = async (opts) => ({ endpoint: "https://example/ep", options: opts }),
} = {}) => ({
  pushManager: {
    getSubscription: jest.fn().mockResolvedValue(existingSubscription),
    subscribe: jest.fn(subscribeImpl),
  },
});

// Stimulus 接続（stub Application は connect() を即時呼ぶ）
const connectController = (root, ControllerKlass) => {
  const app = Application.start();
  app.register("push", ControllerKlass);
  const controller = app.getControllerForElementAndIdentifier(root, "push");
  return { app, controller };
};

// グローバルAPIの標準モック
const setupGlobals = () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
  global.Notification = {
    requestPermission: jest.fn().mockResolvedValue("granted"),
  };
  // PushManager フラグ（"PushManager" in window）
  window.PushManager = function () {};
};

describe("push_controller", () => {
  beforeEach(() => {
    jest.resetModules();     // 動的 import 前にキャッシュを消す
    jest.clearAllMocks();
    setupGlobals();
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  test("smoke: このファイルが実行される", () => {
    expect(true).toBe(true);
  });

  test('PushManager が無い場合は何もしない（早期 return）', async () => {
    setupDom();
    // フラグを消す
    // eslint-disable-next-line no-undef
    delete window.PushManager;

    // SUT import 前に registerServiceWorker を監視（呼ばれないことの確認用）
    const rsMod = require(RS_ABS_PATH);
    const rsSpy = jest.spyOn(rsMod, "registerServiceWorker");

    const ControllerClass = (await import("controllers/push_controller")).default;
    const root = document.querySelector("[data-controller='push']");
    connectController(root, ControllerClass);

    // 何も呼ばれないことを確認（軽く1tick）
    await Promise.resolve();

    expect(rsSpy).not.toHaveBeenCalled();
    expect(Notification.requestPermission).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  test("registerServiceWorker が null を返すと早期 return", async () => {
    setupDom();

    // import 前に差し替え
    const rsMod = require(RS_ABS_PATH);
    jest.spyOn(rsMod, "registerServiceWorker").mockResolvedValueOnce(null);

    const ControllerClass = (await import("controllers/push_controller")).default;
    const root = document.querySelector("[data-controller='push']");
    connectController(root, ControllerClass);

    await Promise.resolve();

    expect(Notification.requestPermission).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('Notification.permission = "denied" なら購読しない', async () => {
    setupDom();
    Notification.requestPermission.mockResolvedValueOnce("denied");

    const reg = makeRegistration({});
    const rsMod = require(RS_ABS_PATH);
    jest.spyOn(rsMod, "registerServiceWorker").mockResolvedValueOnce(reg);

    const ControllerClass = (await import("controllers/push_controller")).default;
    const root = document.querySelector("[data-controller='push']");
    connectController(root, ControllerClass);

    await waitFor(() => expect(Notification.requestPermission).toHaveBeenCalled());

    // 以降は走らない
    expect(reg.pushManager.getSubscription).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  test("既存 subscription があり unsubscribe が throw しても warn して継続", async () => {
    setupDom({ vapid: "SGVsbG8" }); // "Hello"
    const existing = {
      unsubscribe: jest.fn().mockRejectedValue(new Error("boom")),
    };

    const reg = makeRegistration({
      existingSubscription: existing,
      subscribeImpl: async (opts) => ({ endpoint: "https://example/new", options: opts }),
    });

    const rsMod = require(RS_ABS_PATH);
    jest.spyOn(rsMod, "registerServiceWorker").mockResolvedValueOnce(reg);

    const ControllerClass = (await import("controllers/push_controller")).default;
    const root = document.querySelector("[data-controller='push']");
    connectController(root, ControllerClass);

    // 1) 権限要求が走る
    await waitFor(() => expect(Notification.requestPermission).toHaveBeenCalled());
    // 2) 既存購読の unsubscribe が試みられる
    await waitFor(() => expect(existing.unsubscribe).toHaveBeenCalledTimes(1));
    // 3) 失敗は warn で握りつぶされる
    expect(console.warn).toHaveBeenCalled();
    // 4) それでも subscribe は続行される
    await waitFor(() => expect(reg.pushManager.subscribe).toHaveBeenCalledTimes(1));
    const args = reg.pushManager.subscribe.mock.calls[0][0];
    expect(args.userVisibleOnly).toBe(true);
    expect(args.applicationServerKey instanceof Uint8Array).toBe(true);
    expect(args.applicationServerKey.length).toBeGreaterThan(0);
    // 5) fetch POST も送られる
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, opt] = fetch.mock.calls[0];
    expect(url).toBe("/push_subscription");
    expect(opt.method).toBe("POST");
    expect(opt.headers["Content-Type"]).toBe("application/json");
    expect(opt.headers["X-CSRF-Token"]).toBe("csrf-token-123");
    const body = JSON.parse(opt.body);
    expect(body.subscription.endpoint).toBe("https://example/new");
  });

  test("正常系：subscribe 〜 fetch POST まで通る", async () => {
    setupDom({ vapid: "QUFBRkY" /* 適当Base64 */ });

    const reg = makeRegistration({});
    const rsMod = require(RS_ABS_PATH);
    jest.spyOn(rsMod, "registerServiceWorker").mockResolvedValueOnce(reg);

    const ControllerClass = (await import("controllers/push_controller")).default;
    const root = document.querySelector("[data-controller='push']");
    connectController(root, ControllerClass);

    await waitFor(() => expect(Notification.requestPermission).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(reg.pushManager.getSubscription).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(reg.pushManager.subscribe).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });

  test("例外系：registerServiceWorker が reject した場合は console.error", async () => {
    setupDom();

    const rsMod = require(RS_ABS_PATH);
    jest.spyOn(rsMod, "registerServiceWorker").mockRejectedValueOnce(new Error("sw failed"));

    const ControllerClass = (await import("controllers/push_controller")).default;
    const root = document.querySelector("[data-controller='push']");
    connectController(root, ControllerClass);

    await waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(fetch).not.toHaveBeenCalled();
  });

  test("_urlBase64ToUint8Array の動作確認（URL-safe, padding 無しにも対応）", async () => {
    const root = setupDom();
    const ControllerClass = (await import("controllers/push_controller")).default;
    const { controller } = connectController(root, ControllerClass);

    // "SGVsbG8" => "Hello"（[72,101,108,108,111]）
    const out = controller._urlBase64ToUint8Array("SGVsbG8");
    expect(out).toBeInstanceOf(Uint8Array);
    expect(Array.from(out).slice(0, 5)).toEqual([72, 101, 108, 108, 111]);
  });
});
