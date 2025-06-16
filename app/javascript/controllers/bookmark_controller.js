import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["selectedLogsInput", "includeMyLogsCheckbox"];

  // マイページ投稿表示ON/OFF切替え
  toggleMyPageLogs(event) {
    const includeMyLogs = event.target.checked;
    const url = new URL(window.location);
    url.searchParams.set("include_my_logs", includeMyLogs);
    Turbo.visit(url.toString(), { frame: "logs_list" });
  }

  // フォーム送信時にチェック済投稿のIDをセット
  submitPlaylistForm(event) {
    const checkedBoxes = document.querySelectorAll(".playlist-check:checked");
    const selectedIds = Array.from(checkedBoxes).map(box => box.value);
    this.selectedLogsInputTarget.value = selectedIds.join(",");
  }
}
