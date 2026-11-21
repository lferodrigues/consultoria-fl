// Chave Pix do Fagner (dentro do Financeiro)
//   config/pix -> { tipo, chave, nome, cidade, banco, atualizadoEm }
import { ref, onValue, update } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { db } from "./firebase-app.js?v=2";
import { paraCentavos, centavosParaTexto, moeda } from "./alunos-util.js?v=2";
import { TIPOS_PIX, normalizarChave, chaveFormatada, pixCopiaECola } from "./pix-util.js?v=1";
import { $, esc, aviso, abrirModal, fecharModal, mensagemErro, ocupado } from "./admin-core.js?v=1";

let pix = null;

export function iniciar() {
    onValue(ref(db, "config/pix"), (snap) => { pix = snap.val(); desenhar(); }, (e) => {
        console.error(e);
        $("pix-card").innerHTML = '<p class="pix-erro">Sem permissão para ler a chave Pix. Confira as regras do Realtime Database.</p>';
    });
    desenhar();
    $("pix-card").addEventListener("click", acao);
    $("pix-card").addEventListener("blur", (ev) => {
        if (ev.target.id !== "pix-valor") return;
        const c = paraCentavos(ev.target.value);
        ev.target.value = Number.isFinite(c) && c > 0 ? centavosParaTexto(c) : "";
    }, true);
    document.querySelectorAll('input[name="px-tipo"]').forEach((r) => r.addEventListener("change", ajustarCampo));
    $("px-chave").addEventListener("input", mascarar);
    $("pix-form").addEventListener("submit", salvar);
}

export function editar() {
    const tipo = pix?.tipo || "telefone";
    document.querySelector(`input[name="px-tipo"][value="${tipo}"]`).checked = true;
    ajustarCampo();
    $("px-chave").value = pix ? chaveFormatada(pix.tipo, pix.chave) : "";
    $("px-nome").value = pix?.nome || "Fagner Lage";
    $("px-cidade").value = pix?.cidade || "";
    $("px-banco").value = pix?.banco || "";
    $("px-msg").textContent = "";
    abrirModal("modal-pix", "px-chave");
}

/* ---------- Cartão no Financeiro ---------- */

function desenhar() {
    const el = $("pix-card");
    if (!pix?.chave) {
        el.className = "pix-card vazio";
        el.innerHTML = `
            <span class="pix-ico"><i class="fa-brands fa-pix"></i></span>
            <div class="pix-txt"><strong>Cadastre a sua chave Pix</strong><small>Para gerar o Pix copia e cola e enviar aos alunos.</small></div>
            <button type="button" class="btn btn-primary btn-sm" data-pix="editar"><i class="fa-solid fa-plus"></i> Cadastrar chave Pix</button>`;
        return;
    }
    el.className = "pix-card";
    el.innerHTML = `
        <span class="pix-ico"><i class="fa-brands fa-pix"></i></span>
        <div class="pix-txt">
            <small>Chave Pix · ${esc(TIPOS_PIX[pix.tipo]?.nome || pix.tipo)}</small>
            <strong class="pix-chave">${esc(chaveFormatada(pix.tipo, pix.chave))}</strong>
            <small>${esc(pix.nome)}${pix.banco ? " · " + esc(pix.banco) : ""}${pix.cidade ? " · " + esc(pix.cidade) : ""}</small>
        </div>
        <div class="pix-acoes">
            <button type="button" class="btn btn-ghost btn-sm" data-pix="copiar-chave"><i class="fa-regular fa-copy"></i> Copiar chave</button>
            <div class="pix-cobrar">
                <input type="text" id="pix-valor" inputmode="decimal" placeholder="Valor (opcional)" aria-label="Valor da cobrança em reais">
                <button type="button" class="btn btn-primary btn-sm" data-pix="copia-cola"><i class="fa-solid fa-qrcode"></i> Copiar Pix copia e cola</button>
            </div>
            <button type="button" class="icon-btn" data-pix="editar" title="Editar chave Pix" aria-label="Editar chave Pix"><i class="fa-solid fa-pen"></i></button>
        </div>`;
}

async function copiar(texto, msg) {
    try {
        await navigator.clipboard.writeText(texto);
        aviso(msg, "ok");
    } catch {
        // navegador sem permissão: mostra para copiar à mão
        window.prompt("Copie o texto abaixo:", texto);
    }
}

function acao(ev) {
    const b = ev.target.closest("[data-pix]");
    if (!b) return;
    if (b.dataset.pix === "editar") return editar();
    if (!pix?.chave) return;
    if (b.dataset.pix === "copiar-chave") return copiar(pix.chave, "Chave Pix copiada.");
    if (b.dataset.pix === "copia-cola") {
        const centavos = paraCentavos($("pix-valor").value);
        const valor = Number.isFinite(centavos) && centavos > 0 ? centavos : 0;
        const codigo = pixCopiaECola({ chave: pix.chave, nome: pix.nome, cidade: pix.cidade, valorCentavos: valor });
        copiar(codigo, "Pix copia e cola " + (valor ? "de " + moeda(valor) + " " : "") + "copiado. É só colar no WhatsApp do aluno.");
    }
}

/* ---------- Formulário ---------- */

const tipoEscolhido = () => document.querySelector('input[name="px-tipo"]:checked').value;

function ajustarCampo() {
    const t = tipoEscolhido();
    const input = $("px-chave");
    input.placeholder = TIPOS_PIX[t].placeholder;
    input.inputMode = t === "cpf" || t === "cnpj" || t === "telefone" ? "numeric" : t === "email" ? "email" : "text";
    input.value = "";
    $("px-msg").textContent = "";
}

// Máscara enquanto digita (CPF, CNPJ e celular)
function mascarar(ev) {
    const t = tipoEscolhido();
    const d = ev.target.value.replace(/\D/g, "");
    if (t === "cpf") ev.target.value = d.slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    if (t === "cnpj") ev.target.value = d.slice(0, 14).replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
    if (t === "telefone") {
        const n = (d.length > 11 && d.startsWith("55") ? d.slice(2) : d).slice(0, 11);
        ev.target.value = n.length <= 2 ? (n ? "(" + n : "") : n.length <= 7 ? "(" + n.slice(0, 2) + ") " + n.slice(2) : "(" + n.slice(0, 2) + ") " + n.slice(2, 7) + "-" + n.slice(7);
    }
}

async function salvar(ev) {
    ev.preventDefault();
    const msg = $("px-msg");
    msg.textContent = "";
    const tipo = tipoEscolhido();
    const r = normalizarChave(tipo, $("px-chave").value);
    const nome = $("px-nome").value.trim();
    const cidade = $("px-cidade").value.trim();
    if (!r.ok) return (msg.textContent = r.erro);
    if (!nome) return (msg.textContent = "Digite o nome do recebedor, como está no banco.");
    if (!cidade) return (msg.textContent = "Digite a cidade.");

    const botao = $("px-salvar");
    ocupado(botao, true);
    try {
        await update(ref(db, "config/pix"), { tipo, chave: r.chave, nome, cidade, banco: $("px-banco").value.trim(), atualizadoEm: Date.now() });
        fecharModal("modal-pix");
        aviso("Chave Pix salva.", "ok");
    } catch (e) {
        console.error(e);
        msg.textContent = mensagemErro(e);
    } finally {
        ocupado(botao, false);
    }
}
