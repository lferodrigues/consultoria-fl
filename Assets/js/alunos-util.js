// Funções de apoio do painel (sem Firebase — dá para testar isoladamente)

export const MESES_POR_PLANO = { trimestral: 3, semestral: 6, anual: 12 };

// Soma meses a uma data AAAA-MM-DD. Se o dia não existir no mês final (ex.: 31/02),
// usa o último dia desse mês.
export function somarMeses(iso, meses) {
    const [a, m, d] = iso.split("-").map(Number);
    const alvo = new Date(a, m - 1 + meses, 1);
    const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
    alvo.setDate(Math.min(d, ultimoDia));
    return alvo.getFullYear() + "-" + String(alvo.getMonth() + 1).padStart(2, "0") + "-" + String(alvo.getDate()).padStart(2, "0");
}

// Dias entre duas datas AAAA-MM-DD (b - a)
export function diasEntre(a, b) {
    const [y1, m1, d1] = a.split("-").map(Number);
    const [y2, m2, d2] = b.split("-").map(Number);
    return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

// Situação do aluno: { chave, texto, classe }
export function situacao(aluno, hoje) {
    if (aluno.ativo === false) return { chave: "inativos", texto: "Desativado", classe: "off" };
    if (!aluno.vencimento) return { chave: "ativos", texto: "Ativo", classe: "ok" };
    const dias = diasEntre(hoje, aluno.vencimento);
    if (dias < 0) return { chave: "vencidos", texto: "Vencido", classe: "bad" };
    if (dias === 0) return { chave: "vencendo", texto: "Vence hoje", classe: "warn" };
    if (dias <= 7) return { chave: "vencendo", texto: "Vence em " + dias + (dias === 1 ? " dia" : " dias"), classe: "warn" };
    return { chave: "ativos", texto: "Ativo", classe: "ok" };
}

// "Ativos" no resumo inclui quem vence em até 7 dias (ainda tem acesso)
export function contar(alunos, hoje) {
    const c = { total: alunos.length, ativos: 0, vencendo: 0, vencidos: 0, inativos: 0 };
    for (const a of alunos) {
        const s = situacao(a, hoje).chave;
        if (s === "ativos") c.ativos++;
        if (s === "vencendo") { c.vencendo++; c.ativos++; }
        if (s === "vencidos") c.vencidos++;
        if (s === "inativos") c.inativos++;
    }
    return c;
}

export function filtrar(alunos, filtro, busca, hoje) {
    const termo = (busca || "").trim().toLowerCase();
    const soDigitos = termo.replace(/\D/g, "");
    return alunos.filter((a) => {
        const s = situacao(a, hoje).chave;
        if (filtro === "ativos" && s !== "ativos" && s !== "vencendo") return false;
        if (filtro !== "todos" && filtro !== "ativos" && s !== filtro) return false;
        if (!termo) return true;
        return (a.nome || "").toLowerCase().includes(termo)
            || (a.email || "").toLowerCase().includes(termo)
            || (soDigitos && (a.telefone || "").replace(/\D/g, "").includes(soDigitos));
    });
}

export function dataBR(iso) {
    if (!iso) return "—";
    const [a, m, d] = iso.split("-");
    return d + "/" + m + "/" + a;
}

export function mascaraTelefone(v) {
    const n = v.replace(/\D/g, "").slice(0, 11);
    if (n.length <= 2) return n.length ? "(" + n : "";
    if (n.length <= 6) return "(" + n.slice(0, 2) + ") " + n.slice(2);
    if (n.length <= 10) return "(" + n.slice(0, 2) + ") " + n.slice(2, 6) + "-" + n.slice(6);
    return "(" + n.slice(0, 2) + ") " + n.slice(2, 7) + "-" + n.slice(7);
}

export function escaparHTML(t) {
    return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- Financeiro ---------- */

// "1.234,56" | "1234.56" | "R$ 150" -> centavos (inteiro). Retorna NaN se inválido.
export function paraCentavos(texto) {
    let t = String(texto ?? "").replace(/[^\d.,-]/g, "").trim();
    if (!t) return NaN;
    const temVirgula = t.includes(",");
    if (temVirgula) t = t.replace(/\./g, "").replace(",", ".");
    else if ((t.match(/\./g) || []).length > 1) t = t.replace(/\./g, "");
    else if (/\.\d{3}$/.test(t)) t = t.replace(".", "");
    const n = Number(t);
    return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

export function moeda(centavos) {
    return (Number(centavos || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function centavosParaTexto(centavos) {
    return (Number(centavos || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Resumo de um mês (AAAA-MM): recebido, despesas pagas, saldo e a receber
export function resumoMes(lancamentos, mes) {
    const r = { receitas: 0, despesas: 0, saldo: 0, receber: 0 };
    for (const l of lancamentos) {
        if (!l.data || l.data.slice(0, 7) !== mes) continue;
        const v = Number(l.valor || 0);
        if (l.tipo === "receita") {
            if (l.status === "pago") r.receitas += v; else r.receber += v;
        } else if (l.tipo === "despesa" && l.status === "pago") {
            r.despesas += v;
        }
    }
    r.saldo = r.receitas - r.despesas;
    return r;
}

// Objeto do Firebase {id: {...}} -> lista [{id, ...}]
export function listaDe(obj) {
    return Object.entries(obj || {}).map(([id, v]) => ({ id, ...v }));
}

export function tamanhoArquivo(bytes) {
    if (!bytes) return "—";
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
    return (bytes / 1024 / 1024).toFixed(1).replace(".", ",") + " MB";
}
