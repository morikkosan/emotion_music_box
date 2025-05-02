import { Application } from "@hotwired/stimulus";
import ModalController from "./modal_controller";
import SearchMusicController from "./search_music_controller";

const application = Application.start();
application.register("modal", ModalController);
application.register("search-music", SearchMusicController);
