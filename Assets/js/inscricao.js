// Ficha de inscrição (cadastro.html)
//
// 1. Plano e conta (Google, Apple ou e-mail e senha)  2. Dados  3. Saúde  4. Treino e fatura  5. Termos LGPD
// Salva em inscricoes/{uid} e abre o WhatsApp do Fagner com o link da inscrição no painel.
// A área do aluno só é liberada depois que o Fagner salva a primeira ficha de treino.
import {
    GoogleAuthProvider, OAuthProvider, signInWithPopup, createUserWithEmailAndPassword,
    signInWithEmailAndPassword, updateProfile, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { ref, get, update } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { auth, db, ehAdmin, chaveEmail, PAGINAS } from "./firebase-app.js?v=2";
import { ordenarPlanos } from "./planos-card.js?v=2";
import { canvasParaImagem } from "./imagem-webp.js?v=1";

export const VERSAO_TERMOS = "1.0";
const WHATSAPP_FAGNER = "5532998528266";
const TOTAL = 5;

// Link direto (/cadastrolivre ou cadastro.html?direto=1): o aluno faz a inscrição sem escolher plano.
// O plano e o valor ficam "a combinar" e o Fagner define na hora de aprovar.
export const DIRETO = new URLSearchParams(location.search).has("direto") || /\/cadastrolivre(\.html)?\/?$/i.test(location.pathname);
export const PLANO_A_DEFINIR = { id: "a-definir", nome: "A combinar com o Fagner", preco: 0 };

const $ = (id) => document.getElementById(id);
const so = (t) => String(t || "").replace(/\D/g, "");
const moeda = (c) => (Number(c || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const escolhido = (nome) => document.querySelector(`input[name="${nome}"]:checked`)?.value || "";

const google = new GoogleAuthProvider();
const apple = new OAuthProvider("apple.com");
apple.addScope("email");
apple.addScope("name");
apple.setCustomParameters({ locale: "pt_BR" });

let etapa = 1;
let planos = [];
let usuario = null;
let foto = "";
let ocupado = false;   // enquanto entra / salva, o onAuthStateChanged não decide nada

const ERROS = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/invalid-credential": "Esse e-mail já tem conta e a senha não confere. Use a senha da conta ou entre com Google/Apple.",
    "auth/wrong-password": "Esse e-mail já tem conta e a senha não confere.",
    "auth/popup-closed-by-user": "A janela de login foi fechada antes de terminar.",
    "auth/cancelled-popup-request": "A janela de login foi fechada antes de terminar.",
    "auth/popup-blocked": "O navegador bloqueou a janela de login. Libere os pop-ups e tente de novo.",
    "auth/operation-not-allowed": "Esse tipo de login ainda não está ativado.",
    "auth/account-exists-with-different-credential": "Esse e-mail já está cadastrado com outra forma de login.",
    "auth/network-request-failed": "Sem conexão. Verifique sua internet.",
    "auth/too-many-requests": "Muitas tentativas. Espere um pouco e tente de novo."
};

function msg(texto, tipo = "") {
    $("cad-msg").textContent = texto || "";
    $("cad-msg").className = "cad-msg " + tipo;
}
// Tela de carregamento com porcentagem. Não dá para medir o tempo real do Firebase,
// então a % anda sozinha (cada vez mais devagar até 95%), pula nas etapas concluídas
// e vai a 100% quando termina.
let pct = 0;
let timerPct = null;
function mostrarPct() {
    const n = Math.floor(pct);
    $("cad-pct").textContent = n + "%";
    $("cad-barra").style.width = n + "%";
}
function progresso(n, texto) {
    if (texto) $("cad-loading-texto").textContent = texto;
    pct = Math.max(pct, n);
    mostrarPct();
}
function carregando(sim, texto) {
    const tela = $("cad-loading");
    if (sim) {
        if (tela.hidden || tela.dataset.saindo) {
            delete tela.dataset.saindo;
            pct = 0;
            clearInterval(timerPct);
            timerPct = setInterval(() => { pct += (95 - pct) * 0.06; mostrarPct(); }, 80);
        }
        $("cad-loading-texto").textContent = texto || "Carregando...";
        mostrarPct();
        tela.hidden = false;
    } else if (!tela.hidden) {
        clearInterval(timerPct);
        pct = 100;
        mostrarPct();
        tela.dataset.saindo = "1";
        setTimeout(() => { if (tela.dataset.saindo) { tela.hidden = true; delete tela.dataset.saindo; } }, 250);
    }
    ["cad-avancar", "cad-google", "cad-apple"].forEach((id) => { $(id).disabled = sim; });
}
function erroEm(el, texto) {
    const campo = el.closest(".campo, .aceite, .foto-campo, .pergunta") || el;
    campo.classList.add("erro");
    if (el.focus) el.focus({ preventScroll: true });
    campo.scrollIntoView({ behavior: "smooth", block: "center" });
    msg(texto);
    return false;
}
document.addEventListener("input", (e) => { e.target.closest(".erro")?.classList.remove("erro"); if ($("cad-msg").textContent) msg(""); });
document.addEventListener("change", (e) => { e.target.closest(".erro")?.classList.remove("erro"); });

/* =================== Etapas =================== */

function irPara(n) {
    etapa = n;
    document.querySelectorAll(".cad-etapa").forEach((s) => { s.hidden = Number(s.dataset.etapa) !== n; });
    document.querySelectorAll("#cad-passos li").forEach((li) => {
        const p = Number(li.dataset.passo);
        li.classList.toggle("feito", p < n);
        li.classList.toggle("atual", p === n);
    });
    $("cad-voltar").hidden = n === 1;
    $("cad-avancar").innerHTML = n === TOTAL ? '<i class="fa-solid fa-paper-plane"></i> Enviar inscrição' : 'Continuar <i class="fa-solid fa-arrow-right"></i>';
    if (n === 4) desenharResumo();
    if (n === 5) $("menor-wrap").hidden = !(Number($("c-idade").value) > 0 && Number($("c-idade").value) < 18);
    msg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

$("cad-voltar").addEventListener("click", () => irPara(Math.max(1, etapa - 1)));
$("res-trocar").addEventListener("click", () => irPara(1));

$("cad-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (ocupado) return;
    if (etapa === 1) return avancarConta();
    const ok = [null, null, validarDados, validarSaude, validarTreino, validarTermos][etapa]();
    if (!ok) return;
    if (etapa < TOTAL) irPara(etapa + 1);
    else enviar();
});

/* =================== 1. Planos =================== */

async function carregarPlanos() {
    if (DIRETO) {
        $("cad-planos").hidden = true;
        // Mesmo sem mostrar os planos, faz essa leitura leve logo ao abrir a página:
        // ela já resolve a verificação de segurança (App Check) e abre a conexão com o banco,
        // e o "Continuar" fica rápido em vez de esperar tudo isso no clique.
        get(ref(db, "planos")).catch(() => {});
        return;
    }
    try {
        const snap = await get(ref(db, "planos"));
        planos = ordenarPlanos(Object.entries(snap.val() || {}).map(([id, p]) => ({ id, ...p })))
            .filter((p) => p.visivel !== false && Number(p.preco) > 0);
    } catch (e) {
        console.error(e);
        planos = [];
    }
    const grade = $("cad-planos");
    if (!planos.length) {
        grade.innerHTML = '<p class="dica"><i class="fa-solid fa-circle-info"></i> Nenhum plano disponível agora. Fale com o Fagner pelo <a href="https://wa.me/' + WHATSAPP_FAGNER + '" target="_blank" rel="noopener">WhatsApp</a>.</p>';
        return;
    }
    grade.innerHTML = planos.map((p) => `
        <label class="plano-op">
            <input type="radio" name="plano" value="${esc(p.id)}">
            <span class="caixa">
                ${p.tag ? `<span class="tag">${esc(p.tag)}</span>` : ""}
                <strong>${esc(p.nome)}</strong>
                <small>${esc(p.duracao || "")}</small>
                <b>${moeda(p.preco)} ${p.periodo ? `<em>${esc(p.periodo)}</em>` : ""}</b>
            </span>
        </label>`).join("");
    const pedido = new URLSearchParams(location.search).get("plano");
    const inicial = planos.find((p) => p.id === pedido) || (planos.length === 1 ? planos[0] : planos.find((p) => p.destaque));
    if (inicial) grade.querySelector(`input[value="${CSS.escape(inicial.id)}"]`).checked = true;
}

const planoEscolhido = () => (DIRETO ? PLANO_A_DEFINIR : planos.find((p) => p.id === escolhido("plano")));

/* =================== 1. Conta =================== */

function mostrarConta(user) {
    usuario = user;
    $("conta-off").hidden = !!user;
    $("conta-on").hidden = !user;
    $("conta-email").textContent = user?.email || "";
    $("c-email-conta").value = user?.email || "";
    if (user?.displayName && !$("c-nome").value) $("c-nome").value = user.displayName;
}

// Já é aluno ou já mandou a inscrição? Então não precisa preencher de novo.
async function situacaoDaConta(user) {
    if (ehAdmin(user)) return { titulo: "Você está como administrador", texto: "Saia e entre com a conta do aluno para fazer a inscrição.", tipo: "admin" };
    // As duas consultas ao mesmo tempo (antes era uma depois da outra)
    const [cad, ins] = await Promise.all([
        get(ref(db, "emails/" + chaveEmail(user.email))).catch(() => null),
        get(ref(db, "inscricoes/" + user.uid)).catch(() => null)
    ]);
    if (cad && cad.exists()) return { titulo: "Você já é aluno!", texto: "Esta conta já está cadastrada. É só entrar na área do aluno." };
    if (ins && ins.exists()) {
        const i = ins.val();
        return {
            titulo: "Sua inscrição já foi enviada",
            texto: "Recebemos a inscrição de " + (i.nome || user.email) + " em " + new Date(i.criadoEm || Date.now()).toLocaleDateString("pt-BR") + ". Assim que o Fagner cadastrar a sua primeira ficha, a área do aluno é liberada e você recebe um WhatsApp."
        };
    }
    return null;
}

function mostrarJa(s) {
    $("cad-form").hidden = true;
    $("cad-passos").hidden = true;
    $("cad-head").hidden = true;
    $("ja-titulo").textContent = s.titulo;
    $("ja-texto").textContent = s.texto;
    $("cad-ja").hidden = false;
}

async function aoEntrar(user) {
    const s = await situacaoDaConta(user);
    if (s) { mostrarJa(s); return false; }
    mostrarConta(user);
    return true;
}

async function entrarCom(provedor) {
    if (!planoEscolhido()) return msg("Escolha um plano primeiro.");
    msg("");
    ocupado = true;
    carregando(true, "Entrando com a sua conta...");
    try {
        const r = await signInWithPopup(auth, provedor);
        progresso(60, "Conferindo o seu cadastro...");
        if (await aoEntrar(r.user)) irPara(2);
    } catch (e) {
        console.error(e);
        msg(ERROS[e.code] || "Não foi possível entrar. Tente novamente.");
    } finally {
        ocupado = false;
        carregando(false);
    }
}
$("cad-google").addEventListener("click", () => entrarCom(google));
$("cad-apple").addEventListener("click", () => entrarCom(apple));

$("conta-trocar").addEventListener("click", async () => {
    await signOut(auth);
    mostrarConta(null);
});
$("ja-sair").addEventListener("click", async () => {
    await signOut(auth);
    location.reload();
});

async function avancarConta() {
    if (!planoEscolhido()) return erroEm($("cad-planos"), planos.length ? "Escolha um plano." : "Nenhum plano disponível no momento.");
    if (usuario) return irPara(2);

    const email = $("c-email").value.trim().toLowerCase();
    const senha = $("c-senha").value;
    if (!email && !senha) return msg("Entre com Google ou Apple, ou crie uma senha com o seu e-mail.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return erroEm($("c-email"), "Digite um e-mail válido.");
    if (senha.length < 6) return erroEm($("c-senha"), "A senha precisa ter pelo menos 6 caracteres.");
    if (senha !== $("c-senha2").value) return erroEm($("c-senha2"), "As senhas não são iguais.");

    ocupado = true;
    carregando(true, "Criando a sua conta...");
    try {
        let cred;
        try {
            cred = await createUserWithEmailAndPassword(auth, email, senha);
        } catch (e) {
            // Já existe conta com esse e-mail: tenta entrar com a mesma senha (quem voltou para terminar a inscrição)
            if (e.code !== "auth/email-already-in-use") throw e;
            progresso(30, "Entrando na sua conta...");
            cred = await signInWithEmailAndPassword(auth, email, senha);
        }
        progresso(60, "Conferindo o seu cadastro...");
        if (await aoEntrar(cred.user)) irPara(2);
    } catch (e) {
        console.error(e);
        msg(ERROS[e.code] || "Não foi possível criar a conta. Tente novamente.");
    } finally {
        ocupado = false;
        carregando(false);
    }
}

/* =================== 2. Dados =================== */

function mascara(el, fn) { el.addEventListener("input", () => { el.value = fn(so(el.value)); }); }
mascara($("c-cpf"), (d) => d.slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2"));
mascara($("c-cep"), (d) => d.slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2"));
mascara($("c-whats"), (d) => {
    d = d.slice(0, 11);
    if (d.length <= 2) return d.length ? "(" + d : "";
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
});
$("c-uf").addEventListener("input", (e) => { e.target.value = e.target.value.replace(/[^a-z]/gi, "").toUpperCase(); });

export function cpfValido(cpf) {
    const d = so(cpf);
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    for (const t of [9, 10]) {
        let soma = 0;
        for (let i = 0; i < t; i++) soma += Number(d[i]) * (t + 1 - i);
        const dv = ((soma * 10) % 11) % 10;
        if (dv !== Number(d[t])) return false;
    }
    return true;
}

// CEP -> endereço (ViaCEP)
let ultimoCep = "";
$("c-cep").addEventListener("input", async () => {
    const cep = so($("c-cep").value);
    if (cep.length !== 8 || cep === ultimoCep) return;
    ultimoCep = cep;
    $("cep-info").textContent = "Buscando endereço...";
    try {
        const r = await fetch("https://viacep.com.br/ws/" + cep + "/json/");
        const e = await r.json();
        if (e.erro) throw new Error("CEP não encontrado");
        $("c-rua").value = e.logradouro || $("c-rua").value;
        $("c-bairro").value = e.bairro || $("c-bairro").value;
        $("c-cidade").value = e.localidade || "";
        $("c-uf").value = e.uf || "";
        ["c-rua", "c-bairro", "c-cidade", "c-uf"].forEach((id) => $(id).closest(".campo").classList.remove("erro"));
        $("cep-info").textContent = "";
        (e.logradouro ? $("c-numero") : $("c-rua")).focus();
    } catch (e) {
        $("cep-info").textContent = "CEP não encontrado. Preencha o endereço.";
    }
});

// Foto: recorta no centro e reduz para 320x320 (fica leve para o banco)
$("c-foto").addEventListener("change", async (ev) => {
    const arq = ev.target.files[0];
    if (!arq) return;
    if (!arq.type.startsWith("image/")) return erroEm($("c-foto"), "Escolha um arquivo de imagem.");
    try {
        foto = await reduzirFoto(arq, 320);
        $("foto-prev").innerHTML = `<img src="${foto}" alt="Sua foto">`;
        $("foto-prev").classList.add("tem");
        $("foto-campo").classList.remove("erro");
        msg("");
    } catch (e) {
        console.error(e);
        erroEm($("c-foto"), "Não foi possível abrir essa imagem. Tente outra.");
    }
});

function reduzirFoto(arquivo, lado) {
    return new Promise((ok, falha) => {
        const url = URL.createObjectURL(arquivo);
        const img = new Image();
        img.onload = () => {
            const m = Math.min(img.width, img.height);
            const c = document.createElement("canvas");
            c.width = c.height = lado;
            c.getContext("2d").drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, lado, lado);
            URL.revokeObjectURL(url);
            ok(canvasParaImagem(c, 0.82));
        };
        img.onerror = () => { URL.revokeObjectURL(url); falha(new Error("imagem inválida")); };
        img.src = url;
    });
}

function validarDados() {
    const nome = $("c-nome").value.trim().replace(/\s+/g, " ");
    $("c-nome").value = nome;
    if (!foto) return erroEm($("c-foto"), "Escolha uma foto de perfil.");
    if (nome.split(" ").length < 2 || nome.length < 5) return erroEm($("c-nome"), "Digite o nome completo.");
    if (!cpfValido($("c-cpf").value)) return erroEm($("c-cpf"), "CPF inválido. Confira os números.");
    const w = so($("c-whats").value);
    if (w.length < 10 || w.length > 11) return erroEm($("c-whats"), "Digite o WhatsApp com DDD.");
    if (!$("c-sexo").value) return erroEm($("c-sexo"), "Selecione o sexo.");
    const idade = Number($("c-idade").value);
    if (!Number.isInteger(idade) || idade < 10 || idade > 100) return erroEm($("c-idade"), "Digite uma idade válida.");
    if (so($("c-cep").value).length !== 8) return erroEm($("c-cep"), "Digite o CEP.");
    for (const [id, nomeCampo] of [["c-rua", "a rua"], ["c-numero", "o número (ou S/N)"], ["c-bairro", "o bairro"], ["c-cidade", "a cidade"]]) {
        if (!$(id).value.trim()) return erroEm($(id), "Preencha " + nomeCampo + ".");
    }
    if (!/^[A-Z]{2}$/.test($("c-uf").value)) return erroEm($("c-uf"), "Digite a UF (ex.: MG).");
    return true;
}

/* =================== 3. Saúde =================== */

function atualizarImc() {
    const p = Number($("c-peso").value), a = Number($("c-altura").value) / 100;
    $("c-imc").value = p > 0 && a > 0.9 ? (p / (a * a)).toFixed(1).replace(".", ",") : "";
}
$("c-peso").addEventListener("input", atualizarImc);
$("c-altura").addEventListener("input", atualizarImc);

document.querySelectorAll('input[name="objetivo"]').forEach((r) => r.addEventListener("change", () => {
    $("obj-outro-wrap").hidden = escolhido("objetivo") !== "Outro";
}));
document.querySelectorAll(".pergunta").forEach((p) => {
    p.addEventListener("change", (e) => {
        if (e.target.type !== "radio") return;
        const campo = p.querySelector(".campo");
        campo.hidden = e.target.value !== "sim";
        if (!campo.hidden) campo.querySelector("textarea").focus();
    });
});

function validarSaude() {
    const peso = Number($("c-peso").value), altura = Number($("c-altura").value);
    if (!(peso >= 20 && peso <= 400)) return erroEm($("c-peso"), "Digite o seu peso em kg.");
    if (!(altura >= 100 && altura <= 250)) return erroEm($("c-altura"), "Digite a altura em centímetros (ex.: 170).");
    if (!escolhido("objetivo")) return erroEm($("c-objetivo"), "Escolha o seu objetivo.");
    if (escolhido("objetivo") === "Outro" && !$("c-obj-outro").value.trim()) return erroEm($("c-obj-outro"), "Conte qual é o seu objetivo.");
    for (const [nome, pergunta] of [["lesao", "se tem lesão"], ["saude", "se tem problema de saúde"], ["medicamento", "se usa medicamento"]]) {
        const bloco = document.querySelector(`.pergunta[data-pergunta="${nome}"]`);
        if (!escolhido(nome)) return erroEm(bloco, "Responda " + pergunta + ".");
        if (escolhido(nome) === "sim" && $("c-" + nome).value.trim().length < 3) return erroEm($("c-" + nome), "Conte qual, para o treino ser seguro.");
    }
    return true;
}

/* =================== 4. Treino e fatura =================== */

// Próxima data com o dia escolhido, com pelo menos 3 dias de prazo
export function primeiroVencimento(dia, hoje = new Date()) {
    const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 3);
    let d = new Date(base.getFullYear(), base.getMonth(), dia);
    if (d < base) d = new Date(base.getFullYear(), base.getMonth() + 1, dia);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
const dataBR = (iso) => iso.split("-").reverse().join("/");

function desenharResumo() {
    const p = planoEscolhido();
    $("res-plano").textContent = p ? p.nome + (p.duracao ? " · " + p.duracao : "") : "—";
    $("res-valor").textContent = DIRETO ? "A combinar" : p ? moeda(p.preco) + (p.periodo ? " " + p.periodo : "") : "—";
    atualizarVenc();
}
function atualizarVenc() {
    const dia = Number(escolhido("venc"));
    $("venc-info").innerHTML = dia
        ? `<i class="fa-regular fa-calendar-check"></i> Sua primeira fatura vence em <strong>&nbsp;${dataBR(primeiroVencimento(dia))}</strong>. Depois, sempre no dia ${dia}.`
        : '<i class="fa-regular fa-calendar"></i> Escolha o melhor dia do mês para pagar.';
    $("venc-info").classList.toggle("ok", !!dia);
}
document.querySelectorAll('input[name="venc"]').forEach((r) => r.addEventListener("change", atualizarVenc));

function validarTreino() {
    if (!escolhido("dias")) return erroEm($("c-dias"), "Escolha quantos dias por semana você vai treinar.");
    if (!escolhido("tempo")) return erroEm($("c-tempo"), "Escolha quanto tempo você tem por dia.");
    if (!planoEscolhido()) { irPara(1); msg("Escolha um plano."); return false; }
    if (!escolhido("venc")) return erroEm($("c-venc"), "Escolha o dia de vencimento da fatura.");
    return true;
}

/* =================== 5. Termos =================== */

function validarTermos() {
    if (!$("c-termos").checked) return erroEm($("c-termos"), "Para continuar, aceite os Termos de Uso e a Política de Privacidade.");
    if (!$("c-consent-saude").checked) return erroEm($("c-consent-saude"), "Precisamos do seu consentimento para usar os dados de saúde no treino.");
    if (!$("menor-wrap").hidden) {
        if ($("c-resp").value.trim().split(/\s+/).length < 2) return erroEm($("c-resp"), "Digite o nome completo do responsável.");
        if (!$("c-resp-ok").checked) return erroEm($("c-resp-ok"), "O responsável precisa dar o consentimento.");
    }
    return true;
}

/* =================== Enviar =================== */

function montarInscricao() {
    const p = planoEscolhido();
    const dia = Number(escolhido("venc"));
    const resposta = (nome) => ({ tem: escolhido(nome) === "sim", qual: escolhido(nome) === "sim" ? $("c-" + nome).value.trim() : "" });
    const idade = Number($("c-idade").value);
    const dados = {
        uid: usuario.uid,
        email: usuario.email,
        provedor: usuario.providerData?.[0]?.providerId || "password",
        nome: $("c-nome").value.trim(),
        cpf: so($("c-cpf").value),
        whatsapp: so($("c-whats").value),
        sexo: $("c-sexo").value,
        idade,
        endereco: {
            cep: so($("c-cep").value), rua: $("c-rua").value.trim(), numero: $("c-numero").value.trim(),
            complemento: $("c-compl").value.trim(), bairro: $("c-bairro").value.trim(), cidade: $("c-cidade").value.trim(), uf: $("c-uf").value
        },
        foto,
        peso: Number($("c-peso").value),
        altura: Number($("c-altura").value),
        objetivo: escolhido("objetivo") === "Outro" ? "Outro: " + $("c-obj-outro").value.trim() : escolhido("objetivo"),
        lesao: resposta("lesao"),
        saude: resposta("saude"),
        medicamento: resposta("medicamento"),
        diasTreino: Number(escolhido("dias")),
        tempoDia: escolhido("tempo"),
        planoId: p.id,
        planoNome: p.nome,
        valor: Number(p.preco),
        diaVencimento: dia,
        primeiroVencimento: primeiroVencimento(dia),
        lgpd: { aceito: true, saude: true, versao: VERSAO_TERMOS, em: Date.now() },
        status: "pendente",
        visto: false,
        criadoEm: Date.now()
    };
    if (idade < 18) dados.responsavel = { nome: $("c-resp").value.trim(), consentiu: true };
    return dados;
}

export function linkPainel(uid) {
    return new URL(PAGINAS.admin + "#/inscricoes/" + uid, location.href).href;
}

function mensagemFagner(d) {
    return [
        "Olá, Fagner! Acabei de fazer a minha inscrição na consultoria.",
        "",
        "Nome: " + d.nome,
        "Plano: " + (DIRETO ? "a combinar" : d.planoNome + " (" + moeda(d.valor) + ")"),
        "Objetivo: " + d.objetivo,
        "Treino: " + d.diasTreino + "x por semana, " + d.tempoDia + " por dia",
        "",
        "Ver a minha ficha de inscrição: " + linkPainel(d.uid)
    ].join("\n");
}

async function enviar() {
    if (!usuario || !auth.currentUser) { irPara(1); return msg("Entre com a sua conta para enviar a inscrição."); }
    const dados = montarInscricao();
    const link = "https://wa.me/" + WHATSAPP_FAGNER + "?text=" + encodeURIComponent(mensagemFagner(dados));

    // A janela do WhatsApp precisa ser aberta no clique (senão o navegador bloqueia); o endereço entra depois de salvar
    let janela = null;
    try { janela = window.open("", "_blank"); } catch (e) { janela = null; }

    ocupado = true;
    carregando(true, "Enviando a sua ficha...");
    try {
        await update(ref(db), { ["inscricoes/" + usuario.uid]: dados });
        if (!usuario.displayName) updateProfile(auth.currentUser, { displayName: dados.nome }).catch(() => {});
        $("fim-whats").href = link;
        if (janela) { janela.opener = null; janela.location.href = link; }
        $("cad-form").hidden = true;
        $("cad-passos").hidden = true;
        $("cad-head").hidden = true;
        $("cad-fim").hidden = false;
        window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
        console.error(e);
        if (janela) janela.close();
        msg(/permission/i.test(String(e?.code || e?.message)) ? "O cadastro foi recusado pelo servidor. Confira os dados e tente de novo." : "Não foi possível enviar agora. Verifique sua internet e tente de novo.");
    } finally {
        ocupado = false;
        carregando(false);
    }
}

/* =================== Início =================== */

if (DIRETO) {
    // Sem a escolha de plano: a etapa 1 vira só "Sua conta"
    document.querySelector('#cad-passos li[data-passo="1"] span').textContent = "Sua conta";
    document.querySelector('.cad-etapa[data-etapa="1"] h2').textContent = "Sua conta";
    document.querySelector('.cad-etapa[data-etapa="1"] .sub').textContent = "Escolha como você vai entrar na área do aluno. O plano você combina direto com o Fagner.";
    $("res-trocar").hidden = true;
}
carregarPlanos();
irPara(1);
onAuthStateChanged(auth, async (user) => {
    if (ocupado) return;
    if (!user) return mostrarConta(null);
    carregando(true, "Carregando a sua conta...");
    try { await aoEntrar(user); } finally { carregando(false); }
});
