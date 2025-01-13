function enviarWhatsApp() {
    var nome = document.getElementById("nome").value;
    var sobrenome = document.getElementById("sobrenome").value;
    var email = document.getElementById("email").value;
    var telefone = "32998528266";
    var mensagem = `Olá, meu nome é ${nome} ${sobrenome}, e meu email é: ${email}. Gostaria de saber mais sobre a consultoria anual.`;
    var link = `https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`;
    window.open(link, '_blank');
}
function enviarWhatsApp_consultoria() {
    var nome = document.getElementById("nome").value;
    var sobrenome = document.getElementById("sobrenome").value;
    var email = document.getElementById("email").value;
    var telefone = "32998528266";
    var mensagem = `Olá, meu nome é ${nome} ${sobrenome}, e meu email é: ${email}.Gostaria de saber mais sobre a consultoria semestral.`;
    var link = `https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`;
    window.open(link, '_blank');
}
function enviarWhatsApp_mentoria() {
    var nome = document.getElementById("nome").value;
    var sobrenome = document.getElementById("sobrenome").value;
    var email = document.getElementById("email").value;
    var telefone = "32998528266";
    var mensagem = `Olá, meu nome é ${nome} ${sobrenome}, e meu email é: ${email}. Gostaria de saber mais sobre a consultoria trimestral.`;
    var link = `https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`;
    window.open(link, '_blank');
}
