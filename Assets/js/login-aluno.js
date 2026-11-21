// Login da Área do Aluno — Firebase Authentication (e-mail/senha e Google)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    sendPasswordResetEmail,
    GoogleAuthProvider,
    signInWithPopup,
    getAdditionalUserInfo,
    deleteUser,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyALkfMd9sTok0tuFgRmDkqgK6NCh4kAGr0",
    authDomain: "flconsultoria.firebaseapp.com",
    databaseURL: "https://flconsultoria-default-rtdb.firebaseio.com",
    projectId: "flconsultoria",
    storageBucket: "flconsultoria.firebasestorage.app",
    messagingSenderId: "907260382682",
    appId: "1:907260382682:web:b456647534f5b58df444e3",
    measurementId: "G-7GPBGL18YG"
};

// Página para onde o aluno vai depois de entrar.
// Deixe vazio ("") para apenas mostrar a mensagem de boas-vindas nesta tela.
const REDIRECIONAR_PARA = "";

// Página de planos, para quem entra com um Google que ainda não está cadastrado.
const PAGINA_PLANOS = "./planos.html";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = "pt";
const google = new GoogleAuthProvider();

// Elementos
const $ = (id) => document.getElementById(id);
const form = $("auth-form");
const nameField = $("field-name");
const nameInput = $("name");
const emailInput = $("email");
const passInput = $("password");
const submitBtn = $("submit-btn");
const forgotBtn = $("forgot-btn");
const googleBtn = $("google-btn");
const switchBtn = $("switch-btn");
const switchText = $("switch-text");
const message = $("message");
const loading = $("loading");
const logged = $("logged");

let modoCadastro = false;
let verificandoGoogle = false; // evita mostrar "logado" enquanto checa o cadastro

// Mensagens de erro do Firebase em português
const erros = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/missing-password": "Digite a sua senha.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/user-not-found": "Não existe conta com esse e-mail.",
    "auth/email-already-in-use": "Já existe uma conta com esse e-mail.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Espere um pouco e tente de novo.",
    "auth/popup-closed-by-user": "A janela do Google foi fechada antes de terminar.",
    "auth/popup-blocked": "O navegador bloqueou a janela do Google. Libere os pop-ups e tente de novo.",
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
}

function tratarErro(e) {
    console.error(e);
    mostrar(erros[e.code] || "Não foi possível concluir. Tente novamente.");
}

// Alterna entre "Entrar" e "Criar conta"
switchBtn.addEventListener("click", () => {
    modoCadastro = !modoCadastro;
    nameField.hidden = !modoCadastro;
    forgotBtn.hidden = modoCadastro;
    submitBtn.textContent = modoCadastro ? "Criar conta" : "Entrar";
    $("title").textContent = modoCadastro ? "Criar conta" : "Entrar";
    switchText.textContent = modoCadastro ? "Já tem conta?" : "Ainda não tem conta?";
    switchBtn.textContent = modoCadastro ? "Entrar" : "Criar conta";
    passInput.autocomplete = modoCadastro ? "new-password" : "current-password";
    mostrar("", "");
});

// Mostrar / esconder senha
$("toggle-pass").addEventListener("click", (ev) => {
    const visivel = passInput.type === "text";
    passInput.type = visivel ? "password" : "text";
    ev.currentTarget.innerHTML = visivel ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>';
});

// Entrar ou cadastrar com e-mail
form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const email = emailInput.value.trim();
    const senha = passInput.value;

    if (!email || !senha) return mostrar("Preencha e-mail e senha.");
    if (modoCadastro && !nameInput.value.trim()) return mostrar("Digite o seu nome.");

    carregando(true);
    try {
        if (modoCadastro) {
            const cred = await createUserWithEmailAndPassword(auth, email, senha);
            await updateProfile(cred.user, { displayName: nameInput.value.trim() });
        } else {
            await signInWithEmailAndPassword(auth, email, senha);
        }
    } catch (e) {
        tratarErro(e);
    } finally {
        carregando(false);
    }
});

// Entrar com Google
// Só entra quem já tem cadastro. Se o e-mail do Google ainda não existe no Firebase,
// a conta recém-criada é apagada e a pessoa vai para a página de planos.
googleBtn.addEventListener("click", async () => {
    carregando(true);
    verificandoGoogle = true;
    try {
        const resultado = await signInWithPopup(auth, google);
        const info = getAdditionalUserInfo(resultado);

        if (info && info.isNewUser) {
            const email = resultado.user.email || "";
            try {
                await deleteUser(resultado.user);
            } catch (e) {
                console.error("Não foi possível apagar a conta nova:", e);
                await signOut(auth);
            }
            window.location.href = PAGINA_PLANOS + "?nao-cadastrado=1&email=" + encodeURIComponent(email);
            return;
        }

        verificandoGoogle = false;
        mostrarLogado(resultado.user);
    } catch (e) {
        verificandoGoogle = false;
        tratarErro(e);
    } finally {
        carregando(false);
    }
});

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

// Mostra a tela de "logado" (ou redireciona, se configurado)
function mostrarLogado(user) {
    if (REDIRECIONAR_PARA) {
        window.location.href = REDIRECIONAR_PARA;
        return;
    }
    $("auth-area").hidden = true;
    $("user-name").textContent = user.displayName || user.email;
    logged.hidden = false;
    mostrar("", "");
}

// Reage ao login / logout
onAuthStateChanged(auth, (user) => {
    if (verificandoGoogle) return; // o botão do Google decide o que fazer
    if (user) {
        mostrarLogado(user);
    } else {
        $("auth-area").hidden = false;
        logged.hidden = true;
    }
});
