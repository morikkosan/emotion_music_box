/**
 * application.js の未カバー枝を集中的にカバーする追加スイート
 * - このスイートだけで効く PointerEvent / setPointerCapture のローカル・ポリフィルを先頭に定義
 * - bootstrap は ENTRY 読み込み前にクラスモックへ差し替え
 */

// ---- このスイート専用の PointerEvent ポリフィル（他テストには影響しない）----
if (!window.PointerEvent) {
  class PEvent extends MouseEvent {
    constructor(type, opts = {}) {
      // button/buttons は MouseEvent の init 辞書で渡すだけ（後から代入しない）
      super(type, opts);
      Object.defineProperty(this, "pointerId", { value: opts.pointerId ?? 1, configurable: true });
      Object.defineProperty(this, "isPrimary", { value: opts.isPrimary ?? true, configurable: true });
    }
  }
  window.PointerEvent = PEvent;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = function () {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = function () {};
}

const path = require("path");
const ENTRY = path.join(process.cwd(), "app/javascript/application.js");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const flush = async (n = 2) => { for (let i = 0; i < n; i++) await Promise.resolve(); };
const waitFor = async (cond, { timeout = 1500, step = 10 } = {}) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (cond()) return;
    await flush(2);
    await sleep(step);
  }
  throw new Error("waitFor timeout");
};

describe("application.js (entry extra cover)", () => {
  let originalAtob;
  let origRAF;
  let OrigImage;

  beforeEach(() => {
    jest.resetModules();

    document.body.innerHTML = `
      <div id="loading-overlay" class="view-hidden"></div>
      <div id="screen-cover-loading"></div>

      <!-- record modal -->
      <div id="record-modal"></div>

      <!-- ▼ アバター関連一式 -->
      <input type="file" id="avatarInput" />
      <img id="avatarPreviewInline" />
      <div id="avatarCropModal"></div>
      <div id="cropContainer" style="width:120px;height:80px;position:relative;"></div>
      <img id="cropImage" width="120" height="80" />
      <button id="cropConfirmBtn" type="button"></button>
      <form id="f1">
        <input type="text" id="avatarUrlField" />
        <input type="submit" value="送信" />
      </form>
      <button id="removeAvatarBtn" type="button"></button>
      <input type="checkbox" id="removeAvatarCheckbox" />
    `;

    // VAPID/atob
    window.VAPID_PUBLIC_KEY = "AQID";
    originalAtob = global.atob;
    global.atob = (b64) => (b64 === "AQID" || b64 === "AQID==") ? String.fromCharCode(1, 2, 3) : "";

    // SW/Push
    const register = jest.fn().mockResolvedValue({});
    const ready = Promise.resolve({
      pushManager: {
        getSubscription: jest.fn().mockResolvedValue(null),
        subscribe: jest.fn().mockResolvedValue({ endpoint: "https://sub", keys: {} }),
      },
    });
    Object.defineProperty(global, "navigator", {
      configurable: true,
      value: { serviceWorker: { register, ready } },
    });
    if (!("PushManager" in window)) {
      Object.defineProperty(window, "PushManager", { value: function(){}, configurable: true, writable: true });
    }

    // fetch
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => "" });

    // rAF -> 即時
    origRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb) => cb();

    OrigImage = window.Image;

    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    if (typeof window.updateHPBar !== "function") window.updateHPBar = jest.fn();

    delete window.CLOUDINARY_CLOUD_NAME;
    delete window.CLOUDINARY_UPLOAD_PRESET;
  });

  afterEach(() => {
    if (typeof originalAtob === "function") global.atob = originalAtob;
    else { try { delete global.atob; } catch {} }
    if (origRAF) window.requestAnimationFrame = origRAF;
    if (OrigImage) window.Image = OrigImage;
    delete window.CLOUDINARY_CLOUD_NAME;
    delete window.CLOUDINARY_UPLOAD_PRESET;
    delete global.axios;
    jest.restoreAllMocks();
  });

  test("turbo:visit でローディングを表示（show）", async () => {
    await jest.isolateModulesAsync(async () => { require(ENTRY); });
    const loader = document.getElementById("loading-overlay");
    loader.classList.add("view-hidden");
    document.dispatchEvent(new Event("turbo:visit", { bubbles: true }));
    expect(loader.classList.contains("view-hidden")).toBe(false);
  });

  test("modalContentObserver: .modal.show/.modal-content 検知でローダーを隠す", async () => {
    await jest.isolateModulesAsync(async () => { require(ENTRY); });
    document.dispatchEvent(new Event("turbo:load", { bubbles: true }));

    const loader = document.getElementById("loading-overlay");
    loader.classList.remove("view-hidden");

    const modal = document.createElement("div");
    modal.className = "modal show";
    const content = document.createElement("div");
    content.className = "modal-content";
    document.body.appendChild(modal);
    document.body.appendChild(content);

    await waitFor(() => loader.classList.contains("view-hidden"));
    expect(loader.classList.contains("view-hidden")).toBe(true);
  });

  test("アバター：pointer drag で画像 transform が更新される", async () => {
    await jest.isolateModulesAsync(async () => { require(ENTRY); });
    document.dispatchEvent(new Event("turbo:load", { bubbles: true }));

    const container = document.getElementById("cropContainer");
    const img = document.getElementById("cropImage");
    container.setPointerCapture = jest.fn();
    container.releasePointerCapture = jest.fn();

    expect(img.style.transform || "").toBe("");

    container.dispatchEvent(new PointerEvent("pointerdown", { bubbles:true, clientX:100, clientY:50, pointerId:1 }));
    container.dispatchEvent(new PointerEvent("pointermove",  { bubbles:true, clientX:130, clientY:90, pointerId:1 }));

    await flush(1);
    expect(img.style.transform).toContain("translate(30px, 40px)");

    container.dispatchEvent(new PointerEvent("pointerup", { bubbles:true, clientX:130, clientY:90, pointerId:1 }));
    expect(container.releasePointerCapture).toHaveBeenCalled();
  });

  test("アバター：Crop確定（Cloudinary未設定分岐）→ dataURL をプレビューとフィールドに反映", async () => {
    const drawImage = jest.fn();
    const ctx = { drawImage };
    const dataUrl = "data:image/png;base64,AAAA";
    Object.defineProperty(window.HTMLCanvasElement.prototype, "getContext", { value: () => ctx });
    Object.defineProperty(window.HTMLCanvasElement.prototype, "toDataURL", { value: () => dataUrl });

    // ★ ENTRY 読み込み前に bootstrap をクラスモック化
    await jest.isolateModulesAsync(async () => {
      jest.doMock("bootstrap", () => {
        class FakeModal {
          constructor() {}
          hide() {}
          show() {}
          static getInstance() { return null; }
          static getOrCreateInstance() { return new FakeModal(); }
        }
        return { __esModule: true, Modal: FakeModal, default: { Modal: FakeModal } };
      });
      require(ENTRY);
    });

    document.dispatchEvent(new Event("turbo:load", { bubbles: true }));

    const cropImg = document.getElementById("cropImage");
    const preview = document.getElementById("avatarPreviewInline");
    const field = document.getElementById("avatarUrlField");
    const btn = document.getElementById("cropConfirmBtn");

    Object.defineProperty(cropImg, "naturalWidth",  { value: 400 });
    Object.defineProperty(cropImg, "naturalHeight", { value: 200 });
    Object.defineProperty(cropImg, "clientWidth",   { value: 200 });
    Object.defineProperty(cropImg, "clientHeight",  { value: 100 });

    delete window.CLOUDINARY_CLOUD_NAME;
    delete window.CLOUDINARY_UPLOAD_PRESET;

    btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    await waitFor(() => preview.src === dataUrl);
    await waitFor(() => field.value === dataUrl);

    expect(preview.src).toBe(dataUrl);
    expect(field.value).toBe(dataUrl);
    expect(drawImage).toHaveBeenCalled();
  });

  test("アバター：Crop確定（Cloudinary設定あり分岐）→ axios.post で secure_url 反映", async () => {
    const drawImage = jest.fn();
    const ctx = { drawImage };
    Object.defineProperty(window.HTMLCanvasElement.prototype, "getContext", { value: () => ctx });
    Object.defineProperty(window.HTMLCanvasElement.prototype, "toDataURL", { value: () => "data:image/png;base64,BBBB" });
    Object.defineProperty(window.HTMLCanvasElement.prototype, "toBlob", { value: (cb) => cb(new Blob(["x"], { type: "image/jpeg" })) });

    window.CLOUDINARY_CLOUD_NAME = "demo";
    window.CLOUDINARY_UPLOAD_PRESET = "unsigned";
    global.axios = { post: jest.fn().mockResolvedValue({ data: { secure_url: "https://cdn.example.com/ok.jpg" } }) };

    class MockImage {
      set onload(fn) { this._onload = fn; }
      set src(_) { setTimeout(() => this._onload && this._onload(), 0); }
    }
    window.Image = MockImage;

    // ★ ENTRY 読み込み前に bootstrap をクラスモック化
    await jest.isolateModulesAsync(async () => {
      jest.doMock("bootstrap", () => {
        class FakeModal {
          constructor() {}
          hide() {}
          show() {}
          static getInstance() { return null; }
          static getOrCreateInstance() { return new FakeModal(); }
        }
        return { __esModule: true, Modal: FakeModal, default: { Modal: FakeModal } };
      });
      require(ENTRY);
    });

    document.dispatchEvent(new Event("turbo:load", { bubbles: true }));

    const cropImg = document.getElementById("cropImage");
    const preview = document.getElementById("avatarPreviewInline");
    const field = document.getElementById("avatarUrlField");
    const btn = document.getElementById("cropConfirmBtn");

    Object.defineProperty(cropImg, "naturalWidth",  { value: 400 });
    Object.defineProperty(cropImg, "naturalHeight", { value: 200 });
    Object.defineProperty(cropImg, "clientWidth",   { value: 200 });
    Object.defineProperty(cropImg, "clientHeight",  { value: 100 });

    btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    await waitFor(() => (global.axios.post.mock.calls || []).length >= 1);
    await waitFor(() =>
      preview.src === "https://cdn.example.com/ok.jpg" &&
      field.value === "https://cdn.example.com/ok.jpg"
    );

    expect(drawImage).toHaveBeenCalled();
    expect(global.axios.post).toHaveBeenCalled();
  });

  test("turbo:before-stream-render（record-modal-content update）で record-modal を再 show", async () => {
    await jest.isolateModulesAsync(async () => { require(ENTRY); });

    const showSpy = jest.fn();
    window.bootstrap = window.bootstrap || {};
    window.bootstrap.Modal = window.bootstrap.Modal || {};
    window.bootstrap.Modal.getOrCreateInstance = () => ({ show: showSpy, hide() {} });

    const stream = document.createElement("turbo-stream");
    stream.setAttribute("action", "update");
    stream.setAttribute("target", "record-modal-content");

    const origRender = jest.fn();
    const detail = { render: origRender };
    const evt = new CustomEvent("turbo:before-stream-render", { cancelable: true, bubbles: true, detail });
    Object.defineProperty(evt, "target", { value: stream });

    document.dispatchEvent(evt);

    expect(detail.render).not.toBe(origRender);
    detail.render(stream);

    expect(origRender).toHaveBeenCalled();
    expect(showSpy).toHaveBeenCalled();
  });
});
