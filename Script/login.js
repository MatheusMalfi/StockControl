document.addEventListener("DOMContentLoaded", function () {
    const form2 = document.getElementById('loginForm');

    form2.addEventListener("submit", async (e) => {
        e.preventDefault();
        console.log("Submit interceptado");
        
        const email = document.getElementById('email').value;
        const senha = document.getElementById('senha').value;

        try{
        const response = await fetch('http://localhost:3306/api/login', {
            method: "POST",
            headers:{
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({email, senha})
        });

        const respostaLog = await response.json();
        console.log("Resposta do servidor: ", respostaLog);

        if(respostaLog.success){
            window.location.href = 'index.html';
        } else{
            alert("E-mail ou senha invalidos.");}
        }catch(erro){
            console.error("Error ao enviar: ", erro);
            alert("Erro ao realizar Login.");
        }
    });
});