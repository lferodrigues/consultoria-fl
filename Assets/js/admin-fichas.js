// Tela: Treinos — fichas de treino por aluno (histórico) e "Cadastrar ficha de treino"
//   fichas/{alunoId}/{fichaId}  (estrutura em fichas-util.js)
//   feedbacks/{id} -> { alunoId, nome, fichaId, fichaNome, dia, diaNome, data, esforco, comentario, feitos, total, criadoEm, lido }
import { ref, push, update, remove } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { db, hojeISO } from "./firebase-app.js?v=2";
import { situacao, dataBR } from "./alunos-util.js?v=2";
import { DIAS, diaPorId, PADRAO_DIAS, diasDaFicha, exerciciosDe, ordenarFichas, ESFORCO, trocaDaFicha, diasParaTroca, textoTroca, AVISO_TROCA_DIAS } from "./fichas-util.js?v=2";
import { CATEGORIAS, categoriaPorId } from "./exercicios-dados.js?v=1";
import { $, estado, aoMudar, esc, aviso, abrirModal, fecharModal, confirmar, mensagemErro, ocupado } from "./admin-core.js?v=1";
import { daAluno, foneWhats } from "./admin-inscricoes.js?v=6";
import { PAGINAS } from "./firebase-app.js?v=2";

const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]/g, "").trim();
const LETRAS = "ABCDEFG";

let abertos = new Set();          // alunos expandidos no histórico
let editando = null;              // { alunoId, id } ao editar
let qtdDias = 0;
let diasEscolhidos = [];          // ["seg", "qua", ...]
let diaAtivo = null;
const paineis = new Map();        // dia -> elemento do painel (preserva o que foi digitado)
let escolhidos = new Set();
let catEscolha = "";

/* =================== Início =================== */

export function iniciar() {
    aoMudar(() => { desenhar(); preencherSugestoes(); if (!$("modal-escolher").hidden) desenharEscolha(); });
    $("fh-busca").addEventListener("input", desenhar);
    $("fh-filtro").addEventListener("change", desenhar);
    $("fh-lista").addEventListener("click", acaoHistorico);

    // Formulário
    $("fc-qtd").innerHTML = [1, 2, 3, 4, 5, 6, 7].map((n) => `<button type="button" class="qtd-btn" data-n="${n}" role="radio" aria-checked="false">${n}</button>`).join("");
    $("fc-semana").innerHTML = DIAS.map((d) => `<button type="button" class="dia-btn" data-dia="${d.id}" aria-pressed="false" title="${d.nome}"><b>${d.letra}</b><small>${d.curto}</small></button>`).join("");
    $("fc-aluno").addEventListener("change", aoEscolherAluno);
    $("fc-qtd").addEventListener("click", (ev) => { const b = ev.target.closest("[data-n]"); if (b) definirQuantidade(Number(b.dataset.n), true); });
    $("fc-semana").addEventListener("click", (ev) => { const b = ev.target.closest("[data-dia]"); if (b) alternarDia(b.dataset.dia); });
    $("fc-tabs").addEventListener("click", (ev) => { const b = ev.target.closest("[data-dia]"); if (b) mostrarDia(b.dataset.dia); });
    $("fc-dias").addEventListener("click", acaoNoDia);
    $("fc-dias").addEventListener("change", completarDaBiblioteca);
    $("ficha-form").addEventListener("submit", salvar);

    // Escolher da biblioteca
    $("esc-cats").addEventListener("click", (ev) => { const b = ev.target.closest("button[data-cat]"); if (b) { catEscolha = b.dataset.cat; desenharEscolha(); } });
    $("esc-busca").addEventListener("input", desenharEscolha);
    $("esc-lista").addEventListener("change", (ev) => {
        if (ev.target.type !== "checkbox") return;
        if (ev.target.checked) escolhidos.add(ev.target.value); else escolhidos.delete(ev.target.value);
        contarEscolha();
    });
    $("esc-ok").addEventListener("click", adicionarEscolhidos);
}

export function novo(aoFechar) { abrir(null, aoFechar); }

// Primeira ficha de um aluno que veio da inscrição: aluno escolhido, objetivo e dias da ficha de inscrição
const OBJETIVOS = ["Hipertrofia", "Emagrecimento", "Força", "Condicionamento", "Mobilidade", "Reabilitação"];
export function primeiraFicha(alunoId) {
    const aluno = estado.alunos.find((a) => a.id === alunoId);
    if (!aluno) { aviso("Aluno não encontrado. Confira em Alunos.", "error"); return; }
    const ins = daAluno(alunoId, aluno.uid);
    const objetivo = OBJETIVOS.find((o) => norm(ins?.objetivo || "").startsWith(norm(o))) || (ins ? (/saude/.test(norm(ins.objetivo)) ? "Condicionamento" : "Outro") : undefined);
    abrir({ alunoId, objetivo }, null);
    const n = Number(ins?.diasTreino);
    if (n >= 1 && n <= 7) definirQuantidade(n, true);
}

// Resumo da inscrição (objetivo, rotina e saúde) dentro do cadastro da ficha
function resumoInscricao(a) {
    const ins = a ? daAluno(a.id, a.uid) : null;
    const box = $("fc-insc");
    box.hidden = !ins;
    if (!ins) return;
    const item = (r, nome) => r?.tem ? `<li class="alerta"><b>${nome}:</b> ${esc(r.qual)}</li>` : "";
    const saude = item(ins.lesao, "Lesão") + item(ins.saude, "Saúde") + item(ins.medicamento, "Medicamento");
    box.innerHTML = `
        <strong><i class="fa-solid fa-file-signature"></i> Da ficha de inscrição</strong>
        <ul>
            <li><b>Objetivo:</b> ${esc(ins.objetivo || "—")}</li>
            <li><b>Rotina:</b> ${ins.diasTreino || "?"}x por semana · ${esc(ins.tempoDia || "")} por dia</li>
            <li><b>Corpo:</b> ${esc(ins.sexo || "")}, ${ins.idade || "?"} anos · ${ins.peso || "?"} kg · ${ins.altura || "?"} cm</li>
            ${saude || '<li><b>Saúde:</b> sem lesões, problemas de saúde ou medicamentos</li>'}
        </ul>
        <a href="#/inscricoes/${esc(ins.id)}" class="drop-link" data-fechar>Ver inscrição completa</a>`;
}

// Abre (e rola até) um aluno no histórico — usado pelas notificações
export function focarAluno(alunoId) {
    abertos.add(alunoId);
    marcarFeedbacksLidos(alunoId);
    desenhar();
    setTimeout(() => document.querySelector(`.hist-aluno[data-aluno="${alunoId}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
}

/* =================== Histórico =================== */

const fichasDoAluno = (id) => ordenarFichas(estado.fichas.filter((f) => f.alunoId === id));
const feedbacksDoAluno = (id) => estado.feedbacks.filter((f) => f.alunoId === id).sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));

function iniciais(nome) {
    return String(nome || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function chipsDias(ficha) {
    const ativos = new Set(diasDaFicha(ficha).map((d) => d.id));
    return `<span class="mini-semana">${DIAS.map((d) => `<i class="${ativos.has(d.id) ? "on" : ""}" title="${d.nome}">${d.letra}</i>`).join("")}</span>`;
}

function desenhar() {
    const termo = norm($("fh-busca").value);
    const filtro = $("fh-filtro").value;
    const hoje = hojeISO();
    const lista = estado.alunos.filter((a) => {
        const n = fichasDoAluno(a.id).length;
        const novos = feedbacksDoAluno(a.id).some((f) => !f.lido);
        if (filtro === "com" && !n) return false;
        if (filtro === "sem" && n) return false;
        if (filtro === "feedback" && !novos) return false;
        return !termo || norm(a.nome + " " + a.email).includes(termo);
    });

    $("fh-lista").innerHTML = lista.map((a) => {
        const fichas = fichasDoAluno(a.id);
        const fbs = feedbacksDoAluno(a.id);
        const novos = fbs.filter((f) => !f.lido).length;
        const s = situacao(a, hoje);
        const aberto = abertos.has(a.id);
        return `
        <article class="hist-aluno${aberto ? " aberto" : ""}" data-aluno="${a.id}">
            <button type="button" class="hist-head" data-acao="abrir" data-aluno="${a.id}" aria-expanded="${aberto}">
                <span class="avatar-mini">${esc(iniciais(a.nome))}</span>
                <span class="hist-nome"><strong>${esc(a.nome)}</strong><small>${esc(a.email)}</small></span>
                <span class="hist-meta">
                    ${novos ? `<span class="badge bad">${novos} feedback${novos > 1 ? "s" : ""} novo${novos > 1 ? "s" : ""}</span>` : ""}
                    <span class="tag">${fichas.length} ${fichas.length === 1 ? "ficha" : "fichas"}</span>
                    <span class="badge ${s.classe}">${s.texto}</span>
                </span>
                <i class="fa-solid fa-chevron-down chev"></i>
            </button>
            ${aberto ? corpoAluno(a, fichas, fbs) : ""}
        </article>`;
    }).join("");

    $("fh-vazio").hidden = lista.length > 0;
    $("fh-vazio-txt").textContent = estado.alunos.length === 0
        ? "Nenhum aluno cadastrado. Cadastre o aluno em Alunos e depois monte a ficha de treino dele aqui."
        : "Nenhum aluno encontrado com esse filtro.";
}

function corpoAluno(a, fichas, fbs) {
    const linhas = fichas.map((f, i) => {
        const dias = diasDaFicha(f);
        const total = dias.reduce((n, d) => n + exerciciosDe(d).length, 0);
        return `
        <tr>
            <td class="td-aluno"><div class="aluno-nome">${esc(f.nome || "Ficha de treino")}</div><div class="aluno-email">${esc([f.objetivo, f.nivel].filter(Boolean).join(" · "))}</div></td>
            <td data-label="Início">${dataBR(f.inicio)}${i === 0 && trocaDaFicha(f) ? `<div class="aluno-email">troca ${dataBR(trocaDaFicha(f))}${(() => { const d = diasParaTroca(f, hojeISO()); return d !== null && d <= AVISO_TROCA_DIAS ? ` <span class="badge ${d < 0 ? "bad" : "warn"}">${textoTroca(d)}</span>` : ""; })()}</div>` : ""}</td>
            <td data-label="Dias">${chipsDias(f)}</td>
            <td data-label="Exercícios">${total}</td>
            <td data-label="Situação">${i === 0 ? '<span class="badge ok">Atual</span>' : '<span class="badge off">Anterior</span>'}</td>
            <td class="td-actions"><div class="actions">
                <button type="button" class="icon-btn" data-acao="editar" data-aluno="${a.id}" data-id="${f.id}" title="Ver / editar" aria-label="Editar ${esc(f.nome)}"><i class="fa-solid fa-pen"></i></button>
                <button type="button" class="icon-btn" data-acao="duplicar" data-aluno="${a.id}" data-id="${f.id}" title="Nova ficha a partir desta" aria-label="Duplicar ${esc(f.nome)}"><i class="fa-regular fa-copy"></i></button>
                <button type="button" class="icon-btn danger" data-acao="excluir" data-aluno="${a.id}" data-id="${f.id}" title="Excluir" aria-label="Excluir ${esc(f.nome)}"><i class="fa-solid fa-trash"></i></button>
            </div></td>
        </tr>`;
    }).join("");

    const feedbacks = fbs.slice(0, 6).map((f) => {
        const e = ESFORCO[f.esforco] || { nome: f.esforco, classe: "off" };
        return `<li class="${f.lido ? "" : "novo"}">
            <div class="fb-top"><strong>${esc(diaPorId(f.dia).nome)} · ${esc(f.diaNome || "")}</strong><span class="badge ${e.classe}">Esforço ${e.nome.toLowerCase()}</span></div>
            <small>${dataBR(f.data)} · ${f.feitos ?? 0} de ${f.total ?? 0} exercícios feitos</small>
            ${f.comentario ? `<p>“${esc(f.comentario)}”</p>` : ""}
        </li>`;
    }).join("");

    return `
    <div class="hist-body">
        <div class="hist-acoes">
            <button type="button" class="btn btn-primary btn-sm" data-acao="nova" data-aluno="${a.id}"><i class="fa-solid fa-plus"></i> Nova ficha para ${esc(a.nome.split(" ")[0])}</button>
        </div>
        ${fichas.length ? `
        <div class="table-card inner">
            <table class="table">
                <thead><tr><th>Ficha</th><th>Início</th><th>Dias</th><th>Exercícios</th><th>Situação</th><th class="th-actions">Ações</th></tr></thead>
                <tbody>${linhas}</tbody>
            </table>
        </div>` : `<p class="hist-vazio">Nenhuma ficha cadastrada para ${esc(a.nome.split(" ")[0])} ainda.</p>`}
        <h4 class="hist-sub"><i class="fa-regular fa-comment-dots"></i> Feedbacks do aluno</h4>
        ${feedbacks ? `<ul class="fb-list">${feedbacks}</ul>` : '<p class="hist-vazio">Nenhum feedback recebido ainda.</p>'}
    </div>`;
}

function acaoHistorico(ev) {
    const b = ev.target.closest("[data-acao]");
    if (!b) return;
    const alunoId = b.dataset.aluno;
    const ficha = estado.fichas.find((f) => f.alunoId === alunoId && f.id === b.dataset.id);
    switch (b.dataset.acao) {
        case "abrir":
            if (abertos.has(alunoId)) abertos.delete(alunoId);
            else { abertos.add(alunoId); marcarFeedbacksLidos(alunoId); }
            desenhar();
            break;
        case "nova": abrir({ alunoId }); break;
        case "editar": if (ficha) abrir(ficha); break;
        case "duplicar": if (ficha) abrir({ ...ficha, id: null, nome: (ficha.nome || "Ficha") + " (nova)", inicio: hojeISO() }, null, true); break;
        case "excluir": if (ficha) excluir(ficha); break;
    }
}

export async function marcarFeedbacksLidos(alunoId) {
    const mudancas = {};
    estado.feedbacks.filter((f) => (!alunoId || f.alunoId === alunoId) && !f.lido).forEach((f) => { mudancas["feedbacks/" + f.id + "/lido"] = true; });
    if (!Object.keys(mudancas).length) return;
    try { await update(ref(db), mudancas); } catch (e) { console.error(e); }
}

async function excluir(f) {
    const aluno = estado.alunos.find((a) => a.id === f.alunoId);
    if (!(await confirmar({ titulo: "Excluir ficha?", texto: "A ficha \"" + (f.nome || "de treino") + "\" de " + (aluno?.nome || "aluno") + " será apagada. Essa ação não pode ser desfeita." }))) return;
    try {
        await remove(ref(db, "fichas/" + f.alunoId + "/" + f.id));
        aviso("Ficha excluída.", "ok");
    } catch (e) {
        console.error(e);
        aviso(mensagemErro(e, "Não foi possível excluir."), "error");
    }
}

/* =================== Cadastrar ficha =================== */

// Mostra embaixo do campo "Duração" quando a ficha deve ser trocada
function infoTroca() {
    const t = trocaDaFicha({ inicio: $("fc-inicio").value || hojeISO(), duracaoMeses: Number($("fc-duracao").value) });
    $("fc-troca-info").textContent = t ? "Troca em " + dataBR(t) + ". Você e o aluno são avisados " + AVISO_TROCA_DIAS + " dias antes." : "";
}
let infoTrocaLigada = false;
function ligarInfoTroca() {
    if (infoTrocaLigada) return;
    infoTrocaLigada = true;
    $("fc-duracao").addEventListener("change", infoTroca);
    $("fc-inicio").addEventListener("change", infoTroca);
}

function abrir(f, aoFechar, copia = false) {
    ligarInfoTroca();
    editando = f && f.id && !copia ? { alunoId: f.alunoId, id: f.id } : null;
    $("fc-titulo").textContent = editando ? "Editar ficha de treino" : copia ? "Nova ficha a partir de outra" : "Cadastrar ficha de treino";
    $("fc-msg").textContent = "";

    const alunos = [...estado.alunos].sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
    $("fc-aluno").innerHTML = '<option value="">— Selecione o aluno —</option>' + alunos.map((a) => `<option value="${a.id}">${esc(a.nome)} (${esc(a.email)})</option>`).join("");
    $("fc-aluno").value = f?.alunoId && alunos.some((a) => a.id === f.alunoId) ? f.alunoId : "";
    $("fc-aluno").disabled = !!editando; // a ficha pertence ao aluno; para outro aluno, use "duplicar"

    $("fc-nome").value = f?.nome || "";
    $("fc-inicio").value = f?.inicio || hojeISO();
    // Duração: a da ficha; ficha nova começa com 2 meses
    $("fc-duracao").value = f?.duracaoMeses ? String(f.duracaoMeses) : (f && f.id && !copia ? "" : "2");
    infoTroca();
    $("fc-objetivo").value = f?.objetivo || "Hipertrofia";
    $("fc-nivel").value = f?.nivel || "Intermediário";
    $("fc-obs").value = f?.obs || "";

    // Dias e exercícios
    paineis.clear();
    $("fc-dias").innerHTML = "";
    const dias = f ? diasDaFicha(f) : [];
    diasEscolhidos = dias.map((d) => d.id);
    dias.forEach((d) => criarPainel(d.id, d));
    definirQuantidade(dias.length || 0, false);

    aoEscolherAluno();
    if (!alunos.length) $("fc-aluno-info").textContent = "Nenhum aluno cadastrado. Cadastre o aluno primeiro em Alunos → Cadastrar aluno.";
    abrirModal("modal-ficha", editando ? "fc-nome" : "fc-aluno", aoFechar);
}

function aoEscolherAluno() {
    const a = estado.alunos.find((x) => x.id === $("fc-aluno").value);
    $("fc-resto").hidden = !a;
    resumoInscricao(a);
    if (!a) { $("fc-aluno-info").textContent = "Escolha o aluno para montar a ficha."; return; }
    const n = estado.fichas.filter((f) => f.alunoId === a.id).length;
    $("fc-aluno-info").textContent = (a.plano ? "Plano " + a.plano + " · " : "") + (n ? n + (n === 1 ? " ficha anterior" : " fichas anteriores") : "primeira ficha");
    if (!$("fc-nome").value.trim()) {
        const mes = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        $("fc-nome").value = "Ficha de " + mes;
    }
}

function definirQuantidade(n, sugerir) {
    qtdDias = n;
    $("fc-qtd").querySelectorAll("[data-n]").forEach((b) => {
        const on = Number(b.dataset.n) === n;
        b.classList.toggle("ativo", on);
        b.setAttribute("aria-checked", String(on));
    });
    if (sugerir) {
        // Mantém os dias já escolhidos que couberem e completa com a sugestão
        const manter = diasEscolhidos.slice(0, n);
        const sugestao = PADRAO_DIAS[n].filter((d) => !manter.includes(d));
        diasEscolhidos = DIAS.map((d) => d.id).filter((d) => manter.includes(d) || sugestao.slice(0, n - manter.length).includes(d));
    }
    atualizarDias();
}

function alternarDia(dia) {
    if (!qtdDias) { $("fc-semana-hint").textContent = "Primeiro escolha quantos dias de treino na semana."; return; }
    if (diasEscolhidos.includes(dia)) {
        diasEscolhidos = diasEscolhidos.filter((d) => d !== dia);
    } else {
        if (diasEscolhidos.length >= qtdDias) {
            $("fc-semana-hint").textContent = "Já são " + qtdDias + " dias. Desmarque um dia ou aumente a quantidade.";
            $("fc-semana-hint").classList.add("alerta");
            return;
        }
        diasEscolhidos = DIAS.map((d) => d.id).filter((d) => d === dia || diasEscolhidos.includes(d));
    }
    atualizarDias();
}

function atualizarDias() {
    const faltam = qtdDias - diasEscolhidos.length;
    $("fc-semana-hint").classList.toggle("alerta", false);
    $("fc-semana-hint").textContent = !qtdDias ? "Escolha a quantidade de dias acima."
        : faltam > 0 ? "Escolha mais " + faltam + (faltam === 1 ? " dia:" : " dias:")
        : "Dias de treino: " + diasEscolhidos.map((d) => diaPorId(d).nome).join(", ") + ".";
    $("fc-semana").querySelectorAll("[data-dia]").forEach((b) => {
        const on = diasEscolhidos.includes(b.dataset.dia);
        b.classList.toggle("ativo", on);
        b.setAttribute("aria-pressed", String(on));
        b.disabled = !qtdDias;
    });

    // Cria painéis para os dias novos (os já existentes guardam o que foi digitado)
    diasEscolhidos.forEach((d) => { if (!paineis.has(d)) criarPainel(d); });
    paineis.forEach((el, d) => { el.dataset.escolhido = diasEscolhidos.includes(d) ? "1" : ""; });
    nomearTreinos();

    $("fc-passo3").hidden = diasEscolhidos.length === 0;
    $("fc-tabs").innerHTML = diasEscolhidos.map((d, i) => {
        const n = paineis.get(d).querySelectorAll(".ex-row").length ? [...paineis.get(d).querySelectorAll('.ex-row [data-c="nome"]')].filter((x) => x.value.trim()).length : 0;
        return `<button type="button" class="dia-tab" data-dia="${d}" role="tab"><b>${diaPorId(d).nome}</b><small>Treino ${LETRAS[i]} · ${n} exerc.</small></button>`;
    }).join("");
    mostrarDia(diasEscolhidos.includes(diaAtivo) ? diaAtivo : diasEscolhidos[0]);
}

// Nome padrão "Treino A, B, C..." seguindo a ordem dos dias (só se o nome ainda for o padrão)
function nomearTreinos() {
    diasEscolhidos.forEach((d, i) => {
        const input = paineis.get(d).querySelector('[data-c="dia-nome"]');
        if (!input.value.trim() || /^Treino [A-G]$/.test(input.value.trim())) input.value = "Treino " + LETRAS[i];
    });
}

function mostrarDia(dia) {
    diaAtivo = dia || null;
    paineis.forEach((el, d) => { el.hidden = d !== diaAtivo || !diasEscolhidos.includes(d); });
    $("fc-tabs").querySelectorAll("[data-dia]").forEach((b) => {
        b.classList.toggle("ativo", b.dataset.dia === diaAtivo);
        b.setAttribute("aria-selected", String(b.dataset.dia === diaAtivo));
    });
}

function criarPainel(diaId, dados) {
    const d = diaPorId(diaId);
    const el = document.createElement("div");
    el.className = "dia-painel";
    el.dataset.dia = diaId;
    el.hidden = true;
    el.innerHTML = `
        <div class="grid-2"><label class="full">Nome do treino de ${d.nome}<input type="text" data-c="dia-nome" maxlength="60" autocomplete="off" placeholder="Ex.: Treino A — Inferiores"></label></div>
        <div class="ex-head">
            <h3>Exercícios de ${d.nome}</h3>
            <div class="ex-head-btns">
                <button type="button" class="btn btn-primary btn-sm" data-acao-dia="biblioteca"><i class="fa-solid fa-book-open"></i> Da biblioteca</button>
                <button type="button" class="btn btn-ghost btn-sm" data-acao-dia="branco"><i class="fa-solid fa-plus"></i> Em branco</button>
            </div>
        </div>
        <div class="ex-list"></div>`;
    el.querySelector('[data-c="dia-nome"]').value = dados?.nome || "";
    const lista = el.querySelector(".ex-list");
    const ex = dados ? exerciciosDe(dados) : [];
    if (ex.length) ex.forEach((e) => lista.appendChild(linhaExercicio(e)));
    else for (let i = 0; i < 3; i++) lista.appendChild(linhaExercicio());
    numerar(lista);
    $("fc-dias").appendChild(el);
    paineis.set(diaId, el);
    return el;
}

function linhaExercicio(e = {}) {
    const div = document.createElement("div");
    div.className = "ex-row";
    div.innerHTML = `
        <span class="ex-n"></span>
        <label class="ex-nome">Exercício<input type="text" data-c="nome" list="dl-exercicios" placeholder="Digite ou escolha da biblioteca" autocomplete="off"></label>
        <label>Séries<input type="text" data-c="series" inputmode="numeric" placeholder="4" autocomplete="off"></label>
        <label>Repetições<input type="text" data-c="reps" placeholder="10-12" autocomplete="off"></label>
        <label>Carga<input type="text" data-c="carga" placeholder="20 kg" autocomplete="off"></label>
        <label>Descanso<input type="text" data-c="descanso" placeholder="60s" autocomplete="off"></label>
        <div class="ex-actions">
            <button type="button" class="icon-btn" data-ex="subir" title="Subir" aria-label="Mover para cima"><i class="fa-solid fa-arrow-up"></i></button>
            <button type="button" class="icon-btn" data-ex="descer" title="Descer" aria-label="Mover para baixo"><i class="fa-solid fa-arrow-down"></i></button>
            <button type="button" class="icon-btn danger" data-ex="remover" title="Remover" aria-label="Remover exercício"><i class="fa-solid fa-trash"></i></button>
        </div>
        <label class="ex-wide">Link do vídeo (YouTube)<input type="text" data-c="video" placeholder="https://youtube.com/..." autocomplete="off"></label>
        <label class="ex-wide">Observação<input type="text" data-c="obs" placeholder="Dica de execução (opcional)" autocomplete="off"></label>`;
    for (const c of ["nome", "series", "reps", "carga", "descanso", "video", "obs"]) div.querySelector(`[data-c="${c}"]`).value = e[c] || "";
    return div;
}

function numerar(lista) {
    const linhas = [...lista.querySelectorAll(".ex-row")];
    linhas.forEach((l, i) => { l.querySelector(".ex-n").textContent = i + 1; });
    const vazio = lista.querySelector(".ex-empty");
    if (!linhas.length && !vazio) lista.innerHTML = '<p class="ex-empty">Nenhum exercício neste dia. Use "Da biblioteca" ou "Em branco".</p>';
    if (linhas.length && vazio) vazio.remove();
}

function acaoNoDia(ev) {
    const painel = ev.target.closest(".dia-painel");
    if (!painel) return;
    const lista = painel.querySelector(".ex-list");
    const bDia = ev.target.closest("[data-acao-dia]");
    if (bDia?.dataset.acaoDia === "branco") {
        lista.querySelector(".ex-empty")?.remove();
        lista.appendChild(linhaExercicio());
        numerar(lista);
        lista.lastElementChild.querySelector('[data-c="nome"]').focus();
        return;
    }
    if (bDia?.dataset.acaoDia === "biblioteca") return abrirEscolha();
    const bEx = ev.target.closest("[data-ex]");
    if (!bEx) return;
    const linha = bEx.closest(".ex-row");
    if (bEx.dataset.ex === "remover") linha.remove();
    if (bEx.dataset.ex === "subir" && linha.previousElementSibling) lista.insertBefore(linha, linha.previousElementSibling);
    if (bEx.dataset.ex === "descer" && linha.nextElementSibling) lista.insertBefore(linha.nextElementSibling, linha);
    numerar(lista);
}

/* ---------- Biblioteca de exercícios ---------- */

function preencherSugestoes() {
    $("dl-exercicios").innerHTML = [...estado.exercicios]
        .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"))
        .map((e) => `<option value="${esc(e.nome)}">${esc(categoriaPorId(e.categoria).nome)}</option>`).join("");
}

function completarDaBiblioteca(ev) {
    if (ev.target.dataset.c !== "nome") return;
    const n = norm(ev.target.value);
    const x = n && estado.exercicios.find((e) => norm(e.nome) === n);
    if (!x) return;
    const linha = ev.target.closest(".ex-row");
    if (!linha.querySelector('[data-c="video"]').value.trim()) linha.querySelector('[data-c="video"]').value = x.video || "";
    if (!linha.querySelector('[data-c="obs"]').value.trim()) linha.querySelector('[data-c="obs"]').value = x.descricao || "";
}

function abrirEscolha() {
    escolhidos = new Set();
    catEscolha = "";
    $("esc-busca").value = "";
    $("esc-titulo").textContent = "Adicionar ao treino de " + diaPorId(diaAtivo).nome;
    desenharEscolha();
    abrirModal("modal-escolher", "esc-busca");
}

function desenharEscolha() {
    const n = {};
    estado.exercicios.forEach((e) => { n[e.categoria] = (n[e.categoria] || 0) + 1; });
    $("esc-cats").innerHTML =
        `<button type="button" class="chip${catEscolha === "" ? " ativo" : ""}" data-cat="">Todos <small>${estado.exercicios.length}</small></button>` +
        CATEGORIAS.map((c) => `<button type="button" class="chip${catEscolha === c.id ? " ativo" : ""}" data-cat="${c.id}"><i class="fa-solid ${c.icone}"></i> ${c.nome} <small>${n[c.id] || 0}</small></button>`).join("");
    const termo = norm($("esc-busca").value);
    const lista = estado.exercicios
        .filter((e) => (!catEscolha || e.categoria === catEscolha) && (!termo || norm(e.nome + " " + e.equipamento).includes(termo)))
        .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
    $("esc-lista").innerHTML = lista.length
        ? lista.map((e) => `<label><input type="checkbox" value="${e.id}" ${escolhidos.has(e.id) ? "checked" : ""}> ${esc(e.nome)} <small>${esc(categoriaPorId(e.categoria).nome)}${e.equipamento ? " · " + esc(e.equipamento) : ""}</small></label>`).join("")
        : `<p class="ex-empty">${estado.exercicios.length ? "Nenhum exercício neste grupo." : "A biblioteca está vazia. Cadastre exercícios em Treinos → Biblioteca de exercícios."}</p>`;
    contarEscolha();
}

function contarEscolha() {
    const k = escolhidos.size;
    $("esc-n").textContent = k ? k + (k === 1 ? " exercício selecionado" : " exercícios selecionados") : "Nenhum selecionado";
    $("esc-ok").disabled = k === 0;
}

function adicionarEscolhidos() {
    const painel = paineis.get(diaAtivo);
    if (!painel) return fecharModal("modal-escolher");
    const lista = painel.querySelector(".ex-list");
    const selecionados = estado.exercicios.filter((e) => escolhidos.has(e.id))
        .sort((a, b) => CATEGORIAS.findIndex((c) => c.id === a.categoria) - CATEGORIAS.findIndex((c) => c.id === b.categoria) || (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
    const vazias = [...lista.querySelectorAll(".ex-row")].filter((l) => !l.querySelector('[data-c="nome"]').value.trim());
    selecionados.forEach((x) => {
        const linha = vazias.shift();
        if (linha) {
            linha.querySelector('[data-c="nome"]').value = x.nome;
            linha.querySelector('[data-c="video"]').value = x.video || "";
            linha.querySelector('[data-c="obs"]').value = x.descricao || "";
        } else {
            lista.querySelector(".ex-empty")?.remove();
            lista.appendChild(linhaExercicio({ nome: x.nome, video: x.video, obs: x.descricao }));
        }
    });
    numerar(lista);
    fecharModal("modal-escolher");
    atualizarDias();
    aviso(selecionados.length + (selecionados.length === 1 ? " exercício adicionado em " : " exercícios adicionados em ") + diaPorId(diaAtivo).nome + ".", "ok");
}

/* ---------- Salvar ---------- */

function lerDia(diaId) {
    const painel = paineis.get(diaId);
    const exercicios = [...painel.querySelectorAll(".ex-row")].map((l) => {
        const v = (c) => l.querySelector(`[data-c="${c}"]`).value.trim();
        return { nome: v("nome"), series: v("series"), reps: v("reps"), carga: v("carga"), descanso: v("descanso"), video: v("video"), obs: v("obs") };
    }).filter((e) => e.nome);
    return { nome: painel.querySelector('[data-c="dia-nome"]').value.trim(), exercicios };
}

export function mensagemPrimeiraFicha(nome) {
    const login = new URL(PAGINAS.login, location.href).href;
    return "Olá, " + String(nome || "").split(" ")[0] + "! Aqui é o Fagner Lage. 💪\n\n" +
        "A sua primeira ficha de treino já está cadastrada! A sua área do aluno foi liberada: lá você vê os exercícios de cada dia, os vídeos e manda o feedback do treino.\n\n" +
        "Acesse: " + login + "\n\nBons treinos!";
}

async function concluirPrimeiraFicha(aluno, fone, janela, agora) {
    // Inscrição vira "aluno ativo"
    const ins = aluno ? daAluno(aluno.id, aluno.uid) : null;
    if (ins && ins.status !== "ativo") {
        update(ref(db), { ["inscricoes/" + ins.id + "/status"]: "ativo", ["inscricoes/" + ins.id + "/primeiraFichaEm"]: agora }).catch((e) => console.error(e));
    }
    if (!fone) return;
    const url = "https://wa.me/" + fone + "?text=" + encodeURIComponent(mensagemPrimeiraFicha(aluno.nome));
    if (janela) { janela.opener = null; janela.location.href = url; return; }
    // Navegador bloqueou a janela: pergunta e abre no clique
    if (await confirmar({ titulo: "Avisar " + aluno.nome.split(" ")[0] + " no WhatsApp?", texto: "A primeira ficha foi salva. Envie a mensagem avisando que a área do aluno foi liberada.", botao: "Abrir WhatsApp" })) {
        const w = window.open(url, "_blank");
        if (w) w.opener = null;
    }
}

async function salvar(ev) {
    ev.preventDefault();
    const msg = $("fc-msg");
    msg.textContent = "";
    const alunoId = editando ? editando.alunoId : $("fc-aluno").value;
    if (!alunoId) return (msg.textContent = "Selecione o aluno.");
    if (!qtdDias) return (msg.textContent = "Escolha quantos dias de treino na semana.");
    if (diasEscolhidos.length !== qtdDias) return (msg.textContent = "Escolha " + qtdDias + (qtdDias === 1 ? " dia" : " dias") + " da semana (faltam " + (qtdDias - diasEscolhidos.length) + ").");

    const dias = {};
    for (const [i, d] of diasEscolhidos.entries()) {
        const dia = lerDia(d);
        if (!dia.exercicios.length) {
            mostrarDia(d);
            return (msg.textContent = "Adicione pelo menos um exercício em " + diaPorId(d).nome + ".");
        }
        const videoRuim = dia.exercicios.find((e) => e.video && !/^https?:\/\//i.test(e.video));
        if (videoRuim) { mostrarDia(d); return (msg.textContent = "O link do vídeo de \"" + videoRuim.nome + "\" precisa começar com https://"); }
        dias[d] = { nome: dia.nome || "Treino " + LETRAS[i], exercicios: dia.exercicios };
    }

    // Primeira ficha do aluno: avisa no WhatsApp. A janela abre já no clique (senão o navegador bloqueia).
    const aluno = estado.alunos.find((a) => a.id === alunoId);
    const primeira = !editando && !estado.fichas.some((f) => f.alunoId === alunoId);
    const fone = primeira ? foneWhats(aluno?.telefone) : "";
    let janela = null;
    if (fone) { try { janela = window.open("", "_blank"); } catch (e) { janela = null; } }

    const botao = $("fc-salvar");
    ocupado(botao, true);
    try {
        const antigo = editando ? estado.fichas.find((f) => f.alunoId === editando.alunoId && f.id === editando.id) : null;
        const id = editando ? editando.id : push(ref(db, "fichas/" + alunoId)).key;
        const agora = Date.now();
        abertos.add(alunoId); // antes de salvar: o Firebase já redesenha a lista durante o salvamento
        await update(ref(db, "fichas/" + alunoId + "/" + id), {
            nome: $("fc-nome").value.trim() || "Ficha de treino",
            inicio: $("fc-inicio").value || hojeISO(),
            objetivo: $("fc-objetivo").value,
            nivel: $("fc-nivel").value,
            obs: $("fc-obs").value.trim(),
            diasPorSemana: qtdDias,
            duracaoMeses: Number($("fc-duracao").value) || null,
            troca: trocaDaFicha({ inicio: $("fc-inicio").value || hojeISO(), duracaoMeses: Number($("fc-duracao").value) }) || null,
            dias,
            criadoEm: antigo?.criadoEm || agora,
            atualizadoEm: agora
        });
        fecharModal("modal-ficha");
        desenhar();
        const nome = aluno?.nome || "o aluno";
        aviso(editando ? "Ficha atualizada." : primeira ? "Primeira ficha salva! A área do aluno de " + nome.split(" ")[0] + " foi liberada." : "Ficha salva. Ela já aparece na área do aluno de " + nome.split(" ")[0] + ".", "ok");
        if (location.hash !== "#/treinos") location.hash = "#/treinos";
        if (primeira) await concluirPrimeiraFicha(aluno, fone, janela, agora);
    } catch (e) {
        console.error(e);
        if (janela) janela.close();
        msg.textContent = mensagemErro(e);
    } finally {
        ocupado(botao, false);
    }
}
