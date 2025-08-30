window.Swal = {
  fire: function (opts = {}) {
    const {
      title = "",
      text = "",
      icon = "info",
      confirmButtonText = "OK",
      showCancelButton = false,
      cancelButtonText = "キャンセル",
      // ★ これをちゃんと受け取り、モーダルが閉じたら呼ぶ
      didClose = null,
    } = opts;

    // ネオン風アイコン
    let iconHtml = "";
    if (icon === "success") iconHtml = `<span class="cyber-icon success">✔</span>`;
    else if (icon === "error") iconHtml = `<span class="cyber-icon error">✖</span>`;
    else if (icon === "question") iconHtml = `<span class="cyber-icon question">？</span>`;

    const modalId = "swal-fake-modal";
    let modalDiv = document.getElementById(modalId);
    if (modalDiv) modalDiv.remove();

    modalDiv = document.createElement("div");
    modalDiv.innerHTML = `
      <div class="modal fade" id="${modalId}" tabindex="-1" aria-hidden="true">
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

    const bsModalEl = modalDiv.querySelector(`#${modalId}`);
    const modal = new bootstrap.Modal(bsModalEl, { backdrop: true, keyboard: true, focus: true });

    // ★ ここが肝：Bootstrap モーダルが閉じたら didClose を必ず呼ぶ
    bsModalEl.addEventListener("hidden.bs.modal", () => {
      try { if (typeof didClose === "function") didClose(); } catch (_) {}
      // 後始末
      setTimeout(() => { try { modalDiv.remove(); } catch (_) {} }, 0);
    });

    modal.show();

    // OK/Cancel/× ボタンは「hide」して resolve → hidden 時に didClose が呼ばれる
    modalDiv.querySelector(`#${modalId}-ok`).onclick = function () {
      modal.hide();
      // SweetAlert2 互換（使っていれば）
      try { opts.resolve?.({ isConfirmed: true }); } catch (_) {}
    };

    if (showCancelButton) {
      modalDiv.querySelector(`#${modalId}-cancel`).onclick = function () {
        modal.hide();
        try { opts.resolve?.({ isConfirmed: false }); } catch (_) {}
      };
    }

    modalDiv.querySelector(".btn-close").onclick = function () {
      modal.hide();
      try { opts.resolve?.({ isConfirmed: false }); } catch (_) {}
    };

    // Promise 互換（必要なら呼び出し側で then 可能）
    return new Promise((resolve) => {
      opts.resolve = resolve;
    });
  }
};
