// Núcleo do painel: estado compartilhado, avisos, modais e confirmação

export const $ = (id) => document.getElementById(id);

// Dados vindos do Realtime Database (atualizados em tempo real)
export const estado = { alunos: [], fichas: [], feedbacks: [], biblioteca: [], financeiro: [], planos: [], exercicios: [], depoimentos: [], inscricoes: [] };

const inscritos = new Set();
export function aoMudar(fn) { inscritos.add(fn); }
export function notificar() {
    inscritos.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
}

export function nomeAluno(id) {
    const a = estado.alunos.find((x) => x.id === id);
    return a ? a.nome : "";
}

// Opções de <select> com os alunos
export function opcoesAlunos(primeira) {
    const ordenados = [...estado.alunos].sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
    return (primeira ? `<option value="">${primeira}</option>` : "") +
        ordenados.map((a) => `<option value="${a.id}">${esc(a.nome)}</option>`).join("");
}

export function esc(t) {
    return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- Aviso rápido ---------- */
let timer;
export function aviso(texto, tipo = "ok") {
    const t = $("toast");
    t.textContent = texto;
    t.className = "toast show " + tipo;
    clearTimeout(timer);
    timer = setTimeout(() => { t.className = "toast " + tipo; }, 3500);
}

/* ---------- Modais ---------- */
let aoFechar = {};
export function abrirModal(id, focoId, fechar) {
    $(id).hidden = false;
    aoFechar[id] = fechar || null;
    document.body.classList.add("modal-aberto");
    if (focoId) setTimeout(() => $(focoId)?.focus(), 50);
}
export function fecharModal(id) {
    if ($(id).hidden) return;
    $(id).hidden = true;
    if (!document.querySelector(".modal:not([hidden])")) document.body.classList.remove("modal-aberto");
    if (aoFechar[id]) { const f = aoFechar[id]; aoFechar[id] = null; f(); }
}

document.addEventListener("click", (e) => {
    const botao = e.target.closest("[data-fechar]");
    if (botao) fecharModal(botao.closest(".modal").id);
    else if (e.target.classList && e.target.classList.contains("modal")) fecharModal(e.target.id);
});
document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const abertos = [...document.querySelectorAll(".modal:not([hidden])")];
    if (abertos.length) fecharModal(abertos[abertos.length - 1].id);
});

/* ---------- Confirmação ---------- */
export function confirmar({ titulo = "Tem certeza?", texto = "", botao = "Excluir" } = {}) {
    return new Promise((resolve) => {
        $("cf-titulo").textContent = titulo;
        $("cf-texto").textContent = texto;
        $("cf-sim").textContent = botao;
        const fim = (v) => {
            $("cf-sim").onclick = $("cf-nao").onclick = null;
            resolve(v); // antes de fechar (fechar pelo X/Esc resolve como "não")
            fecharModal("modal-confirm");
        };
        $("cf-sim").onclick = () => fim(true);
        $("cf-nao").onclick = () => fim(false);
        abrirModal("modal-confirm", "cf-nao", () => resolve(false));
    });
}

/* ---------- Erros ---------- */
export function mensagemErro(e, padrao = "Não foi possível salvar. Tente novamente.") {
    const txt = String(e?.code || "") + " " + String(e?.message || "");
    if (txt.includes("PERMISSION_DENIED") || txt.includes("permission")) return "Sem permissão. Confira as regras do Realtime Database.";
    if (txt.includes("network")) return "Sem conexão. Verifique sua internet.";
    if (txt.includes("max") && txt.includes("size")) return "O arquivo é grande demais para o banco.";
    return padrao;
}

// Botão em estado de "salvando..."
export function ocupado(botao, sim, texto) {
    if (sim) { botao.dataset.txt = botao.textContent; botao.textContent = texto || "Salvando..."; botao.disabled = true; }
    else { botao.textContent = botao.dataset.txt || botao.textContent; botao.disabled = false; }
}
