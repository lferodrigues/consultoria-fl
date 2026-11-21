// Login da Área do Aluno — Firebase Authentication + Realtime Database
//
// Para onde cada pessoa vai depois de entrar:
//   - contato@fagnerlage.com.br  -> painel do administrador
//   - e-mail cadastrado no banco, ativo e no prazo -> área do aluno
//   - e-mail cadastrado mas desativado ou vencido   -> fica no login com aviso
//   - inscrição enviada, aguardando a primeira ficha -> área do aluno (tela de espera)
//   - e-mail que não está no banco                  -> página de planos
import {
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    GoogleAuthProvider,
    OAuthProvider,
    signInWithPopup,
    getAdditionalUserInfo,
    deleteUser,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { auth, db, ehAdmin, chaveEmail, hojeISO, PAGINAS } from "./firebase-app.js?v=2";

const google = new GoogleAuthProvider();
const apple = new OAuthProvider("apple.com");
apple.addScope("email");
apple.addScope("name");
apple.setCustomParameters({ locale: "pt_BR" });

// Elementos
const $ = (id) => document.getElementById(id);
const form = $("auth-form");
const emailInput = $("email");
const passInput = $("password");
const submitBtn = $("submit-btn");
const forgotBtn = $("forgot-btn");
const googleBtn = $("google-btn");
const appleBtn = $("apple-btn");
const message = $("message");
const loading = $("loading");
const logged = $("logged");

// Enquanto a janela do Google/Apple está aberta, quem decide o destino é o botão
// (ele sabe se a conta acabou de ser criada). Fora isso, decide o onAuthStateChanged.
let aguardandoPopup = false;
let verificando = false;

// Mensagens de erro do Firebase em português
const erros = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/missing-password": "Digite a sua senha.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/user-not-found": "Não existe conta com esse e-mail.",
    "auth/user-disabled": "Esta conta foi desativada.",
    "auth/too-many-requests": "Muitas tentativas. Espere um pouco e tente de novo.",
    "auth/popup-closed-by-user": "A janela de login foi fechada antes de terminar.",
    "auth/cancelled-popup-request": "A janela de login foi fechada antes de terminar.",
    "auth/popup-blocked": "O navegador bloqueou a janela de login. Libere os pop-ups e tente de novo.",
    "auth/operation-not-allowed": "Esse tipo de login ainda não está ativado.",
    "auth/account-exists-with-different-credential": "Esse e-mail já está cadastrado com outra forma de login. Entre com e-mail ou Google.",
    "auth/unauthorized-domain": "Este domínio não está autorizado no Firebase.",
    "auth/network-request-failed": "Sem conexão. Verifique sua internet."
};

function mostrar(texto, tipo = "error") {
    message.textContent = texto;
    message.className = "message " + tipo;
}

function carregando(sim) {
    loading.hidden = !sim;
    submitBtn.disabled = sim;
    googleBtn.disabled = sim;
    appleBtn.disabled = sim;
}

function tratarErro(e) {
    console.error(e);
    mostrar(erros[e.code] || "Não foi possível concluir. Tente novamente.");
}

function mostrarLogado(user) {
    if (PAGINAS.aluno) {
        window.location.href = PAGINAS.aluno;
        return;
    }
    $("auth-area").hidden = true;
    $("user-name").textContent = user.displayName || user.email;
    logged.hidden = false;
    mostrar("", "");
}

function mostrarFormulario() {
    $("auth-area").hidden = false;
    logged.hidden = true;
}

async function irParaPlanos(user, contaNova) {
    const email = user.email || "";
    // Conta criada agora pelo Google/Apple sem cadastro: apaga para não sobrar lixo no Firebase
    if (contaNova) {
        try { await deleteUser(user); } catch (e) { await signOut(auth); }
    } else {
        await signOut(auth);
    }
    window.location.href = PAGINAS.planos + "?nao-cadastrado=1&email=" + encodeURIComponent(email);
}

// Decide o destino de quem acabou de entrar
async function decidirDestino(user, contaNova = false) {
    if (verificando) return;
    verificando = true;

    if (ehAdmin(user)) {
        window.location.href = PAGINAS.admin;
        return;
    }

    carregando(true);
    try {
        const snap = await get(ref(db, "emails/" + chaveEmail(user.email)));
        const cadastro = snap.val();

        if (!cadastro) {
            // Já mandou a ficha de inscrição? Vai para a área do aluno, que mostra a tela de espera
            const inscricao = await get(ref(db, "inscricoes/" + user.uid)).catch(() => null);
            if (inscricao && inscricao.exists()) { mostrarLogado(user); return; }
            await irParaPlanos(user, contaNova);
            return;
        }
        if (cadastro.ativo === false) {
            await signOut(auth);
            mostrar("Seu acesso está desativado. Fale com o personal para liberar.");
            return;
        }
        if (cadastro.vencimento && cadastro.vencimento < hojeISO()) {
            await signOut(auth);
            mostrar("Seu plano venceu. Fale com o personal para renovar.");
            return;
        }
        mostrarLogado(user);
    } catch (e) {
        console.error(e);
        await signOut(auth);
        mostrar("Não foi possível verificar o seu cadastro. Tente novamente em instantes.");
    } finally {
        verificando = false;
        carregando(false);
    }
}

// Mostrar / esconder senha
$("toggle-pass").addEventListener("click", (ev) => {
    const visivel = passInput.type === "text";
    passInput.type = visivel ? "password" : "text";
    ev.currentTarget.innerHTML = visivel ? '<i class="fa-regular fa-eye"></i>' : '<i class="fa-regular fa-eye-slash"></i>';
});

// Entrar com e-mail (o destino é decidido no onAuthStateChanged)
form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const email = emailInput.value.trim();
    const senha = passInput.value;
    if (!email || !senha) return mostrar("Preencha e-mail e senha.");

    mostrar("", "");
    carregando(true);
    try {
        await signInWithEmailAndPassword(auth, email, senha);
    } catch (e) {
        tratarErro(e);
        carregando(false);
    }
});

// Entrar com Google ou Apple
async function entrarComProvedor(provedor) {
    mostrar("", "");
    carregando(true);
    aguardandoPopup = true;
    try {
        const resultado = await signInWithPopup(auth, provedor);
        const info = getAdditionalUserInfo(resultado);
        aguardandoPopup = false;
        await decidirDestino(resultado.user, !!(info && info.isNewUser));
    } catch (e) {
        aguardandoPopup = false;
        tratarErro(e);
        carregando(false);
    }
}

googleBtn.addEventListener("click", () => entrarComProvedor(google));
appleBtn.addEventListener("click", () => entrarComProvedor(apple));

// Esqueci a senha
forgotBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    if (!email) return mostrar("Digite o seu e-mail acima para receber o link.");
    carregando(true);
    try {
        await sendPasswordResetEmail(auth, email);
        mostrar("Enviamos um link para redefinir a senha no seu e-mail.", "ok");
    } catch (e) {
        tratarErro(e);
    } finally {
        carregando(false);
    }
});

// Sair
$("logout-btn").addEventListener("click", () => signOut(auth));

// Reage ao login / logout (inclui quem já estava logado ao abrir a página)
onAuthStateChanged(auth, (user) => {
    if (aguardandoPopup) return;
    if (user) {
        decidirDestino(user);
    } else {
        mostrarFormulario();
    }
});
