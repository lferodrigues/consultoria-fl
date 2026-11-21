// Monta o card de um plano — usado no site (index e planos.html) e na prévia do painel.
// Sem Firebase aqui: só HTML.
//   plano -> { nome, duracao, preco (centavos), periodo, descricao, beneficios: [..], botao, icone, tag, destaque, visivel, ordem }
//   O botão de cada plano abre a ficha de inscrição (cadastro.html?plano=<id>).

const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Só aceita links seguros (evita "javascript:" e afins)
export function linkSeguro(url) {
    const u = String(url || "").trim();
    if (/^(https?:\/\/|\.\/|\/|#|mailto:|tel:)/i.test(u) && !/^\/\//.test(u)) return u;
    if (/^[\w-]+\.html(#.*)?$/i.test(u)) return "./" + u;
    return "#planos";
}

export function beneficiosDe(p) {
    const b = p.beneficios;
    return (Array.isArray(b) ? b : Object.values(b || {})).map((x) => String(x).trim()).filter(Boolean);
}

function precoHTML(p) {
    if (!p.preco) return "";
    const reais = (Number(p.preco) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    return `<div class="price"><strong>${esc(reais)}</strong>${p.periodo ? `<small>${esc(p.periodo)}</small>` : ""}</div>`;
}

// variante: "index" (cards do index) ou "pagina" (planos.html, com ícone e frase)
export function cardPlano(p, variante = "pagina") {
    const destaque = !!p.destaque;
    const icone = /^fa-[a-z0-9-]+$/.test(p.icone || "") ? p.icone : "fa-bolt";
    // Planos do banco levam para a ficha de inscrição com o plano já escolhido
    const destino = p.id ? "./cadastro.html?plano=" + encodeURIComponent(p.id) : linkSeguro(p.link);
    const externo = /^https?:\/\//i.test(destino);
    return `
    <div class="plan${destaque ? " featured" : ""} reveal in">
        ${p.tag ? `<span class="tag">${esc(p.tag)}</span>` : ""}
        ${variante === "pagina" ? `<span class="plan-icon"><i class="fa-solid ${icone}"></i></span>` : ""}
        <h3>${esc(p.nome)}</h3>
        ${p.duracao ? `<span class="dur">${esc(p.duracao)}</span>` : ""}
        ${precoHTML(p)}
        ${variante === "pagina" && p.descricao ? `<p class="plan-for">${esc(p.descricao)}</p>` : ""}
        <ul>${beneficiosDe(p).map((b) => `<li><i class="fa-solid fa-check"></i>${esc(b)}</li>`).join("")}</ul>
        <a href="${esc(destino)}" class="btn ${destaque ? "btn-primary" : "btn-ghost"}"${externo ? ' target="_blank" rel="noopener"' : ""}>${esc(p.botao || "Quero este plano")}</a>
    </div>`;
}

export function ordenarPlanos(lista) {
    return [...lista].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
}

// Os 3 planos que estavam fixos no site (usados para importar no painel)
export const PLANOS_PADRAO = [
    {
        nome: "Trimestral", duracao: "3 meses de acompanhamento", icone: "fa-bolt",
        descricao: "Para quem quer começar e sentir a diferença de um treino feito para você.",
        beneficios: ["Treino personalizado", "Suporte para dúvidas", "Ajustes durante o ciclo", "Acesso à área do aluno"],
        botao: "Quero o trimestral", link: "./consuloria_trimestral.html", destaque: false, tag: "", visivel: true
    },
    {
        nome: "Semestral", duracao: "6 meses de acompanhamento", icone: "fa-fire",
        descricao: "Tempo certo para sair do platô e ver resultado de verdade.",
        beneficios: ["Treino personalizado", "Suporte para dúvidas", "Ajustes e progressão contínua", "Tempo para consolidar resultados", "Acesso à área do aluno"],
        botao: "Quero o semestral", link: "./consuloria_semestral.html", destaque: true, tag: "Mais escolhido", visivel: true
    },
    {
        nome: "Anual", duracao: "12 meses de acompanhamento", icone: "fa-trophy",
        descricao: "Para quem quer uma transformação completa, com planejamento de longo prazo.",
        beneficios: ["Treino personalizado", "Suporte para dúvidas", "Periodização de longo prazo", "Transformação completa", "Acesso à área do aluno"],
        botao: "Quero o anual", link: "./consuloria_anual.html", destaque: false, tag: "", visivel: true
    }
];
