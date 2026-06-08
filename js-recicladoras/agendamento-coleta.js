(function bootAgendamento() {
  if (!window.SC || !window.SC.ready) {
    document.addEventListener("sc:ready", bootAgendamento, { once: true });
    return;
  }

  const elements = {
    backToDetailsBtn: document.getElementById("backToDetailsBtn"),
    cancelScheduleBtn: document.getElementById("cancelScheduleBtn"),
    orderDisplay: document.getElementById("orderIdDisplay"),
    orderSummary: document.getElementById("orderIdSummary"),
    orgName: document.querySelector(".recycler-name"),
    orgSubtitle: document.getElementById("orgSubtitle"),
    orgInitial: document.querySelector(".recycler-avatar"),
    summaryOrg: document.getElementById("summaryOrg"),
    summaryItems: document.getElementById("summaryItems"),
    summaryWeight: document.getElementById("summaryWeight"),
    summaryQty: document.getElementById("summaryQty"),
    dateInput: document.getElementById("data-retirada"),
    obsInput: document.getElementById("observacoes"),
    obsGroup: document.getElementById("groupObservacoes"),
    obsError: document.getElementById("observacoesError"),
    form: document.getElementById("scheduleForm"),
  };

  let currentRequest = null;
  let currentRequests = [];

  function normalizeStatus(status) {
    return String(status || "").toLowerCase();
  }

  function getRequestIdsFromRoute() {
    const params = new URLSearchParams(window.location.search);
    return params.getAll("solicitacao_id").filter(Boolean);
  }

  function isRequestSchedulable(status) {
    const statusLower = normalizeStatus(status);
    return statusLower === "aprovada";
  }

  function setFieldError(groupEl, errorEl, message) {
    if (!groupEl || !errorEl) return;
    if (message) {
      groupEl.classList.add("has-error");
      errorEl.textContent = message;
    } else {
      groupEl.classList.remove("has-error");
      errorEl.textContent = "";
    }
  }

  function setFormDisabled(disabled) {
    if (!elements.form) return;

    elements.form
      .querySelectorAll("input, textarea, button[type='submit']")
      .forEach((el) => {
        el.disabled = disabled;
      });
  }

  function buildDetailsHref() {
    const requestIds = getRequestIdsFromRoute();
    const solId = requestIds[0];
    if (!solId || requestIds.length > 1) return "pedidos-recicladora.html";
    return `detalhes-pedido.html?solicitacao_id=${encodeURIComponent(solId)}`;
  }

  async function loadRequestData() {
    const requestIds = getRequestIdsFromRoute();

    if (!requestIds.length) {
      SC.toast("ID da solicitação não encontrado.", "error");
      return;
    }

    try {
      const requestsData = await Promise.all(
        requestIds.map((requestId) =>
          SC.api(`/solicitacoes/${requestId}/detalhes`),
        ),
      );

      currentRequests = requestsData.map((data) => ({
        solicitacao: data.solicitacao,
        items: data.items || [],
      }));
      currentRequest = currentRequests[0]?.solicitacao || null;

      const schedulableRequests = currentRequests.filter((request) =>
        isRequestSchedulable(request.solicitacao.status),
      );

      if (!schedulableRequests.length) {
        SC.toast(
          "Nenhuma solicitação aprovada disponível para agendamento.",
          "warning",
        );
        setFormDisabled(true);
      }

      const primaryRequest = currentRequest;
      const primaryOrgName = primaryRequest?.org_name || "Organização";
      const sameOrg = currentRequests.every(
        (request) =>
          (request.solicitacao.org_name || "Organização") === primaryOrgName,
      );
      const orderLabel =
        currentRequests.length === 1
          ? primaryRequest.id.substring(0, 8).toUpperCase()
          : `${currentRequests.length} pedidos`;

      if (elements.orderDisplay) {
        elements.orderDisplay.textContent = orderLabel;
      }
      if (elements.orderSummary) {
        elements.orderSummary.textContent = orderLabel;
      }

      if (elements.orgName) {
        elements.orgName.textContent = sameOrg
          ? primaryOrgName
          : `${currentRequests.length} ONGs`;
      }
      if (elements.orgSubtitle)
        elements.orgSubtitle.textContent = primaryRequest.org_email
          ? primaryRequest.org_email
          : "Empresa responsável pelo pedido";
      if (elements.orgInitial)
        elements.orgInitial.textContent = sameOrg
          ? primaryOrgName[0].toUpperCase()
          : String(currentRequests.length);
      if (elements.summaryOrg)
        elements.summaryOrg.textContent = sameOrg
          ? primaryOrgName
          : `${currentRequests.length} ONGs`;

      const allItems = currentRequests.flatMap((request) => request.items);
      const totalItems = allItems.length;
      const totalQty = allItems.reduce(
        (sum, item) => sum + (parseInt(item.quantity, 10) || 0),
        0,
      );
      const totalWeight = allItems.reduce((sum, item) => {
        const weight = parseFloat(item.weight_kg) || 0;
        const quantity = parseInt(item.quantity, 10) || 1;
        return sum + weight * quantity;
      }, 0);

      if (elements.summaryItems)
        elements.summaryItems.textContent = `${totalItems} itens`;
      if (elements.summaryQty)
        elements.summaryQty.textContent = `${totalQty} unidades`;
      if (elements.summaryWeight) {
        elements.summaryWeight.textContent = `${totalWeight.toLocaleString(
          "pt-BR",
          {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3,
          },
        )} kg`;
      }

      if (currentRequests.length > 1 && elements.backToDetailsBtn) {
        elements.backToDetailsBtn.textContent = "Voltar para pedidos";
      }

      if (currentRequests.length > 1 && elements.cancelScheduleBtn) {
        elements.cancelScheduleBtn.textContent = "Cancelar";
      }
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
      SC.toast("Erro ao carregar dados da solicitação.", "error");
    }
  }

  if (elements.dateInput) {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    elements.dateInput.min = today;
    elements.dateInput.value = today;
  }

  if (elements.backToDetailsBtn) {
    elements.backToDetailsBtn.onclick = () => {
      window.location.href = buildDetailsHref();
    };
  }

  if (elements.cancelScheduleBtn) {
    elements.cancelScheduleBtn.onclick = () => {
      window.location.href = buildDetailsHref();
    };
  }

  if (elements.form) {
    elements.form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const requestIds = getRequestIdsFromRoute();
      const date = elements.dateInput ? elements.dateInput.value : "";
      const obs = elements.obsInput ? elements.obsInput.value.trim() : "";

      if (!date) {
        SC.toast("Selecione a data de retirada.", "warning");
        return;
      }

      setFieldError(elements.obsGroup, elements.obsError, "");
      if (!obs) {
        setFieldError(
          elements.obsGroup,
          elements.obsError,
          "Informe observações à empresa.",
        );
        if (elements.obsInput) {
          elements.obsInput.focus();
        }
        return;
      }

      if (!currentRequests.length) {
        SC.toast("Solicitação não carregada.", "error");
        return;
      }

      const schedulableIds = currentRequests
        .filter((request) => isRequestSchedulable(request.solicitacao.status))
        .map((request) => request.solicitacao.id);

      if (!schedulableIds.length) {
        SC.toast(
          "Somente solicitações aprovadas podem ser agendadas.",
          "warning",
        );
        return;
      }

      try {
        await Promise.all(
          schedulableIds.map((requestId) =>
            SC.api(`/solicitacoes/${requestId}/agendar-coleta`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                data_coleta: date,
                obs,
              }),
            }),
          ),
        );

        SC.toast(
          schedulableIds.length === 1
            ? "Coleta agendada com sucesso!"
            : `${schedulableIds.length} coletas agendadas com sucesso!`,
          "success",
        );
        const year = new Date(`${date}T00:00:00`).getFullYear();
        setTimeout(() => {
          window.location.href = `recicladora.html?open_history=${year}`;
        }, 1500);
      } catch (err) {
        console.error("Erro ao agendar:", err);
        SC.toast("Falha ao salvar agendamento.", "error");
      }
    });
  }

  if (elements.obsInput) {
    elements.obsInput.addEventListener("input", () => {
      setFieldError(elements.obsGroup, elements.obsError, "");
    });
  }

  loadRequestData();
})();
