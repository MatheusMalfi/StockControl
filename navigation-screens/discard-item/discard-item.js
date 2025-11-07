// discard-item.js

document.addEventListener("DOMContentLoaded", () => {
  // Seleciona todos os elementos com a classe 'item'
  const items = document.querySelectorAll(".item");
  const discardButton = document.querySelector(".btn-discard button");

  // Função para verificar o estado da seleção
  function updateDiscardButtonState() {
    const selectedItems = document.querySelectorAll(".item.selected").length;
    // Desabilita o botão se não houver itens selecionados, habilita se houver.
    discardButton.disabled = selectedItems === 0;

    // (Opcional) Você pode mudar o texto do botão aqui também,
    // por exemplo, para "DESCARTAR (2)"
  }

  // Inicializa o estado do botão
  updateDiscardButtonState();

  // Adiciona o ouvinte de clique para cada item
  items.forEach((item) => {
    item.addEventListener("click", () => {
      // Alterna a classe 'selected'
      item.classList.toggle("selected");

      // Atualiza o estado do botão após a seleção
      updateDiscardButtonState();
    });
  });

  // Adiciona a lógica para o clique no botão DESCARTAR (a ser implementada depois)
  discardButton.addEventListener("click", () => {
    alert("Itens descartados com sucesso (em breve com lógica real)!");
    // Aqui viria a lógica real para remover os itens da lista
  });
});
