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
    orgInitial: document.querySelector(".recycler-avatar"),
    summaryOrg: document.querySelectorAll(".summary-value")[1],
    summaryItems: document.querySelectorAll(".summary-value")[2],
    summaryWeight: document.querySelectorAll(".summary-value")[3],
    summaryQty: document.querySelectorAll(".summary-value")[4],
    dateInput: document.getElementById("data-retirada"),
    obsInput: document.getElementById("observacoes"),
    form: document.getElementById("scheduleForm"),
  };

  let currentRequest = null;

  function normalizeStatus(status) {
    return String(status || "").toLowerCase();
  }

  function buildDetailsHref() {
    const solId = new URLSearchParams(window.location.search).get(
      "solicitacao_id",
    );
    if (!solId) return "detalhes-pedido.html";
    return `detalhes-pedido.html?solicitacao_id=${encodeURIComponent(solId)}`;
  }

  async function loadRequestData() {
    const params = new URLSearchParams(window.location.search);
    const solId = params.get("solicitacao_id");

    if (!solId) {
      SC.toast("ID da solicitação não encontrado.", "error");
      return;
    }

    try {
      const data = await SC.api(`/solicitacoes/${solId}/detalhes`);
      const sol = data.solicitacao;
      const items = data.items || [];
      currentRequest = sol;

      const statusLower = normalizeStatus(sol.status);
      const isSchedulable =
        statusLower === "concluida" || statusLower === "concluída";

      if (!isSchedulable && elements.form) {
        SC.toast(
          "Esta solicitação não está com status concluída e não pode ser agendada.",
          "warning",
        );
        elements.form
          .querySelectorAll("input, textarea, button[type='submit']")
          .forEach((el) => {
            el.disabled = true;
          });
      }

      if (elements.orderDisplay) {
        elements.orderDisplay.textContent = sol.id
          .substring(0, 8)
          .toUpperCase();
      }
      if (elements.orderSummary) {
        elements.orderSummary.textContent = sol.id
          .substring(0, 8)
          .toUpperCase();
      }

      const orgName = sol.org_name || "Organização";
      if (elements.orgName) elements.orgName.textContent = orgName;
      if (elements.orgInitial)
        elements.orgInitial.textContent = orgName[0].toUpperCase();
      if (elements.summaryOrg) elements.summaryOrg.textContent = orgName;

      const totalItems = items.length;
      const totalQty = items.reduce(
        (sum, item) => sum + (parseInt(item.quantity, 10) || 0),
        0,
      );
      const totalWeight = items.reduce((sum, item) => {
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
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
      SC.toast("Erro ao carregar dados da solicitação.", "error");
    }
  }

  if (elements.dateInput) {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    elements.dateInput.min = today;
    elements.dateInput.value = tomorrow.toISOString().split("T")[0];
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

      const solId = new URLSearchParams(window.location.search).get(
        "solicitacao_id",
      );
      const date = elements.dateInput ? elements.dateInput.value : "";
      const obs = elements.obsInput ? elements.obsInput.value.trim() : "";

      if (!date) {
        SC.toast("Selecione a data de retirada.", "warning");
        return;
      }

      if (!currentRequest) {
        SC.toast("Solicitação não carregada.", "error");
        return;
      }

      const statusLower = normalizeStatus(currentRequest.status);
      if (statusLower !== "concluida" && statusLower !== "concluída") {
        SC.toast(
          "Somente solicitações concluídas podem ser agendadas.",
          "warning",
        );
        return;
      }

      try {
        await SC.api(`/solicitacoes/${solId}/agendar-coleta`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            data_coleta: date,
            obs,
          }),
        });

        SC.toast("Coleta agendada com sucesso!", "success");
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

  loadRequestData();
})();
