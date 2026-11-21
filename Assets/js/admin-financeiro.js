// Tela: Financeiro
//   financeiro/{id} -> { tipo: "receita"|"despesa", descricao, valor (centavos), data, categoria, forma, alunoId, status: "pago"|"pendente", obs, criadoEm, atualizadoEm }
import { ref, push, update, remove } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { db, hojeISO } from "./firebase-app.js?v=2";
import { dataBR, paraCentavos, moeda, centavosParaTexto, resumoMes } from "./alunos-util.js?v=2";
import { $, estado, aoMudar, esc, aviso, abrirModal, fecharModal, confirmar, mensagemErro, ocupado, nomeAluno, opcoesAlunos } from "./admin-core.js?v=1";

const CATEGORIAS = {
    receita: ["Plano trimestral", "Plano semestral", "Plano anual", "Avaliação física", "Consultoria avulsa", "Outras receitas"],
    despesa: ["Equipamentos", "Marketing", "Software e apps", "Impostos e taxas", "Aluguel", "Outras despesas"]
};

let editandoId = null;

export const mesAtual = () => hojeISO().slice(0, 7);

export function iniciar() {
    $("fi-mes").value = mesAtual();
    aoMudar(desenhar);
    ["fi-mes", "fi-tipo", "fi-status"].forEach((id) => $(id).addEventListener("change", desenhar));
    $("fi-busca").addEventListener("input", desenhar);
    document.querySelectorAll('input[name="l-tipo"]').forEach((r) => r.addEventListener("change", () => preencherCategorias()));
    $("l-valor").addEventListener("blur", () => {
        const c = paraCentavos($("l-valor").value);
        if (Number.isFinite(c) && c > 0) $("l-valor").value = centavosParaTexto(c);
    });
    $("l-aluno").addEventListener("change", sugerirDescricao);
    $("lanc-form").addEventListener("submit", salvar);
    $("fi-tbody").addEventListener("click", (ev) => {
        const btn = ev.target.closest("button[data-acao]");
        if (!btn) return;
        const l = estado.financeiro.find((x) => x.id === btn.dataset.id);
        if (!l) return;
        if (btn.dataset.acao === "status") alternarStatus(l);
        if (btn.dataset.acao === "editar") abrir(l);
        if (btn.dataset.acao === "excluir") excluir(l);
    });
}

export function novo(aoFechar) { abrir(null, aoFechar); }

const tipoEscolhido = () => document.querySelector('input[name="l-tipo"]:checked').value;

/* ---------- Lista ---------- */

function desenhar() {
    const mes = $("fi-mes").value || mesAtual();
    const r = resumoMes(estado.financeiro, mes);
    $("fi-receitas").textContent = moeda(r.receitas);
    $("fi-despesas").textContent = moeda(r.despesas);
    $("fi-saldo").textContent = moeda(r.saldo);
    $("fi-saldo").style.color = r.saldo < 0 ? "var(--red-2)" : "";
    $("fi-receber").textContent = moeda(r.receber);

    const termo = $("fi-busca").value.trim().toLowerCase();
    const tipo = $("fi-tipo").value;
    const status = $("fi-status").value;
    const lista = estado.financeiro
        .filter((l) => (l.data || "").slice(0, 7) === mes)
        .filter((l) => (!tipo || l.tipo === tipo) && (!status || l.status === status))
        .filter((l) => !termo || [l.descricao, l.categoria, nomeAluno(l.alunoId), l.forma].join(" ").toLowerCase().includes(termo))
        .sort((a, b) => (b.data || "").localeCompare(a.data || "") || (b.criadoEm || 0) - (a.criadoEm || 0));

    $("fi-tbody").innerHTML = lista.map((l) => {
        const aluno = nomeAluno(l.alunoId);
        const pago = l.status === "pago";
        const sinal = l.tipo === "despesa" ? "− " : "+ ";
        return `
        <tr>
            <td data-label="Data">${dataBR(l.data)}</td>
            <td class="td-aluno"><div class="aluno-nome">${esc(l.descricao)}</div>${aluno ? `<div class="aluno-email">${esc(aluno)}</div>` : ""}</td>
            <td data-label="Categoria">${esc(l.categoria || "—")}</td>
            <td data-label="Forma">${esc(l.forma || "—")}</td>
            <td data-label="Valor"><span class="valor ${l.tipo}">${sinal}${moeda(l.valor)}</span></td>
            <td data-label="Situação"><button type="button" class="badge badge-btn ${pago ? "ok" : "warn"}" data-acao="status" data-id="${l.id}" title="Clique para marcar como ${pago ? "pendente" : "pago"}">${pago ? "Pago" : "Pendente"}</button></td>
            <td class="td-actions"><div class="actions">
                <button type="button" class="icon-btn" data-acao="editar" data-id="${l.id}" title="Editar" aria-label="Editar ${esc(l.descricao)}"><i class="fa-solid fa-pen"></i></button>
                <button type="button" class="icon-btn danger" data-acao="excluir" data-id="${l.id}" title="Excluir" aria-label="Excluir ${esc(l.descricao)}"><i class="fa-solid fa-trash"></i></button>
            </div></td>
        </tr>`;
    }).join("");

    $("fi-vazio").hidden = lista.length > 0;
    const nomeMes = new Date(mes + "-15T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    $("fi-vazio-txt").textContent = estado.financeiro.some((l) => (l.data || "").slice(0, 7) === mes)
        ? "Nenhum lançamento com esse filtro."
        : "Nenhum lançamento em " + nomeMes + ".";
}

/* ---------- Formulário ---------- */

function preencherCategorias(valor) {
    const tipo = tipoEscolhido();
    $("l-categoria").innerHTML = CATEGORIAS[tipo].map((c) => `<option>${c}</option>`).join("");
    if (valor && CATEGORIAS[tipo].includes(valor)) $("l-categoria").value = valor;
    $("l-aluno-wrap").hidden = tipo !== "receita";
    sugerirCategoriaPeloAluno();
}

function sugerirCategoriaPeloAluno() {
    const a = estado.alunos.find((x) => x.id === $("l-aluno").value);
    if (tipoEscolhido() === "receita" && a?.plano && !editandoId) $("l-categoria").value = "Plano " + a.plano;
}

function sugerirDescricao() {
    const a = estado.alunos.find((x) => x.id === $("l-aluno").value);
    if (a && !$("l-descricao").value.trim()) $("l-descricao").value = "Plano " + (a.plano || "") + " — " + a.nome.split(" ")[0];
    sugerirCategoriaPeloAluno();
}

function abrir(l, aoFechar) {
    editandoId = l ? l.id : null;
    $("la-titulo").textContent = l ? "Editar lançamento" : "Novo lançamento";
    $("la-msg").textContent = "";
    document.querySelector(`input[name="l-tipo"][value="${l?.tipo || "receita"}"]`).checked = true;
    $("l-aluno").innerHTML = opcoesAlunos("Nenhum");
    $("l-aluno").value = l?.alunoId && estado.alunos.some((a) => a.id === l.alunoId) ? l.alunoId : "";
    $("l-descricao").value = l?.descricao || "";
    $("l-valor").value = l ? centavosParaTexto(l.valor) : "";
    $("l-data").value = l?.data || hojeISO();
    $("l-forma").value = l?.forma || "Pix";
    $("l-status").value = l?.status || "pago";
    $("l-obs").value = l?.obs || "";
    preencherCategorias(l?.categoria);
    abrirModal("modal-lanc", "l-descricao", aoFechar);
}

async function salvar(ev) {
    ev.preventDefault();
    const msg = $("la-msg");
    msg.textContent = "";
    const tipo = tipoEscolhido();
    const descricao = $("l-descricao").value.trim();
    const valor = paraCentavos($("l-valor").value);
    const data = $("l-data").value;

    if (!descricao) return (msg.textContent = "Escreva uma descrição.");
    if (!Number.isFinite(valor) || valor <= 0) return (msg.textContent = "Digite um valor maior que zero. Ex.: 150,00");
    if (!data) return (msg.textContent = "Escolha a data.");

    const botao = $("la-salvar");
    ocupado(botao, true);
    try {
        const antigo = editandoId ? estado.financeiro.find((x) => x.id === editandoId) : null;
        const id = editandoId || push(ref(db, "financeiro")).key;
        const agora = Date.now();
        await update(ref(db, "financeiro/" + id), {
            tipo, descricao, valor, data,
            categoria: $("l-categoria").value,
            forma: $("l-forma").value,
            alunoId: tipo === "receita" ? ($("l-aluno").value || null) : null,
            status: $("l-status").value,
            obs: $("l-obs").value.trim(),
            criadoEm: antigo?.criadoEm || agora,
            atualizadoEm: agora
        });
        fecharModal("modal-lanc");
        // Mostra o mês do lançamento salvo
        if (data.slice(0, 7) !== $("fi-mes").value) { $("fi-mes").value = data.slice(0, 7); desenhar(); }
        aviso(editandoId ? "Lançamento atualizado." : "Lançamento salvo.", "ok");
    } catch (e) {
        console.error(e);
        msg.textContent = mensagemErro(e);
    } finally {
        ocupado(botao, false);
    }
}

async function alternarStatus(l) {
    const novoStatus = l.status === "pago" ? "pendente" : "pago";
    try {
        await update(ref(db, "financeiro/" + l.id), { status: novoStatus, atualizadoEm: Date.now() });
        aviso("Marcado como " + novoStatus + ".", "ok");
    } catch (e) {
        console.error(e);
        aviso(mensagemErro(e, "Não foi possível alterar."), "error");
    }
}

async function excluir(l) {
    if (!(await confirmar({ titulo: "Excluir lançamento?", texto: "\"" + l.descricao + "\" (" + moeda(l.valor) + ") será apagado. Essa ação não pode ser desfeita." }))) return;
    try {
        await remove(ref(db, "financeiro/" + l.id));
        aviso("Lançamento excluído.", "ok");
    } catch (e) {
        console.error(e);
        aviso(mensagemErro(e, "Não foi possível excluir."), "error");
    }
}
