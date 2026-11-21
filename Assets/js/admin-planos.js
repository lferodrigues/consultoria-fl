// Tela: Planos do site
//   planos/{id} -> { nome, duracao, preco (centavos), periodo, descricao, beneficios: [..], botao, link, icone, tag, destaque, visivel, ordem, atualizadoEm }
import { ref, push, update, remove } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { db } from "./firebase-app.js?v=2";
import { paraCentavos, centavosParaTexto } from "./alunos-util.js?v=2";
import { cardPlano, ordenarPlanos, beneficiosDe, linkSeguro, PLANOS_PADRAO } from "./planos-card.js?v=1";
import { $, estado, aoMudar, esc, aviso, abrirModal, fecharModal, confirmar, mensagemErro, ocupado } from "./admin-core.js?v=1";

let editandoId = null;

export function iniciar() {
    aoMudar(desenhar);
    $("plano-form").addEventListener("submit", salvar);
    $("pl-importar").addEventListener("click", importar);
    $("p-preco").addEventListener("blur", () => {
        const c = paraCentavos($("p-preco").value);
        if (Number.isFinite(c) && c > 0) $("p-preco").value = centavosParaTexto(c);
    });
    $("p-destaque").addEventListener("change", () => {
        if ($("p-destaque").checked && !$("p-tag").value.trim()) $("p-tag").value = "Mais escolhido";
    });
    $("pl-lista").addEventListener("click", (ev) => {
        const btn = ev.target.closest("button[data-acao]");
        if (!btn) return;
        const p = estado.planos.find((x) => x.id === btn.dataset.id);
        if (!p) return;
        const acoes = { editar: () => abrir(p), subir: () => mover(p, -1), descer: () => mover(p, 1), visivel: () => alternarVisivel(p), excluir: () => excluir(p) };
        acoes[btn.dataset.acao]?.();
    });
}

export function novo(aoFechar) { abrir(null, aoFechar); }

/* ---------- Lista (prévia igual ao site) ---------- */

function desenhar() {
    const lista = ordenarPlanos(estado.planos);
    $("pl-aviso").hidden = lista.length > 0;
    $("pl-lista").innerHTML = lista.map((p, i) => `
        <div class="plan-admin${p.visivel === false ? " oculto" : ""}">
            <div class="plan-admin-top">
                <span class="tag">${i + 1}º no site</span>
                ${p.visivel === false ? '<span class="badge off">Oculto</span>' : '<span class="badge ok">Visível</span>'}
            </div>
            <div class="plan-preview">${cardPlano(p, "pagina")}</div>
            <div class="actions plan-admin-acoes">
                <button type="button" class="icon-btn" data-acao="subir" data-id="${p.id}" title="Mover para a esquerda" aria-label="Mover ${esc(p.nome)} para antes" ${i === 0 ? "disabled" : ""}><i class="fa-solid fa-arrow-left"></i></button>
                <button type="button" class="icon-btn" data-acao="descer" data-id="${p.id}" title="Mover para a direita" aria-label="Mover ${esc(p.nome)} para depois" ${i === lista.length - 1 ? "disabled" : ""}><i class="fa-solid fa-arrow-right"></i></button>
                <button type="button" class="icon-btn" data-acao="visivel" data-id="${p.id}" title="${p.visivel === false ? "Mostrar no site" : "Esconder do site"}" aria-label="${p.visivel === false ? "Mostrar" : "Esconder"} ${esc(p.nome)}"><i class="fa-solid ${p.visivel === false ? "fa-eye" : "fa-eye-slash"}"></i></button>
                <button type="button" class="icon-btn" data-acao="editar" data-id="${p.id}" title="Editar" aria-label="Editar ${esc(p.nome)}"><i class="fa-solid fa-pen"></i></button>
                <button type="button" class="icon-btn danger" data-acao="excluir" data-id="${p.id}" title="Excluir" aria-label="Excluir ${esc(p.nome)}"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>`).join("");
    // Links da prévia não navegam
    $("pl-lista").querySelectorAll(".plan-preview a").forEach((a) => { a.addEventListener("click", (e) => e.preventDefault()); a.tabIndex = -1; });
}

/* ---------- Formulário ---------- */

function abrir(p, aoFechar) {
    editandoId = p ? p.id : null;
    $("pl-titulo").textContent = p ? "Editar plano" : "Novo plano";
    $("pl-msg").textContent = "";
    $("p-nome").value = p?.nome || "";
    $("p-duracao").value = p?.duracao || "";
    $("p-preco").value = p?.preco ? centavosParaTexto(p.preco) : "";
    $("p-periodo").value = p?.periodo || "";
    $("p-descricao").value = p?.descricao || "";
    $("p-beneficios").value = p ? beneficiosDe(p).join("\n") : "Treino personalizado\nSuporte para dúvidas\nAcesso à área do aluno";
    $("p-botao").value = p?.botao || "";
    $("p-link").value = p?.link || "";
    $("p-icone").value = p?.icone || "fa-bolt";
    $("p-tag").value = p?.tag || "";
    $("p-destaque").checked = !!p?.destaque;
    $("p-visivel").checked = p ? p.visivel !== false : true;
    abrirModal("modal-plano", "p-nome", aoFechar);
}

async function salvar(ev) {
    ev.preventDefault();
    const msg = $("pl-msg");
    msg.textContent = "";
    const nome = $("p-nome").value.trim();
    const beneficios = $("p-beneficios").value.split("\n").map((b) => b.trim()).filter(Boolean).slice(0, 15);
    const link = $("p-link").value.trim();
    const precoTxt = $("p-preco").value.trim();
    const preco = precoTxt ? paraCentavos(precoTxt) : 0;

    if (!nome) return (msg.textContent = "Dê um nome ao plano.");
    if (!beneficios.length) return (msg.textContent = "Escreva pelo menos um benefício.");
    if (!link) return (msg.textContent = "Coloque o link do botão (página de matrícula, WhatsApp ou pagamento).");
    if (linkSeguro(link) === "#planos" && link !== "#planos") return (msg.textContent = "Link inválido. Use um endereço que comece com https:// ou ./");
    if (precoTxt && (!Number.isFinite(preco) || preco < 0)) return (msg.textContent = "Preço inválido. Ex.: 599,00");

    const botao = $("pl-salvar");
    ocupado(botao, true);
    try {
        const antigo = editandoId ? estado.planos.find((x) => x.id === editandoId) : null;
        const id = editandoId || push(ref(db, "planos")).key;
        const ordem = antigo ? (antigo.ordem ?? 0) : Math.max(-1, ...estado.planos.map((x) => x.ordem ?? 0)) + 1;
        await update(ref(db, "planos/" + id), {
            nome,
            duracao: $("p-duracao").value.trim(),
            preco: preco || null,
            periodo: $("p-periodo").value.trim(),
            descricao: $("p-descricao").value.trim(),
            beneficios,
            botao: $("p-botao").value.trim() || "Quero o " + nome.toLowerCase(),
            link,
            icone: $("p-icone").value,
            tag: $("p-tag").value.trim(),
            destaque: $("p-destaque").checked,
            visivel: $("p-visivel").checked,
            ordem,
            atualizadoEm: Date.now()
        });
        fecharModal("modal-plano");
        aviso(editandoId ? "Plano atualizado no site." : "Plano adicionado ao site.", "ok");
    } catch (e) {
        console.error(e);
        msg.textContent = mensagemErro(e);
    } finally {
        ocupado(botao, false);
    }
}

/* ---------- Ações ---------- */

async function mover(p, direcao) {
    const lista = ordenarPlanos(estado.planos);
    const i = lista.findIndex((x) => x.id === p.id);
    const j = i + direcao;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    const mudancas = {};
    lista.forEach((x, k) => { mudancas["planos/" + x.id + "/ordem"] = k; });
    try {
        await update(ref(db), mudancas);
    } catch (e) {
        console.error(e);
        aviso(mensagemErro(e, "Não foi possível mudar a ordem."), "error");
    }
}

async function alternarVisivel(p) {
    const visivel = p.visivel === false;
    try {
        await update(ref(db, "planos/" + p.id), { visivel, atualizadoEm: Date.now() });
        aviso(visivel ? p.nome + " voltou a aparecer no site." : p.nome + " foi escondido do site.", "ok");
    } catch (e) {
        console.error(e);
        aviso(mensagemErro(e, "Não foi possível alterar."), "error");
    }
}

async function excluir(p) {
    const ok = await confirmar({ titulo: "Excluir plano?", texto: "O card \"" + p.nome + "\" sai do index e da página de planos. Se quiser só tirar do ar por um tempo, use o botão de esconder." });
    if (!ok) return;
    try {
        await remove(ref(db, "planos/" + p.id));
        aviso("Plano excluído.", "ok");
    } catch (e) {
        console.error(e);
        aviso(mensagemErro(e, "Não foi possível excluir."), "error");
    }
}

async function importar() {
    const btn = $("pl-importar");
    btn.disabled = true;
    try {
        const mudancas = {};
        PLANOS_PADRAO.forEach((p, i) => {
            mudancas["planos/" + push(ref(db, "planos")).key] = { ...p, ordem: i, atualizadoEm: Date.now() };
        });
        await update(ref(db), mudancas);
        aviso("Planos importados. Agora é só editar.", "ok");
    } catch (e) {
        console.error(e);
        aviso(mensagemErro(e, "Não foi possível importar."), "error");
    } finally {
        btn.disabled = false;
    }
}
