import { Application } from "@hotwired/stimulus";
import ModalController from "./modal_controller";
import SearchMusicController from "./search_music_controller";
import SubmitHandlerController from "./submit_handler_controller";
import RecordBtnController from "./record_btn_controller"  // ← 追加
import BookmarkToggleController from "./bookmark_toggle_controller";
import CommentFormController from "./comment_form_controller"
import ReactionController    from "./reaction_controller"   // 追加

const application = Application.start(); // ← 最初に application を定義！

application.register("modal", ModalController);
application.register("search-music", SearchMusicController);
application.register("submit-handler", SubmitHandlerController); // ← これを最後に
application.register("bookmark-toggle", BookmarkToggleController); // ✅ 名前一致
application.register("comment-form", CommentFormController)
application.register("reaction",    ReactionController)
