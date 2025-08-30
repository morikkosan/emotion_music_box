import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static values = {
    message: String,
    url: String,
    title: { type: String, default: "削除しました" },
    icon: { type: String, default: "success" },
    confirmText: { type: String, default: "閉じる" }
  }

  connect() {
    // 念のため、既存モーダル/バックドロップを掃除（黒画面対策・ちらつき防止）
    document.querySelectorAll(".modal.show").forEach(m => {
      try { window.bootstrap?.Modal.getInstance(m)?.hide(); } catch {}
    });
    document.querySelectorAll(".modal-backdrop").forEach(b => b.remove());
    document.body.classList.remove("modal-open");
    document.body.style.removeProperty("overflow");
    document.body.style.removeProperty("padding-right");

    const Swal = window.Swal;
    if (!Swal?.fire) {
      alert(this.messageValue || "完了しました");
      this.go();
      return;
    }
    Swal.fire({
      title: this.titleValue,
      text: this.messageValue,
      icon: this.iconValue,
      confirmButtonText: this.confirmTextValue,
      showCancelButton: false
    }).then(() => this.go());
  }

  go() {
    const url = this.urlValue || "/";
    if (window.Turbo?.visit) {
      window.Turbo.visit(url, { action: "replace" });
    } else {
      window.location.replace(url);
    }
  }
}
