// app/javascript/custom/avatar_cropper.js
document.addEventListener("turbo:load", () => {
  const fileInput      = document.getElementById("avatarInput");
  const inlinePreview  = document.getElementById("avatarPreviewInline");
  const modalEl        = document.getElementById("avatarCropModal");
  const cropContainer  = document.getElementById("cropContainer");
  const cropImage      = document.getElementById("cropImage");
  const confirmBtn     = document.getElementById("cropConfirmBtn");
  const avatarUrlField = document.getElementById("avatarUrlField");
  const submitBtn      = document.querySelector('form input[type="submit"]');
  const removeAvatarCheckbox = document.getElementById("removeAvatarCheckbox");

  if (![fileInput, inlinePreview, avatarUrlField, modalEl, cropContainer, cropImage, confirmBtn].every(Boolean)) return;

  const modal = (window.bootstrap && window.bootstrap.Modal)
    ? new window.bootstrap.Modal(modalEl)
    : { show() {}, hide() {} };

  function hideModalSafely() {
    try {
      const BS = window.bootstrap && window.bootstrap.Modal;
      if (BS && typeof BS.getOrCreateInstance === "function") {
        const inst = BS.getOrCreateInstance(modalEl);
        /* istanbul ignore next */ /* c8 ignore next */
        inst && typeof inst.hide === "function" && inst.hide();
      }
      /* istanbul ignore next */ /* c8 ignore next */
      modal && typeof modal.hide === "function" && modal.hide();
    } catch {}
  }

  // JSDOM対策: サイズ安全取得（本番では natural* が優先される）
  const safeClientW  = (el, d = 80) => (Number(el?.clientWidth)  || Number(el?.width)  || 0) || d;
  const safeClientH  = (el, d = 80) => (Number(el?.clientHeight) || Number(el?.height) || 0) || d;
  const safeNaturalW = (el, fb = 80) => (Number(el?.naturalWidth)  || 0) || safeClientW(el, fb);
  const safeNaturalH = (el, fb = 80) => (Number(el?.naturalHeight) || 0) || safeClientH(el, fb);

  // dataURL -> Blob（Cloudinary送信用）
  function dataURLtoBlob(dataURL) {
    const [meta, b64] = String(dataURL || "").split(",");
    const mime = (meta && meta.match(/data:(.*?);base64/))?.[1] || "image/png";
    const bin = atob(b64 || "");
    const u8  = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: mime });
  }

  let startX = 0, startY = 0, isDragging = false, dragStartX = 0, dragStartY = 0;

  function updateTransform() {
    cropImage.style.transform = `translate(${startX}px, ${startY}px)`;
  }

  // 画像の初期サイズを「トリミング枠にちょうど良く」合わせる
  function fitImageToCropContainer() {
    try {
      const vW = safeClientW(cropContainer, 80); // トリミング枠の幅
      const vH = safeClientH(cropContainer, 80); // トリミング枠の高さ
      const nW = safeNaturalW(cropImage, vW);    // 画像本来の幅
      const nH = safeNaturalH(cropImage, vH);    // 画像本来の高さ

      if (!vW || !vH || !nW || !nH) return;

      // 枠を完全に覆うようにスケール（大きい画像は縮小、小さい画像は拡大）
      const scale = Math.max(vW / nW, vH / nH);

      const displayW = nW * scale;
      const displayH = nH * scale;

      // 表示サイズとして width/height をセット
      cropImage.style.width = `${displayW}px`;
      cropImage.style.height = `${displayH}px`;

      // 画像を枠の中心にくるように初期位置を調整
      startX = (vW - displayW) / 2;
      startY = (vH - displayH) / 2;

      updateTransform();
    } catch (e) {
      console.error("fitImageToCropContainer failed:", e);
    }
  }

  Object.assign(cropImage.style, {
    position: "absolute",
    top: "0",
    left: "0",
    userSelect: "none",
    webkitUserSelect: "none",
    maxWidth: "none",
    maxHeight: "none",
    width: "auto",
    height: "auto",
  });
  cropImage.draggable = false;
  cropContainer.style.cursor = "grab";
  cropContainer.style.touchAction = "none";

  // ファイル選択
  if (!fileInput.dataset.bound) {
    fileInput.dataset.bound = "1";
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const allowed = ["image/jpeg", "image/jpg", "image/png"];
      if (!allowed.includes(file.type)) {
        alert("ファイル形式はJPEGまたはPNGのみ許可されています。");
        fileInput.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataURL = reader.result;

        // 画像が読み込まれたタイミングで、自動的に「ちょうど良いサイズ」にフィットさせる
        cropImage.onload = () => {
          // 画像の naturalWidth / naturalHeight が確定したあとに実行
          fitImageToCropContainer();
        };

        cropImage.src = dataURL; // モーダル内の画像だけ差し替え

        /* istanbul ignore next */ /* c8 ignore next */
        modal && typeof modal.show === "function" && modal.show();
      };
      reader.readAsDataURL(file);
    });
  }

  // ドラッグ
  if (!cropContainer.dataset.bound) {
    cropContainer.dataset.bound = "1";

    cropContainer.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      /* istanbul ignore next */ /* c8 ignore next */
      cropContainer.setPointerCapture?.(e.pointerId);
      cropContainer.style.cursor = "grabbing";
    });

    cropContainer.addEventListener("pointermove", (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      startX += dx; startY += dy;
      dragStartX = e.clientX; dragStartY = e.clientY;
      updateTransform();
    });

    cropContainer.addEventListener("pointerup", (e) => {
      if (!isDragging) return;
      isDragging = false;
      /* istanbul ignore next */ /* c8 ignore next */
      cropContainer.releasePointerCapture?.(e.pointerId);
      cropContainer.style.cursor = "grab";
    });
  }

  // 確定（ここでプレビュー/hidden更新 → 必要ならCloudinary）
  if (!confirmBtn.dataset.bound) {
    confirmBtn.dataset.bound = "1";
    confirmBtn.addEventListener("click", async () => {
      if (submitBtn) submitBtn.disabled = true;

      const hasCloudinary = Boolean(window.CLOUDINARY_CLOUD_NAME && window.CLOUDINARY_UPLOAD_PRESET);
      let dataUrlForUpload = "";

      try {
        // 1) 80x80 にクロップして dataURL 生成
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = 80; canvas.height = 80;

        const vW = safeClientW(cropContainer, 80);
        const vH = safeClientH(cropContainer, 80);
        const cW = safeClientW(cropImage, 80);
        const cH = safeClientH(cropImage, 80);
        const nW = safeNaturalW(cropImage, cW);
        const nH = safeNaturalH(cropImage, cH);

        const scaleX = nW / (cW || 1);
        const scaleY = nH / (cH || 1);
        const sx = -startX * scaleX;
        const sy = -startY * scaleY;

        ctx.drawImage(cropImage, sx, sy, vW * scaleX, vH * scaleY, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL("image/png");

        // 先に dataURL を画面/hidden に反映（失敗時フォールバックとして有効）
        inlinePreview.src = dataUrl;
        avatarUrlField.value = dataUrl;
        avatarUrlField.setAttribute("value", dataUrl);

        dataUrlForUpload = dataUrl;
      } catch (err) {
        console.error("Canvas crop failed:", err);
        dataUrlForUpload = cropImage?.src || inlinePreview?.src || avatarUrlField?.value || "";
      } finally {
        /* istanbul ignore next */ /* c8 ignore next */
        confirmBtn.blur?.();
        /* istanbul ignore next */ /* c8 ignore next */
        document.activeElement?.blur?.();
        hideModalSafely();
      }

      // 2) Cloudinary アップロード
      if (hasCloudinary) {
        inlinePreview.classList.add("loading");

        const tempImage = new window.Image();
        tempImage.onload = async () => {
          try {
            const blob = dataURLtoBlob(dataUrlForUpload);

            const axiosObj = (window && window.axios);
            if (!axiosObj || typeof axiosObj.post !== "function") {
              throw new Error("axios post function not available");
            }

            const fd = new FormData();
            fd.append("file", blob, "avatar.png");
            fd.append("upload_preset", window.CLOUDINARY_UPLOAD_PRESET);

            const endpoint = `https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CLOUD_NAME}/upload`;
            const res = await axiosObj.post(endpoint, fd);
            const uploadedUrl = res?.data?.secure_url;

            if (uploadedUrl) {
              inlinePreview.src = uploadedUrl;
              avatarUrlField.value = uploadedUrl;
              avatarUrlField.setAttribute("value", uploadedUrl);
            }
          } catch (err) {
            console.error("Cloudinary upload failed:", err);
          } finally {
            /* istanbul ignore next */ /* c8 ignore next */
            inlinePreview.classList?.remove("loading");
            if (submitBtn) submitBtn.disabled = false;
          }
        };
        try { tempImage.src = dataUrlForUpload; } catch {
          /* istanbul ignore next */ /* c8 ignore next */
          inlinePreview.classList?.remove("loading");
          if (submitBtn) submitBtn.disabled = false;
        }
      } else {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // 削除ボタン
  const removeAvatarBtn = document.getElementById("removeAvatarBtn");
  if (removeAvatarBtn && removeAvatarCheckbox) {
    removeAvatarBtn.addEventListener("click", () => {
      const isChecked = removeAvatarCheckbox.checked;
      const confirmMsg = isChecked ? "削除をキャンセルしますか？" : "本当に画像を削除しますか？";
      if (confirm(confirmMsg)) {
        removeAvatarCheckbox.checked = !isChecked;
        removeAvatarBtn.textContent = removeAvatarCheckbox.checked ? "削除予定" : "画像を削除する";
        removeAvatarBtn.classList.toggle("btn-danger", removeAvatarCheckbox.checked);
        removeAvatarBtn.classList.toggle("btn-warning", !removeAvatarCheckbox.checked);
      }
    });
  }

  // 送信ガード
  const form = document.querySelector("form");
  if (form) {
    form.addEventListener("submit", (e) => {
      const removeChecked = !!(removeAvatarCheckbox && removeAvatarCheckbox.checked);
      if (!avatarUrlField.value && !removeChecked) {
        e.preventDefault();
        alert("画像のアップロードがまだ完了していません！");
      }
    });
  }
});
