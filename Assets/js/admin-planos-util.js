// Escolha de plano no painel (cadastro/edição de aluno e aprovação de inscrição).
// Usa os planos da página de Planos (planos/{id}: nome, duracao, preco em centavos).
// No aluno ficam: planoId, plano (nome curto, ex.: "Semestral"), valor (centavos).
import { estado, esc } from "./admin-core.js?v=1";
import { moeda, MESES_POR_PLANO } from "./alunos-util.js?v=2";
import { ordenarPlanos } from "./planos-card.js?v=2";

const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// "Plano Semestral" -> "Semestral"
export const nomeCurto = (nome) => String(nome || "").replace(/^plano\s+/i, "").trim();

// Meses do plano: pelo nome (trimestral/semestral/anual) ou pela duração ("6 meses", "1 ano")
export function mesesDoPlano(nome, duracao = "") {
    const chave = norm(nomeCurto(nome));
    if (MESES_POR_PLANO[chave]) return MESES_POR_PLANO[chave];
    const t = norm(duracao + " " + nome);
    const m = t.match(/(\d+)\s*mes/); if (m) return Number(m[1]);
    const a = t.match(/(\d+)\s*ano/); if (a) return Number(a[1]) * 12;
    if (/mensal/.test(t)) return 1;
    if (/anual/.test(t)) return 12;
    return 6;
}

const planosDoSite = () => ordenarPlanos(estado.planos || []).filter((p) => p.nome);

// Plano atual do aluno na lista: pelo id; se for um cadastro antigo, pelo nome
export function idDoPlano(aluno) {
    if (aluno?.planoId && planosDoSite().some((p) => p.id === aluno.planoId)) return aluno.planoId;
    const n = norm(nomeCurto(aluno?.plano || aluno?.planoNome));
    return planosDoSite().find((p) => norm(nomeCurto(p.nome)) === n)?.id || "";
}

// Preenche um <select> com os planos do site
export function preencherPlanos(select, selecionado, { vazio = "" } = {}) {
    const lista = planosDoSite();
    select.innerHTML = (vazio ? `<option value="">${esc(vazio)}</option>` : "") + lista.map((p) =>
        `<option value="${esc(p.id)}">${esc(nomeCurto(p.nome))}${p.preco ? " · " + moeda(p.preco) : ""}${p.duracao ? " · " + esc(p.duracao) : ""}</option>`).join("");
    if (!lista.length) select.innerHTML = '<option value="">Cadastre os planos em Planos</option>';
    select.value = lista.some((p) => p.id === selecionado) ? selecionado : (vazio ? "" : lista[0]?.id || "");
}

// Dados que vão para o aluno a partir do plano escolhido
export function dadosDoPlano(id) {
    const p = planosDoSite().find((x) => x.id === id);
    if (!p) return null;
    return { planoId: p.id, plano: nomeCurto(p.nome), planoNome: p.nome, valor: Number(p.preco) || null, meses: mesesDoPlano(p.nome, p.duracao) };
}
