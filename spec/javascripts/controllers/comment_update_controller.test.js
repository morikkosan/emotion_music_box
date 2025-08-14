import { Application } from "@hotwired/stimulus";
import CommentUpdateController from "controllers/comment_update_controller";

describe("comment_update_controller", () => {
  let app;

  beforeAll(() => {
    app = Application.start();
    app.register("comment-update", CommentUpdateController);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    jest.useRealTimers();
  });

  test("connect() → 2秒後に element.innerHTML が空になる", () => {
    jest.useFakeTimers();

    const el = document.createElement("div");
    el.setAttribute("data-controller", "comment-update");
    el.innerHTML = "コメントが更新されました";

    document.body.appendChild(el);

    // Stimulusコントローラ起動
    app.getControllerForElementAndIdentifier(el, "comment-update");

    // すぐには消ない
    expect(el.innerHTML).toBe("コメントが更新されました");

    // 2秒進める
    jest.advanceTimersByTime(2000);

    // タイマーのコールバック実行
    expect(el.innerHTML).toBe("");
  });
});
