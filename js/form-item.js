"use strict";

document.addEventListener("sc:ready", function () {
  const params = SC.urlParams();
  const ITEM_ID = params.id || null;
  const IS_EDIT = Boolean(ITEM_ID);

  // ── State ────────────────────────────────────────────────────────────────
  const state = {
    isDirty: false,
    categories: [],
    brands: [],
    locations: [],
    tags: [],
    photoFile: null,
    photoPreviewUrl: null,
    existingPhotoUrl: null,
  };

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const titleEl       = document.getElementById("page-title");
  const breadcrumbEl  = document.getElementById("breadcrumb-action");
  const submitBtn     = document.getElementById("btn-submit");
  const cancelBtn     = document.getElementById("btn-cancel");
  const form          = document.getElementById("item-form");

  const nameInput     = document.getElementById("field-name");
  const assetInput    = document.getElementById("field-asset-tag");
  const categorySelect = document.getElementById("field-category");
  const brandSelect   = document.getElementById("field-brand");
  const modelInput    = document.getElementById("field-model");
  const descInput     = document.getElementById("field-description");
  const conditionInputs = document.querySelectorAll('input[name="condition"]');
  const qtyInput      = document.getElementById("field-qty");
  const valueInput    = document.getElementById("field-value");
  const locationSelect = document.getElementById("field-location");
  const tagsInput     = document.getElementById("field-tags-input");
  const tagsContainer = document.getElementById("tags-container");
  const notesInput    = document.getElementById("field-notes");

  const photoUploadZone = document.getElementById("photo-upload-zone");
  const photoFileInput  = document.getElementById("photo-file-input");
  const photoPreview    = document.getElementById("photo-preview");
  const photoPlaceholder = document.getElementById("photo-placeholder");
  const photoRemoveBtn  = document.getElementById("btn-remove-photo");

  const summaryName     = document.getElementById("summary-name");
  const summaryCategory = document.getElementById("summary-category");
  const summaryCondition = document.getElementById("summary-condition");
  const summaryQty      = document.getElementById("summary-qty");
  const summaryLocation = document.getElementById("summary-location");
  const summaryAsset    = document.getElementById("summary-asset");

  const qrSection   = document.getElementById("qr-section");
  const qrTokenEl   = document.getElementById("qr-token");
  const btnCopyQr   = document.getElementById("btn-copy-qr");

  const discardModal = document.getElementById("modal-unsaved");
  const btnDiscardOk = document.getElementById("btn-discard-ok");
  let pendingNavUrl  = null;

  // ── Init ─────────────────────────────────────────────────────────────────
  async function init() {
    if (IS_EDIT) {
      titleEl && (titleEl.textContent = "Editar Item");
      breadcrumbEl && (breadcrumbEl.textContent = "Editar Item");
      document.title = "Editar Item — StockControl";
      submitBtn && (submitBtn.textContent = "Salvar Alterações");
      if (qrSection) qrSection.style.display = "block";
    }

    await Promise.all([loadCategories(), loadBrands(), loadLocations()]);

    if (IS_EDIT) {
      await loadItem();
    }

    wireForm();
    wireTags();
    wirePhoto();
    wireSummarySync();
    wireUnsavedGuard();
    updateSummary();
  }

  // ── Load lookups ─────────────────────────────────────────────────────────
  async function loadCategories() {
    try {
      const data = await SC.api("/categories");
      state.categories = data.items || data || [];
      if (categorySelect) {
        categorySelect.innerHTML = '<option value="">Selecionar categoria</option>' +
          state.categories.map(c => `<option value="${c.id}">${SC.escHtml(c.name)}</option>`).join("");
      }
    } catch (_) { /* non-fatal */ }
  }

  async function loadBrands() {
    try {
      const data = await SC.api("/brands");
      state.brands = data.items || data || [];
      if (brandSelect) {
        brandSelect.innerHTML = '<option value="">Selecionar marca</option>' +
          state.brands.map(b => `<option value="${b.id}">${SC.escHtml(b.name)}</option>`).join("");
      }
    } catch (_) { /* non-fatal */ }
  }

  async function loadLocations() {
    try {
      const data = await SC.api("/locations");
      state.locations = data.items || data || [];
      if (locationSelect) {
        locationSelect.innerHTML = '<option value="">Selecionar localização</option>' +
          state.locations.map(l => `<option value="${l.id}">${SC.escHtml(l.name)}</option>`).join("");
      }
    } catch (_) { /* non-fatal */ }
  }

  // ── Load existing item (edit mode) ────────────────────────────────────────
  async function loadItem() {
    try {
      const item = await SC.api(`/items/${ITEM_ID}`);
      fillForm(item);
    } catch (err) {
      SC.toastError("Erro ao carregar item.");
      console.error(err);
    }
  }

  function fillForm(item) {
    if (nameInput)    nameInput.value     = item.name || "";
    if (assetInput)   assetInput.value    = item.assetTag || item.asset_tag || "";
    if (modelInput)   modelInput.value    = item.model || "";
    if (descInput)    descInput.value     = item.description || "";
    if (qtyInput)     qtyInput.value      = item.quantity ?? item.qty ?? 1;
    if (valueInput)   valueInput.value    = item.estimatedValue ?? item.estimated_value ?? "";
    if (notesInput)   notesInput.value    = item.notes || "";

    if (categorySelect && item.categoryId) categorySelect.value = item.categoryId;
    if (brandSelect && item.brandId)       brandSelect.value    = item.brandId;
    if (locationSelect && item.locationId) locationSelect.value = item.locationId;

    const cond = item.condition || "OTIMO";
    conditionInputs.forEach(r => { r.checked = r.value === cond; });

    state.tags = Array.isArray(item.tags) ? [...item.tags] : [];
    renderTags();

    if (item.photoUrl || item.photo_url) {
      state.existingPhotoUrl = item.photoUrl || item.photo_url;
      showPhotoPreview(state.existingPhotoUrl);
    }

    if (qrTokenEl && item.qrToken) {
      qrTokenEl.textContent = item.qrToken;
    }

    if (btnCopyQr && item.qrToken) {
      btnCopyQr.onclick = () => SC.copyText(item.qrToken, "Token QR copiado!");
    }

    updateSummary();
    state.isDirty = false;
  }

  // ── Form submission ───────────────────────────────────────────────────────
  function wireForm() {
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!validateForm()) return;

      submitBtn.disabled = true;
      submitBtn.classList.add("loading");

      try {
        const payload = buildPayload();
        let item;

        if (IS_EDIT) {
          item = await SC.api(`/items/${ITEM_ID}`, { method: "PUT", body: JSON.stringify(payload) });
        } else {
          item = await SC.api("/items", { method: "POST", body: JSON.stringify(payload) });
        }

        if (state.photoFile) {
          await uploadPhoto(item.id || ITEM_ID);
        }

        state.isDirty = false;
        SC.toastSuccess(IS_EDIT ? "Item atualizado com sucesso!" : "Item cadastrado com sucesso!");
        setTimeout(() => { window.location.href = "estoque.html"; }, 800);
      } catch (err) {
        SC.toastError(err.message || "Erro ao salvar item.");
        submitBtn.disabled = false;
        submitBtn.classList.remove("loading");
      }
    });

    cancelBtn && cancelBtn.addEventListener("click", () => {
      if (state.isDirty) {
        pendingNavUrl = "estoque.html";
        SC.openModal("modal-unsaved");
      } else {
        window.location.href = "estoque.html";
      }
    });
  }

  function buildPayload() {
    const condition = [...conditionInputs].find(r => r.checked)?.value || "OTIMO";
    return {
      name:           nameInput?.value.trim(),
      assetTag:       assetInput?.value.trim(),
      categoryId:     categorySelect?.value || null,
      brandId:        brandSelect?.value || null,
      model:          modelInput?.value.trim(),
      description:    descInput?.value.trim(),
      condition,
      quantity:       parseInt(qtyInput?.value) || 1,
      estimatedValue: parseFloat(valueInput?.value) || null,
      locationId:     locationSelect?.value || null,
      tags:           state.tags,
      notes:          notesInput?.value.trim(),
    };
  }

  function validateForm() {
    let valid = true;

    if (!nameInput?.value.trim()) {
      markInvalid(nameInput, "Nome é obrigatório");
      valid = false;
    } else {
      markValid(nameInput);
    }

    if (qtyInput && (parseInt(qtyInput.value) < 0 || isNaN(parseInt(qtyInput.value)))) {
      markInvalid(qtyInput, "Quantidade inválida");
      valid = false;
    } else {
      markValid(qtyInput);
    }

    return valid;
  }

  function markInvalid(el, msg) {
    if (!el) return;
    el.classList.add("is-error");
    let hint = el.parentElement.querySelector(".form-hint.error");
    if (!hint) {
      hint = document.createElement("span");
      hint.className = "form-hint error";
      el.parentElement.appendChild(hint);
    }
    hint.textContent = msg;
  }

  function markValid(el) {
    if (!el) return;
    el.classList.remove("is-error");
    const hint = el.parentElement.querySelector(".form-hint.error");
    if (hint) hint.remove();
  }

  async function uploadPhoto(itemId) {
    const fd = new FormData();
    fd.append("photo", state.photoFile);
    await SC.api(`/items/${itemId}/photo`, {
      method: "POST",
      body: fd,
      headers: {},
    });
  }

  // ── Tags ─────────────────────────────────────────────────────────────────
  function wireTags() {
    if (!tagsInput) return;
    tagsInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        const val = tagsInput.value.trim().replace(/,$/, "");
        if (val && !state.tags.includes(val)) {
          state.tags.push(val);
          renderTags();
          markDirty();
        }
        tagsInput.value = "";
      }
      if (e.key === "Backspace" && !tagsInput.value && state.tags.length) {
        state.tags.pop();
        renderTags();
        markDirty();
      }
    });
  }

  function renderTags() {
    if (!tagsContainer) return;
    const chips = state.tags.map((t, i) =>
      `<span class="tag-chip">${SC.escHtml(t)}<button type="button" class="tag-remove" data-index="${i}" aria-label="Remover tag">×</button></span>`
    ).join("");
    tagsContainer.innerHTML = chips;
    tagsContainer.querySelectorAll(".tag-remove").forEach(btn => {
      btn.addEventListener("click", () => {
        state.tags.splice(parseInt(btn.dataset.index), 1);
        renderTags();
        markDirty();
      });
    });
  }

  // ── Photo ─────────────────────────────────────────────────────────────────
  function wirePhoto() {
    if (!photoUploadZone) return;

    photoUploadZone.addEventListener("click", () => photoFileInput?.click());

    photoUploadZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      photoUploadZone.classList.add("drag-over");
    });

    photoUploadZone.addEventListener("dragleave", () => {
      photoUploadZone.classList.remove("drag-over");
    });

    photoUploadZone.addEventListener("drop", (e) => {
      e.preventDefault();
      photoUploadZone.classList.remove("drag-over");
      const file = e.dataTransfer.files[0];
      if (file) handlePhotoFile(file);
    });

    photoFileInput?.addEventListener("change", () => {
      const file = photoFileInput.files[0];
      if (file) handlePhotoFile(file);
    });

    photoRemoveBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      clearPhoto();
    });
  }

  function handlePhotoFile(file) {
    if (!file.type.startsWith("image/")) {
      SC.toastError("Selecione um arquivo de imagem válido.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      SC.toastError("A imagem não pode ultrapassar 5 MB.");
      return;
    }
    state.photoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      state.photoPreviewUrl = e.target.result;
      showPhotoPreview(e.target.result);
      markDirty();
    };
    reader.readAsDataURL(file);
  }

  function showPhotoPreview(url) {
    if (photoPreview)    { photoPreview.src = url; photoPreview.style.display = "block"; }
    if (photoPlaceholder) photoPlaceholder.style.display = "none";
    if (photoRemoveBtn)   photoRemoveBtn.style.display = "inline-flex";
  }

  function clearPhoto() {
    state.photoFile = null;
    state.photoPreviewUrl = null;
    state.existingPhotoUrl = null;
    if (photoPreview)     { photoPreview.src = ""; photoPreview.style.display = "none"; }
    if (photoPlaceholder) photoPlaceholder.style.display = "flex";
    if (photoRemoveBtn)   photoRemoveBtn.style.display = "none";
    if (photoFileInput)   photoFileInput.value = "";
    markDirty();
  }

  // ── Live summary ─────────────────────────────────────────────────────────
  function wireSummarySync() {
    const live = [nameInput, assetInput, qtyInput, valueInput];
    live.forEach(el => el?.addEventListener("input", () => { updateSummary(); markDirty(); }));

    categorySelect?.addEventListener("change", () => { updateSummary(); markDirty(); });
    locationSelect?.addEventListener("change", () => { updateSummary(); markDirty(); });
    conditionInputs.forEach(r => r.addEventListener("change", () => { updateSummary(); markDirty(); }));

    [brandSelect, modelInput, descInput, notesInput].forEach(el =>
      el?.addEventListener("change", () => markDirty())
    );
  }

  function updateSummary() {
    if (summaryName) summaryName.textContent = nameInput?.value.trim() || "—";
    if (summaryAsset) summaryAsset.textContent = assetInput?.value.trim() || "—";
    if (summaryQty) summaryQty.textContent = qtyInput?.value || "1";

    if (summaryCategory) {
      const opt = categorySelect?.options[categorySelect.selectedIndex];
      summaryCategory.textContent = opt?.text !== "Selecionar categoria" ? opt?.text || "—" : "—";
    }

    if (summaryLocation) {
      const opt = locationSelect?.options[locationSelect.selectedIndex];
      summaryLocation.textContent = opt?.text !== "Selecionar localização" ? opt?.text || "—" : "—";
    }

    if (summaryCondition) {
      const cond = [...conditionInputs].find(r => r.checked)?.value || "OTIMO";
      summaryCondition.innerHTML = SC.conditionBadge(cond);
    }
  }

  // ── Dirty / unsaved guard ─────────────────────────────────────────────────
  function markDirty() { state.isDirty = true; }

  function wireUnsavedGuard() {
    window.addEventListener("beforeunload", (e) => {
      if (state.isDirty) { e.preventDefault(); e.returnValue = ""; }
    });

    document.querySelectorAll(".sidebar-link").forEach(link => {
      link.addEventListener("click", (e) => {
        if (state.isDirty) {
          e.preventDefault();
          pendingNavUrl = link.href;
          SC.openModal("modal-unsaved");
        }
      });
    });

    btnDiscardOk?.addEventListener("click", () => {
      state.isDirty = false;
      SC.closeModal("modal-unsaved");
      if (pendingNavUrl) window.location.href = pendingNavUrl;
    });

    document.getElementById("btn-discard-cancel")?.addEventListener("click", () => {
      SC.closeModal("modal-unsaved");
      pendingNavUrl = null;
    });
  }

  init();
});
