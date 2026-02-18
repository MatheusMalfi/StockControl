// Função para obter parâmetros da URL
function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

document.addEventListener('DOMContentLoaded', () => {
  // Pega o nome da ONG da URL (?ong=JEDA)
  const ong = getQueryParam('ong');
  const h4 = document.querySelector('.ong-container h4');
  const painelExterno = document.querySelector('.painel-externo');
  if (!ong) {
    if (painelExterno) painelExterno.style.display = 'none';
    const erro = document.createElement('div');
    erro.style.color = '#ff2d2d';
    erro.style.textAlign = 'center';
    erro.style.fontSize = '1.5rem';
    erro.style.marginTop = '60px';
    erro.textContent = 'Erro: Nenhuma ONG selecionada. Volte e selecione uma ONG.';
    document.body.appendChild(erro);
    return;
  }
  // Atualiza o nome na tela
  if (h4) h4.textContent = ong;
});
