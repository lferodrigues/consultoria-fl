// Painel do Administrador — cadastro de alunos no Realtime Database
//
// Estrutura no banco:
//   alunos/{id}        -> { nome, email, telefone, plano, inicio, vencimento, ativo, obs, uid, criadoEm, atualizadoEm }
//   emails/{emailKey}  -> { aluno: id, ativo, vencimento }   (o login consulta só isto)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signOut,
    sendEmailVerification,
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { ref, onValue, get, push, update } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { auth, db, firebaseConfig, ehAdmin, chaveEmail, hojeISO, PAGINAS } from "./firebase-app.js?v=1";
import {
    MESES_POR_PLANO, somarMeses, situacao, contar, filtrar,
    dataBR, mascaraTelefone, escaparHTML
} from "./alunos-util.js?v=1";

const $ = (id) => document.getElementById(id);

let alunos = [];          // lista atual vinda do banco
let editandoId = null;    // null = novo aluno
let excluirId = null;
let pararEscuta = null;

/* ---------------- Acesso ---------------- */

onAuthStateChanged(auth, (user) => {
    if (!user || !ehAdmin(user)) {
        if (pararEscuta) pararEscuta();
        window.location.replace(PAGINAS.login);
        return;
    }
    $("admin-email").textContent = user.email;
    $("verify-alert").hidden = user.emailVerified;
    $("gate").hidden = true;
    escutarAlunos();
});

$("logout-btn").addEventListener("click", () => signOut(auth));

$("verify-btn").addEventListener("click", async (ev) => {
    const btn = ev.currentTarget;
    btn.disabled = true;
    try {
        await sendEmailVerification(auth.currentUser);
        aviso("Link de verificação enviado para " + auth.currentUser.email, "ok");
    } catch (e) {
        console.error(e);
        aviso("Não foi possível enviar agora. Tente de novo em alguns minutos.", "error");
    } finally {
        btn.disabled = false;
    }
});

/* ---------------- Leitura em tempo real ---------------- */

function escutarAlunos() {
    if (pararEscuta) return;
    pararEscuta = onValue(ref(db, "alunos"), (snap) => {
        const dados = snap.val() || {};
        alunos = Object.entries(dados).map(([id, a]) => ({ id, ...a }));
        alunos.sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
        desenhar();
    }, (erro) => {
        console.error(erro);
        pararEscuta = null;
        $("empty").hidden = false;
        $("empty-text").textContent = auth.currentUser && !auth.currentUser.emailVerified
            ? "Confirme o e-mail do administrador para ver os alunos (aviso no topo)."
            : "Sem permissão para ler os alunos. Confira as regras do Realtime Database.";
    });
}

/* ---------------- Lista ---------------- */

function desenhar() {
    const hoje = hojeISO();
    const c = contar(alunos, hoje);
    $("st-total").textContent = c.total;
    $("st-ativos").textContent = c.ativos;
    $("st-vencendo").textContent = c.vencendo;
    $("st-vencidos").textContent = c.vencidos;

    const lista = filtrar(alunos, $("filter").value, $("search").value, hoje);
    $("tbody").innerHTML = lista.map((a) => {
        const s = situacao(a, hoje);
        return `
        <tr>
            <td class="td-aluno">
                <div class="aluno-nome">${escaparHTML(a.nome)}</div>
                <div class="aluno-email">${escaparHTML(a.email)}</div>
            </td>
            <td data-label="Telefone">${escaparHTML(a.telefone || "—")}</td>
            <td data-label="Plano" class="plano">${escaparHTML(a.plano || "—")}</td>
            <td data-label="Início">${dataBR(a.inicio)}</td>
            <td data-label="Vencimento">${dataBR(a.vencimento)}</td>
            <td data-label="Situação"><span class="badge ${s.classe}">${s.texto}</span></td>
            <td class="td-actions">
                <div class="actions">
                    <button type="button" class="icon-btn" data-acao="editar" data-id="${a.id}" title="Editar" aria-label="Editar ${escaparHTML(a.nome)}"><i class="fa-solid fa-pen"></i></button>
                    <button type="button" class="icon-btn" data-acao="alternar" data-id="${a.id}" title="${a.ativo === false ? "Liberar acesso" : "Desativar acesso"}" aria-label="${a.ativo === false ? "Liberar" : "Desativar"} ${escaparHTML(a.nome)}"><i class="fa-solid ${a.ativo === false ? "fa-lock-open" : "fa-lock"}"></i></button>
                    <button type="button" class="icon-btn danger" data-acao="excluir" data-id="${a.id}" title="Excluir" aria-label="Excluir ${escaparHTML(a.nome)}"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join("");

    const vazio = lista.length === 0;
    $("empty").hidden = !vazio;
    if (vazio) {
        $("empty-text").textContent = alunos.length === 0
            ? "Nenhum aluno cadastrado ainda. Clique em \"Novo aluno\" para começar."
            : "Nenhum aluno encontrado com esse filtro.";
    }
}

$("search").addEventListener("input", desenhar);
$("filter").addEventListener("change", desenhar);
document.querySelectorAll(".stat").forEach((b) => b.addEventListener("click", () => {
    $("filter").value = b.dataset.filter;
    desenhar();
}));

$("tbody").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-acao]");
    if (!btn) return;
    const aluno = alunos.find((a) => a.id === btn.dataset.id);
    if (!aluno) return;
    if (btn.dataset.acao === "editar") abrirModal(aluno);
    if (btn.dataset.acao === "alternar") alternarAcesso(aluno);
    if (btn.dataset.acao === "excluir") pedirExclusao(aluno);
});

/* ---------------- Formulário ---------------- */

const campos = {
    nome: $("f-nome"), email: $("f-email"), telefone: $("f-telefone"), plano: $("f-plano"),
    inicio: $("f-inicio"), vencimento: $("f-vencimento"), ativo: $("f-ativo"), senha: $("f-senha"), obs: $("f-obs")
};

function recalcularVencimento() {
    if (campos.inicio.value) {
        campos.vencimento.value = somarMeses(campos.inicio.value, MESES_POR_PLANO[campos.plano.value] || 6);
    }
}
campos.plano.addEventListener("change", recalcularVencimento);
campos.inicio.addEventListener("change", recalcularVencimento);
campos.telefone.addEventListener("input", (e) => { e.target.value = mascaraTelefone(e.target.value); });

function abrirModal(aluno = null) {
    editandoId = aluno ? aluno.id : null;
    $("modal-title").textContent = aluno ? "Editar aluno" : "Novo aluno";
    $("form-msg").textContent = "";
    $("senha-wrap").hidden = !!aluno; // senha só no cadastro
    campos.nome.value = aluno?.nome || "";
    campos.email.value = aluno?.email || "";
    campos.telefone.value = aluno?.telefone || "";
    campos.plano.value = aluno?.plano || "semestral";
    campos.inicio.value = aluno?.inicio || hojeISO();
    campos.ativo.checked = aluno ? aluno.ativo !== false : true;
    campos.senha.value = "";
    campos.obs.value = aluno?.obs || "";
    if (aluno?.vencimento) campos.vencimento.value = aluno.vencimento; else recalcularVencimento();
    $("modal").hidden = false;
    setTimeout(() => campos.nome.focus(), 50);
}

function fecharModal() { $("modal").hidden = true; }

$("new-btn").addEventListener("click", () => abrirModal());
$("modal-close").addEventListener("click", fecharModal);
$("cancel-btn").addEventListener("click", fecharModal);
$("modal").addEventListener("click", (e) => { if (e.target.id === "modal") fecharModal(); });
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { fecharModal(); $("confirm").hidden = true; }
});

// App secundário só para criar o login do aluno sem desconectar o administrador
let authCadastro = null;
function getAuthCadastro() {
    if (!authCadastro) authCadastro = getAuth(initializeApp(firebaseConfig, "cadastro-alunos"));
    return authCadastro;
}

$("aluno-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const msg = $("form-msg");
    msg.textContent = "";

    const dados = {
        nome: campos.nome.value.trim(),
        email: campos.email.value.trim().toLowerCase(),
        telefone: campos.telefone.value.trim(),
        plano: campos.plano.value,
        inicio: campos.inicio.value,
        vencimento: campos.vencimento.value,
        ativo: campos.ativo.checked,
        obs: campos.obs.value.trim()
    };
    const senha = campos.senha.value;

    if (!dados.nome) return (msg.textContent = "Digite o nome do aluno.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) return (msg.textContent = "Digite um e-mail válido.");
    if (!dados.inicio || !dados.vencimento) return (msg.textContent = "Preencha as datas de início e vencimento.");
    if (dados.vencimento < dados.inicio) return (msg.textContent = "O vencimento não pode ser antes do início.");
    if (!editandoId && senha && senha.length < 6) return (msg.textContent = "A senha precisa ter pelo menos 6 caracteres.");
    if (dados.email === "contato@fagnerlage.com.br") return (msg.textContent = "Esse é o e-mail do administrador.");

    const salvar = $("save-btn");
    salvar.disabled = true;
    salvar.textContent = "Salvando...";

    try {
        const antigo = editandoId ? alunos.find((a) => a.id === editandoId) : null;
        const chaveNova = chaveEmail(dados.email);
        const mudouEmail = !antigo || antigo.email !== dados.email;

        // E-mail já usado por outro aluno?
        if (mudouEmail) {
            const existe = await get(ref(db, "emails/" + chaveNova));
            if (existe.exists() && existe.val().aluno !== editandoId) {
                msg.textContent = "Já existe um aluno cadastrado com esse e-mail.";
                return;
            }
        }

        const id = editandoId || push(ref(db, "alunos")).key;
        const agora = Date.now();
        let avisoExtra = "";

        // Cria o login com senha (opcional, só no cadastro novo)
        if (!editandoId && senha) {
            const authSec = getAuthCadastro();
            try {
                const cred = await createUserWithEmailAndPassword(authSec, dados.email, senha);
                dados.uid = cred.user.uid;
            } catch (e) {
                if (e.code === "auth/email-already-in-use") {
                    avisoExtra = " Esse e-mail já tinha login no Firebase; a senha não foi alterada.";
                } else {
                    throw e;
                }
            } finally {
                await signOut(authSec).catch(() => {});
            }
        }

        const mudancas = {};
        mudancas["alunos/" + id] = {
            ...(antigo ? { uid: antigo.uid || null, criadoEm: antigo.criadoEm || agora } : { criadoEm: agora }),
            ...dados,
            atualizadoEm: agora
        };
        if (!dados.uid && antigo?.uid) mudancas["alunos/" + id].uid = antigo.uid;
        mudancas["emails/" + chaveNova] = { aluno: id, ativo: dados.ativo, vencimento: dados.vencimento };
        if (antigo && mudouEmail) mudancas["emails/" + chaveEmail(antigo.email)] = null;

        await update(ref(db), mudancas);
        fecharModal();
        aviso((editandoId ? "Aluno atualizado." : "Aluno cadastrado.") + avisoExtra, "ok");
    } catch (e) {
        console.error(e);
        const erros = {
            "auth/invalid-email": "E-mail inválido.",
            "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
            "auth/operation-not-allowed": "O login por e-mail/senha não está ativado no Firebase.",
            "PERMISSION_DENIED": "Sem permissão para salvar. Confirme o e-mail do administrador e as regras do banco."
        };
        msg.textContent = erros[e.code] || (String(e.message || "").includes("PERMISSION_DENIED") ? erros.PERMISSION_DENIED : "Não foi possível salvar. Tente novamente.");
    } finally {
        salvar.disabled = false;
        salvar.textContent = "Salvar";
    }
});

/* ---------------- Ativar / desativar ---------------- */

async function alternarAcesso(aluno) {
    const ativo = aluno.ativo === false;
    try {
        await update(ref(db), {
            ["alunos/" + aluno.id + "/ativo"]: ativo,
            ["alunos/" + aluno.id + "/atualizadoEm"]: Date.now(),
            ["emails/" + chaveEmail(aluno.email) + "/ativo"]: ativo
        });
        aviso(ativo ? "Acesso de " + aluno.nome + " liberado." : "Acesso de " + aluno.nome + " desativado.", "ok");
    } catch (e) {
        console.error(e);
        aviso("Não foi possível alterar o acesso.", "error");
    }
}

/* ---------------- Excluir ---------------- */

function pedirExclusao(aluno) {
    excluirId = aluno.id;
    $("confirm-text").textContent = aluno.nome + " (" + aluno.email + ") perde o acesso à área do aluno e sai da lista. Essa ação não pode ser desfeita.";
    $("confirm").hidden = false;
}

$("confirm-no").addEventListener("click", () => { $("confirm").hidden = true; });
$("confirm").addEventListener("click", (e) => { if (e.target.id === "confirm") $("confirm").hidden = true; });
$("confirm-yes").addEventListener("click", async () => {
    const aluno = alunos.find((a) => a.id === excluirId);
    $("confirm").hidden = true;
    if (!aluno) return;
    try {
        await update(ref(db), {
            ["alunos/" + aluno.id]: null,
            ["emails/" + chaveEmail(aluno.email)]: null
        });
        aviso(aluno.nome + " foi excluído.", "ok");
    } catch (e) {
        console.error(e);
        aviso("Não foi possível excluir.", "error");
    }
});

/* ---------------- Aviso rápido ---------------- */

let timerAviso;
function aviso(texto, tipo = "ok") {
    const t = $("toast");
    t.textContent = texto;
    t.className = "toast show " + tipo;
    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => { t.className = "toast " + tipo; }, 3500);
}
