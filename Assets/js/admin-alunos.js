// Tela: Alunos
//   alunos/{id}        -> { nome, email, telefone, planoId, plano, valor, inicio, vencimento, ativo, obs, uid, diaFatura, criadoEm, atualizadoEm }
//   emails/{emailKey}  -> { aluno, ativo, vencimento, nome, plano, valor, diaFatura }  (o login e a área do aluno leem isto)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { ref, get, push, update } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { db, firebaseConfig, chaveEmail, hojeISO, ADMIN_EMAIL } from "./firebase-app.js?v=2";
import { MESES_POR_PLANO, somarMeses, situacao, contar, filtrar, dataBR, mascaraTelefone } from "./alunos-util.js?v=2";
import { $, estado, aoMudar, esc, aviso, abrirModal, fecharModal, confirmar, mensagemErro, ocupado } from "./admin-core.js?v=1";
import { preencherPlanos, dadosDoPlano, idDoPlano } from "./admin-planos-util.js?v=1";

let editandoId = null;

const campos = {
    nome: $("f-nome"), email: $("f-email"), telefone: $("f-telefone"), plano: $("f-plano"),
    inicio: $("f-inicio"), vencimento: $("f-vencimento"), ativo: $("f-ativo"), senha: $("f-senha"), obs: $("f-obs")
};

export function iniciar() {
    aoMudar(desenhar);
    $("al-busca").addEventListener("input", desenhar);
    $("al-filtro").addEventListener("change", desenhar);
    document.querySelectorAll("#view-alunos .stat").forEach((b) => b.addEventListener("click", () => {
        $("al-filtro").value = b.dataset.filter;
        desenhar();
    }));

    $("al-tbody").addEventListener("click", (ev) => {
        const btn = ev.target.closest("button[data-acao]");
        if (!btn) return;
        const aluno = estado.alunos.find((a) => a.id === btn.dataset.id);
        if (!aluno) return;
        if (btn.dataset.acao === "editar") abrir(aluno);
        if (btn.dataset.acao === "plano") { abrir(aluno); setTimeout(() => campos.plano.focus(), 50); }
        if (btn.dataset.acao === "alternar") alternarAcesso(aluno);
        if (btn.dataset.acao === "excluir") excluir(aluno);
    });

    campos.plano.addEventListener("change", recalcular);
    campos.inicio.addEventListener("change", recalcular);
    campos.telefone.addEventListener("input", (e) => { e.target.value = mascaraTelefone(e.target.value); });
    $("aluno-form").addEventListener("submit", salvar);
}

export function filtrarPor(filtro) {
    $("al-filtro").value = filtro;
    desenhar();
}

export function novo(aoFechar) { abrir(null, aoFechar); }

/* ---------- Lista ---------- */

function desenhar() {
    const hoje = hojeISO();
    const c = contar(estado.alunos, hoje);
    $("st-total").textContent = c.total;
    $("st-ativos").textContent = c.ativos;
    $("st-vencendo").textContent = c.vencendo;
    $("st-vencidos").textContent = c.vencidos;

    const lista = filtrar(estado.alunos, $("al-filtro").value, $("al-busca").value, hoje);
    $("al-tbody").innerHTML = lista.map((a) => {
        const s = situacao(a, hoje);
        const bloqueado = a.ativo === false;
        return `
        <tr>
            <td class="td-aluno"><div class="aluno-nome">${esc(a.nome)}</div><div class="aluno-email">${esc(a.email)}</div></td>
            <td data-label="Telefone">${esc(a.telefone || "—")}</td>
            <td data-label="Plano" class="plano">${a.plano ? esc(a.plano) : '<span class="badge warn">A definir</span>'}</td>
            <td data-label="Início">${dataBR(a.inicio)}</td>
            <td data-label="Vencimento">${dataBR(a.vencimento)}</td>
            <td data-label="Situação"><span class="badge ${s.classe}">${s.texto}</span></td>
            <td class="td-actions"><div class="actions">
                <button type="button" class="icon-btn" data-acao="editar" data-id="${a.id}" title="Editar" aria-label="Editar ${esc(a.nome)}"><i class="fa-solid fa-pen"></i></button>
                <button type="button" class="icon-btn" data-acao="plano" data-id="${a.id}" title="${a.plano ? "Mudar / fazer upgrade do plano" : "Escolher o plano"}" aria-label="Plano de ${esc(a.nome)}"><i class="fa-solid fa-arrow-up-right-dots"></i></button>
                <button type="button" class="icon-btn" data-acao="alternar" data-id="${a.id}" title="${bloqueado ? "Liberar acesso" : "Desativar acesso"}" aria-label="${bloqueado ? "Liberar" : "Desativar"} ${esc(a.nome)}"><i class="fa-solid ${bloqueado ? "fa-lock-open" : "fa-lock"}"></i></button>
                <button type="button" class="icon-btn danger" data-acao="excluir" data-id="${a.id}" title="Excluir" aria-label="Excluir ${esc(a.nome)}"><i class="fa-solid fa-trash"></i></button>
            </div></td>
        </tr>`;
    }).join("");

    $("al-vazio").hidden = lista.length > 0;
    $("al-vazio-txt").textContent = estado.alunos.length === 0
        ? "Nenhum aluno cadastrado ainda. Clique em \"Cadastrar aluno\" para começar."
        : "Nenhum aluno encontrado com esse filtro.";
}

/* ---------- Formulário ---------- */

let planoOriginal = "";
function recalcular() {
    const p = dadosDoPlano(campos.plano.value);
    if (campos.inicio.value) campos.vencimento.value = somarMeses(campos.inicio.value, p?.meses || 6);
    const mudou = editandoId && planoOriginal && campos.plano.value !== planoOriginal;
    $("f-plano-info").textContent = !p ? ""
        : mudou ? "Mudança de plano: o vencimento foi recalculado a partir do início. Ajuste as datas se precisar."
        : (p.valor ? "Valor do plano: " + (p.valor / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "");
}

function abrir(aluno, aoFechar) {
    editandoId = aluno ? aluno.id : null;
    $("al-titulo").textContent = aluno ? "Editar aluno" : "Cadastrar aluno";
    $("al-msg").textContent = "";
    $("senha-wrap").hidden = !!aluno;
    campos.nome.value = aluno?.nome || "";
    campos.email.value = aluno?.email || "";
    campos.telefone.value = aluno?.telefone || "";
    // Planos da página de Planos; aluno do cadastro livre (sem plano) começa sem escolha
    planoOriginal = aluno ? idDoPlano(aluno) : "";
    preencherPlanos(campos.plano, aluno ? planoOriginal : idDoPlano({ plano: "semestral" }), { vazio: aluno && !planoOriginal ? "— Escolha o plano —" : "" });
    campos.inicio.value = aluno?.inicio || hojeISO();
    campos.ativo.checked = aluno ? aluno.ativo !== false : true;
    campos.senha.value = "";
    campos.obs.value = aluno?.obs || "";
    if (aluno?.vencimento) campos.vencimento.value = aluno.vencimento; else recalcular();
    $("f-plano-info").textContent = aluno && !planoOriginal ? "Este aluno ainda não tem plano (veio do cadastro livre). Escolha um." : "";
    abrirModal("modal-aluno", "f-nome", aoFechar);
}

// App secundário só para criar o login do aluno sem desconectar o administrador
let authCadastro = null;
function getAuthCadastro() {
    if (!authCadastro) authCadastro = getAuth(initializeApp(firebaseConfig, "cadastro-alunos"));
    return authCadastro;
}

async function salvar(ev) {
    ev.preventDefault();
    const msg = $("al-msg");
    msg.textContent = "";
    const dados = {
        nome: campos.nome.value.trim(),
        email: campos.email.value.trim().toLowerCase(),
        telefone: campos.telefone.value.trim(),
        inicio: campos.inicio.value,
        vencimento: campos.vencimento.value,
        ativo: campos.ativo.checked,
        obs: campos.obs.value.trim()
    };
    const senha = campos.senha.value;

    if (!dados.nome) return (msg.textContent = "Digite o nome do aluno.");
    const plano = dadosDoPlano(campos.plano.value);
    if (!plano) return (msg.textContent = "Escolha o plano do aluno.");
    Object.assign(dados, { planoId: plano.planoId, plano: plano.plano, valor: plano.valor });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) return (msg.textContent = "Digite um e-mail válido.");
    if (!dados.inicio || !dados.vencimento) return (msg.textContent = "Preencha as datas de início e vencimento.");
    if (dados.vencimento < dados.inicio) return (msg.textContent = "O vencimento não pode ser antes do início.");
    if (!editandoId && senha && senha.length < 6) return (msg.textContent = "A senha precisa ter pelo menos 6 caracteres.");
    if (dados.email === ADMIN_EMAIL) return (msg.textContent = "Esse é o e-mail do administrador.");

    const botao = $("al-salvar");
    ocupado(botao, true);
    try {
        const antigo = editandoId ? estado.alunos.find((a) => a.id === editandoId) : null;
        const chaveNova = chaveEmail(dados.email);
        const mudouEmail = !antigo || antigo.email !== dados.email;

        if (mudouEmail) {
            const existe = await get(ref(db, "emails/" + chaveNova));
            if (existe.exists() && existe.val().aluno !== editandoId) {
                msg.textContent = "Já existe um aluno cadastrado com esse e-mail.";
                return;
            }
        }

        const id = editandoId || push(ref(db, "alunos")).key;
        const agora = Date.now();
        let extra = "";

        if (!editandoId && senha) {
            const authSec = getAuthCadastro();
            try {
                const cred = await createUserWithEmailAndPassword(authSec, dados.email, senha);
                dados.uid = cred.user.uid;
            } catch (e) {
                if (e.code === "auth/email-already-in-use") extra = " Esse e-mail já tinha login no Firebase; a senha não foi alterada.";
                else if (e.code === "auth/operation-not-allowed") { msg.textContent = "O login por e-mail/senha não está ativado no Firebase."; return; }
                else throw e;
            } finally {
                await signOut(authSec).catch(() => {});
            }
        }

        const registro = { ...(antigo || {}), ...dados, criadoEm: antigo?.criadoEm || agora, atualizadoEm: agora };
        delete registro.id;
        if (antigo && antigo.planoId !== dados.planoId) registro.planoAnterior = antigo.plano || null;
        if (!registro.uid && antigo?.uid) registro.uid = antigo.uid;

        const mudancas = {
            ["alunos/" + id]: registro,
            ["emails/" + chaveNova]: {
                aluno: id, ativo: dados.ativo, vencimento: dados.vencimento, nome: dados.nome, plano: dados.plano,
                valor: dados.valor || null, diaFatura: registro.diaFatura || null, primeiraFatura: registro.primeiraFatura || null
            }
        };
        if (antigo && mudouEmail) mudancas["emails/" + chaveEmail(antigo.email)] = null;

        await update(ref(db), mudancas);
        fecharModal("modal-aluno");
        const mudouPlano = antigo && antigo.planoId !== dados.planoId && antigo.plano !== dados.plano;
        aviso((mudouPlano ? "Plano de " + dados.nome.split(" ")[0] + " mudou para " + dados.plano + "." : editandoId ? "Aluno atualizado." : "Aluno cadastrado.") + extra, "ok");
    } catch (e) {
        console.error(e);
        msg.textContent = mensagemErro(e);
    } finally {
        ocupado(botao, false);
    }
}

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
        aviso(mensagemErro(e, "Não foi possível alterar o acesso."), "error");
    }
}

async function excluir(aluno) {
    const ok = await confirmar({
        titulo: "Excluir aluno?",
        texto: aluno.nome + " (" + aluno.email + ") perde o acesso à área do aluno e sai da lista. Os treinos dele viram modelos. Essa ação não pode ser desfeita."
    });
    if (!ok) return;
    try {
        const mudancas = { ["alunos/" + aluno.id]: null, ["emails/" + chaveEmail(aluno.email)]: null };
        // Fichas de treino e feedbacks do aluno saem junto
        mudancas["fichas/" + aluno.id] = null;
        estado.feedbacks.filter((f) => f.alunoId === aluno.id).forEach((f) => { mudancas["feedbacks/" + f.id] = null; });
        estado.depoimentos.filter((d) => d.alunoId === aluno.id).forEach((d) => { mudancas["depoimentos/" + d.id] = null; mudancas["depoimentosPublicos/" + d.id] = null; });
        await update(ref(db), mudancas);
        aviso(aluno.nome + " foi excluído.", "ok");
    } catch (e) {
        console.error(e);
        aviso(mensagemErro(e, "Não foi possível excluir."), "error");
    }
}
