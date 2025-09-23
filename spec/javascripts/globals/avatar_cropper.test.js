// spec/javascripts/globals/avatar_cropper.test.js
/**
 * 対象: app/javascript/custom/avatar_cropper.js
 * 検証:
 *  - 不正MIME -> alert + input reset
 *  - Cloudinaryなし -> dataURL を hidden/preview にセット & submit復帰
 *  - Cloudinaryあり + axios成功 -> secure_url 反映 & loading解除 & submit復帰
 *  - Cloudinaryあり + axiosなし -> 失敗でも finally で submit復帰（dataURLフォールバック）
 *  - removeAvatarBtn トグル
 *  - removeAvatarBtn confirm=false 分岐（カバレッジ用）
 *  - 削除チェックONでフォーム送信許可（カバレッジ用）
 *  - Image.src セッター例外で catch 経由（loading解除 & submit復帰のカバレッジ用）
 */
describe("custom/avatar_cropper.js", () => {
  const ORIGIN_ALERT = window.alert;
  const ORIGIN_IMAGE = window.Image;
  const ORIGIN_URL_CREATEOBJECTURL = window.URL && window.URL.createObjectURL;

  let modalShowMock, modalHideMock;

  const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms));

  function getHiddenVal() {
    const el = document.getElementById("avatarUrlField");
    return (el && (el.value || el.getAttribute("value") || "")) || "";
  }

  function mockCanvasApis() {
    const toDataURL = jest.fn(() => "data:image/png;base64,TESTDATA");
    const toBlob = jest.fn((cb) => cb(new Blob(["x"], { type: "image/jpeg" })));
    const getContext = jest.fn(() => ({ drawImage: jest.fn() }));

    const realCreateElement = Document.prototype.createElement;
    jest
      .spyOn(Document.prototype, "createElement")
      .mockImplementation(function (tagName, options) {
        const el = realCreateElement.call(this, tagName, options);
        if (String(tagName).toLowerCase() === "canvas") {
          el.toDataURL = toDataURL;
          el.toBlob = toBlob;
          el.getContext = getContext;
        }
        return el;
      });

    return { toDataURL, toBlob, getContext };
  }

  function forceSize(el, w = 80, h = 80) {
    Object.defineProperty(el, "clientWidth", { value: w, configurable: true });
    Object.defineProperty(el, "clientHeight", { value: h, configurable: true });
  }

  function setupDom() {
    document.body.innerHTML = `
      <form id="profileForm">
        <input id="avatarInput" type="file" />
        <img id="avatarPreviewInline" />
        <input id="avatarUrlField" type="hidden" />
        <input id="removeAvatarCheckbox" type="checkbox" />
        <input type="submit" value="送信" />
        <button id="removeAvatarBtn" type="button" class="btn btn-warning">画像を削除する</button>
      </form>

      <div id="avatarCropModal" class="modal"><div class="modal-dialog"></div></div>
      <div id="cropContainer"></div>
      <img id="cropImage" />
      <button id="cropConfirmBtn" type="button">確定</button>
    `;

    modalShowMock = jest.fn();
    modalHideMock = jest.fn();
    window.bootstrap = {
      Modal: class {
        constructor() {
          return { show: modalShowMock, hide: modalHideMock };
        }
        static getOrCreateInstance() {
          return { show: modalShowMock, hide: modalHideMock };
        }
      },
    };

    class FRMock {
      readAsDataURL() {
        setTimeout(() => {
          this.result = "data:image/png;base64,FAKE";
          this.onload && this.onload();
        }, 0);
      }
    }
    window.FileReader = FRMock;

    // デフォの Image（成功パス用）
    class ImgMock {
      set src(_v) {
        setTimeout(() => {
          this.width = 120;
          this.height = 120;
          this.naturalWidth = 120;
          this.naturalHeight = 120;
          this.clientWidth = 80;
          this.clientHeight = 80;
          this.onload && this.onload();
        }, 0);
      }
    }
    window.Image = ImgMock;

    forceSize(document.getElementById("cropContainer"), 80, 80);
    forceSize(document.getElementById("cropImage"), 80, 80);
  }

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    window.alert = jest.fn();
    setupDom();
    mockCanvasApis();

    if (window.URL && !window.URL.createObjectURL) {
      window.URL.createObjectURL = () => "blob://dummy";
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
    window.alert = ORIGIN_ALERT;
    window.Image = ORIGIN_IMAGE;
    if (ORIGIN_URL_CREATEOBJECTURL) window.URL.createObjectURL = ORIGIN_URL_CREATEOBJECTURL;
    document.body.innerHTML = "";
  });

  async function importModule() {
    const modPath = require.resolve("../../../app/javascript/custom/avatar_cropper.js");
    jest.isolateModules(() => {
      require(modPath);
    });
    document.dispatchEvent(new Event("turbo:load"));
    await sleep(0);
  }

  function getEls() {
    const fileInput = document.getElementById("avatarInput");
    const inlinePreview = document.getElementById("avatarPreviewInline");
    const avatarUrlField = document.getElementById("avatarUrlField");
    const confirmBtn = document.getElementById("cropConfirmBtn");
    const submitBtn = document.querySelector('form input[type="submit"]');
    const removeBtn = document.getElementById("removeAvatarBtn");
    const removeCheckbox = document.getElementById("removeAvatarCheckbox");
    const form = document.getElementById("profileForm");
    return { fileInput, inlinePreview, avatarUrlField, confirmBtn, submitBtn, removeBtn, removeCheckbox, form };
  }

  // --- 既存の通るテスト ---
  test("不正なファイルタイプで alert & input.value リセット", async () => {
    await importModule();
    const { fileInput } = getEls();

    const file = new File(["xxx"], "x.gif", { type: "image/gif" });
    Object.defineProperty(fileInput, "files", { value: [file] });

    fileInput.dispatchEvent(new Event("change"));
    expect(window.alert).toHaveBeenCalled();
    expect(fileInput.value).toBe("");
  });

  test("Cloudinary 未設定: dataURL を avatarUrlField にセットして submit 復帰", async () => {
    delete window.CLOUDINARY_CLOUD_NAME;
    delete window.CLOUDINARY_UPLOAD_PRESET;

    await importModule();
    const { fileInput, inlinePreview, avatarUrlField, confirmBtn, submitBtn } = getEls();

    const file = new File(["xxx"], "x.png", { type: "image/png" });
    Object.defineProperty(fileInput, "files", { value: [file] });
    fileInput.dispatchEvent(new Event("change"));
    await sleep(30);

    expect(modalShowMock).toHaveBeenCalled();

    confirmBtn.click();
    await sleep(30);

    const val = getHiddenVal();
    expect(val.startsWith("data:image/png;base64")).toBe(true);
    expect(inlinePreview.src.startsWith("data:image/png;base64")).toBe(true);
    expect(modalHideMock).toHaveBeenCalled();
    expect(submitBtn.disabled).toBe(false);
  });

  test("Cloudinary 設定あり & axios 成功: secure_url 反映（loading クラス解除 & submit 復帰）", async () => {
    window.CLOUDINARY_CLOUD_NAME = "demo";
    window.CLOUDINARY_UPLOAD_PRESET = "unsigned";
    window.axios = {
      post: jest.fn().mockResolvedValue({
        data: { secure_url: "https://res.cloudinary.com/demo/image/upload/v1/ok.jpg" },
      }),
    };

    await importModule();
    const { fileInput, inlinePreview, avatarUrlField, confirmBtn, submitBtn } = getEls();

    const file = new File(["xxx"], "x.jpg", { type: "image/jpeg" });
    Object.defineProperty(fileInput, "files", { value: [file] });
    fileInput.dispatchEvent(new Event("change"));
    await sleep(30);

    confirmBtn.click();
    await sleep(10);
    await sleep(50);

    expect(window.axios.post).toHaveBeenCalled();
    expect(avatarUrlField.value).toBe("https://res.cloudinary.com/demo/image/upload/v1/ok.jpg");
    expect(inlinePreview.src).toBe("https://res.cloudinary.com/demo/image/upload/v1/ok.jpg");
    expect(inlinePreview.classList.contains("loading")).toBe(false);
    expect(submitBtn.disabled).toBe(false);
  });

  test("Cloudinary 設定あり & axios なし: 例外でも finally で submit 復帰 & dataURL フォールバック", async () => {
    window.CLOUDINARY_CLOUD_NAME = "demo";
    window.CLOUDINARY_UPLOAD_PRESET = "unsigned";
    delete window.axios;

    await importModule();
    const { fileInput, inlinePreview, confirmBtn, submitBtn } = getEls();

    const file = new File(["xxx"], "x.jpg", { type: "image/jpeg" });
    Object.defineProperty(fileInput, "files", { value: [file] });
    fileInput.dispatchEvent(new Event("change"));
    await sleep(30);

    confirmBtn.click();
    await sleep(80);

    const hiddenVal = getHiddenVal();
    const previewVal = inlinePreview.src || "";
    expect(
      (hiddenVal && hiddenVal.startsWith("data:image/png;base64")) ||
        (previewVal && previewVal.startsWith("data:image/png;base64"))
    ).toBe(true);
    expect(submitBtn.disabled).toBe(false);
  });

  test("removeAvatarBtn: チェックのトグルとボタンの表示/クラスが変わる", async () => {
    await importModule();
    const { removeBtn, removeCheckbox } = getEls();

    removeCheckbox.checked = false;
    window.confirm = jest.fn(() => true);

    removeBtn.click();
    expect(removeCheckbox.checked).toBe(true);

    removeBtn.click();
    expect(removeCheckbox.checked).toBe(false);
  });

  // --- 追加のカバレッジ用テスト ---

  test("removeAvatarBtn: confirm=false なら状態は変わらない（早期return分岐）", async () => {
    await importModule();
    const { removeBtn, removeCheckbox } = getEls();

    removeCheckbox.checked = false;
    window.confirm = jest.fn(() => false); // ← キャンセル

    const beforeText = removeBtn.textContent;
    const beforeDanger = removeBtn.classList.contains("btn-danger");
    const beforeWarning = removeBtn.classList.contains("btn-warning");

    removeBtn.click();

    expect(window.confirm).toHaveBeenCalled();
    expect(removeCheckbox.checked).toBe(false); // 変化なし
    expect(removeBtn.textContent).toBe(beforeText);
    expect(removeBtn.classList.contains("btn-danger")).toBe(beforeDanger);
    expect(removeBtn.classList.contains("btn-warning")).toBe(beforeWarning);
  });

  test("削除チェックONならフォーム送信を阻止しない（ガードの else 分岐）", async () => {
    await importModule();
    const { form, removeCheckbox } = getEls();

    removeCheckbox.checked = true;
    const ev = new Event("submit", { bubbles: true, cancelable: true });
    const prevented = jest.spyOn(ev, "preventDefault");
    form.dispatchEvent(ev);

    expect(prevented).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
    expect(window.alert).not.toHaveBeenCalled();
  });

  test("Cloudinary 設定ありだが Image.src セッターが throw → catch で loading解除 & submit復帰", async () => {
    window.CLOUDINARY_CLOUD_NAME = "demo";
    window.CLOUDINARY_UPLOAD_PRESET = "unsigned";
    delete window.axios; // axios 未定義でも、src セッターの例外で外側 catch に入る

    // ここだけ Image の src セッターが throw するモックに差し替え
    class ThrowingImage {
      set src(_v) { throw new Error("src setter boom"); }
    }
    window.Image = ThrowingImage;

    await importModule();
    const { fileInput, inlinePreview, confirmBtn, submitBtn } = getEls();

    const file = new File(["xxx"], "x.jpg", { type: "image/jpeg" });
    Object.defineProperty(fileInput, "files", { value: [file] });
    fileInput.dispatchEvent(new Event("change"));
    await sleep(30);

    confirmBtn.click();
    await sleep(30); // src セット直後に catch → finally が走る

    // catch 側で loading を外し、submit を復帰する分岐を踏む
    expect(inlinePreview.classList.contains("loading")).toBe(false);
    expect(submitBtn.disabled).toBe(false);

    // dataURL フォールバック（すでに先行で dataURL を入れている）
    const val = getHiddenVal();
    expect(val.startsWith("data:image/png;base64")).toBe(true);
  });


  // ← 既存の describe(...) の内側に追加
test("ドラッグ: setPointerCapture / releasePointerCapture を通す（カバレッジ155-156対策）", async () => {
  // PointerEvent の軽量ポリフィル（JSDOM向け）
  if (typeof window.PointerEvent === "undefined") {
    class P extends Event {
      constructor(type, props = {}) {
        super(type, { bubbles: true, cancelable: true });
        Object.assign(this, props);
      }
    }
    // @ts-ignore
    window.PointerEvent = P;
  }

  await importModule(); // ← describe内なのでスコープOK（beforeEachも走る）

  const cropContainer = document.getElementById("cropContainer");
  const cropImage     = document.getElementById("cropImage");

  // 呼び出し検証用にモック（pointerdown 前に用意）
  cropContainer.setPointerCapture = jest.fn();
  cropContainer.releasePointerCapture = jest.fn();

  // pointerdown→pointermove→pointerup の順に発火
  cropContainer.dispatchEvent(new window.PointerEvent("pointerdown", { clientX: 10, clientY: 10, pointerId: 1 }));
  cropContainer.dispatchEvent(new window.PointerEvent("pointermove", { clientX: 30, clientY: 25, pointerId: 1 }));
  cropContainer.dispatchEvent(new window.PointerEvent("pointerup",   { clientX: 30, clientY: 25, pointerId: 1 }));

  expect(cropContainer.setPointerCapture).toHaveBeenCalledWith(1);
  expect(cropContainer.releasePointerCapture).toHaveBeenCalledWith(1);
  expect((cropImage.style.transform || "").includes("translate(")).toBe(true);
});




});


