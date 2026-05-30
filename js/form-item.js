// ── Máscara BRL para Valor Estimado ─────────────────────────────────────
function maskBRLInput(input) {
  if (!input) return;
  input.addEventListener("input", function () {
    let v = input.value.replace(/\D/g, "");
    v = (parseInt(v, 10) || 0).toString();
    while (v.length < 3) v = "0" + v;
    let reais = v.slice(0, -2);
    let centavos = v.slice(-2);
    reais = reais.replace(/^0+/, "") || "0";
    reais = reais.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
    input.value = `R$ ${reais},${centavos}`;
  });
  input.addEventListener("blur", function () {
    if (!input.value) input.value = "R$ 0,00";
  });
}

("use strict");

(function bootstrap() {
  if (!window.SC || !window.SC.ready) {
    document.addEventListener("sc:ready", bootstrap, { once: true });
    return;
  }
  const params = SC.urlParams();
  const ITEM_ID = params.id || null;
  const IS_EDIT = Boolean(ITEM_ID);

  // ── Static data ───────────────────────────────────────────────────────────
  // Categorias carregadas dinamicamente da API (/api/categories)

  const LOCATIONS = [
    "Sala A01",
    "Sala A02",
    "Sala B12",
    "Almoxarifado",
    "Lab TI",
    "Ginásio",
    "Enfermaria",
    "Recepção",
    "Auditório",
  ];

  const BRAND_DATA = {
    Notebook: [
      "Dell",
      "Lenovo",
      "HP",
      "Apple",
      "Samsung",
      "Acer",
      "Asus",
      "Outros",
    ],
    Gabinete: ["Dell", "HP", "Corsair", "NZXT", "Cooler Master", "Outros"],
    Monitor: ["Dell", "LG", "Samsung", "AOC", "Philips", "BenQ", "Outros"],
    Periféricos: [
      "Logitech",
      "Microsoft",
      "HP",
      "Samsung",
      "Multilaser",
      "Outros",
    ],
    Outros: ["Outros"],
  };

  const MODEL_DATA = {
    Notebook: {
      Dell: ["Inspiron 15", "Latitude 5420", "Vostro 3510", "XPS 13"],
      Lenovo: ["ThinkPad E14", "IdeaPad 3", "ThinkCentre M720q"],
      HP: ["ProBook 450", "EliteBook 840", "Pavilion 15"],
      Apple: ["MacBook Air M2", 'MacBook Pro 14"', 'MacBook Pro 16"'],
      Samsung: ["Galaxy Book2", "Galaxy Book3"],
      Acer: ["Aspire 5", "Nitro 5", "Swift 3"],
      Asus: ["VivoBook 15", "ZenBook 14", "ExpertBook B1"],
    },
    Gabinete: {
      Dell: ["OptiPlex 3090", "OptiPlex 7090"],
      HP: ["ProDesk 400 G7", "EliteDesk 800 G6"],
      Corsair: ["4000D Airflow", "5000D"],
      NZXT: ["H510", "H710"],
      "Cooler Master": ["MasterBox Q300L", "HAF 500"],
    },
    Monitor: {
      Dell: ["P2422H", "U2722D", "S2722QC"],
      LG: ["24MK430H", "27UK850", "32UN880"],
      Samsung: ["S24F350", "C27F591", "LS27A600"],
      AOC: ["24B2XH", "Q27P2Q"],
      Philips: ["243V7", "273V7"],
      BenQ: ["GW2480", "PD2705Q"],
    },
    Periféricos: {
      Logitech: ["MK270 Teclado+Mouse", "M185 Mouse", "K380 Teclado"],
      Microsoft: ["Sculpt Ergonomic", "Arc Mouse"],
      HP: ["USB Business Slim Keyboard", "X1000 Mouse"],
      Multilaser: ["TC193 Combo", "MO300 Mouse"],
    },
    Outros: {},
  };

  const COND_MAP = { OTIMO: "otimo", REPARO: "reparo", DESCARTAR: "descartar" };
  const COND_REVERSE = {
    otimo: "OTIMO",
    bom: "OTIMO",
    reparo: "REPARO",
    ruim: "REPARO",
    descartar: "DESCARTAR",
  };

  // ── State ─────────────────────────────────────────────────────────────────
  let isDirty = false;
  let pendingNav = null;
  let photoDataUrl = null;
  let photoFile = null;
  const tags = [];

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const form = document.getElementById("itemForm");
  const itemIdField = document.getElementById("itemId");
  const pageTitle = document.getElementById("pageTitle");
  const modeBadge = document.getElementById("modeBadge");

  const productName = document.getElementById("productName");
  const assetTag = document.getElementById("assetTag");
  const categoryId = document.getElementById("categoryId");
  const brandId = document.getElementById("brandId");
  const modelId = document.getElementById("modelId");
  const description = document.getElementById("description");
  const condInputs = document.querySelectorAll('input[name="condition_code"]');
  const quantity = document.getElementById("quantity");
  const estimatedValue = document.getElementById("estimatedValue");
  const locationId = document.getElementById("locationId");
  const tagsWrap = document.getElementById("tagsWrap");
  const tagsInput = document.getElementById("tagsInput");
  const tagsHidden = document.getElementById("tagsHidden");
  const notes = document.getElementById("notes");

  const photoZone = document.getElementById("photoZone");
  const photoInput = document.getElementById("photoInput");
  const photoPreview = document.getElementById("photoPreview");
  const photoRemoveBtn = document.getElementById("photoRemoveBtn");
  const photoPlaceholder = document.getElementById("photoPlaceholder");
  const photoUploadText = document.getElementById("photoUploadText");
  const photoUploadHint = document.getElementById("photoUploadHint");

  const summaryName = document.getElementById("summaryName");
  const summaryCategory = document.getElementById("summaryCategory");
  const summaryCondition = document.getElementById("summaryCondition");
  const summaryQty = document.getElementById("summaryQty");
  const summaryLocation = document.getElementById("summaryLocation");
  const summaryAsset = document.getElementById("summaryAsset");

  const qrSection = document.getElementById("qrSection");
  const qrTokenText = document.getElementById("qrTokenText");
  const qrCopyBtn = document.getElementById("qrCopyBtn");
  const discardBtn = document.getElementById("discardChangesBtn");

  // ── Storage ───────────────────────────────────────────────────────────────
  function getItems() {
    try {
      return JSON.parse(
        localStorage.getItem(SC.storageKey("sc_items")) || "[]",
      );
    } catch {
      return [];
    }
  }
  function saveItems(items) {
    localStorage.setItem(SC.storageKey("sc_items"), JSON.stringify(items));
  }

  function _syncToBackend(item, isEdit) {
    const token =
      localStorage.getItem("sc_token") || sessionStorage.getItem("sc_token");
    const user =
      JSON.parse(
        localStorage.getItem("sc_user") ||
          sessionStorage.getItem("sc_user") ||
          "{}",
      ) || {};
    if (!token || !user.organization_id) return;

    const COND_CODE = {
      otimo: "OTIMO",
      bom: "OTIMO",
      reparo: "REPARO",
      ruim: "REPARO",
      descartar: "DESCARTAR",
    };

    if (isEdit && item._backend_id) {
      fetch(`/api/items/${item._backend_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          organization_id: user.organization_id,
          produto: item.nome,
          marca: item.marca || null,
          modelo: item.modelo || null,
          descricao: item.descricao || null,
          status: COND_CODE[item.condicao] || "OTIMO",
        }),
      }).catch(() => {});
    } else if (!isEdit) {
      const fd = new FormData();
      fd.append("organization_id", user.organization_id);
      fd.append("product_name", item.nome);
      if (item.marca) fd.append("product_brand", item.marca);
      if (item.modelo) fd.append("product_model", item.modelo);
      if (item.patrimonio) fd.append("serial_number", item.patrimonio);
      if (item.descricao) fd.append("description", item.descricao);
      fd.append("condition_code", COND_CODE[item.condicao] || "OTIMO");
      if (item.categoria) fd.append("category_name", item.categoria);
      fd.append("quantity", item.total ?? 1);
      if (item.valor) fd.append("estimated_value", item.valor);
      const uid = user.user_id || user.id;
      if (uid) fd.append("created_by", uid);

      if (item.foto && item.foto.startsWith("data:")) {
        try {
          const [header, b64] = item.foto.split(",");
          const mime = header.match(/:(.*?);/)[1];
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          fd.append("photo", new Blob([bytes], { type: mime }), "photo.jpg");
        } catch (_) {}
      }

      fetch("/api/items", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.item_id) {
            const all = getItems();
            const idx = all.findIndex((i) => i.id === item.id);
            if (idx !== -1) {
              all[idx]._backend_id = data.item_id;
              saveItems(all);
            }
          }
        })
        .catch(() => {});
    }
  }

  // ── Auto-patrimônio ───────────────────────────────────────────────────────
  function genPatrimonio() {
    const year = new Date().getFullYear();
    const prefix = `PAT-${year}-`;
    const used = new Set(
      getItems()
        .map((i) => i.patrimonio || "")
        .filter((p) => p.startsWith(prefix))
        .map((p) => parseInt(p.slice(prefix.length), 10))
        .filter((n) => !isNaN(n)),
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

  // ── Local storage helpers ─────────────────────────────────────────────────
  function mergeUniqueStrings(list) {
    const seen = new Set();
    return list
      .map((value) => String(value || "").trim())
      .filter((value) => {
        if (!value) return false;
        const key = value.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function readStoredCategories() {
    try {
      const data = JSON.parse(localStorage.getItem("sc_categorias") || "{}");
      if (!Array.isArray(data.categorias)) return [];
      return data.categorias.map((c) => c.nome || "").filter(Boolean);
    } catch {
      return [];
    }
  }

  function readStoredBrands() {
    try {
      const data = JSON.parse(localStorage.getItem("sc_categorias") || "{}");
      if (!Array.isArray(data.marcas)) return [];
      return data.marcas.map((m) => m.nome || m || "").filter(Boolean);
    } catch {
      return [];
    }
  }

  // ── Populate dropdowns ────────────────────────────────────────────────────
  function populateCategories(categories) {
    if (!categoryId) return;
    categoryId.innerHTML =
      '<option value="">Selecione…</option>' +
      categories
        .map(
          (c) => `<option value="${SC.escHtml(c)}">${SC.escHtml(c)}</option>`,
        )
        .join("");
  }

  function populateLocations() {
    if (!locationId) return;
    locationId.innerHTML =
      '<option value="">Sem localização</option>' +
      LOCATIONS.map(
        (l) => `<option value="${SC.escHtml(l)}">${SC.escHtml(l)}</option>`,
      ).join("");
  }

  function populateBrands(cat, selectedBrand) {
    if (!brandId) return;
    const storedBrands = readStoredBrands();
    const staticBrands = BRAND_DATA[cat] || [];
    const brands = mergeUniqueStrings([...staticBrands, ...storedBrands]);
    brandId.innerHTML =
      '<option value="">Selecione…</option>' +
      brands
        .map(
          (b) =>
            `<option value="${SC.escHtml(b)}"${b === selectedBrand ? " selected" : ""}>${SC.escHtml(b)}</option>`,
        )
        .join("");
    brandId.disabled = !brands.length;
  }

  function populateModels() {
    // Campo de modelo agora é digitável manualmente.
  }

  // ── Edit: load item ───────────────────────────────────────────────────────
  function loadItemForEdit() {
    const token =
      localStorage.getItem("sc_token") || sessionStorage.getItem("sc_token");
    fetch(`/api/items/${ITEM_ID}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.success || !data.item) {
          SC.toastError("Item não encontrado.");
          setTimeout(() => {
            window.location.href = "estoque.html";
          }, 1500);
          return;
        }
        const a = data.item;
        // Mapeia schema da API → schema legado esperado por fillForm()
        const condCodeToLegacy = {
          OTIMO: "otimo",
          REPARO: "reparo",
          DESCARTAR: "descartar",
        };
        const item = {
          id: a.id,
          _backend_id: a.id,
          nome: a.product_name || "",
          patrimonio: a.serial_number || "",
          descricao: a.description || "",
          total: a.quantity ?? 1,
          valor: a.estimated_value || "",
          condicao: condCodeToLegacy[a.condition_code] || "otimo",
          categoria: a.category_name || "",
          marca: a.product_brand || a.brand || "",
          modelo: a.product_model || a.model || "",
          localizacao: a.localizacao || "",
          notas: "",
          tags: [],
          foto: a.photo_url || null,
        };
        fillForm(item);
      })
      .catch(() => {
        SC.toastError("Erro ao carregar item.");
        setTimeout(() => {
          window.location.href = "estoque.html";
        }, 1500);
      });
  }

  function fillForm(item) {
    if (itemIdField) itemIdField.value = item.id || "";
    if (productName) productName.value = item.nome || "";
    if (assetTag) assetTag.value = item.patrimonio || "";
    if (description) description.value = item.descricao || "";
    if (quantity) quantity.value = item.total ?? 1;
    if (estimatedValue) estimatedValue.value = item.valor || "";
    if (notes) notes.value = item.notas || "";

    if (categoryId && item.categoria) {
      // Se as categorias ainda não foram carregadas da API, guarda para aplicar depois
      if (categoryId.options.length <= 1) {
        categoryId.dataset.pendingValue = item.categoria;
        categoryId.dataset.pendingBrand = item.marca || "";
        categoryId.dataset.pendingModel = item.modelo || "";
      } else {
        categoryId.value = item.categoria;
        populateBrands(item.categoria, item.marca || "");
        if (modelId) modelId.value = item.modelo || "";
      }
    }
    if (locationId && item.localizacao) locationId.value = item.localizacao;

    const condValue = COND_REVERSE[item.condicao] || "OTIMO";
    condInputs.forEach((r) => {
      r.checked = r.value === condValue;
    });

    if (Array.isArray(item.tags)) {
      tags.length = 0;
      item.tags.forEach((t) => tags.push(t));
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
    if (err) {
      err.textContent = msg || err.textContent;
      err.style.display = show ? "block" : "";
    }
    grp?.classList.toggle("has-error", show);
  }

  function validateForm() {
    let valid = true;
    let firstBad = null;

    // Nome (required, min 3)
    const nameVal = productName?.value.trim() || "";
    const nameOk = nameVal.length >= 3;
    setFieldError(
      "errorProductName",
      "groupProductName",
      nameVal.length === 0
        ? "Informe o nome do item."
        : "Nome deve ter pelo menos 3 caracteres.",
      !nameOk,
    );
    if (!nameOk) {
      valid = false;
      firstBad = firstBad || productName;
    }

    // Categoria
    const catOk = Boolean(categoryId?.value);
    setFieldError("errorCategory", "groupCategory", null, !catOk);
    if (!catOk) {
      valid = false;
      firstBad = firstBad || categoryId;
    }

    // Marca
    const brandOk = Boolean(brandId?.value);
    setFieldError("errorBrand", "groupBrand", null, !brandOk);
    if (!brandOk) {
      valid = false;
      firstBad = firstBad || brandId;
    }

    // Condição
    const condOk = [...condInputs].some((r) => r.checked);
    setFieldError("errorCondition", "groupCondition", null, !condOk);
    if (!condOk) valid = false;

    // Quantidade
    const qtyVal = parseInt(quantity?.value);
    const qtyOk = !isNaN(qtyVal) && qtyVal >= 1;
    setFieldError("errorQty", "groupQty", null, !qtyOk);
    if (!qtyOk) {
      valid = false;
      firstBad = firstBad || quantity;
    }

    // Patrimônio uniqueness (apenas no cadastro; no modo edição o servidor valida)
    const patVal = assetTag?.value.trim() || "";
    if (valid && patVal && !IS_EDIT) {
      const conflict = getItems().find(
        (i) =>
          i.patrimonio === patVal &&
          String(i.id) !== String(ITEM_ID) &&
          String(i._backend_id) !== String(ITEM_ID),
      );
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
      [btn1, btn2].forEach((b) => {
        if (!b) return;
        b.disabled = on;
        b.classList.toggle("loading", on);
      });
    };

    setLoading(true);

    const condValue = [...condInputs].find((r) => r.checked)?.value || "OTIMO";
    const now = new Date().toISOString();
    const items = getItems();
    const qty = parseInt(quantity?.value) || 1;

    try {
      if (IS_EDIT) {
        const token =
          localStorage.getItem("sc_token") ||
          sessionStorage.getItem("sc_token");
        const user =
          JSON.parse(
            localStorage.getItem("sc_user") ||
              sessionStorage.getItem("sc_user") ||
              "{}",
          ) || {};

        const formData = new FormData();
        formData.append("organization_id", user.organization_id || "");
        formData.append("produto", productName?.value.trim() || "");
        if (assetTag?.value?.trim()) {
          formData.append("serial_number", assetTag.value.trim());
        }
        if (categoryId?.value) {
          formData.append("categoria", categoryId.value);
        }
        if (brandId?.value) {
          formData.append("marca", brandId.value);
        }
        if (modelId?.value) {
          formData.append("modelo", modelId.value);
        }
        if (description?.value?.trim()) {
          formData.append("descricao", description.value.trim());
        }
        formData.append("status", condValue);
        formData.append("quantidade", String(qty));
        if (estimatedValue?.value) {
          formData.append("valor", String(parseFloat(estimatedValue.value)));
        }
        formData.append("localizacao", locationId?.value || "");
        if (notes?.value?.trim()) {
          formData.append("notas", notes.value.trim());
        }
        if (photoFile) {
          formData.append("photo", photoFile);
        }

        fetch(`/api/items/${ITEM_ID}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        })
          .then((r) => r.json())
          .then((data) => {
            if (!data.success) throw new Error(data.message || "Erro");
            isDirty = false;
            SC.toastSuccess("Item atualizado com sucesso!");
            setTimeout(() => {
              window.location.href = "estoque.html";
            }, 900);
          })
          .catch(() => {
            SC.toastError("Erro ao salvar item.");
            setLoading(false);
          });
        return; // fluxo assíncrono
      } else {
        const newId =
          "item_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
        items.push({
          id: newId,
          nome: productName?.value.trim() || "",
          patrimonio: assetTag?.value.trim() || genPatrimonio(),
          categoria: categoryId?.value || "",
          marca: brandId?.value || "",
          modelo: modelId?.value || "",
          descricao: description?.value.trim() || "",
          condicao: COND_MAP[condValue] || "otimo",
          total: qty,
          disponivel: qty,
          valor: parseFloat(estimatedValue?.value) || 0,
          localizacao: locationId?.value || "",
          responsavel: "",
          tags: [...tags],
          notas: notes?.value.trim() || "",
          foto: photoDataUrl || null,
          created_at: now,
          updated_at: now,
        });
        saveItems(items);
        _syncToBackend(items[items.length - 1], false);
        isDirty = false;
        SC.toastSuccess("Item cadastrado com sucesso!");
      }
      setTimeout(() => {
        window.location.href = "estoque.html";
      }, 900);
    } catch (err) {
      SC.toastError("Erro ao salvar item.");
      setLoading(false);
    }
  }

  // ── Tags ──────────────────────────────────────────────────────────────────
  function wireTags() {
    if (!tagsInput) return;
    tagsWrap?.addEventListener("click", () => tagsInput.focus());
    tagsInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        addTag(tagsInput.value);
        tagsInput.value = "";
      }
      if (e.key === "Backspace" && !tagsInput.value && tags.length) {
        tags.pop();
        renderTags();
        markDirty();
      }
    });
    tagsInput.addEventListener("blur", () => {
      if (tagsInput.value.trim()) {
        addTag(tagsInput.value);
        tagsInput.value = "";
      }
    });
  }

  function addTag(raw) {
    const val = raw.replace(/,/g, "").trim();
    if (val && !tags.includes(val) && tags.length < 15) {
      tags.push(val);
      renderTags();
      markDirty();
    }
  }

  function renderTags() {
    if (!tagsWrap || !tagsInput) return;
    tagsWrap.querySelectorAll(".tag-chip").forEach((el) => el.remove());
    tags.forEach((t, i) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.innerHTML =
        `${SC.escHtml(t)}<button type="button" class="tag-remove" data-idx="${i}" aria-label="Remover tag">` +
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">` +
        `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
      chip.querySelector(".tag-remove").addEventListener("click", () => {
        tags.splice(i, 1);
        renderTags();
        markDirty();
      });
      tagsWrap.insertBefore(chip, tagsInput);
    });
    if (tagsHidden) tagsHidden.value = JSON.stringify(tags);
  }

  // ── Photo ─────────────────────────────────────────────────────────────────
  function wirePhoto() {
    if (!photoZone) return;
    photoZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      photoZone.classList.add("dragover");
    });
    photoZone.addEventListener("dragleave", () =>
      photoZone.classList.remove("dragover"),
    );
    photoZone.addEventListener("drop", (e) => {
      e.preventDefault();
      photoZone.classList.remove("dragover");
      const f = e.dataTransfer?.files?.[0];
      if (f) handlePhotoFile(f);
    });
    photoInput?.addEventListener("change", () => {
      const f = photoInput.files?.[0];
      if (f) handlePhotoFile(f);
    });
    photoRemoveBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      clearPhoto();
    });
  }

  function handlePhotoFile(file) {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      SC.toastError("Formato inválido. Use JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      SC.toastError("Imagem muito grande. Máximo 5 MB.");
      return;
    }
    photoFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      photoDataUrl = ev.target.result;
      showPhotoPreview(photoDataUrl);
      markDirty();
    };
    reader.readAsDataURL(file);
  }

  function showPhotoPreview(url) {
    if (photoPreview) {
      photoPreview.src = url;
      photoPreview.classList.add("is-visible");
    }
    if (photoRemoveBtn) photoRemoveBtn.classList.add("is-visible");
    if (photoPlaceholder) photoPlaceholder.style.display = "none";
    if (photoUploadText) photoUploadText.style.display = "none";
    if (photoUploadHint) photoUploadHint.style.display = "none";
  }

  function clearPhoto() {
    photoDataUrl = null;
    photoFile = null;
    if (photoPreview) {
      photoPreview.src = "";
      photoPreview.classList.remove("is-visible");
    }
    if (photoRemoveBtn) photoRemoveBtn.classList.remove("is-visible");
    if (photoPlaceholder) photoPlaceholder.style.display = "";
    if (photoUploadText) photoUploadText.style.display = "";
    if (photoUploadHint) photoUploadHint.style.display = "";
    if (photoInput) photoInput.value = "";
    markDirty();
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  function wireSummarySync() {
    [productName, assetTag, quantity, estimatedValue].forEach((el) =>
      el?.addEventListener("input", () => {
        updateSummary();
        markDirty();
      }),
    );
    categoryId?.addEventListener("change", () => {
      setFieldError("errorCategory", "groupCategory", null, false);
      populateBrands(categoryId.value, "");
      updateSummary();
      markDirty();
    });
    brandId?.addEventListener("change", () => {
      setFieldError("errorBrand", "groupBrand", null, false);
      markDirty();
    });
    modelId?.addEventListener("change", () => markDirty());
    locationId?.addEventListener("change", () => {
      updateSummary();
      markDirty();
    });
    condInputs.forEach((r) =>
      r.addEventListener("change", () => {
        updateSummary();
        markDirty();
      }),
    );
    [description, notes].forEach((el) =>
      el?.addEventListener("input", () => markDirty()),
    );
  }

  function updateSummary() {
    if (summaryName) summaryName.textContent = productName?.value.trim() || "—";
    if (summaryAsset) summaryAsset.textContent = assetTag?.value.trim() || "—";
    if (summaryQty) summaryQty.textContent = quantity?.value || "1";
    if (summaryCategory) summaryCategory.textContent = categoryId?.value || "—";
    if (summaryLocation)
      summaryLocation.textContent = locationId?.value || "Sem localização";
    if (summaryCondition) {
      const val = [...condInputs].find((r) => r.checked)?.value;
      summaryCondition.innerHTML = val
        ? SC.conditionBadge(COND_MAP[val] || "otimo")
        : "—";
    }
  }

  // ── Dirty guard ───────────────────────────────────────────────────────────
  function markDirty() {
    isDirty = true;
  }

  function wireUnsavedGuard() {
    document
      .querySelectorAll('a.btn-secondary[href="estoque.html"]')
      .forEach((link) => {
        link.addEventListener("click", (e) => {
          if (isDirty) {
            e.preventDefault();
            pendingNav = "estoque.html";
            SC.openModal("unsavedModal");
          }
        });
      });

    document.querySelectorAll(".nav-item").forEach((link) => {
      link.addEventListener("click", (e) => {
        if (isDirty) {
          e.preventDefault();
          pendingNav = link.href;
          SC.openModal("unsavedModal");
        }
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
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (validateForm()) saveItem();
      }
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    // Carrega categorias da API
    const token =
      localStorage.getItem("sc_token") || sessionStorage.getItem("sc_token");
    fetch("/api/categories", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const apiCats = (data.categories || [])
          .map((c) => c.name)
          .filter(Boolean);
        const storedCats = readStoredCategories();
        const cats = mergeUniqueStrings([...storedCats, ...apiCats]);
        populateCategories(
          cats.length ? cats : storedCats.length ? storedCats : ["Outros"],
        );
        // Se já carregou o item (edição), re-aplica a categoria
        if (IS_EDIT && categoryId && categoryId.dataset.pendingValue) {
          categoryId.value = categoryId.dataset.pendingValue;
          populateBrands(
            categoryId.value,
            categoryId.dataset.pendingBrand || "",
          );
          if (modelId) modelId.value = categoryId.dataset.pendingModel || "";
          delete categoryId.dataset.pendingValue;
          delete categoryId.dataset.pendingBrand;
          delete categoryId.dataset.pendingModel;
        }
      })
      .catch(() => {
        const storedCats = readStoredCategories();
        populateCategories(storedCats.length ? storedCats : ["Outros"]);
      });

    populateLocations();
    addCharCounter(productName, 200);
    addCharCounter(description, 1000);

    // Aplica máscara BRL ao campo de valor estimado
    maskBRLInput(estimatedValue);

    // Remove máscara ao enviar o formulário
    if (form && estimatedValue) {
      form.addEventListener("submit", function () {
        if (estimatedValue.value) {
          estimatedValue.value = estimatedValue.value
            .replace(/[^\d,]/g, "")
            .replace(",", ".");
        }
      });
    }

    if (IS_EDIT) {
      document.title = "Editar Item — StockControl";
      if (pageTitle) pageTitle.textContent = "Editar Item";
      if (modeBadge) {
        modeBadge.innerHTML =
          `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">` +
          `<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>` +
          `<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar Item`;
      }
      document.querySelectorAll("#saveBtn, #saveBtn2").forEach((b) => {
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

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      if (validateForm()) saveItem();
    });

    qrCopyBtn?.addEventListener("click", () => {
      const tok = qrTokenText?.textContent || "";
      if (navigator.clipboard) {
        navigator.clipboard
          .writeText(tok)
          .then(() => SC.toastSuccess("Token copiado!"));
      } else {
        SC.toastInfo("Copie manualmente: " + tok);
      }
    });
  }

  init();
})();
