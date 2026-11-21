// Tela: Biblioteca (e-books em PDF salvos no Realtime Database)
//   biblioteca/{id} -> { titulo, descricao, categoria, nomeArquivo, tamanho, para: "todos"|"selecionados", alunos: {alunoId: true}, criadoEm, atualizadoEm }
//   arquivos/{id}   -> { nome, tipo, tamanho, dados (PDF em base64) }   (separado para a lista carregar rápido)
import { ref, get, push, update } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { db } from "./firebase-app.js?v=2";
import { tamanhoArquivo } from "./alunos-util.js?v=2";
import { $, estado, aoMudar, esc, aviso, abrirModal, fecharModal, confirmar, mensagemErro, ocupado } from "./admin-core.js?v=1";

// O Realtime Database aceita até 10 MB por valor; em base64 o PDF cresce ~33%.
export const LIMITE_BYTES = 5 * 1024 * 1024;

let editandoId = null;
let selecionados = new Set();

export function iniciar() {
    aoMudar(() => { desenhar(); if (!$("modal-ebook").hidden) desenharEscolha(); });
    $("bi-busca").addEventListener("input", desenhar);
    $("bi-filtro").addEventListener("change", desenhar);
    $("ebook-form").addEventListener("submit", salvar);
    $("e-arquivo").addEventListener("change", mostrarArquivo);
    document.querySelectorAll('input[name="e-envio"]').forEach((r) => r.addEventListener("change", () => {
        $("e-pick").hidden = envio() !== "selecionados";
    }));
    $("e-pick-busca").addEventListener("input", desenharEscolha);
    $("e-pick-list").addEventListener("change", (ev) => {
        if (ev.target.type !== "checkbox") return;
        if (ev.target.checked) selecionados.add(ev.target.value); else selecionados.delete(ev.target.value);
        contarEscolha();
    });
    $("bi-lista").addEventListener("click", (ev) => {
        const btn = ev.target.closest("button[data-acao]");
        if (!btn) return;
        const e = estado.biblioteca.find((x) => x.id === btn.dataset.id);
        if (!e) return;
        if (btn.dataset.acao === "baixar") baixar(e, btn);
        if (btn.dataset.acao === "editar") abrir(e);
        if (btn.dataset.acao === "excluir") excluir(e);
    });
}

export function novo(aoFechar) { abrir(null, aoFechar); }

const envio = () => document.querySelector('input[name="e-envio"]:checked').value;

function textoEnvio(e) {
    if (e.para !== "selecionados") return "Todos os alunos";
    const n = Object.keys(e.alunos || {}).filter((id) => estado.alunos.some((a) => a.id === id)).length;
    return n + (n === 1 ? " aluno" : " alunos");
}

/* ---------- Lista ---------- */

function desenhar() {
    const termo = $("bi-busca").value.trim().toLowerCase();
    const cat = $("bi-filtro").value;
    const lista = estado.biblioteca
        .filter((e) => (!cat || e.categoria === cat) && (!termo || [e.titulo, e.descricao, e.nomeArquivo].join(" ").toLowerCase().includes(termo)))
        .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));

    $("bi-lista").innerHTML = lista.map((e) => `
        <article class="item-card">
            <div class="item-top">
                <span class="item-ico"><i class="fa-solid fa-file-pdf"></i></span>
                <div>
                    <h3>${esc(e.titulo)}</h3>
                    <span class="item-sub">${esc(e.nomeArquivo || "")} · ${tamanhoArquivo(e.tamanho)}</span>
                </div>
            </div>
            <div class="tags">
                <span class="tag red">${esc(e.categoria || "Outros")}</span>
                <span class="tag"><i class="fa-solid fa-paper-plane"></i> ${textoEnvio(e)}</span>
            </div>
            <p class="item-desc">${esc(e.descricao || "Sem descrição.")}</p>
            <div class="item-foot">
                <span class="item-sub">${e.criadoEm ? "Adicionado em " + new Date(e.criadoEm).toLocaleDateString("pt-BR") : ""}</span>
                <div class="actions">
                    <button type="button" class="icon-btn" data-acao="baixar" data-id="${e.id}" title="Baixar PDF" aria-label="Baixar ${esc(e.titulo)}"><i class="fa-solid fa-download"></i></button>
                    <button type="button" class="icon-btn" data-acao="editar" data-id="${e.id}" title="Editar" aria-label="Editar ${esc(e.titulo)}"><i class="fa-solid fa-pen"></i></button>
                    <button type="button" class="icon-btn danger" data-acao="excluir" data-id="${e.id}" title="Excluir" aria-label="Excluir ${esc(e.titulo)}"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        </article>`).join("");

    $("bi-vazio").hidden = lista.length > 0;
    $("bi-vazio-txt").textContent = estado.biblioteca.length === 0
        ? "Nenhum e-book na biblioteca ainda. Clique em \"Adicionar e-book\" para enviar o primeiro PDF."
        : "Nenhum e-book encontrado com esse filtro.";
}

/* ---------- Escolha de alunos ---------- */

function desenharEscolha() {
    const termo = $("e-pick-busca").value.trim().toLowerCase();
    const alunos = [...estado.alunos]
        .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"))
        .filter((a) => !termo || (a.nome + " " + a.email).toLowerCase().includes(termo));
    $("e-pick-list").innerHTML = alunos.length ? alunos.map((a) => `
        <label><input type="checkbox" value="${a.id}" ${selecionados.has(a.id) ? "checked" : ""}> ${esc(a.nome)} <small>${esc(a.email)}</small></label>`).join("")
        : '<label>Nenhum aluno encontrado.</label>';
    contarEscolha();
}

function contarEscolha() {
    const n = [...selecionados].filter((id) => estado.alunos.some((a) => a.id === id)).length;
    $("e-pick-n").textContent = n + (n === 1 ? " aluno selecionado" : " alunos selecionados");
}

/* ---------- Formulário ---------- */

function mostrarArquivo() {
    const f = $("e-arquivo").files[0];
    $("e-arq-info").textContent = f ? f.name + " · " + tamanhoArquivo(f.size) : (editandoId ? "Deixe em branco para manter o PDF atual." : "Até 5 MB.");
    if (f && !$("e-titulo").value.trim()) $("e-titulo").value = f.name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ");
}

function abrir(e, aoFechar) {
    editandoId = e ? e.id : null;
    $("eb-titulo").textContent = e ? "Editar e-book" : "Adicionar e-book";
    $("eb-msg").textContent = "";
    $("e-titulo").value = e?.titulo || "";
    $("e-categoria").value = e?.categoria || "Treino";
    $("e-descricao").value = e?.descricao || "";
    $("e-arquivo").value = "";
    $("e-arq-obrig").hidden = !!e;
    $("e-arq-info").textContent = e ? "Atual: " + (e.nomeArquivo || "PDF") + ". Deixe em branco para manter." : "Até 5 MB.";
    const para = e?.para === "selecionados" ? "selecionados" : "todos";
    document.querySelector(`input[name="e-envio"][value="${para}"]`).checked = true;
    $("e-pick").hidden = para !== "selecionados";
    selecionados = new Set(Object.keys(e?.alunos || {}));
    $("e-pick-busca").value = "";
    desenharEscolha();
    abrirModal("modal-ebook", "e-titulo", aoFechar);
}

function lerBase64(arquivo) {
    return new Promise((resolve, reject) => {
        const leitor = new FileReader();
        leitor.onload = () => resolve(String(leitor.result).split(",")[1] || "");
        leitor.onerror = () => reject(leitor.error);
        leitor.readAsDataURL(arquivo);
    });
}

async function salvar(ev) {
    ev.preventDefault();
    const msg = $("eb-msg");
    msg.textContent = "";
    const titulo = $("e-titulo").value.trim();
    const arquivo = $("e-arquivo").files[0];
    const para = envio();

    if (!titulo) return (msg.textContent = "Dê um título ao e-book.");
    if (!editandoId && !arquivo) return (msg.textContent = "Escolha o arquivo PDF.");
    if (arquivo) {
        const ehPdf = arquivo.type === "application/pdf" || /\.pdf$/i.test(arquivo.name);
        if (!ehPdf) return (msg.textContent = "O arquivo precisa ser um PDF.");
        if (arquivo.size > LIMITE_BYTES) return (msg.textContent = "O PDF tem " + tamanhoArquivo(arquivo.size) + ". O limite é 5 MB — comprima o arquivo e tente de novo.");
    }
    const alunosEscolhidos = [...selecionados].filter((id) => estado.alunos.some((a) => a.id === id));
    if (para === "selecionados" && !alunosEscolhidos.length) return (msg.textContent = "Selecione pelo menos um aluno.");

    const botao = $("eb-salvar");
    ocupado(botao, true, arquivo ? "Enviando PDF..." : "Salvando...");
    try {
        const antigo = editandoId ? estado.biblioteca.find((x) => x.id === editandoId) : null;
        const id = editandoId || push(ref(db, "biblioteca")).key;
        const agora = Date.now();
        const meta = {
            titulo,
            descricao: $("e-descricao").value.trim(),
            categoria: $("e-categoria").value,
            para,
            alunos: para === "selecionados" ? Object.fromEntries(alunosEscolhidos.map((a) => [a, true])) : null,
            nomeArquivo: arquivo ? arquivo.name : antigo?.nomeArquivo || "",
            tamanho: arquivo ? arquivo.size : antigo?.tamanho || 0,
            criadoEm: antigo?.criadoEm || agora,
            atualizadoEm: agora
        };
        const mudancas = { ["biblioteca/" + id]: meta };
        if (arquivo) {
            mudancas["arquivos/" + id] = { nome: arquivo.name, tipo: "application/pdf", tamanho: arquivo.size, dados: await lerBase64(arquivo) };
        }
        await update(ref(db), mudancas);
        fecharModal("modal-ebook");
        aviso(editandoId ? "E-book atualizado." : "E-book adicionado à biblioteca.", "ok");
    } catch (e) {
        console.error(e);
        msg.textContent = mensagemErro(e);
    } finally {
        ocupado(botao, false);
    }
}

async function baixar(e, btn) {
    btn.disabled = true;
    try {
        const snap = await get(ref(db, "arquivos/" + e.id));
        const arq = snap.val();
        if (!arq || !arq.dados) { aviso("O arquivo deste e-book não foi encontrado.", "error"); return; }
        const bin = atob(arq.dados);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = arq.nome || (e.titulo + ".pdf");
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
        console.error(err);
        aviso(mensagemErro(err, "Não foi possível baixar o PDF."), "error");
    } finally {
        btn.disabled = false;
    }
}

async function excluir(e) {
    if (!(await confirmar({ titulo: "Excluir e-book?", texto: "\"" + e.titulo + "\" e o PDF serão apagados da biblioteca. Essa ação não pode ser desfeita." }))) return;
    try {
        await update(ref(db), { ["biblioteca/" + e.id]: null, ["arquivos/" + e.id]: null });
        aviso("E-book excluído.", "ok");
    } catch (err) {
        console.error(err);
        aviso(mensagemErro(err, "Não foi possível excluir."), "error");
    }
}
