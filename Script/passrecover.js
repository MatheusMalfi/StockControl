
document.getElementById("recoverPass").addEventListener("submit", async(e) =>{
    e.preventDefault();
    const email = e.target.email.value;
    const confirm_email = e.target.confirm_email.value;

    if(email != confirm_email){
        alert("Os e-mail não coincidem.")
        return;
    }

    const res = await fetch("/api/passrecover",{
        method: "POST",
        body: JSON.stringify({email}),
        headers: {"Content-Type": "application/json"}
    });

    const data = await res.json();
    alert(data.message);
});