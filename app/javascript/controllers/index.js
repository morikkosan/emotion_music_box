// app/javascript/controllers/index.js
import { Application } from "@hotwired/stimulus";

import ModalController from "./modal_controller";
import SearchMusicController from "./search_music_controller";
import SubmitHandlerController from "./submit_handler_controller";
import RecordBtnController from "./record_btn_controller";
import BookmarkToggleController from "./bookmark_toggle_controller";
import CommentFormController from "./comment_form_controller";
import ReactionController from "./reaction_controller";
import TagInputController from "./tag_input_controller";
import TagAutocompleteController from "./tag_autocomplete_controller";
import ViewSwitcherController from "./view_switcher_controller";
import MobileSuperSearchController from "./mobile_super_search_controller";
import PlaylistModalController from "./playlist_modal_controller";
import GlobalPlayerController from "./global-player_controller";
import BookmarkController from "./bookmark_controller";
import AddSongController from "./add_song_modal_controller";
import PushController from "./push_controller";
import RedirectController from "./redirect_controller";
import CommentUpdateController from "./comment_update_controller";
import MobileFooterController from "./mobile_footer_controller";
import FlashThenRedirectController from "./flash_then_redirect_controller";
import TapGuardController from "./tap_guard_controller"; // 追加
import SelectionCounterController from "./selection_counter_controller"; // 追加
import NotifBadgeController from "./notif_badge_controller"; // 追加
import NotifPageController from "./notif_page_controller"; // 追加

const application = Application.start();

// ★ ここから register（重複なし！）
application.register("modal", ModalController);
application.register("search-music", SearchMusicController);
application.register("submit-handler", SubmitHandlerController);
application.register("bookmark-toggle", BookmarkToggleController);
application.register("comment-form", CommentFormController);
application.register("reaction", ReactionController);
application.register("tag-input", TagInputController);
application.register("tag-autocomplete", TagAutocompleteController);
application.register("view-switcher", ViewSwitcherController);
application.register("record-btn", RecordBtnController);
application.register("mobile-super-search", MobileSuperSearchController);
application.register("playlist-modal", PlaylistModalController);
application.register("global-player", GlobalPlayerController); // ★ 重複行は削除
application.register("bookmark", BookmarkController);
application.register("add-song-modal", AddSongController);
application.register("push", PushController);
application.register("redirect", RedirectController);
application.register("comment-update", CommentUpdateController);
application.register("mobile-footer", MobileFooterController);
application.register("flash-then-redirect", FlashThenRedirectController);
application.register("tap-guard", TapGuardController);
application.register("selection-counter", SelectionCounterController);
application.register("notif-badge", NotifBadgeController);
application.register("notif-page", NotifPageController);