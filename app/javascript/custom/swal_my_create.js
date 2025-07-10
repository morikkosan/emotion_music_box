window.Swal = {
  fire: function({
    title = "",
    text = "",
    icon = "info",
    confirmButtonText = "OK",
    showCancelButton = false,
    cancelButtonText = "キャンセル"
  }) {
    return new Promise((resolve, reject) => {
      // ネオン風アイコンにカスタムクラス付与！
      let iconHtml = "";
      if (icon === "success") iconHtml = `<span class="cyber-icon success">✔</span>`;
      else if (icon === "error") iconHtml = `<span class="cyber-icon error">✖</span>`;
      else if (icon === "question") iconHtml = `<span class="cyber-icon question">？</span>`;
      else iconHtml = "";

      const modalId = "swal-fake-modal";
      let modalDiv = document.getElementById(modalId);
      if (modalDiv) modalDiv.remove();

      modalDiv = document.createElement("div");
      modalDiv.innerHTML = `
      <div class="modal fade" id="${modalId}" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content cyber-popup">
            <div class="modal-header border-0">
              <h5 class="modal-title">${iconHtml} <span class="cyber-title">${title}</span></h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body"><span class="cyber-text">${text || ""}</span></div>
            <div class="modal-footer border-0">
              ${showCancelButton ? `<button type="button" class="btn cyber-btn-cancel" id="${modalId}-cancel">${cancelButtonText}</button>` : ""}
              <button type="button" class="btn cyber-btn-ok" id="${modalId}-ok">${confirmButtonText}</button>
            </div>
          </div>
        </div>
      </div>
      `;
      document.body.appendChild(modalDiv);

      // Bootstrapでモーダルを表示
      const modal = new bootstrap.Modal(modalDiv.querySelector(`#${modalId}`));
      modal.show();

      // OK/Cancel処理
      modalDiv.querySelector(`#${modalId}-ok`).onclick = function () {
        modal.hide();
        resolve({ isConfirmed: true });
        setTimeout(() => modalDiv.remove(), 500);
      };
      if (showCancelButton) {
        modalDiv.querySelector(`#${modalId}-cancel`).onclick = function () {
          modal.hide();
          resolve({ isConfirmed: false });
          setTimeout(() => modalDiv.remove(), 500);
        };
      }

      // クローズボタン
      modalDiv.querySelector('.btn-close').onclick = function () {
        modal.hide();
        resolve({ isConfirmed: false });
        setTimeout(() => modalDiv.remove(), 500);
      };
    });
  }
};
