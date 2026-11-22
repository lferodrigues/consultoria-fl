// Tela: Avaliações por foto (enviadas pelos alunos na área do aluno)
//   avaliacoes/{id}      -> { uid, alunoId, nome, obs, criadoEm, expiraEm, visto }
//   avaliacoesFotos/{id} -> "data:image/webp;base64,..."   (baixada só ao abrir a avaliação)
// Cada foto fica 15 dias. Depois disso as regras do banco já não deixam ler, e ela é apagada
// pela limpeza diária (/api/diario) ou aqui mesmo, quando o painel encontra uma vencida.
import { ref, get, update } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { db } from "./firebase-app.js?v=2";
import { $, estado, aoMudar, esc, aviso, confirmar, mensagemErro } from "./admin-core.js?v=1";
import { foneWhats } from "./admin-inscricoes.js?v=4";

const DIA = 86400000;
let atual = null;            // id aberto no detalhe
const apagando = new Set();  // vencidas já mandadas apagar

const lista = () => (estado.avaliacoes || []).filter((a) => (a.expiraEm || 0) > Date.now());
export const novas = () => lista().filter((a) => !a.visto);

const quando = (ts) => {
    const d = new Date(ts || Date.now());
    return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};
const restam = (a) => {
    const dias = Math.max(0, Math.ceil(((a.expiraEm || 0) - Date.now()) / DIA));
    return dias <= 1 ? "apaga em menos de 1 dia" : "apaga em " + dias + " dias";
};

export function iniciar() {
    aoMudar(() => { limparVencidas(); desenhar(); if (atual) desenharCabecalhoDetalhe(); });
    $("av-lista").addEventListener("click", (ev) => {
        const b = ev.target.closest("[data-av]");
        if (b) location.hash = "#/avaliacoes/" + b.dataset.av;
    });
}

// Apaga as vencidas que ainda estiverem no banco (reserva da limpeza diária)
function limparVencidas() {
    const mudancas = {};
    (estado.avaliacoes || []).forEach((a) => {
        if ((a.expiraEm || 0) <= Date.now() && !apagando.has(a.id)) {
            apagando.add(a.id);
            mudancas["avaliacoes/" + a.id] = null;
            mudancas["avaliacoesFotos/" + a.id] = null;
        }
    });
    if (Object.keys(mudancas).length) update(ref(db), mudancas).catch((e) => console.warn("Limpeza das avaliações:", e));
}

function desenhar() {
    const todas = [...lista()].sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
    $("menu-av-n").textContent = novas().length;
    $("menu-av-n").hidden = novas().length === 0;
    $("av-lista").innerHTML = todas.map((a) => `
        <button type="button" class="item-card av-card" data-av="${esc(a.id)}">
            <span class="av-card-ico"><i class="fa-solid fa-camera"></i></span>
            <span class="av-card-txt">
                <strong>${esc(a.nome)} ${!a.visto ? '<span class="badge warn">Nova</span>' : ""}</strong>
                <small>${quando(a.criadoEm)} · ${restam(a)}</small>
                ${a.obs ? `<em>“${esc(a.obs)}”</em>` : ""}
            </span>
            <i class="fa-solid fa-chevron-right av-card-seta"></i>
        </button>`).join("");
    $("av-vazio").hidden = todas.length > 0;
}

/* =================== Detalhe =================== */

export function mostrarLista() {
    atual = null;
    $("av-lista-wrap").hidden = false;
    $("av-detalhe").hidden = true;
}

export async function abrir(id) {
    atual = id;
    $("av-lista-wrap").hidden = true;
    $("av-detalhe").hidden = false;
    $("av-detalhe").innerHTML = `
        <a href="#/avaliacoes" class="btn btn-ghost"><i class="fa-solid fa-arrow-left"></i> Avaliações</a>
        <div class="av-det">
            <div class="av-det-foto" id="av-det-foto"><p class="av-carregando"><i class="fa-solid fa-spinner fa-spin"></i> Abrindo a foto...</p></div>
            <div class="av-det-info" id="av-det-info"></div>
        </div>`;
    desenharCabecalhoDetalhe();

    const a = (estado.avaliacoes || []).find((x) => x.id === id);
    if (a && !a.visto) update(ref(db), { ["avaliacoes/" + id + "/visto"]: true }).catch((e) => console.error(e));
    try {
        const foto = (await get(ref(db, "avaliacoesFotos/" + id))).val();
        if (atual !== id) return;
        $("av-det-foto").innerHTML = typeof foto === "string" && foto.startsWith("data:image/")
            ? `<img src="${foto}" alt="Foto enviada para avaliação"><a class="btn btn-ghost btn-sm" href="${foto}" download="avaliacao-${esc(id)}.${foto.startsWith("data:image/webp") ? "webp" : "jpg"}"><i class="fa-solid fa-download"></i> Baixar foto</a>`
            : '<div class="empty card-empty"><i class="fa-regular fa-image"></i><p>Esta foto não está mais disponível (já passou dos 15 dias ou foi excluída).</p></div>';
    } catch (e) {
        console.error(e);
        if (atual === id) $("av-det-foto").innerHTML = '<div class="empty card-empty"><i class="fa-regular fa-image"></i><p>Esta foto não está mais disponível (já passou dos 15 dias ou foi excluída).</p></div>';
    }
}

function desenharCabecalhoDetalhe() {
    const info = $("av-det-info");
    if (!info) return;
    const a = (estado.avaliacoes || []).find((x) => x.id === atual);
    if (!a) {
        info.innerHTML = "<p>Avaliação não encontrada. Ela pode ter passado dos 15 dias ou ter sido excluída.</p>";
        return;
    }
    const al = (estado.alunos || []).find((x) => x.id === a.alunoId);
    const zap = foneWhats(al?.telefone || "");
    const resposta = encodeURIComponent("Olá, " + String(a.nome || "").split(" ")[0] + "! Vi a foto que você mandou para avaliação.");
    info.innerHTML = `
        <h1>${esc(a.nome)}</h1>
        <p class="av-det-quando">Enviada em ${quando(a.criadoEm)} · <b>${restam(a)}</b></p>
        ${a.obs ? `<div class="av-det-obs"><small>O que avaliar</small><p>${esc(a.obs)}</p></div>` : ""}
        <div class="av-det-acoes">
            ${zap ? `<a class="btn btn-primary" href="https://wa.me/${zap}?text=${resposta}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> Responder no WhatsApp</a>` : ""}
            <button type="button" class="btn btn-ghost" id="av-excluir"><i class="fa-solid fa-trash"></i> Excluir agora</button>
        </div>`;
    $("av-excluir").addEventListener("click", () => excluir(a));
}

async function excluir(a) {
    if (!(await confirmar({ titulo: "Excluir a foto?", texto: "A foto de " + a.nome + " será apagada agora. Essa ação não pode ser desfeita." }))) return;
    try {
        await update(ref(db), { ["avaliacoes/" + a.id]: null, ["avaliacoesFotos/" + a.id]: null });
        aviso("Foto excluída.", "ok");
        location.hash = "#/avaliacoes";
    } catch (e) {
        console.error(e);
        aviso(mensagemErro(e, "Não foi possível excluir."), "error");
    }
}
