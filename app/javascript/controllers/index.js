import { Application } from "@hotwired/stimulus";
import ModalController from "./modal_controller";
import SearchMusicController from "./search_music_controller";
import SubmitHandlerController from "./submit_handler_controller";
import RecordBtnController from "./record_btn_controller"  // ← 追加
import BookmarkToggleController from "./bookmark_toggle_controller";
import CommentFormController from "./comment_form_controller"
import ReactionController    from "./reaction_controller"   // 追加
import TagInputController from "./tag_input_controller";
import TagAutocompleteController from "./tag_autocomplete_controller";
import ViewSwitcherController from "./view_switcher_controller"; //
import MobileSuperSearchController from "./mobile_super_search_controller"; // ← 追加
import PlaylistModalController from "./playlist_modal_controller"; // ← 追加
import GlobalPlayerController from "./global-player_controller" // ←ここが新しい名前になっていること
const application = Application.start(); // ← 最初に application を定義！

application.register("modal", ModalController);
application.register("search-music", SearchMusicController);
application.register("submit-handler", SubmitHandlerController); // ← これを最後に
application.register("bookmark-toggle", BookmarkToggleController); // ✅ 名前一致
application.register("comment-form", CommentFormController)
application.register("reaction",    ReactionController)
application.register("tag-input", TagInputController);
application.register("tag-autocomplete", TagAutocompleteController);   // ← ✅ 統一
application.register("view-switcher", ViewSwitcherController); // ← 追加
application.register("record-btn", RecordBtnController); // ← 追加
application.register("mobile-super-search", MobileSuperSearchController); // ← 追加
application.register("playlist-modal", PlaylistModalController); // ← 追加
application.register("global-player", GlobalPlayerController)
