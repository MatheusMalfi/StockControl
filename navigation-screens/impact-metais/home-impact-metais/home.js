// home-impact-metais.js

document.addEventListener("DOMContentLoaded", () => {
    // Verifica se o usuário está logado (igual ao seu home.js)
    const rawUser = localStorage.getItem("sc_user");
    if (!rawUser) {
        return (window.location.href = "/acesso/login/login.html");
    }

    const user = JSON.parse(rawUser);

    // ADMIN acessa qualquer interface
    if (user.org_type !== 'RECYCLER' && user.role !== 'ADMIN') {
        // Redireciona para a Home da ONG caso a URL seja acessada incorretamente
        return (window.location.href = "/navigation-screens/home/home.html");
    }

    // Adicione aqui a lógica de carregamento de dados específica para o Impact Metais se necessário.
    // Exemplo: carregarListaDeONGsParaColeta();

    console.log("Usuário Impact Metais logado:", user.email);
});