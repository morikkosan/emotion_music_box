import { Application } from "@hotwired/stimulus";
import ModalController from "./modal_controller";
import SearchMusicController from "./search_music_controller";
import SubmitHandlerController from "./submit_handler_controller";

const application = Application.start(); // ← 最初に application を定義！

application.register("modal", ModalController);
application.register("search-music", SearchMusicController);
application.register("submit-handler", SubmitHandlerController); // ← これを最後に
