
//joga dados de registo pro server em forma json

    document.addEventListener("DOMContentLoaded", function () {
        const form1 = document.getElementById("ongRegister");
        if (!form1) return;

        form1.addEventListener("submit", function (prevDef) {
            prevDef.preventDefault();

            const formData = new FormData(this);
            const dados = Object.fromEntries(formData.entries());

            if (dados.email !== dados.email_confirm) {
                alert("Os e-mails não coincidem!");
                return;
            }

            if (dados.senha !== dados.senha_confirm) {
                alert("As senhas não coincidem!");
                return;
            }

        delete dados.email_confirm;
        delete dados.senha_confirm;

        fetch("http://localhost:3306/api/cadastro", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(dados)
        })
            .then(async (response) =>{
                const resposta = await response.json();

                if(!response.ok){
                    alert(`Erro: ${resposta.erro}`);
                    return;
                }

                alert("Cadastro realizado com sucesso!");
                window.location.href = 'login.html'
            })
            .catch(err => {
                console.error("Error ao enviar: ", err);
                alert("Erro ao cadastrar.");
            });
            
    })
});