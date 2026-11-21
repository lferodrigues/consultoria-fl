// Área do Aluno (app) — só entra quem está logado, cadastrado, ativo e no prazo.
// Telas: #/inicio  #/treino  #/progresso  #/ebooks  #/depoimentos  #/faturas
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { ref, get, onValue, push, update, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { auth, db, ehAdmin, chaveEmail, hojeISO, PAGINAS } from "./firebase-app.js?v=2";
import { situacao, diasEntre, dataBR, moeda, tamanhoArquivo } from "./alunos-util.js?v=2";
import { DIAS, diaPorId, diaDeHoje, diasDaFicha, exerciciosDe, resumoExercicio, fichaAtual, idYoutube, ESFORCO } from "./fichas-util.js?v=1";
import { TIPOS_PIX, chaveFormatada, pixCopiaECola } from "./pix-util.js?v=1";
import { mostrarAcessoNegado } from "./acesso-negado.js?v=1";

// WhatsApp do personal (55 = Brasil, 32 = DDD)
const WHATSAPP = "5532998528266";

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const wa = (texto) => "https://wa.me/" + WHATSAPP + (texto ? "?text=" + encodeURIComponent(texto) : "");

const TELAS = { inicio: "", treino: "Treinos", progresso: "Meu progresso", ebooks: "E-books", depoimentos: "Depoimentos", faturas: "Faturas" };

let saindo = false;
let aluno = null;       // { id, nome, email }
let cadastro = null;    // emails/{chave}
let ficha = null;       // ficha atual
let diaSel = null;      // "seg", "ter"...
let exAberto = null;
let ebooks = [];
let pix = null;
let precoPlano = 0;
let feedbacks = null;   // carregados ao abrir "Meu progresso"

/* =================== Acesso =================== */

onAuthStateChanged(auth, async (user) => {
    if (saindo) return;
    if (!user) return mostrarAcessoNegado({ texto: "Faça o seu login para entrar." });
    if (ehAdmin(user)) return window.location.replace(PAGINAS.admin);

    try {
        const snap = await get(ref(db, "emails/" + chaveEmail(user.email)));
        cadastro = snap.val();
        const hoje = hojeISO();
        if (!cadastro) {
            return mostrarAcessoNegado({ texto: "O e-mail " + (user.email || "") + " não está cadastrado. Escolha um plano para começar.", botao: "Ver planos", link: PAGINAS.planos });
        }
        if (cadastro.ativo === false) {
            return mostrarAcessoNegado({ texto: "Seu acesso está desativado. Fale com o personal para liberar.", botao: "Voltar ao login" });
        }
        if (cadastro.vencimento && cadastro.vencimento < hoje) {
            return mostrarAcessoNegado({ texto: "Seu plano venceu. Fale com o personal para renovar.", botao: "Ver planos", link: PAGINAS.planos });
        }
        const nome = cadastro.nome || user.displayName || user.email;
        aluno = { id: cadastro.aluno, nome, email: user.email };
        iniciarApp();
    } catch (e) {
        console.error(e);
        mostrarAcessoNegado({ texto: "Não foi possível verificar o seu acesso. Faça o login de novo.", botao: "Fazer login" });
    }
});

function iniciarApp() {
    const primeiro = aluno.nome.split(" ")[0];
    const h = new Date().getHours();
    $("al-saudacao").textContent = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
    $("aluno-nome").textContent = primeiro;
    $("al-sheet-nome").textContent = aluno.nome;
    $("al-sheet-email").textContent = aluno.email;
    $("al-iniciais").textContent = aluno.nome.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
    $("nav-whats").href = wa("Olá, Fagner! Aqui é " + aluno.nome + ".");

    desenharFaturas();
    escutarFicha();
    escutarArquivos();
    carregarPix();

    window.addEventListener("hashchange", rotear);
    rotear();
    $("gate").hidden = true;
}

async function sair() {
    saindo = true;
    await signOut(auth);
    window.location.replace(PAGINAS.login);
}
$("logout-btn").addEventListener("click", sair);

/* =================== Telas (sem recarregar a página) =================== */

function rotear() {
    let tela = location.hash.replace(/^#\/?/, "").split("/")[0];
    if (tela === "arquivos") tela = "ebooks"; // endereço antigo
    const atual = tela in TELAS ? tela : "inicio";
    Object.keys(TELAS).forEach((t) => { $("view-" + t).hidden = t !== atual; });
    const inicio = atual === "inicio";
    $("al-voltar").hidden = inicio;
    $("al-marca").hidden = !inicio;
    $("al-top-titulo").hidden = inicio;
    $("al-top-titulo").textContent = TELAS[atual];
    document.querySelectorAll(".al-nav [data-nav]").forEach((a) => a.classList.toggle("ativo", inicio));
    document.title = (TELAS[atual] || "Área do Aluno") + " | Fagner Lage";
    fecharMenu();
    fecharNotificacoes();
    window.scrollTo(0, 0);
    if (atual === "progresso") carregarProgresso();
    if (atual === "depoimentos") carregarDepoimentos();
}

/* =================== Menu (botão de baixo) =================== */

function abrirMenu() {
    $("al-sheet").hidden = false;
    $("al-sheet-fundo").hidden = false;
    $("nav-menu").setAttribute("aria-expanded", "true");
}
function fecharMenu() {
    $("al-sheet").hidden = true;
    $("al-sheet-fundo").hidden = true;
    $("nav-menu").setAttribute("aria-expanded", "false");
}
$("nav-menu").addEventListener("click", () => ($("al-sheet").hidden ? abrirMenu() : fecharMenu()));
$("al-sheet-fundo").addEventListener("click", fecharMenu);
$("al-sheet").addEventListener("click", (e) => { if (e.target.closest("a")) fecharMenu(); });

/* =================== Notificações =================== */

const chaveVisto = () => "fl-notif-visto-" + aluno.id;
const chaveVencVisto = () => "fl-venc-visto-" + aluno.id;
const lerLocal = (k, padrao) => { try { return localStorage.getItem(k) ?? padrao; } catch { return padrao; } };
const gravarLocal = (k, v) => { try { localStorage.setItem(k, v); } catch { /* navegação privada */ } };

function diasParaVencer() {
    return cadastro?.vencimento ? diasEntre(hojeISO(), cadastro.vencimento) : null;
}

function montarNotificacoes() {
    const visto = Number(lerLocal(chaveVisto(), 0));
    const vencVisto = lerLocal(chaveVencVisto(), "");
    const lista = [];

    const dias = diasParaVencer();
    if (dias !== null && dias <= 7) {
        lista.push({
            icone: "fa-clock", cor: "warn", link: "#/faturas", quando: Date.now(),
            titulo: dias === 0 ? "Seu plano vence hoje" : "Seu plano vence em " + dias + (dias === 1 ? " dia" : " dias"),
            texto: "Vencimento em " + dataBR(cadastro.vencimento) + ". Renove pelo Pix em Faturas.",
            novo: vencVisto !== hojeISO()
        });
    }
    if (ficha) {
        const criada = ficha.criadoEm || 0;
        const mudou = ficha.atualizadoEm || criada;
        const atualizada = mudou - criada > 60000;
        lista.push({
            icone: "fa-dumbbell", cor: "red", link: "#/treino", quando: mudou,
            titulo: atualizada ? "Sua ficha de treino foi atualizada" : "Nova ficha de treino",
            texto: (ficha.nome || "Ficha de treino") + " · " + diasDaFicha(ficha).length + " dias por semana",
            novo: mudou > visto
        });
    }
    const limite = Date.now() - 60 * 86400000;
    ebooks.filter((e) => (e.criadoEm || 0) > limite).forEach((e) => lista.push({
        icone: "fa-book-open", cor: "red", link: "#/ebooks", quando: e.criadoEm,
        titulo: "Novo e-book: " + e.titulo, texto: e.categoria || "E-book", novo: (e.criadoEm || 0) > visto
    }));

    return lista.sort((a, b) => b.quando - a.quando).slice(0, 10);
}

function quando(ts) {
    const min = Math.round((Date.now() - ts) / 60000);
    if (min < 1) return "agora";
    if (min < 60) return "há " + min + " min";
    if (min < 1440) return "há " + Math.round(min / 60) + " h";
    if (min < 2880) return "ontem";
    return new Date(ts).toLocaleDateString("pt-BR");
}

function atualizarSino() {
    if (!aluno) return;
    const n = montarNotificacoes().filter((x) => x.novo).length;
    $("al-bell-n").textContent = n > 9 ? "9+" : n;
    $("al-bell-n").hidden = n === 0;
    $("al-bell").setAttribute("aria-label", n ? n + " notificações novas" : "Notificações");
}

function abrirNotificacoes() {
    const lista = montarNotificacoes();
    $("al-notifs-lista").innerHTML = lista.length
        ? lista.map((x) => `
            <a href="${x.link}" class="al-notif${x.novo ? " novo" : ""}">
                <span class="al-notif-ico ${x.cor}"><i class="fa-solid ${x.icone}"></i></span>
                <span class="al-notif-txt"><strong>${esc(x.titulo)}</strong><small>${esc(x.texto)}</small><em>${x.cor === "warn" ? "Aviso" : quando(x.quando)}</em></span>
            </a>`).join("")
        : '<p class="al-notif-vazio">Nenhuma notificação por enquanto.</p>';
    $("al-notifs").hidden = false;
    $("al-bell").setAttribute("aria-expanded", "true");
    // Abriu = viu
    gravarLocal(chaveVisto(), String(Date.now()));
    gravarLocal(chaveVencVisto(), hojeISO());
    atualizarSino();
}
function fecharNotificacoes() {
    $("al-notifs").hidden = true;
    $("al-bell").setAttribute("aria-expanded", "false");
}
$("al-bell").addEventListener("click", (e) => { e.stopPropagation(); $("al-notifs").hidden ? abrirNotificacoes() : fecharNotificacoes(); });
$("al-notifs-fechar").addEventListener("click", fecharNotificacoes);
document.addEventListener("click", (e) => { if (!e.target.closest("#al-notifs") && !e.target.closest("#al-bell")) fecharNotificacoes(); });

/* =================== Ficha de treino =================== */

function escutarFicha() {
    onValue(ref(db, "fichas/" + aluno.id), (snap) => {
        const lista = Object.entries(snap.val() || {}).map(([id, f]) => ({ id, ...f }));
        ficha = fichaAtual(lista);
        if (!ficha || !diasDaFicha(ficha).length) {
            ficha = null;
            $("treino-vazio").hidden = false;
            $("treino-grid").hidden = true;
        } else {
            $("treino-vazio").hidden = true;
            $("treino-grid").hidden = false;
            const dias = diasDaFicha(ficha).map((d) => d.id);
            if (!dias.includes(diaSel)) diaSel = dias.includes(diaDeHoje()) ? diaDeHoje() : dias[0];
            desenharFicha();
        }
        desenharInicio();
        atualizarSino();
    }, (erro) => {
        console.error(erro);
        $("treino-vazio").hidden = false;
        $("treino-vazio").querySelector("p").textContent = "Não foi possível carregar a sua ficha agora. Tente novamente em instantes.";
    });
}

const diaAtual = () => diasDaFicha(ficha).find((d) => d.id === diaSel);

// Exercícios concluídos ficam salvos no aparelho, por ficha, dia e data
const chaveFeitos = (diaId = diaSel, data = hojeISO()) => `fl-feitos-${ficha.id}-${diaId}-${data}`;
function lerFeitos(diaId, data) {
    try { return new Set(JSON.parse(localStorage.getItem(chaveFeitos(diaId, data)) || "[]")); } catch { return new Set(); }
}
function gravarFeitos(set) {
    gravarLocal(chaveFeitos(), JSON.stringify([...set]));
}

function desenharFicha() {
    const dias = diasDaFicha(ficha);
    const hoje = diaDeHoje();
    const dia = diaAtual();
    const ex = exerciciosDe(dia);
    const feitos = lerFeitos();

    $("tr-dia-nome").textContent = dia.nome || "Treino";
    $("tr-sub").textContent = diaPorId(diaSel).nome + (diaSel === hoje ? " (hoje)" : "") + " · " + (ficha.nome || "Ficha de treino");
    $("tr-ficha-nome").textContent = ficha.nome || "Ficha de treino";
    $("tr-tags").innerHTML = [ficha.objetivo, ficha.nivel, dias.length + (dias.length === 1 ? " dia" : " dias") + " por semana"]
        .filter(Boolean).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
    $("tr-obs-bloco").hidden = !ficha.obs;
    $("tr-obs").textContent = ficha.obs || "";

    const ativos = new Set(dias.map((d) => d.id));
    $("tr-semana").innerHTML = DIAS.map((d) => {
        const treina = ativos.has(d.id);
        return `<button type="button" class="sem-dia${d.id === diaSel ? " ativo" : ""}${d.id === hoje ? " hoje" : ""}" data-dia="${d.id}" ${treina ? "" : "disabled"} role="tab" aria-selected="${d.id === diaSel}" title="${d.nome}${treina ? "" : " — descanso"}">${d.letra}</button>`;
    }).join("");
    $("tr-descanso").hidden = ativos.has(hoje);
    $("tr-descanso").innerHTML = '<i class="fa-solid fa-bed"></i> Hoje (' + diaPorId(hoje).nome.toLowerCase() + ") é dia de descanso. Abaixo está o treino de " + diaPorId(diaSel).nome.toLowerCase() + ".";

    $("tr-lista").innerHTML = ex.map((e, i) => `
        <li class="${feitos.has(i) ? "feito" : ""}">
            <button type="button" class="ex-abrir" data-i="${i}" aria-label="Ver vídeo de ${esc(e.nome)}">
                <strong>${esc(e.nome)}</strong>
                <small>${esc([resumoExercicio(e), e.carga].filter(Boolean).join(" · ")) || "Toque para ver os detalhes"}</small>
                ${e.video ? '<i class="fa-solid fa-circle-play ex-play" aria-hidden="true"></i>' : ""}
            </button>
            <button type="button" class="ex-check" data-i="${i}" aria-pressed="${feitos.has(i)}" aria-label="${feitos.has(i) ? "Desmarcar" : "Marcar"} ${esc(e.nome)} como feito"><i class="fa-solid fa-check"></i></button>
        </li>`).join("");

    const pct = ex.length ? Math.round((feitos.size / ex.length) * 100) : 0;
    $("tr-barra").style.width = pct + "%";
    $("tr-prog-txt").textContent = feitos.size + " de " + ex.length + (ex.length === 1 ? " concluído" : " concluídos") + (pct === 100 ? " · Treino completo! 💪" : "");
}

$("tr-semana").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-dia]");
    if (!b || b.disabled) return;
    diaSel = b.dataset.dia;
    desenharFicha();
});

$("tr-lista").addEventListener("click", (ev) => {
    const check = ev.target.closest(".ex-check");
    if (check) return alternarFeito(Number(check.dataset.i));
    const abrir = ev.target.closest(".ex-abrir");
    if (abrir) abrirVideo(Number(abrir.dataset.i));
});

function alternarFeito(i) {
    const feitos = lerFeitos();
    if (feitos.has(i)) feitos.delete(i); else feitos.add(i);
    gravarFeitos(feitos);
    desenharFicha();
    desenharInicio();
}

/* =================== Início =================== */

function desenharInicio() {
    const hoje = diaDeHoje();
    if (!ficha) $("tile-treino").textContent = "Aguardando sua ficha";
    else {
        const d = diasDaFicha(ficha).find((x) => x.id === hoje);
        $("tile-treino").textContent = d ? "Hoje: " + (d.nome || "Treino") : "Hoje é dia de descanso";
    }
    const semana = treinosDaSemana();
    $("tile-progresso").textContent = ficha ? semana.feitos + " de " + semana.planejados + " treinos na semana" : "Treinos e feedbacks";
    $("tile-arquivos").textContent = ebooks.length ? ebooks.length + (ebooks.length === 1 ? " e-book" : " e-books") : "Materiais do personal";
    const dias = diasParaVencer();
    $("tile-faturas").textContent = dias === null ? "Plano e pagamento" : dias === 0 ? "Vence hoje" : "Vence em " + dias + (dias === 1 ? " dia" : " dias");
    const aviso = $("al-aviso-venc");
    aviso.hidden = !(dias !== null && dias <= 7);
    if (!aviso.hidden) aviso.innerHTML = `<i class="fa-solid fa-clock"></i><span><strong>${dias === 0 ? "Seu plano vence hoje" : "Seu plano vence em " + dias + (dias === 1 ? " dia" : " dias")}</strong><small>Toque para renovar pelo Pix</small></span><i class="fa-solid fa-chevron-right"></i>`;
}

/* =================== Meu progresso =================== */

function semanaAtual() {
    // Datas de segunda a domingo da semana de hoje
    const hoje = new Date();
    const desloc = (hoje.getDay() + 6) % 7;
    return DIAS.map((d, i) => {
        const dt = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - desloc + i);
        const iso = dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
        return { ...d, iso };
    });
}

function treinosDaSemana() {
    if (!ficha) return { feitos: 0, planejados: 0, dias: [] };
    const ativos = new Set(diasDaFicha(ficha).map((d) => d.id));
    const dias = semanaAtual().map((d) => ({ ...d, treina: ativos.has(d.id), feito: ativos.has(d.id) && lerFeitos(d.id, d.iso).size > 0, futuro: d.iso > hojeISO() }));
    return { feitos: dias.filter((d) => d.feito).length, planejados: ativos.size, dias };
}

async function carregarProgresso() {
    const s = treinosDaSemana();
    $("pg-semana").textContent = s.feitos;
    $("pg-semana-txt").textContent = "de " + s.planejados + " treinos nesta semana";
    $("pg-dias").innerHTML = s.dias.map((d) => `
        <div class="pg-dia ${d.feito ? "feito" : d.treina ? (d.futuro ? "plan" : "falta") : "folga"}${d.iso === hojeISO() ? " hoje" : ""}" title="${d.nome}">
            <b>${d.letra}</b><i class="fa-solid ${d.feito ? "fa-check" : d.treina ? (d.futuro ? "fa-dumbbell" : "fa-xmark") : "fa-bed"}"></i>
        </div>`).join("");

    $("pg-lista").innerHTML = '<li class="pg-vazio">Carregando...</li>';
    try {
        const snap = await get(query(ref(db, "feedbacks"), orderByChild("alunoId"), equalTo(aluno.id)));
        feedbacks = Object.entries(snap.val() || {}).map(([id, f]) => ({ id, ...f })).sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
    } catch (e) {
        console.error(e);
        feedbacks = null;
    }
    if (!feedbacks) {
        $("pg-lista").innerHTML = '<li class="pg-vazio">Não foi possível carregar seus feedbacks agora.</li>';
        return;
    }
    const mes = hojeISO().slice(0, 7);
    $("pg-mes").textContent = feedbacks.filter((f) => (f.data || "").slice(0, 7) === mes).length;
    $("pg-esforco").textContent = feedbacks[0] ? (ESFORCO[feedbacks[0].esforco]?.nome || "—") : "—";
    $("pg-lista").innerHTML = feedbacks.length
        ? feedbacks.slice(0, 20).map((f) => {
            const e = ESFORCO[f.esforco] || { nome: f.esforco, classe: "off" };
            return `<li>
                <div class="pg-topo"><strong>${dataBR(f.data)} · ${esc(diaPorId(f.dia).nome)}</strong><span class="badge ${e.classe}">${e.nome}</span></div>
                <small>${esc(f.diaNome || "Treino")} · ${f.feitos ?? 0} de ${f.total ?? 0} exercícios</small>
                ${f.comentario ? `<p>“${esc(f.comentario)}”</p>` : ""}
            </li>`;
        }).join("")
        : '<li class="pg-vazio">Você ainda não enviou feedbacks. Depois de treinar, toque em "Feedback do dia" na tela de Treinos.</li>';
}

/* =================== E-books =================== */

function escutarArquivos() {
    onValue(ref(db, "biblioteca"), (snap) => {
        ebooks = Object.entries(snap.val() || {}).map(([id, e]) => ({ id, ...e }))
            .filter((e) => e.para !== "selecionados" || (e.alunos && e.alunos[aluno.id]))
            .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
        desenharArquivos();
        desenharInicio();
        atualizarSino();
    }, (e) => {
        console.warn("Arquivos indisponíveis:", e);
        ebooks = [];
        desenharArquivos();
    });
}

function desenharArquivos() {
    $("arq-vazio").hidden = ebooks.length > 0;
    $("arq-lista").innerHTML = ebooks.map((e) => `
        <li class="arq">
            <span class="arq-ico"><i class="fa-solid fa-file-pdf"></i></span>
            <div class="arq-txt">
                <strong>${esc(e.titulo)}</strong>
                <small>${esc(e.categoria || "E-book")} · ${tamanhoArquivo(e.tamanho)}</small>
                ${e.descricao ? `<p>${esc(e.descricao)}</p>` : ""}
            </div>
            <button type="button" class="btn btn-primary btn-sm" data-arq="${e.id}"><i class="fa-solid fa-download"></i> Abrir</button>
        </li>`).join("");
}

$("arq-lista").addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-arq]");
    if (!b) return;
    const e = ebooks.find((x) => x.id === b.dataset.arq);
    b.disabled = true;
    try {
        const arq = (await get(ref(db, "arquivos/" + b.dataset.arq))).val();
        if (!arq?.dados) throw new Error("sem arquivo");
        const bin = atob(arq.dados);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = arq.nome || (e?.titulo || "ebook") + ".pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 15000);
    } catch (err) {
        console.error(err);
        aviso("Não foi possível abrir este e-book agora.", "error");
    } finally {
        b.disabled = false;
    }
});

/* =================== Depoimentos =================== */
//   depoimentos/{id} -> { alunoId, nome, nomeExibicao, texto, nota, autorizado, criadoEm, publicado, visto }

function nomeExibicao(modo) {
    const partes = aluno.nome.trim().split(/\s+/);
    if (modo === "completo") return aluno.nome.trim();
    if (modo === "primeiro" || partes.length === 1) return partes[0];
    return partes[0] + " " + partes[partes.length - 1][0].toUpperCase() + ".";
}

function atualizarPreviaNome() {
    $("dep-nome-prev").textContent = "Vai aparecer como: " + nomeExibicao($("dep-nome-modo").value);
}
$("dep-nome-modo").addEventListener("change", atualizarPreviaNome);
$("dep-texto").addEventListener("input", () => { $("dep-cont").textContent = $("dep-texto").value.length + " / 600"; $("dep-msg").textContent = ""; });
document.querySelectorAll('input[name="dep-nota"]').forEach((r) => r.addEventListener("change", () => { $("dep-msg").textContent = ""; }));
$("dep-autorizo").addEventListener("change", () => { $("dep-msg").textContent = ""; });

async function carregarDepoimentos() {
    atualizarPreviaNome();
    $("dep-lista").innerHTML = '<li class="pg-vazio">Carregando...</li>';
    try {
        const snap = await get(query(ref(db, "depoimentos"), orderByChild("alunoId"), equalTo(aluno.id)));
        const lista = Object.entries(snap.val() || {}).map(([id, d]) => ({ id, ...d })).sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
        $("tile-depoimentos").textContent = lista.some((d) => d.publicado) ? "Seu depoimento está no site!" : "Conte sua experiência";
        $("dep-lista").innerHTML = lista.length
            ? lista.map((d) => `<li>
                <div class="pg-topo"><span class="dep-estrelas">${"★".repeat(d.nota || 0)}<em>${"★".repeat(5 - (d.nota || 0))}</em></span>
                ${d.publicado ? '<span class="badge ok">Publicado no site</span>' : '<span class="badge off">Enviado</span>'}</div>
                <p>“${esc(d.texto)}”</p>
                <small>${esc(d.nomeExibicao || "")} · ${new Date(d.criadoEm || Date.now()).toLocaleDateString("pt-BR")}</small>
            </li>`).join("")
            : '<li class="pg-vazio">Você ainda não enviou depoimentos.</li>';
    } catch (e) {
        console.error(e);
        $("dep-lista").innerHTML = '<li class="pg-vazio">Não foi possível carregar seus depoimentos agora.</li>';
    }
}

$("dep-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const msg = $("dep-msg");
    const nota = Number(document.querySelector('input[name="dep-nota"]:checked')?.value || 0);
    const texto = $("dep-texto").value.trim();
    if (!nota) return (msg.textContent = "Escolha uma nota de 1 a 5 estrelas.");
    if (texto.length < 20) return (msg.textContent = "Escreva um pouco mais (pelo menos 20 caracteres).");
    if (!$("dep-autorizo").checked) return (msg.textContent = "Marque a autorização para o personal poder publicar o depoimento.");

    const botao = $("dep-enviar");
    botao.disabled = true;
    try {
        const id = push(ref(db, "depoimentos")).key;
        await update(ref(db), {
            ["depoimentos/" + id]: {
                alunoId: aluno.id, nome: aluno.nome, nomeExibicao: nomeExibicao($("dep-nome-modo").value),
                texto, nota, autorizado: true, criadoEm: Date.now(), publicado: false, visto: false
            }
        });
        $("dep-form").reset();
        $("dep-cont").textContent = "0 / 600";
        msg.textContent = "";
        aviso("Obrigado! Seu depoimento foi enviado ao personal.", "ok");
        carregarDepoimentos();
    } catch (e) {
        console.error(e);
        msg.textContent = "Não foi possível enviar agora. Tente novamente em instantes.";
    } finally {
        botao.disabled = false;
    }
});

/* =================== Faturas =================== */

function desenharFaturas() {
    const hoje = hojeISO();
    $("aluno-plano").textContent = cadastro.plano ? "Plano " + cadastro.plano : "Consultoria";
    $("aluno-venc").textContent = dataBR(cadastro.vencimento);
    const dias = diasParaVencer();
    $("aluno-dias").textContent = dias === null ? "" : dias === 0 ? "vence hoje" : "faltam " + dias + (dias === 1 ? " dia" : " dias");
    const s = situacao(cadastro, hoje);
    $("aluno-status").textContent = s.texto;
    $("aluno-status").className = "badge " + s.classe;
}

async function carregarPix() {
    try {
        const [snapPix, snapPlanos] = await Promise.all([get(ref(db, "config/pix")), get(ref(db, "planos"))]);
        pix = snapPix.val();
        // Valor do plano: procura o plano do aluno pelo nome na página de planos
        const nomePlano = String(cadastro.plano || "").toLowerCase();
        const plano = Object.values(snapPlanos.val() || {}).find((p) => String(p.nome || "").toLowerCase() === nomePlano);
        precoPlano = plano?.preco || 0;
    } catch (e) {
        console.warn("Pix indisponível:", e);
        pix = null;
    }
    const tem = !!pix?.chave;
    $("pix-bloco").hidden = !tem;
    $("pix-vazio").hidden = tem;
    if (!tem) return;
    $("pix-tipo").textContent = TIPOS_PIX[pix.tipo]?.nome || pix.tipo;
    $("pix-chave").textContent = chaveFormatada(pix.tipo, pix.chave);
    $("pix-nome").textContent = pix.nome + (pix.banco ? " · " + pix.banco : "");
    $("pix-copiar-codigo").innerHTML = '<i class="fa-solid fa-qrcode"></i> Copiar Pix copia e cola' + (precoPlano ? " · " + moeda(precoPlano) : "");
    $("pix-comprovante").href = wa("Olá, Fagner! Segue o comprovante do pagamento do " + (cadastro.plano ? "plano " + cadastro.plano : "plano") + " — " + aluno.nome + ".");
}

async function copiar(texto, msg) {
    try { await navigator.clipboard.writeText(texto); aviso(msg, "ok"); }
    catch { window.prompt("Copie o texto abaixo:", texto); }
}
$("pix-copiar-chave").addEventListener("click", () => pix && copiar(pix.chave, "Chave Pix copiada. Cole no app do seu banco."));
$("pix-copiar-codigo").addEventListener("click", () => {
    if (!pix) return;
    copiar(pixCopiaECola({ chave: pix.chave, nome: pix.nome, cidade: pix.cidade, valorCentavos: precoPlano }),
        "Pix copia e cola copiado. No app do banco, escolha Pix → Copia e cola.");
});

/* =================== Pop-ups =================== */

function abrirModal(id, foco) {
    $(id).hidden = false;
    document.body.classList.add("modal-aberto");
    if (foco) setTimeout(() => $(foco)?.focus(), 50);
}
function fecharModal(id) {
    $(id).hidden = true;
    if (id === "modal-video") $("mv-video").innerHTML = ""; // para o vídeo
    if (!document.querySelector(".modal:not([hidden])")) document.body.classList.remove("modal-aberto");
}
document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fechar]");
    if (b) fecharModal(b.closest(".modal").id);
    else if (e.target.classList?.contains("modal")) fecharModal(e.target.id);
});
document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const aberto = [...document.querySelectorAll(".modal:not([hidden])")].pop();
    if (aberto) fecharModal(aberto.id);
    else { fecharMenu(); fecharNotificacoes(); }
});

function abrirVideo(i) {
    const e = exerciciosDe(diaAtual())[i];
    if (!e) return;
    exAberto = i;
    $("mv-titulo").textContent = e.nome;
    $("mv-sub").textContent = (diaAtual().nome || "Treino") + " · " + (i + 1) + " de " + exerciciosDe(diaAtual()).length;
    const id = idYoutube(e.video);
    if (id) {
        $("mv-video").innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1" title="Vídeo: ${esc(e.nome)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    } else if (e.video) {
        $("mv-video").innerHTML = `<div class="video-vazio"><i class="fa-solid fa-film"></i><p>Este vídeo não é do YouTube.</p><a class="btn btn-ghost btn-sm" href="${esc(e.video)}" target="_blank" rel="noopener">Abrir vídeo</a></div>`;
    } else {
        $("mv-video").innerHTML = `<div class="video-vazio"><i class="fa-solid fa-video-slash"></i><p>O personal ainda não cadastrou um vídeo para este exercício.</p></div>`;
    }
    const dados = [["Séries", e.series], ["Repetições", e.reps], ["Carga", e.carga], ["Descanso", e.descanso]].filter(([, v]) => v);
    $("mv-dados").innerHTML = dados.map(([k, v]) => `<div><small>${k}</small><strong>${esc(v)}</strong></div>`).join("");
    $("mv-obs").hidden = !e.obs;
    $("mv-obs").textContent = e.obs || "";
    const feito = lerFeitos().has(i);
    $("mv-feito").innerHTML = feito ? '<i class="fa-solid fa-rotate-left"></i> Desmarcar' : '<i class="fa-solid fa-check"></i> Marcar como feito';
    abrirModal("modal-video");
}

$("mv-feito").addEventListener("click", () => {
    if (exAberto === null) return;
    alternarFeito(exAberto);
    fecharModal("modal-video");
});

/* =================== Feedback do dia =================== */

$("tr-feedback-btn").addEventListener("click", () => {
    const dia = diaAtual();
    const total = exerciciosDe(dia).length;
    $("fb-resumo").textContent = diaPorId(diaSel).nome + " · " + (dia.nome || "Treino") + " — " + lerFeitos().size + " de " + total + " exercícios feitos";
    $("feedback-form").reset();
    $("fb-msg").textContent = "";
    abrirModal("modal-feedback");
});

document.querySelectorAll('input[name="esforco"]').forEach((r) => r.addEventListener("change", () => { $("fb-msg").textContent = ""; }));

$("feedback-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const esforco = document.querySelector('input[name="esforco"]:checked')?.value;
    const comentario = $("fb-comentario").value.trim();
    if (!esforco) return ($("fb-msg").textContent = "Escolha o nível de esforço: mínimo, médio ou alto.");

    const dia = diaAtual();
    const total = exerciciosDe(dia).length;
    const feitos = lerFeitos().size;
    const registro = {
        alunoId: aluno.id, nome: aluno.nome, email: aluno.email,
        fichaId: ficha.id, fichaNome: ficha.nome || "",
        dia: diaSel, diaNome: dia.nome || "", data: hojeISO(),
        esforco, comentario, feitos, total,
        criadoEm: Date.now(), lido: false
    };

    // Abre o WhatsApp já no clique (navegadores bloqueiam janelas abertas depois de esperar o banco)
    const texto = [
        "*Feedback do treino* 💪",
        "Aluno: " + aluno.nome,
        "Ficha: " + (ficha.nome || "Ficha de treino"),
        "Dia: " + diaPorId(diaSel).nome + " — " + (dia.nome || "Treino"),
        "Esforço: " + ESFORCO[esforco].nome,
        "Exercícios feitos: " + feitos + " de " + total,
        comentario ? "Comentário: " + comentario : ""
    ].filter(Boolean).join("\n");
    const janela = window.open(wa(texto), "_blank");
    if (janela) janela.opener = null;

    const botao = $("fb-enviar");
    botao.disabled = true;
    try {
        const id = push(ref(db, "feedbacks")).key;
        await update(ref(db), { ["feedbacks/" + id]: registro });
        fecharModal("modal-feedback");
        aviso(janela ? "Feedback enviado! Finalize o envio no WhatsApp." : "Feedback enviado ao personal!", "ok");
    } catch (e) {
        console.error(e);
        $("fb-msg").textContent = "Não foi possível registrar no painel. A mensagem do WhatsApp continua valendo.";
    } finally {
        botao.disabled = false;
    }
});

let timerAviso;
function aviso(texto, tipo = "ok") {
    const t = $("toast");
    t.textContent = texto;
    t.className = "toast show " + tipo;
    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => { t.className = "toast " + tipo; }, 4000);
}
