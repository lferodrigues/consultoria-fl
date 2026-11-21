// Tela: Biblioteca de exercícios (dentro de Treinos)
//   exercicios/{id} -> { nome, categoria, equipamento, video, descricao, atualizadoEm }
import { ref, push, update, remove } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { db } from "./firebase-app.js?v=2";
import { CATEGORIAS, categoriaPorId, SUGERIDOS } from "./exercicios-dados.js?v=1";
import { $, estado, aoMudar, esc, aviso, abrirModal, fecharModal, confirmar, mensagemErro, ocupado } from "./admin-core.js?v=1";

let catAtual = "";       // "" = todas
let editandoId = null;

const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export function iniciar() {
    $("x-categoria").innerHTML = CATEGORIAS.map((c) => `<option value="${c.id}">${c.nome}</option>`).join("");
    aoMudar(desenhar);
    $("ex-busca").addEventListener("input", desenharLista);
    $("ex-cats").addEventListener("click", (ev) => {
        const b = ev.target.closest("button[data-cat]");
        if (b) location.hash = "#/exercicios" + (b.dataset.cat ? "/" + b.dataset.cat : "");
    });
    $("ex-tbody").addEventListener("click", (ev) => {
        const btn = ev.target.closest("button[data-acao]");
        if (!btn) return;
        const x = estado.exercicios.find((e) => e.id === btn.dataset.id);
        if (!x) return;
        if (btn.dataset.acao === "editar") abrir(x);
        if (btn.dataset.acao === "excluir") excluir(x);
    });
    $("exercicio-form").addEventListener("submit", salvar);
    $("ex-importar").addEventListener("click", importar);
}

export function novo(aoFechar) { abrir(null, aoFechar); }

export function selecionarCategoria(cat) {
    catAtual = CATEGORIAS.some((c) => c.id === cat) ? cat : "";
    desenhar();
}

export const categoriaAtual = () => catAtual;

export function contarPorCategoria() {
    const n = {};
    estado.exercicios.forEach((e) => { n[e.categoria] = (n[e.categoria] || 0) + 1; });
    return n;
}

/* ---------- Telas ---------- */

function desenhar() {
    const n = contarPorCategoria();
    $("ex-cats").innerHTML =
        `<button type="button" class="cat${catAtual === "" ? " ativo" : ""}" data-cat=""><i class="fa-solid fa-layer-group"></i><span>Todos</span><small>${estado.exercicios.length}</small></button>` +
        CATEGORIAS.map((c) => `<button type="button" class="cat${catAtual === c.id ? " ativo" : ""}" data-cat="${c.id}"><i class="fa-solid ${c.icone}"></i><span>${c.nome}</span><small>${n[c.id] || 0}</small></button>`).join("");
    $("ex-titulo").textContent = catAtual ? categoriaPorId(catAtual).nome : "Todos os exercícios";
    desenharLista();
}

function desenharLista() {
    const termo = norm($("ex-busca").value);
    const lista = estado.exercicios
        .filter((e) => (!catAtual || e.categoria === catAtual) && (!termo || norm(e.nome + " " + e.equipamento).includes(termo)))
        .sort((a, b) => CATEGORIAS.findIndex((c) => c.id === a.categoria) - CATEGORIAS.findIndex((c) => c.id === b.categoria) || (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

    $("ex-tbody").innerHTML = lista.map((e) => {
        const c = categoriaPorId(e.categoria);
        return `
        <tr>
            <td class="td-aluno"><div class="aluno-nome">${esc(e.nome)}</div>${e.descricao ? `<div class="aluno-email">${esc(e.descricao.length > 90 ? e.descricao.slice(0, 90) + "…" : e.descricao)}</div>` : ""}</td>
            <td data-label="Grupo"><span class="tag red"><i class="fa-solid ${c.icone}"></i> ${esc(c.nome)}</span></td>
            <td data-label="Equipamento">${esc(e.equipamento || "—")}</td>
            <td data-label="Vídeo">${e.video ? `<a class="link-video" href="${esc(e.video)}" target="_blank" rel="noopener"><i class="fa-brands fa-youtube"></i> Ver</a>` : "—"}</td>
            <td class="td-actions"><div class="actions">
                <button type="button" class="icon-btn" data-acao="editar" data-id="${e.id}" title="Editar" aria-label="Editar ${esc(e.nome)}"><i class="fa-solid fa-pen"></i></button>
                <button type="button" class="icon-btn danger" data-acao="excluir" data-id="${e.id}" title="Excluir" aria-label="Excluir ${esc(e.nome)}"><i class="fa-solid fa-trash"></i></button>
            </div></td>
        </tr>`;
    }).join("");

    $("ex-vazio").hidden = lista.length > 0;
    $("ex-vazio-txt").textContent = estado.exercicios.length === 0
        ? "A biblioteca está vazia. Clique em \"Importar sugeridos\" para começar com exercícios comuns de cada grupo, ou cadastre os seus."
        : catAtual && !termo
            ? "Nenhum exercício de " + categoriaPorId(catAtual).nome + " ainda. Clique em \"Novo exercício\"."
            : "Nenhum exercício encontrado.";
}

/* ---------- Formulário ---------- */

function abrir(x, aoFechar) {
    editandoId = x ? x.id : null;
    $("exf-titulo").textContent = x ? "Editar exercício" : "Novo exercício";
    $("exf-msg").textContent = "";
    $("x-nome").value = x?.nome || "";
    $("x-categoria").value = x?.categoria || catAtual || "peito";
    $("x-equip").value = x?.equipamento || "";
    $("x-video").value = x?.video || "";
    $("x-descricao").value = x?.descricao || "";
    abrirModal("modal-exercicio", "x-nome", aoFechar);
}

async function salvar(ev) {
    ev.preventDefault();
    const msg = $("exf-msg");
    msg.textContent = "";
    const nome = $("x-nome").value.trim();
    const categoria = $("x-categoria").value;
    const video = $("x-video").value.trim();
    if (!nome) return (msg.textContent = "Digite o nome do exercício.");
    if (video && !/^https?:\/\//i.test(video)) return (msg.textContent = "O link do vídeo precisa começar com https://");
    const repetido = estado.exercicios.find((e) => e.id !== editandoId && e.categoria === categoria && norm(e.nome) === norm(nome));
    if (repetido) return (msg.textContent = "Já existe \"" + repetido.nome + "\" em " + categoriaPorId(categoria).nome + ".");

    const botao = $("exf-salvar");
    ocupado(botao, true);
    try {
        const id = editandoId || push(ref(db, "exercicios")).key;
        await update(ref(db, "exercicios/" + id), {
            nome, categoria,
            equipamento: $("x-equip").value.trim(),
            video,
            descricao: $("x-descricao").value.trim(),
            atualizadoEm: Date.now()
        });
        fecharModal("modal-exercicio");
        aviso(editandoId ? "Exercício atualizado." : "Exercício adicionado em " + categoriaPorId(categoria).nome + ".", "ok");
    } catch (e) {
        console.error(e);
        msg.textContent = mensagemErro(e);
    } finally {
        ocupado(botao, false);
    }
}

async function excluir(x) {
    if (!(await confirmar({ titulo: "Excluir exercício?", texto: "\"" + x.nome + "\" sai da biblioteca. Os treinos que já usam esse exercício não mudam." }))) return;
    try {
        await remove(ref(db, "exercicios/" + x.id));
        aviso("Exercício excluído.", "ok");
    } catch (e) {
        console.error(e);
        aviso(mensagemErro(e, "Não foi possível excluir."), "error");
    }
}

// Adiciona os exercícios sugeridos que ainda não existem (de todos os grupos, ou só do grupo aberto)
async function importar() {
    const grupos = catAtual ? [catAtual] : CATEGORIAS.map((c) => c.id);
    const nomeGrupo = catAtual ? categoriaPorId(catAtual).nome : "todos os grupos";
    const existentes = new Set(estado.exercicios.map((e) => e.categoria + "|" + norm(e.nome)));
    const mudancas = {};
    let n = 0;
    grupos.forEach((cat) => (SUGERIDOS[cat] || []).forEach(([nome, equipamento]) => {
        if (existentes.has(cat + "|" + norm(nome))) return;
        mudancas["exercicios/" + push(ref(db, "exercicios")).key] = { nome, categoria: cat, equipamento, video: "", descricao: "", atualizadoEm: Date.now() };
        n++;
    }));
    if (!n) return aviso("Os exercícios sugeridos de " + nomeGrupo + " já estão na biblioteca.", "ok");
    if (!(await confirmar({ titulo: "Importar exercícios sugeridos?", texto: n + " exercícios comuns de " + nomeGrupo + " serão adicionados. Você pode editar ou excluir qualquer um depois.", botao: "Importar" }))) return;
    try {
        await update(ref(db), mudancas);
        aviso(n + " exercícios adicionados à biblioteca.", "ok");
    } catch (e) {
        console.error(e);
        aviso(mensagemErro(e, "Não foi possível importar."), "error");
    }
}
