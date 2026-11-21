// Tela: Treinos
//   treinos/{id} -> { nome, alunoId, objetivo, nivel, dias, obs, exercicios: [{nome, series, reps, carga, descanso, video, obs}], criadoEm, atualizadoEm }
import { ref, push, update, remove } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { db } from "./firebase-app.js?v=2";
import { $, estado, aoMudar, esc, aviso, abrirModal, fecharModal, confirmar, mensagemErro, ocupado, nomeAluno, opcoesAlunos } from "./admin-core.js?v=1";
import { CATEGORIAS, categoriaPorId } from "./exercicios-dados.js?v=1";

const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]/g, "").trim();
let escolhidos = new Set();
let catEscolha = "";

let editandoId = null;

export function iniciar() {
    aoMudar(() => { preencherFiltro(); desenhar(); preencherSugestoes(); if (!$("modal-escolher").hidden) desenharEscolha(); });
    $("tr-busca").addEventListener("input", desenhar);
    $("tr-filtro").addEventListener("change", desenhar);
    $("ex-add").addEventListener("click", () => { adicionarExercicio(); focarUltimo(); });
    $("ex-list").addEventListener("click", acaoExercicio);
    $("ex-list").addEventListener("change", completarDaBiblioteca);
    $("ex-da-biblioteca").addEventListener("click", abrirEscolha);
    $("esc-cats").addEventListener("click", (ev) => {
        const b = ev.target.closest("button[data-cat]");
        if (!b) return;
        catEscolha = b.dataset.cat;
        desenharEscolha();
    });
    $("esc-busca").addEventListener("input", desenharEscolha);
    $("esc-lista").addEventListener("change", (ev) => {
        if (ev.target.type !== "checkbox") return;
        if (ev.target.checked) escolhidos.add(ev.target.value); else escolhidos.delete(ev.target.value);
        contarEscolha();
    });
    $("esc-ok").addEventListener("click", adicionarEscolhidos);
    $("treino-form").addEventListener("submit", salvar);
    $("tr-lista").addEventListener("click", (ev) => {
        const btn = ev.target.closest("button[data-acao]");
        if (!btn) return;
        const t = estado.treinos.find((x) => x.id === btn.dataset.id);
        if (!t) return;
        if (btn.dataset.acao === "editar") abrir(t);
        if (btn.dataset.acao === "duplicar") abrir({ ...t, id: null, nome: t.nome + " (cópia)" }, null, true);
        if (btn.dataset.acao === "excluir") excluir(t);
    });
}

export function novo(aoFechar) { abrir(null, aoFechar); }

function exercicios(t) {
    // O Realtime Database pode devolver listas como objeto {0: ..., 1: ...}
    return Array.isArray(t.exercicios) ? t.exercicios.filter(Boolean) : Object.values(t.exercicios || {});
}

/* ---------- Lista ---------- */

function preencherFiltro() {
    const sel = $("tr-filtro");
    const atual = sel.value;
    sel.innerHTML = `<option value="">Todos os treinos</option><option value="__modelo">Modelos (sem aluno)</option>` + opcoesAlunos();
    sel.value = [...sel.options].some((o) => o.value === atual) ? atual : "";
}

function desenhar() {
    const termo = $("tr-busca").value.trim().toLowerCase();
    const filtro = $("tr-filtro").value;
    const lista = estado.treinos
        .filter((t) => {
            if (filtro === "__modelo" && t.alunoId) return false;
            if (filtro && filtro !== "__modelo" && t.alunoId !== filtro) return false;
            if (!termo) return true;
            const texto = [t.nome, t.objetivo, nomeAluno(t.alunoId), ...exercicios(t).map((e) => e.nome)].join(" ").toLowerCase();
            return texto.includes(termo);
        })
        .sort((a, b) => (b.atualizadoEm || 0) - (a.atualizadoEm || 0));

    $("tr-lista").innerHTML = lista.map((t) => {
        const ex = exercicios(t);
        const aluno = t.alunoId ? nomeAluno(t.alunoId) : "";
        return `
        <article class="item-card">
            <div class="item-top">
                <span class="item-ico"><i class="fa-solid fa-dumbbell"></i></span>
                <div>
                    <h3>${esc(t.nome)}</h3>
                    <span class="item-sub">${aluno ? '<i class="fa-solid fa-user"></i> ' + esc(aluno) : "Modelo — sem aluno"}</span>
                </div>
            </div>
            <div class="tags">
                <span class="tag red">${esc(t.objetivo || "—")}</span>
                <span class="tag">${esc(t.nivel || "—")}</span>
                <span class="tag">${ex.length} ${ex.length === 1 ? "exercício" : "exercícios"}</span>
                ${t.dias ? `<span class="tag">${esc(t.dias)}</span>` : ""}
            </div>
            <p class="item-desc">${esc(ex.slice(0, 4).map((e) => e.nome).join(" · ") || "Sem exercícios ainda.")}${ex.length > 4 ? " ..." : ""}</p>
            <div class="item-foot">
                <span class="item-sub">${t.atualizadoEm ? "Atualizado em " + new Date(t.atualizadoEm).toLocaleDateString("pt-BR") : ""}</span>
                <div class="actions">
                    <button type="button" class="icon-btn" data-acao="editar" data-id="${t.id}" title="Editar" aria-label="Editar ${esc(t.nome)}"><i class="fa-solid fa-pen"></i></button>
                    <button type="button" class="icon-btn" data-acao="duplicar" data-id="${t.id}" title="Duplicar" aria-label="Duplicar ${esc(t.nome)}"><i class="fa-regular fa-copy"></i></button>
                    <button type="button" class="icon-btn danger" data-acao="excluir" data-id="${t.id}" title="Excluir" aria-label="Excluir ${esc(t.nome)}"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        </article>`;
    }).join("");

    $("tr-vazio").hidden = lista.length > 0;
    $("tr-vazio-txt").textContent = estado.treinos.length === 0
        ? "Nenhum treino cadastrado ainda. Clique em \"Cadastrar treino\" para montar o primeiro."
        : "Nenhum treino encontrado com esse filtro.";
}

/* ---------- Biblioteca de exercícios no cadastro ---------- */

// Sugestões ao digitar o nome do exercício
function preencherSugestoes() {
    $("dl-exercicios").innerHTML = [...estado.exercicios]
        .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"))
        .map((e) => `<option value="${esc(e.nome)}">${esc(categoriaPorId(e.categoria).nome)}</option>`).join("");
}

function exercicioPorNome(nome) {
    const n = norm(nome);
    return n ? estado.exercicios.find((e) => norm(e.nome) === n) : null;
}

// Ao escolher um nome da biblioteca, traz o vídeo (ou a execução) se o campo estiver vazio
function completarDaBiblioteca(ev) {
    if (ev.target.dataset.c !== "nome") return;
    const x = exercicioPorNome(ev.target.value);
    const extra = ev.target.closest(".ex-row").querySelector('[data-c="extra"]');
    if (x && !extra.value.trim()) extra.value = x.video || x.descricao || "";
}

function abrirEscolha() {
    escolhidos = new Set();
    catEscolha = "";
    $("esc-busca").value = "";
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
    // Mantém a ordem da biblioteca na lista exibida
    const selecionados = estado.exercicios.filter((e) => escolhidos.has(e.id))
        .sort((a, b) => CATEGORIAS.findIndex((c) => c.id === a.categoria) - CATEGORIAS.findIndex((c) => c.id === b.categoria) || (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
    // Primeiro preenche as linhas que estão vazias, depois cria novas
    const vazias = [...$("ex-list").querySelectorAll(".ex-row")].filter((l) => !l.querySelector('[data-c="nome"]').value.trim());
    selecionados.forEach((x) => {
        const linha = vazias.shift();
        if (linha) {
            linha.querySelector('[data-c="nome"]').value = x.nome;
            linha.querySelector('[data-c="extra"]').value = x.video || x.descricao || "";
        } else {
            adicionarExercicio({ nome: x.nome, video: x.video, obs: x.video ? "" : x.descricao });
        }
    });
    fecharModal("modal-escolher");
    aviso(selecionados.length + (selecionados.length === 1 ? " exercício adicionado ao treino." : " exercícios adicionados ao treino."), "ok");
}

/* ---------- Formulário ---------- */

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
        <label class="ex-wide">Vídeo ou observação<input type="text" data-c="extra" placeholder="Link do vídeo (YouTube) ou dica de execução" autocomplete="off"></label>`;
    for (const c of ["nome", "series", "reps", "carga", "descanso"]) div.querySelector(`[data-c="${c}"]`).value = e[c] || "";
    div.querySelector('[data-c="extra"]').value = e.video || e.obs || "";
    return div;
}

function numerar() {
    const linhas = [...$("ex-list").querySelectorAll(".ex-row")];
    linhas.forEach((l, i) => { l.querySelector(".ex-n").textContent = i + 1; });
    const vazio = $("ex-list").querySelector(".ex-empty");
    if (!linhas.length && !vazio) $("ex-list").innerHTML = '<p class="ex-empty">Nenhum exercício. Clique em "Adicionar exercício".</p>';
    if (linhas.length && vazio) vazio.remove();
}

function adicionarExercicio(e) {
    $("ex-list").querySelector(".ex-empty")?.remove();
    $("ex-list").appendChild(linhaExercicio(e));
    numerar();
}

function focarUltimo() {
    const linhas = $("ex-list").querySelectorAll(".ex-row");
    linhas[linhas.length - 1]?.querySelector('[data-c="nome"]').focus();
}

function acaoExercicio(ev) {
    const btn = ev.target.closest("button[data-ex]");
    if (!btn) return;
    const linha = btn.closest(".ex-row");
    if (btn.dataset.ex === "remover") linha.remove();
    if (btn.dataset.ex === "subir" && linha.previousElementSibling) linha.parentNode.insertBefore(linha, linha.previousElementSibling);
    if (btn.dataset.ex === "descer" && linha.nextElementSibling) linha.parentNode.insertBefore(linha.nextElementSibling, linha);
    numerar();
}

function abrir(t, aoFechar, copia = false) {
    editandoId = t && !copia ? t.id : null;
    $("tr-titulo").textContent = copia ? "Duplicar treino" : t ? "Editar treino" : "Cadastrar treino";
    $("tr-msg").textContent = "";
    $("t-aluno").innerHTML = opcoesAlunos("Modelo — sem aluno");
    $("t-nome").value = t?.nome || "";
    $("t-aluno").value = t?.alunoId && estado.alunos.some((a) => a.id === t.alunoId) ? t.alunoId : "";
    $("t-objetivo").value = t?.objetivo || "Hipertrofia";
    $("t-nivel").value = t?.nivel || "Intermediário";
    $("t-dias").value = t?.dias || "";
    $("t-obs").value = t?.obs || "";
    $("ex-list").innerHTML = "";
    const lista = t ? exercicios(t) : [];
    if (lista.length) lista.forEach(adicionarExercicio);
    else { adicionarExercicio(); adicionarExercicio(); adicionarExercicio(); }
    abrirModal("modal-treino", "t-nome", aoFechar);
}

function lerExercicios() {
    return [...$("ex-list").querySelectorAll(".ex-row")].map((l) => {
        const v = (c) => l.querySelector(`[data-c="${c}"]`).value.trim();
        const extra = v("extra");
        const ehLink = /^https?:\/\//i.test(extra);
        return { nome: v("nome"), series: v("series"), reps: v("reps"), carga: v("carga"), descanso: v("descanso"), video: ehLink ? extra : "", obs: ehLink ? "" : extra };
    }).filter((e) => e.nome);
}

async function salvar(ev) {
    ev.preventDefault();
    const msg = $("tr-msg");
    msg.textContent = "";
    const nome = $("t-nome").value.trim();
    const lista = lerExercicios();
    if (!nome) return (msg.textContent = "Dê um nome ao treino.");
    if (!lista.length) return (msg.textContent = "Adicione pelo menos um exercício com nome.");

    const botao = $("tr-salvar");
    ocupado(botao, true);
    try {
        const antigo = editandoId ? estado.treinos.find((x) => x.id === editandoId) : null;
        const id = editandoId || push(ref(db, "treinos")).key;
        const agora = Date.now();
        await update(ref(db, "treinos/" + id), {
            nome,
            alunoId: $("t-aluno").value || null,
            objetivo: $("t-objetivo").value,
            nivel: $("t-nivel").value,
            dias: $("t-dias").value.trim(),
            obs: $("t-obs").value.trim(),
            exercicios: lista,
            criadoEm: antigo?.criadoEm || agora,
            atualizadoEm: agora
        });
        fecharModal("modal-treino");
        aviso(editandoId ? "Treino atualizado." : "Treino cadastrado.", "ok");
    } catch (e) {
        console.error(e);
        msg.textContent = mensagemErro(e);
    } finally {
        ocupado(botao, false);
    }
}

async function excluir(t) {
    if (!(await confirmar({ titulo: "Excluir treino?", texto: "\"" + t.nome + "\" será apagado. Essa ação não pode ser desfeita." }))) return;
    try {
        await remove(ref(db, "treinos/" + t.id));
        aviso("Treino excluído.", "ok");
    } catch (e) {
        console.error(e);
        aviso(mensagemErro(e, "Não foi possível excluir."), "error");
    }
}
