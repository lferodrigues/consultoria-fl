// Tela: Depoimentos dos alunos
//   depoimentos/{id}         -> { alunoId, nome, nomeExibicao, texto, nota, autorizado, criadoEm, publicado, visto }  (privado)
//   depoimentosPublicos/{id} -> { nome, texto, nota, criadoEm }  (cópia pública, lida pelo index)
import { ref, update } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { db } from "./firebase-app.js?v=2";
import { $, estado, aoMudar, esc, aviso, confirmar, mensagemErro } from "./admin-core.js?v=1";

const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const estrelas = (n) => `<span class="dp-estrelas" aria-label="${n} de 5 estrelas">${"★".repeat(n || 0)}<em>${"★".repeat(5 - (n || 0))}</em></span>`;

export function iniciar() {
    aoMudar(desenhar);
    $("dp-busca").addEventListener("input", desenhar);
    $("dp-filtro").addEventListener("change", desenhar);
    document.querySelectorAll("[data-dep-filtro]").forEach((b) => b.addEventListener("click", () => { $("dp-filtro").value = b.dataset.depFiltro; desenhar(); }));
    $("dp-lista").addEventListener("click", (ev) => {
        const b = ev.target.closest("[data-acao]");
        if (!b) return;
        const d = estado.depoimentos.find((x) => x.id === b.dataset.id);
        if (!d) return;
        if (b.dataset.acao === "site") alternarSite(d);
        if (b.dataset.acao === "excluir") excluir(d);
    });
}

export const novos = () => estado.depoimentos.filter((d) => !d.visto);

// Ao abrir a tela, os depoimentos novos passam a ser "vistos"
export async function marcarVistos() {
    const mudancas = {};
    novos().forEach((d) => { mudancas["depoimentos/" + d.id + "/visto"] = true; });
    if (!Object.keys(mudancas).length) return;
    try { await update(ref(db), mudancas); } catch (e) { console.error(e); }
}

function desenhar() {
    const todos = [...estado.depoimentos].sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
    $("dp-total").textContent = todos.length;
    $("dp-site").textContent = todos.filter((d) => d.publicado).length;
    $("dp-novos").textContent = novos().length;
    $("menu-dep-n").textContent = novos().length;
    $("menu-dep-n").hidden = novos().length === 0;

    const termo = norm($("dp-busca").value.trim());
    const filtro = $("dp-filtro").value;
    const lista = todos.filter((d) => {
        if (filtro === "novos" && d.visto) return false;
        if (filtro === "site" && !d.publicado) return false;
        if (filtro === "fora" && d.publicado) return false;
        return !termo || norm(d.nome + " " + d.nomeExibicao + " " + d.texto).includes(termo);
    });

    $("dp-lista").innerHTML = lista.map((d) => `
        <article class="item-card dep-card${d.publicado ? " no-site" : ""}">
            <div class="dep-top">
                ${estrelas(d.nota)}
                ${!d.visto ? '<span class="badge warn">Novo</span>' : ""}
                ${d.publicado ? '<span class="badge ok">No site</span>' : ""}
            </div>
            <p class="dep-texto">“${esc(d.texto)}”</p>
            <div class="dep-autor">
                <strong>${esc(d.nomeExibicao || d.nome)}</strong>
                <small>${d.nomeExibicao && d.nomeExibicao !== d.nome ? esc(d.nome) + " · " : ""}${new Date(d.criadoEm || Date.now()).toLocaleDateString("pt-BR")}</small>
            </div>
            <div class="item-foot">
                <button type="button" class="dep-switch${d.publicado ? " on" : ""}" data-acao="site" data-id="${d.id}" role="switch" aria-checked="${!!d.publicado}" ${d.autorizado === false ? "disabled" : ""}>
                    <span class="dep-switch-bola"></span>${d.publicado ? "Aparece no site" : "Mostrar no site"}
                </button>
                <button type="button" class="icon-btn danger" data-acao="excluir" data-id="${d.id}" title="Excluir" aria-label="Excluir depoimento de ${esc(d.nome)}"><i class="fa-solid fa-trash"></i></button>
            </div>
        </article>`).join("");

    $("dp-vazio").hidden = lista.length > 0;
    $("dp-vazio-txt").textContent = todos.length === 0
        ? "Nenhum depoimento ainda. Os alunos enviam pela área do aluno, no botão Depoimentos."
        : "Nenhum depoimento com esse filtro.";
}

async function alternarSite(d) {
    const publicar = !d.publicado;
    try {
        await update(ref(db), {
            ["depoimentos/" + d.id + "/publicado"]: publicar,
            ["depoimentos/" + d.id + "/visto"]: true,
            ["depoimentosPublicos/" + d.id]: publicar
                ? { nome: d.nomeExibicao || d.nome.split(" ")[0], texto: d.texto, nota: d.nota || 5, criadoEm: d.criadoEm || Date.now() }
                : null
        });
        aviso(publicar ? "Depoimento publicado no site." : "Depoimento tirado do site.", "ok");
    } catch (e) {
        console.error(e);
        aviso(mensagemErro(e, "Não foi possível alterar."), "error");
    }
}

async function excluir(d) {
    if (!(await confirmar({ titulo: "Excluir depoimento?", texto: "O depoimento de " + d.nome + " será apagado" + (d.publicado ? " e sai do site" : "") + ". Essa ação não pode ser desfeita." }))) return;
    try {
        await update(ref(db), { ["depoimentos/" + d.id]: null, ["depoimentosPublicos/" + d.id]: null });
        aviso("Depoimento excluído.", "ok");
    } catch (e) {
        console.error(e);
        aviso(mensagemErro(e, "Não foi possível excluir."), "error");
    }
}
