"use strict";

document.addEventListener("sc:ready", function () {
  const params  = SC.urlParams();
  const ITEM_ID = params.id || null;
  const IS_EDIT = Boolean(ITEM_ID);

  // ── Static data ───────────────────────────────────────────────────────────
  const CATEGORIES = [
    "Informática","Mobiliário","Eletrodomésticos","Ferramentas",
    "Veículos","Eletrônicos","Equipamentos","Material de Escritório","Outros"
  ];

  const LOCATIONS = [
    "Sala A01","Sala A02","Sala B12","Almoxarifado",
    "Lab TI","Ginásio","Enfermaria","Recepção","Auditório"
  ];

  const BRAND_DATA = {
    "Informática":          ["Dell","Lenovo","HP","Apple","Samsung","Acer","Asus","Outros"],
    "Mobiliário":           ["Giroflex","Cavaletti","Dell Anno","Plaxmetal","Outros"],
    "Eletrodomésticos":     ["Brastemp","Electrolux","Consul","LG","Samsung","Outros"],
    "Ferramentas":          ["Bosch","Makita","DeWalt","Stanley","Tramontina","Outros"],
    "Veículos":             ["Ford","Volkswagen","Fiat","Chevrolet","Toyota","Outros"],
    "Eletrônicos":          ["Samsung","Apple","Motorola","Philips","Epson","Outros"],
    "Equipamentos":         ["HP","Epson","Canon","Cisco","TP-Link","Intelbras","Outros"],
    "Material de Escritório":["BIC","Faber-Castell","Staples","Elgin","Outros"],
    "Outros":               ["Outros"],
  };

  const MODEL_DATA = {
    "Informática": {
      "Dell":    ["Inspiron 15","Latitude 5420","OptiPlex 3090","Vostro 3510"],
      "Lenovo":  ["ThinkPad E14","IdeaPad 3","ThinkCentre M720q"],
      "HP":      ["ProBook 450","EliteBook 840","Compaq 8200"],
      "Apple":   ["MacBook Air M2","MacBook Pro 14\"","iMac 24\""],
      "Samsung": ["Galaxy Book2","Chromebook 4"],
      "Acer":    ["Aspire 5","Nitro 5"],
      "Asus":    ["VivoBook 15","ZenBook 14"],
    },
    "Mobiliário": {
      "Giroflex":  ["Cadeira Executiva G40","Cadeira Operacional G1"],
      "Cavaletti": ["Cadeira Executiva CE200","Mesa de Escritório"],
      "Dell Anno": ["Mesa Gerencial","Mesa Executiva Opus"],
      "Plaxmetal": ["Armário de Aço 2 portas","Estante de Aço 5 prateleiras"],
    },
    "Eletrodomésticos": {
      "Brastemp":  ["Geladeira 400L Frost Free","Lavadora 12kg","Fogão 5 bocas"],
      "Electrolux":["Geladeira TF39","Micro-ondas MEF41"],
      "Consul":    ["Geladeira CRM50AB","Ar Condicionado 9000 BTU"],
      "LG":        ["Ar Condicionado 12000 BTU","Micro-ondas MS3055R"],
      "Samsung":   ["Smart TV 50\" Crystal","Ar Condicionado 9000 BTU"],
    },
    "Ferramentas": {
      "Bosch":      ["Furadeira GSB 450RE","Parafusadeira GO 3.6V","Serra Circular GKS 185"],
      "Makita":     ["Furadeira HP488D","Serra Tico-Tico JV0600K"],
      "DeWalt":     ["Furadeira DCD771","Parafusadeira DCF887"],
      "Stanley":    ["Jogo de Chaves Combinadas","Alicate Universal 8\""],
      "Tramontina": ["Jogo de Chaves Phillips","Marreta 1kg"],
    },
    "Veículos": {
      "Ford":       ["Ka 1.0 SE","Transit Van 350L","Ranger XL 2.2"],
      "Volkswagen": ["Gol 1.0 City","Saveiro Robust 1.6","Delivery 11.180"],
      "Fiat":       ["Uno 1.0 Attractive","Fiorino 1.4","Ducato Cargo 2.3"],
      "Chevrolet":  ["Onix 1.0 Turbo","S10 LS 2.5","Express Cargo 1.4"],
      "Toyota":     ["Corolla 2.0 XEi","Hilux SR 2.7","Bandeirante 4x4"],
    },
    "Eletrônicos": {
      "Samsung":  ["Galaxy S23","Galaxy Tab S8","Smart TV 55\" QLED"],
      "Apple":    ["iPhone 15","iPad Pro 12.9\"","AirPods Pro 2ª gen"],
      "Motorola": ["Moto G82 5G","Moto G53"],
      "Philips":  ["Monitor 24\" FHD","Projetor PPX4835"],
      "Epson":    ["Projetor EB-X41","Impressora L3250"],
    },
    "Equipamentos": {
      "HP":        ["LaserJet Pro M404dn","Plotter DesignJet T650"],
      "Epson":     ["EcoTank L4260","Scanner WorkForce DS-870"],
      "Canon":     ["PIXMA G3160","EOS Rebel SL3"],
      "Cisco":     ["Switch SG350-28","Roteador RV340"],
      "TP-Link":   ["Switch TL-SG1024","Roteador Archer C6"],
      "Intelbras": ["PABX Impacta 140","Câmera IP VIP 1020 G2"],
    },
    "Material de Escritório": {
      "BIC":          ["Caneta Cristal","Lapiseira Atlantis 0.7mm"],
      "Faber-Castell":["Lápis Preto Nº2","Estojo 12 cores"],
      "Staples":      ["Grampeador 26/6","Perfurador 2 furos"],
      "Elgin":        ["Calculadora 12 dígitos MV4133"],
    },
  };

  const COND_MAP = { OTIMO: "otimo", REPARO: "reparo", DESCARTAR: "inativo" };
  const COND_REVERSE = { otimo: "OTIMO", bom: "OTIMO", reparo: "REPARO", ruim: "REPARO", inativo: "DESCARTAR" };

  // ── State ─────────────────────────────────────────────────────────────────
  let isDirty      = false;
  let pendingNav   = null;
  let photoDataUrl = null;
  const tags       = [];

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const form           = document.getElementById("itemForm");
  const itemIdField    = document.getElementById("itemId");
  const pageTitle      = document.getElementById("pageTitle");
  const modeBadge      = document.getElementById("modeBadge");

  const productName    = document.getElementById("productName");
  const assetTag       = document.getElementById("assetTag");
  const categoryId     = document.getElementById("categoryId");
  const brandId        = document.getElementById("brandId");
  const modelId        = document.getElementById("modelId");
  const description    = document.getElementById("description");
  const condInputs     = document.querySelectorAll('input[name="condition_code"]');
  const quantity       = document.getElementById("quantity");
  const estimatedValue = document.getElementById("estimatedValue");
  const locationId     = document.getElementById("locationId");
  const tagsWrap       = document.getElementById("tagsWrap");
  const tagsInput      = document.getElementById("tagsInput");
  const tagsHidden     = document.getElementById("tagsHidden");
  const notes          = document.getElementById("notes");

  const photoZone       = document.getElementById("photoZone");
  const photoInput      = document.getElementById("photoInput");
  const photoPreview    = document.getElementById("photoPreview");
  const photoRemoveBtn  = document.getElementById("photoRemoveBtn");
  const photoPlaceholder= document.getElementById("photoPlaceholder");
  const photoUploadText = document.getElementById("photoUploadText");
  const photoUploadHint = document.getElementById("photoUploadHint");

  const summaryName     = document.getElementById("summaryName");
  const summaryCategory = document.getElementById("summaryCategory");
  const summaryCondition= document.getElementById("summaryCondition");
  const summaryQty      = document.getElementById("summaryQty");
  const summaryLocation = document.getElementById("summaryLocation");
  const summaryAsset    = document.getElementById("summaryAsset");

  const qrSection   = document.getElementById("qrSection");
  const qrTokenText = document.getElementById("qrTokenText");
  const qrCopyBtn   = document.getElementById("qrCopyBtn");
  const discardBtn  = document.getElementById("discardChangesBtn");

  // ── Storage ───────────────────────────────────────────────────────────────
  function getItems() {
    try { return JSON.parse(localStorage.getItem("sc_items") || "[]"); } catch { return []; }
  }
  function saveItems(items) { localStorage.setItem("sc_items", JSON.stringify(items)); }

  function _syncToBackend(item, isEdit) {
    const token = localStorage.getItem("sc_token") || sessionStorage.getItem("sc_token");
    const user  = JSON.parse(localStorage.getItem("sc_user") || sessionStorage.getItem("sc_user") || "{}") || {};
    if (!token || !user.organization_id) return;

    const COND_CODE = { otimo:"OTIMO", bom:"OTIMO", reparo:"REPARO", ruim:"REPARO", inativo:"DESCARTAR" };

    if (isEdit && item._backend_id) {
      fetch(`/api/items/${item._backend_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          organization_id: user.organization_id,
          produto:   item.nome,
          marca:     item.marca     || null,
          modelo:    item.modelo    || null,
          descricao: item.descricao || null,
          status:    COND_CODE[item.condicao] || "OTIMO",
        }),
      }).catch(() => {});
    } else if (!isEdit) {
      fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          organization_id: user.organization_id,
          product_name:    item.nome,
          product_brand:   item.marca      || null,
          product_model:   item.modelo     || null,
          serial_number:   item.patrimonio || null,
          description:     item.descricao  || null,
          condition_code:  COND_CODE[item.condicao] || "OTIMO",
          category_name:   item.categoria  || null,
          created_by:      user.id         || null,
        }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.item_id) {
            const all = getItems();
            const idx = all.findIndex(i => i.id === item.id);
            if (idx !== -1) { all[idx]._backend_id = data.item_id; saveItems(all); }
          }
        })
        .catch(() => {});
    }
  }

  // ── Auto-patrimônio ───────────────────────────────────────────────────────
  function genPatrimonio() {
    const year   = new Date().getFullYear();
    const prefix = `PAT-${year}-`;
    const used   = new Set(
      getItems()
        .map(i => i.patrimonio || "")
        .filter(p => p.startsWith(prefix))
        .map(p => parseInt(p.slice(prefix.length), 10))
        .filter(n => !isNaN(n))
    );
    let n = 1;
    while (used.has(n)) n++;
    return `${prefix}${String(n).padStart(3, "0")}`;
  }

  // ── Char counters ─────────────────────────────────────────────────────────
  function addCharCounter(el, max) {
    if (!el) return;
    const span = document.createElement("span");
    span.className = "form-hint";
    span.style.cssText = "float:right;margin-top:4px;";
    span.textContent = `0 / ${max}`;
    el.parentElement.appendChild(span);
    el.addEventListener("input", () => {
      const len = el.value.length;
      span.textContent = `${len} / ${max}`;
      span.style.color = len > max * 0.9 ? "var(--color-warning)" : "";
    });
  }

  // ── Populate dropdowns ────────────────────────────────────────────────────
  function populateCategories() {
    if (!categoryId) return;
    categoryId.innerHTML = '<option value="">Selecione…</option>' +
      CATEGORIES.map(c => `<option value="${SC.escHtml(c)}">${SC.escHtml(c)}</option>`).join("");
  }

  function populateLocations() {
    if (!locationId) return;
    locationId.innerHTML = '<option value="">Sem localização</option>' +
      LOCATIONS.map(l => `<option value="${SC.escHtml(l)}">${SC.escHtml(l)}</option>`).join("");
  }

  function populateBrands(cat, selectedBrand) {
    if (!brandId) return;
    const brands = BRAND_DATA[cat] || [];
    brandId.innerHTML = '<option value="">Selecione…</option>' +
      brands.map(b => `<option value="${SC.escHtml(b)}"${b === selectedBrand ? " selected" : ""}>${SC.escHtml(b)}</option>`).join("");
    brandId.disabled = !brands.length;
    populateModels(cat, selectedBrand || "");
  }

  function populateModels(cat, brand, selectedModel) {
    if (!modelId) return;
    const models = (MODEL_DATA[cat] || {})[brand] || [];
    modelId.innerHTML = '<option value="">Selecione…</option>' +
      models.map(m => `<option value="${SC.escHtml(m)}"${m === selectedModel ? " selected" : ""}>${SC.escHtml(m)}</option>`).join("");
    modelId.disabled = !models.length;
  }

  // ── Edit: load item ───────────────────────────────────────────────────────
  function loadItemForEdit() {
    const item = getItems().find(i => String(i.id) === String(ITEM_ID));
    if (!item) {
      SC.toastError("Item não encontrado.");
      setTimeout(() => { window.location.href = "estoque.html"; }, 1500);
      return;
    }
    fillForm(item);
  }

  function fillForm(item) {
    if (itemIdField)    itemIdField.value    = item.id || "";
    if (productName)    productName.value    = item.nome || "";
    if (assetTag)       assetTag.value       = item.patrimonio || "";
    if (description)    description.value    = item.descricao || "";
    if (quantity)       quantity.value       = item.total ?? 1;
    if (estimatedValue) estimatedValue.value = item.valor || "";
    if (notes)          notes.value          = item.notas || "";

    if (categoryId && item.categoria) {
      categoryId.value = item.categoria;
      populateBrands(item.categoria, item.marca || "");
      if (item.marca) populateModels(item.categoria, item.marca, item.modelo || "");
    }
    if (locationId && item.localizacao) locationId.value = item.localizacao;

    const condValue = COND_REVERSE[item.condicao] || "OTIMO";
    condInputs.forEach(r => { r.checked = r.value === condValue; });

    if (Array.isArray(item.tags)) {
      tags.length = 0;
      item.tags.forEach(t => tags.push(t));
      renderTags();
    }

    if (item.foto) {
      photoDataUrl = item.foto;
      showPhotoPreview(item.foto);
    }

    if (qrTokenText) qrTokenText.textContent = item.id || "—";

    // Trigger counters update
    productName?.dispatchEvent(new Event("input"));
    description?.dispatchEvent(new Event("input"));

    updateSummary();
    isDirty = false;
  }

  // ── Validation ────────────────────────────────────────────────────────────
  function setFieldError(errorId, groupId, msg, show) {
    const err = document.getElementById(errorId);
    const grp = document.getElementById(groupId);
    if (err) { err.textContent = msg || err.textContent; err.style.display = show ? "block" : ""; }
    grp?.classList.toggle("has-error", show);
  }

  function validateForm() {
    let valid    = true;
    let firstBad = null;

    // Nome (required, min 3)
    const nameVal = productName?.value.trim() || "";
    const nameOk  = nameVal.length >= 3;
    setFieldError("errorProductName", "groupProductName",
      nameVal.length === 0 ? "Informe o nome do item." : "Nome deve ter pelo menos 3 caracteres.",
      !nameOk);
    if (!nameOk) { valid = false; firstBad = firstBad || productName; }

    // Categoria
    const catOk = Boolean(categoryId?.value);
    setFieldError("errorCategory", "groupCategory", null, !catOk);
    if (!catOk) { valid = false; firstBad = firstBad || categoryId; }

    // Condição
    const condOk = [...condInputs].some(r => r.checked);
    setFieldError("errorCondition", "groupCondition", null, !condOk);
    if (!condOk) valid = false;

    // Quantidade
    const qtyVal = parseInt(quantity?.value);
    const qtyOk  = !isNaN(qtyVal) && qtyVal >= 1;
    setFieldError("errorQty", "groupQty", null, !qtyOk);
    if (!qtyOk) { valid = false; firstBad = firstBad || quantity; }

    // Patrimônio uniqueness
    const patVal = assetTag?.value.trim() || "";
    if (valid && patVal) {
      const conflict = getItems().find(i => i.patrimonio === patVal && String(i.id) !== String(ITEM_ID));
      if (conflict) {
        SC.toastWarning(`Patrimônio "${patVal}" já está em uso.`);
        assetTag?.focus();
        return false;
      }
    }

    if (!valid && firstBad) {
      firstBad.focus();
      firstBad.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return valid;
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  function saveItem() {
    const btn1 = document.getElementById("saveBtn");
    const btn2 = document.getElementById("saveBtn2");
    const setLoading = (on) => {
      [btn1, btn2].forEach(b => {
        if (!b) return;
        b.disabled = on;
        b.classList.toggle("loading", on);
      });
    };

    setLoading(true);

    const condValue = [...condInputs].find(r => r.checked)?.value || "OTIMO";
    const now   = new Date().toISOString();
    const items = getItems();
    const qty   = parseInt(quantity?.value) || 1;

    try {
      if (IS_EDIT) {
        const idx = items.findIndex(i => String(i.id) === String(ITEM_ID));
        if (idx === -1) { SC.toastError("Item não encontrado."); setLoading(false); return; }
        const old = items[idx];
        items[idx] = {
          ...old,
          nome:        productName?.value.trim() || "",
          patrimonio:  assetTag?.value.trim()    || old.patrimonio,
          categoria:   categoryId?.value         || "",
          marca:       brandId?.value            || "",
          modelo:      modelId?.value            || "",
          descricao:   description?.value.trim() || "",
          condicao:    COND_MAP[condValue]        || "otimo",
          total:       qty,
          disponivel:  Math.min(old.disponivel ?? qty, qty),
          valor:       parseFloat(estimatedValue?.value) || 0,
          localizacao: locationId?.value         || "",
          tags:        [...tags],
          notas:       notes?.value.trim()       || "",
          foto:        photoDataUrl              || old.foto || null,
          updated_at:  now,
        };
        saveItems(items);
        _syncToBackend(items[idx], true);
        isDirty = false;
        SC.toastSuccess("Item atualizado com sucesso!");
      } else {
        const newId = "item_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
        items.push({
          id:          newId,
          nome:        productName?.value.trim() || "",
          patrimonio:  assetTag?.value.trim()    || genPatrimonio(),
          categoria:   categoryId?.value         || "",
          marca:       brandId?.value            || "",
          modelo:      modelId?.value            || "",
          descricao:   description?.value.trim() || "",
          condicao:    COND_MAP[condValue]        || "otimo",
          total:       qty,
          disponivel:  qty,
          valor:       parseFloat(estimatedValue?.value) || 0,
          localizacao: locationId?.value         || "",
          responsavel: "",
          tags:        [...tags],
          notas:       notes?.value.trim()       || "",
          foto:        photoDataUrl              || null,
          created_at:  now,
          updated_at:  now,
        });
        saveItems(items);
        _syncToBackend(items[items.length - 1], false);
        isDirty = false;
        SC.toastSuccess("Item cadastrado com sucesso!");
      }
      setTimeout(() => { window.location.href = "estoque.html"; }, 900);
    } catch (err) {
      SC.toastError("Erro ao salvar item.");
      setLoading(false);
    }
  }

  // ── Tags ──────────────────────────────────────────────────────────────────
  function wireTags() {
    if (!tagsInput) return;
    tagsWrap?.addEventListener("click", () => tagsInput.focus());
    tagsInput.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        addTag(tagsInput.value);
        tagsInput.value = "";
      }
      if (e.key === "Backspace" && !tagsInput.value && tags.length) {
        tags.pop(); renderTags(); markDirty();
      }
    });
    tagsInput.addEventListener("blur", () => {
      if (tagsInput.value.trim()) { addTag(tagsInput.value); tagsInput.value = ""; }
    });
  }

  function addTag(raw) {
    const val = raw.replace(/,/g, "").trim();
    if (val && !tags.includes(val) && tags.length < 15) {
      tags.push(val); renderTags(); markDirty();
    }
  }

  function renderTags() {
    if (!tagsWrap || !tagsInput) return;
    tagsWrap.querySelectorAll(".tag-chip").forEach(el => el.remove());
    tags.forEach((t, i) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.innerHTML =
        `${SC.escHtml(t)}<button type="button" class="tag-remove" data-idx="${i}" aria-label="Remover tag">` +
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">` +
        `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
      chip.querySelector(".tag-remove").addEventListener("click", () => {
        tags.splice(i, 1); renderTags(); markDirty();
      });
      tagsWrap.insertBefore(chip, tagsInput);
    });
    if (tagsHidden) tagsHidden.value = JSON.stringify(tags);
  }

  // ── Photo ─────────────────────────────────────────────────────────────────
  function wirePhoto() {
    if (!photoZone) return;
    photoZone.addEventListener("dragover", e => { e.preventDefault(); photoZone.classList.add("dragover"); });
    photoZone.addEventListener("dragleave", () => photoZone.classList.remove("dragover"));
    photoZone.addEventListener("drop", e => {
      e.preventDefault(); photoZone.classList.remove("dragover");
      const f = e.dataTransfer?.files?.[0];
      if (f) handlePhotoFile(f);
    });
    photoInput?.addEventListener("change", () => {
      const f = photoInput.files?.[0];
      if (f) handlePhotoFile(f);
    });
    photoRemoveBtn?.addEventListener("click", e => { e.stopPropagation(); clearPhoto(); });
  }

  function handlePhotoFile(file) {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      SC.toastError("Formato inválido. Use JPG, PNG ou WebP."); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      SC.toastError("Imagem muito grande. Máximo 5 MB."); return;
    }
    const reader = new FileReader();
    reader.onload = ev => { photoDataUrl = ev.target.result; showPhotoPreview(photoDataUrl); markDirty(); };
    reader.readAsDataURL(file);
  }

  function showPhotoPreview(url) {
    if (photoPreview)     { photoPreview.src = url; photoPreview.classList.add("is-visible"); }
    if (photoRemoveBtn)   photoRemoveBtn.classList.add("is-visible");
    if (photoPlaceholder) photoPlaceholder.style.display = "none";
    if (photoUploadText)  photoUploadText.style.display  = "none";
    if (photoUploadHint)  photoUploadHint.style.display  = "none";
  }

  function clearPhoto() {
    photoDataUrl = null;
    if (photoPreview)     { photoPreview.src = ""; photoPreview.classList.remove("is-visible"); }
    if (photoRemoveBtn)   photoRemoveBtn.classList.remove("is-visible");
    if (photoPlaceholder) photoPlaceholder.style.display = "";
    if (photoUploadText)  photoUploadText.style.display  = "";
    if (photoUploadHint)  photoUploadHint.style.display  = "";
    if (photoInput)       photoInput.value = "";
    markDirty();
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  function wireSummarySync() {
    [productName, assetTag, quantity, estimatedValue].forEach(el =>
      el?.addEventListener("input", () => { updateSummary(); markDirty(); })
    );
    categoryId?.addEventListener("change", () => {
      populateBrands(categoryId.value, "");
      updateSummary(); markDirty();
    });
    brandId?.addEventListener("change", () => {
      populateModels(categoryId?.value || "", brandId.value, "");
      markDirty();
    });
    modelId?.addEventListener("change",   () => markDirty());
    locationId?.addEventListener("change",() => { updateSummary(); markDirty(); });
    condInputs.forEach(r => r.addEventListener("change", () => { updateSummary(); markDirty(); }));
    [description, notes].forEach(el => el?.addEventListener("input", () => markDirty()));
  }

  function updateSummary() {
    if (summaryName)     summaryName.textContent     = productName?.value.trim()  || "—";
    if (summaryAsset)    summaryAsset.textContent    = assetTag?.value.trim()     || "—";
    if (summaryQty)      summaryQty.textContent      = quantity?.value            || "1";
    if (summaryCategory) summaryCategory.textContent = categoryId?.value          || "—";
    if (summaryLocation) summaryLocation.textContent = locationId?.value          || "Sem localização";
    if (summaryCondition) {
      const val = [...condInputs].find(r => r.checked)?.value;
      summaryCondition.innerHTML = val ? SC.conditionBadge(COND_MAP[val] || "otimo") : "—";
    }
  }

  // ── Dirty guard ───────────────────────────────────────────────────────────
  function markDirty() { isDirty = true; }

  function wireUnsavedGuard() {
    window.addEventListener("beforeunload", e => {
      if (isDirty) { e.preventDefault(); e.returnValue = ""; }
    });

    document.querySelectorAll('a.btn-secondary[href="estoque.html"]').forEach(link => {
      link.addEventListener("click", e => {
        if (isDirty) { e.preventDefault(); pendingNav = "estoque.html"; SC.openModal("unsavedModal"); }
      });
    });

    document.querySelectorAll(".nav-item").forEach(link => {
      link.addEventListener("click", e => {
        if (isDirty) { e.preventDefault(); pendingNav = link.href; SC.openModal("unsavedModal"); }
      });
    });

    discardBtn?.addEventListener("click", () => {
      isDirty = false;
      SC.closeModal("unsavedModal");
      window.location.href = pendingNav || "estoque.html";
    });
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  function wireKeyboard() {
    document.addEventListener("keydown", e => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (validateForm()) saveItem();
      }
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    populateCategories();
    populateLocations();
    addCharCounter(productName, 200);
    addCharCounter(description, 1000);

    if (IS_EDIT) {
      document.title = "Editar Item — StockControl";
      if (pageTitle) pageTitle.textContent = "Editar Item";
      if (modeBadge) {
        modeBadge.innerHTML =
          `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">` +
          `<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>` +
          `<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar Item`;
      }
      document.querySelectorAll("#saveBtn, #saveBtn2").forEach(b => {
        const txt = b.querySelector("svg");
        b.textContent = "Salvar Alterações";
        if (txt) b.prepend(txt);
      });
      if (qrSection) qrSection.style.display = "block";
      loadItemForEdit();
    } else {
      if (assetTag) assetTag.value = genPatrimonio();
      updateSummary();
    }

    wirePhoto();
    wireTags();
    wireSummarySync();
    wireUnsavedGuard();
    wireKeyboard();

    form?.addEventListener("submit", e => {
      e.preventDefault();
      if (validateForm()) saveItem();
    });

    qrCopyBtn?.addEventListener("click", () => {
      const tok = qrTokenText?.textContent || "";
      if (navigator.clipboard) {
        navigator.clipboard.writeText(tok).then(() => SC.toastSuccess("Token copiado!"));
      } else {
        SC.toastInfo("Copie manualmente: " + tok);
      }
    });
  }

  init();
});
