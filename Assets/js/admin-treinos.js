// Tela: Treinos
//   treinos/{id} -> { nome, alunoId, objetivo, nivel, dias, obs, exercicios: [{nome, series, reps, carga, descanso, video, obs}], criadoEm, atualizadoEm }
import { ref, push, update, remove } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { db } from "./firebase-app.js?v=2";
import { $, estado, aoMudar, esc, aviso, abrirModal, fecharModal, confirmar, mensagemErro, ocupado, nomeAluno, opcoesAlunos } from "./admin-core.js?v=1";

let editandoId = null;

export function iniciar() {
    aoMudar(() => { preencherFiltro(); desenhar(); });
    $("tr-busca").addEventListener("input", desenhar);
    $("tr-filtro").addEventListener("change", desenhar);
    $("ex-add").addEventListener("click", () => { adicionarExercicio(); focarUltimo(); });
    $("ex-list").addEventListener("click", acaoExercicio);
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

/* ---------- Formulário ---------- */

function linhaExercicio(e = {}) {
    const div = document.createElement("div");
    div.className = "ex-row";
    div.innerHTML = `
        <span class="ex-n"></span>
        <label class="ex-nome">Exercício<input type="text" data-c="nome" placeholder="Ex.: Supino reto" autocomplete="off"></label>
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
