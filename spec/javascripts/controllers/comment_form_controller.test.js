/**
 * spec/javascripts/controllers/comment_form_controller.test.js
 *
 * jsdomでは Element.scrollHeight は getter-only（代入不可）なので、
 * Object.defineProperty で getter を差し替えてモックする。
 */

import { Application } from "@hotwired/stimulus";
import CommentFormController from "controllers/comment_form_controller";

// scrollHeight を安全にモックするヘルパ
function mockScrollHeight(el, value) {
  Object.defineProperty(el, "scrollHeight", {
    configurable: true,
    get: () => value,
  });
}

describe("comment_form_controller", () => {
  let app;

  beforeAll(() => {
    app = Application.start();
    app.register("comment-form", CommentFormController);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function setupDOM({ withCommentsTarget = true } = {}) {
    // フォーム要素(data-controller / targets)
    const form = document.createElement("form");
    form.setAttribute("data-controller", "comment-form");

    // submitTarget
    const submitBtn = document.createElement("button");
    submitBtn.type = "submit";
    submitBtn.textContent = "送信";
    submitBtn.setAttribute("data-comment-form-target", "submit");
    form.appendChild(submitBtn);

    // textareaTarget
    const textarea = document.createElement("textarea");
    textarea.setAttribute("data-comment-form-target", "textarea");
    textarea.focus = jest.fn(); // 監視可能に
    form.appendChild(textarea);

    // commentsTarget（任意）
    let commentsList = null;
    if (withCommentsTarget) {
      commentsList = document.createElement("div");
      commentsList.setAttribute("data-comment-form-target", "comments");
      commentsList.style.height = "100px";
      mockScrollHeight(commentsList, 9999); // ← 代入ではなく defineProperty で
      commentsList.scrollTo = jest.fn();
      form.appendChild(commentsList);
    }

    document.body.appendChild(form);

    // Stimulus instance 作成（targetsはスタブが自動配線）
    const controller = app.getControllerForElementAndIdentifier(form, "comment-form");

    // form.reset を監視
    form.reset = jest.fn();

    return { form, submitBtn, textarea, commentsList, controller };
  }

  test("sending(): トースト表示＆送信ボタンdisabled", () => {
    const { controller, submitBtn } = setupDOM();

    controller.sending(new Event("dummy"));

    const toast = document.getElementById("comment-toast");
    expect(toast).toBeTruthy();
    expect(toast.textContent).toBe("送信中…");
    expect(toast.classList.contains("visible")).toBe(true);

    expect(submitBtn.disabled).toBe(true);
  });

  test("sent(success=true): 成功トースト、スクロール、reset、focus、disabled=false", () => {
    const { controller, form, textarea, commentsList, submitBtn } = setupDOM();

    submitBtn.disabled = true; // 送信中想定

    controller.sent({ detail: { success: true } });

    // トースト
    const toast = document.getElementById("comment-toast");
    expect(toast).toBeTruthy();
    expect(toast.textContent).toBe("送信しました ✅");
    expect(toast.classList.contains("visible")).toBe(true);

    // スクロール（commentsTargetがあるパス）
    expect(commentsList.scrollTo).toHaveBeenCalledTimes(1);
    expect(commentsList.scrollTo).toHaveBeenCalledWith({
      top: expect.any(Number), // 値自体は getter モック
      behavior: "smooth",
    });

    // reset & focus
    expect(form.reset).toHaveBeenCalledTimes(1);
    expect(textarea.focus).toHaveBeenCalledTimes(1);

    // 送信ボタン復帰
    expect(submitBtn.disabled).toBe(false);
  });

  test("sent(success=false): 失敗トースト、disabled=false", () => {
    const { controller, submitBtn } = setupDOM();
    submitBtn.disabled = true;

    controller.sent({ detail: { success: false } });

    const toast = document.getElementById("comment-toast");
    expect(toast).toBeTruthy();
    expect(toast.textContent).toBe("送信に失敗しました ❌");
    expect(toast.classList.contains("visible")).toBe(true);

    expect(submitBtn.disabled).toBe(false);
  });

  test("showToast(hideAfter): 一定時間後にvisibleクラスが外れる", () => {
    jest.useFakeTimers();
    const { controller } = setupDOM();

    controller.showToast("一瞬だけ", 1000);
    const toast = document.getElementById("comment-toast");
    expect(toast).toBeTruthy();
    expect(toast.classList.contains("visible")).toBe(true);

    // タイマー進める
    jest.advanceTimersByTime(1000);
    jest.runOnlyPendingTimers();

    expect(toast.classList.contains("visible")).toBe(false);
  });

  test("scrollToBottom(): commentsTargetが無い時は #comments を使う", () => {
    const { controller, form } = setupDOM({ withCommentsTarget: false });

    expect(controller.hasCommentsTarget).toBeFalsy();

    // フォールバック要素 #comments
    const fb = document.createElement("div");
    fb.id = "comments";
    mockScrollHeight(fb, 7777);
    fb.scrollTo = jest.fn();
    document.body.appendChild(fb);

    controller.scrollToBottom();

    expect(fb.scrollTo).toHaveBeenCalledTimes(1);
    expect(fb.scrollTo).toHaveBeenCalledWith({
      top: expect.any(Number),
      behavior: "smooth",
    });

    form.remove();
  });
});
