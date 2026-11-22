// Painel de Controle (SPA) — acesso, dados em tempo real, rotas e menu
//
// Rotas (tudo na mesma página, sem recarregar):
//   #/inicio  #/inscricoes[/uid]  #/alunos  #/treinos  #/exercicios[/grupo]  #/biblioteca  #/financeiro  #/planos  #/vitrine
//   #/<tela>/novo abre o cadastro daquela tela
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { auth, db, ehAdmin, hojeISO, PAGINAS } from "./firebase-app.js?v=2";
import { situacao, dataBR, listaDe } from "./alunos-util.js?v=2";
import { mostrarAcessoNegado } from "./acesso-negado.js?v=1";
import { $, estado, aoMudar, notificar, esc, aviso } from "./admin-core.js?v=1";
import * as Alunos from "./admin-alunos.js?v=3";
import * as Treinos from "./admin-fichas.js?v=6";
import { diaPorId, ESFORCO, ordenarFichas, trocaDaFicha, diasParaTroca, textoTroca, AVISO_TROCA_DIAS } from "./fichas-util.js?v=2";
import * as Biblioteca from "./admin-biblioteca.js?v=1";
import * as Financeiro from "./admin-financeiro.js?v=1";
import * as Planos from "./admin-planos.js?v=2";
import * as Exercicios from "./admin-exercicios.js?v=1";
import * as Pix from "./admin-pix.js?v=1";
import * as Depoimentos from "./admin-depoimentos.js?v=1";
import * as Inscricoes from "./admin-inscricoes.js?v=4";
import * as Vitrine from "./admin-vitrine.js?v=3";
import * as Avaliacoes from "./admin-avaliacoes.js?v=3";

const TELAS = ["inicio", "avaliacoes", "inscricoes", "alunos", "treinos", "exercicios", "biblioteca", "financeiro", "planos", "vitrine", "depoimentos"];
// Telas que ficam dentro de um grupo do menu
const GRUPO = { exercicios: "treinos" };
const TITULOS = { inicio: "Início", avaliacoes: "Avaliações por foto", inscricoes: "Inscrições", alunos: "Alunos", treinos: "Treinos", exercicios: "Biblioteca de exercícios", biblioteca: "Biblioteca", financeiro: "Financeiro", planos: "Planos", vitrine: "Vitrine", depoimentos: "Depoimentos" };
const MODULOS = { alunos: Alunos, treinos: Treinos, biblioteca: Biblioteca, financeiro: Financeiro, planos: Planos, exercicios: Exercicios, depoimentos: Depoimentos, inscricoes: Inscricoes, avaliacoes: Avaliacoes };
const NOS = ["avaliacoes", "inscricoes", "alunos", "fichas", "feedbacks", "exercicios", "biblioteca", "financeiro", "planos", "depoimentos"];

let saindo = false;
let iniciado = false;   // tela montada (pela cópia do aparelho ou após o login)
let ligado = false;     // dados em tempo real ligados
const pararEscutas = [];

/* =================== Abertura instantânea (cópia no aparelho) =================== */
// Como na área do aluno: a última versão dos dados do painel fica guardada neste aparelho.
// Ao abrir, o painel aparece NA HORA com ela, e o Firebase confere o login e atualiza tudo em seguida.
// Dados sensíveis das inscrições (saúde, CPF, endereço, foto) NÃO entram na cópia: só o resumo da lista.
const CACHE = "fl-admin-cache-v1";
const RESUMO_INSCRICAO = ["uid", "nome", "email", "whatsapp", "planoId", "planoNome", "valor", "status", "visto", "criadoEm", "alunoId", "aprovadoEm", "diaVencimento", "primeiroVencimento"];

function lerCache() {
    try { return JSON.parse(localStorage.getItem(CACHE) || "null"); } catch { return null; }
}
function limparCache() {
    try { localStorage.removeItem(CACHE); } catch { /* sem armazenamento */ }
}
let timerCache = null;
function salvarCache(user) {
    clearTimeout(timerCache);
    timerCache = setTimeout(() => {
        const dados = {};
        NOS.forEach((no) => { dados[no] = estado[no]; });
        dados.inscricoes = (estado.inscricoes || []).map((i) => {
            const r = { id: i.id };
            RESUMO_INSCRICAO.forEach((k) => { if (i[k] !== undefined) r[k] = i[k]; });
            return r;
        });
        const copia = { email: user.email, nome: user.displayName || "", salvoEm: Date.now(), dados };
        try { localStorage.setItem(CACHE, JSON.stringify(copia)); }
        catch {
            // Aparelho sem espaço: guarda sem a biblioteca de exercícios (a parte mais pesada)
            try { delete copia.dados.exercicios; localStorage.setItem(CACHE, JSON.stringify(copia)); } catch { /* desiste */ }
        }
    }, 800);
}

// Chamada no fim do arquivo (depois que tudo foi declarado)
function abrirDoCache() {
    const c = lerCache();
    if (!c || !c.dados || !ehAdmin({ email: c.email })) return;
    Object.entries(c.dados).forEach(([no, lista]) => { if (Array.isArray(lista)) estado[no] = lista; });
    try { iniciarPainel({ email: c.email, displayName: c.nome }); }
    catch (e) { console.error(e); limparCache(); location.reload(); }
}

/* =================== Acesso =================== */

onAuthStateChanged(auth, (user) => {
    if (saindo) return;
    if (!user || !ehAdmin(user)) {
        limparCache();
        pararEscutas.forEach((p) => p());
        mostrarAcessoNegado(user
            ? { texto: "Esta área é exclusiva do administrador.", botao: "Ir para a área do aluno", link: PAGINAS.aluno || PAGINAS.login }
            : { texto: "Faça o seu login para entrar." });
        return;
    }
    if (!iniciado) iniciarPainel(user);
    ligarDados(user);
});

// Monta a tela (uma vez): módulos, menu e rotas
function iniciarPainel(user) {
    iniciado = true;
    const nome = (user.displayName || "Fagner Lage").trim();
    $("admin-nome").textContent = nome.split(" ")[0];
    $("admin-email").textContent = user.email;
    $("avatar").textContent = nome.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

    Object.values(MODULOS).forEach((m) => m.iniciar());
    Pix.iniciar();
    Vitrine.iniciar();
    aoMudar(desenharAvisos);
    iniciarMenu();
    iniciarTopo();

    window.addEventListener("hashchange", rotear);
    rotear();
    notificar();
    $("gate").hidden = true;
}

// Escuta os dados em tempo real (uma vez, depois do login). Os PDFs em "arquivos" só são baixados quando pedidos.
function ligarDados(user) {
    if (ligado) return;
    ligado = true;
    $("admin-nome").textContent = (user.displayName || "Fagner Lage").trim().split(" ")[0];
    $("admin-email").textContent = user.email;
    aoMudar(() => salvarCache(user));
    NOS.forEach((no) => {
        pararEscutas.push(onValue(ref(db, no), (snap) => {
            if (no === "fichas") {
                // fichas/{alunoId}/{fichaId} -> lista com alunoId
                estado.fichas = Object.entries(snap.val() || {}).flatMap(([alunoId, fichas]) =>
                    Object.entries(fichas || {}).map(([id, f]) => ({ id, alunoId, ...f })));
            } else {
                estado[no] = listaDe(snap.val());
            }
            if (no === "alunos") estado.alunos.sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
            notificar();
        }, (erro) => {
            console.error(no, erro);
            aviso("Sem permissão para ler \"" + no + "\". Confira as regras do Realtime Database.", "error");
        }));
    });
}

/* =================== Rotas =================== */

function rotear() {
    const [base, acao, extra] = location.hash.replace(/^#\/?/, "").split("/");
    const tela = TELAS.includes(base) ? base : "inicio";

    TELAS.forEach((t) => { $("view-" + t).hidden = t !== tela; });
    document.title = TITULOS[tela] + " | Painel Fagner Lage";

    // Menu: item ativo, grupo aberto e subitem marcado
    document.querySelectorAll(".menu-item").forEach((li) => {
        const ativo = li.dataset.rota === (GRUPO[tela] || tela);
        li.classList.toggle("ativo", ativo);
        if (ativo && li.classList.contains("has-sub")) abrirGrupo(li, true);
    });
    const sub = tela + (acao === "novo" ? "/novo" : acao === "pix" ? "/pix" : "");
    // Biblioteca de exercícios: #/exercicios/<grupo>; "novo" mantém o grupo aberto
    if (tela === "exercicios" && acao !== "novo") Exercicios.selecionarCategoria(acao || "");
    document.querySelectorAll(".submenu a").forEach((a) => a.classList.toggle("ativo", a.dataset.sub === sub));

    if (window.innerWidth <= 1024) document.body.classList.remove("side-aberta");
    window.scrollTo(0, 0);

    // #/financeiro/pix abre o cadastro da chave Pix
    if (tela === "financeiro" && acao === "pix") {
        Pix.editar();
        history.replaceState(null, "", "#/financeiro");
    }

    if (tela === "depoimentos") Depoimentos.marcarVistos();

    // #/avaliacoes/<id> abre a foto (link que chega no WhatsApp do Fagner)
    if (tela === "avaliacoes") { if (acao) Avaliacoes.abrir(acao); else Avaliacoes.mostrarLista(); }

    // #/inscricoes/<uid> abre a ficha de inscrição (link que chega no WhatsApp do Fagner)
    if (tela === "inscricoes") { if (acao) Inscricoes.abrir(acao); else Inscricoes.mostrarLista(); }

    // #/treinos/primeira/<alunoId>: cadastro da primeira ficha, já com o aluno escolhido
    if (tela === "treinos" && acao === "primeira" && extra) {
        Treinos.primeiraFicha(extra);
        history.replaceState(null, "", "#/treinos");
    }

    if (tela === "treinos" && acao === "aluno" && extra) {
        Treinos.focarAluno(extra);
        history.replaceState(null, "", "#/treinos");
    }

    if (acao === "novo" && MODULOS[tela]) {
        MODULOS[tela].novo(() => {
            // ao fechar o cadastro, o menu volta para a lista
            document.querySelectorAll(".submenu a").forEach((a) => a.classList.toggle("ativo", a.dataset.sub === tela));
        });
        const cat = tela === "exercicios" ? Exercicios.categoriaAtual() : "";
        history.replaceState(null, "", "#/" + tela + (cat ? "/" + cat : ""));
    }
}

/* =================== Menu lateral =================== */

function abrirGrupo(li, abrir) {
    li.classList.toggle("aberto", abrir);
    li.querySelector(".menu-toggle")?.setAttribute("aria-expanded", String(abrir));
}

function iniciarMenu() {
    document.querySelectorAll(".menu-toggle").forEach((b) => b.addEventListener("click", () => {
        const li = b.closest(".menu-item");
        abrirGrupo(li, !li.classList.contains("aberto"));
    }));
    $("expand-all").addEventListener("click", () => document.querySelectorAll(".menu-item.has-sub").forEach((li) => abrirGrupo(li, true)));
    $("collapse-all").addEventListener("click", () => document.querySelectorAll(".menu-item.has-sub").forEach((li) => abrirGrupo(li, false)));

    // Encontrar opção
    $("menu-search").addEventListener("input", (e) => {
        const termo = normalizar(e.target.value);
        let algum = false;
        document.querySelectorAll(".menu-item").forEach((li) => {
            const rotulo = li.querySelector(".menu-link span");
            const bateRotulo = !termo || normalizar(rotulo.textContent).includes(termo);
            let bateSub = false;
            li.querySelectorAll(".submenu li").forEach((s) => {
                const ok = bateRotulo || normalizar(s.textContent).includes(termo);
                s.hidden = !ok;
                if (ok && termo && !bateRotulo) bateSub = true;
            });
            const mostrar = bateRotulo || bateSub;
            li.hidden = !mostrar;
            if (mostrar) algum = true;
            if (li.classList.contains("has-sub")) {
                // com busca: abre o que bateu; sem busca: volta a deixar aberto só o grupo da tela atual
                abrirGrupo(li, termo ? mostrar : li.classList.contains("ativo"));
            }
        });
        $("menu-empty").hidden = algum;
    });
    $("menu-search").addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        const primeiro = [...document.querySelectorAll("#menu a")].find((a) => !a.closest("[hidden]"));
        if (primeiro) { location.hash = primeiro.getAttribute("href"); e.target.value = ""; e.target.dispatchEvent(new Event("input")); }
    });

    // Abrir / fechar o menu
    const desktop = () => window.innerWidth > 1024;
    $("side-close").addEventListener("click", () => {
        if (desktop()) document.body.classList.add("side-fechada");
        else document.body.classList.remove("side-aberta");
    });
    $("hamb").addEventListener("click", () => {
        if (desktop()) document.body.classList.remove("side-fechada");
        else document.body.classList.add("side-aberta");
    });
    $("side-overlay").addEventListener("click", () => document.body.classList.remove("side-aberta"));
}

function normalizar(t) {
    // sem acentos, hífens e espaços: "ebook" encontra "E-books"
    return String(t || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
}

/* =================== Topo: avisos e conta =================== */

function iniciarTopo() {
    const menus = [["bell", "bell-menu"], ["avatar", "avatar-menu"]];
    menus.forEach(([botao, menu]) => {
        $(botao).addEventListener("click", (e) => {
            e.stopPropagation();
            const abrir = $(menu).hidden;
            menus.forEach(([, m]) => { $(m).hidden = true; });
            $(menu).hidden = !abrir;
        });
    });
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".dropdown")) menus.forEach(([, m]) => { $(m).hidden = true; });
    });
    $("bell-menu").addEventListener("click", (e) => {
        if (e.target.closest("#fb-todos-lidos")) { e.stopPropagation(); Treinos.marcarFeedbacksLidos(); return; }
        if (e.target.closest("a")) { $("bell-menu").hidden = true; }
    });
    $("logout-btn").addEventListener("click", async () => {
        saindo = true;
        pararEscutas.forEach((p) => p());
        limparCache();
        await signOut(auth);
        window.location.replace(PAGINAS.login);
    });
}

function alunosComAviso() {
    const hoje = hojeISO();
    return estado.alunos
        .map((a) => ({ a, s: situacao(a, hoje) }))
        .filter(({ s }) => s.chave === "vencendo" || s.chave === "vencidos")
        .sort((x, y) => (x.a.vencimento || "").localeCompare(y.a.vencimento || ""));
}

// Fichas atuais que vencem em até 5 dias (ou já venceram) — só alunos ativos
function fichasParaTrocar() {
    const hoje = hojeISO();
    return estado.alunos
        .filter((a) => a.ativo !== false && !(a.vencimento && a.vencimento < hoje))
        .map((a) => {
            const atual = ordenarFichas(estado.fichas.filter((f) => f.alunoId === a.id))[0];
            const dias = atual ? diasParaTroca(atual, hoje) : null;
            return { a, f: atual, dias };
        })
        .filter((x) => x.dias !== null && x.dias <= AVISO_TROCA_DIAS)
        .sort((x, y) => x.dias - y.dias);
}

function desenharAvisos() {
    const vencimentos = alunosComAviso();
    const trocas = fichasParaTrocar();
    const avs = Avaliacoes.novas();
    const feedbacks = estado.feedbacks.filter((f) => !f.lido).sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
    const deps = Depoimentos.novos();
    const insc = Inscricoes.novas().sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
    const total = vencimentos.length + feedbacks.length + deps.length + insc.length + trocas.length + avs.length;
    $("bell-n").textContent = total > 99 ? "99+" : total;
    $("bell-n").classList.toggle("zero", total === 0);

    const nome = (id) => estado.alunos.find((a) => a.id === id)?.nome;
    const htmlFeedbacks = feedbacks.slice(0, 6).map((f) => {
        const e = ESFORCO[f.esforco] || { nome: f.esforco, classe: "off" };
        return `<a href="#/treinos/aluno/${f.alunoId}" class="aviso-item fb" data-fb="${f.id}">
            <i class="fa-solid fa-comment-dots" style="color:var(--red-2)"></i>
            <span>${esc(nome(f.alunoId) || f.nome || "Aluno")} <em class="badge ${e.classe}">${e.nome}</em>
            <small>${esc(diaPorId(f.dia).nome)} · ${esc(f.diaNome || "")} · ${quando(f.criadoEm)}</small>
            ${f.comentario ? `<small class="fb-coment">“${esc(f.comentario.length > 80 ? f.comentario.slice(0, 80) + "…" : f.comentario)}”</small>` : ""}</span></a>`;
    }).join("");
    const htmlVenc = vencimentos.slice(0, 6).map(({ a, s }) => `
        <a href="#/alunos" class="aviso-item"><i class="fa-solid ${s.chave === "vencidos" ? "fa-circle-exclamation" : "fa-clock"}" style="color:${s.chave === "vencidos" ? "var(--red-2)" : "var(--warn)"}"></i>
        <span>${esc(a.nome)}<small>${s.texto} · ${dataBR(a.vencimento)}</small></span></a>`).join("");

    const htmlInsc = insc.slice(0, 5).map((i) => `
        <a href="#/inscricoes/${esc(i.id)}" class="aviso-item"><i class="fa-solid fa-file-signature" style="color:var(--warn)"></i>
        <span>${esc(i.nome)}<small>Nova inscrição · ${esc(i.planoNome || "")} · ${quando(i.criadoEm)}</small></span></a>`).join("");

    const htmlTrocas = trocas.slice(0, 8).map(({ a, f, dias }) => `
        <a href="#/treinos/aluno/${esc(a.id)}" class="aviso-item"><i class="fa-solid fa-rotate" style="color:${dias < 0 ? "var(--red-2)" : "var(--warn)"}"></i>
        <span>${esc(a.nome)}<small>Ficha "${esc(f.nome || "Ficha de treino")}" ${textoTroca(dias)} · ${dataBR(trocaDaFicha(f))}</small></span></a>`).join("");

    $("bell-menu").innerHTML =
        (avs.length ? `<span class="drop-title">Avaliações por foto</span><a href="#/avaliacoes" class="aviso-item"><i class="fa-solid fa-camera" style="color:var(--red-2)"></i><span>${avs.length} ${avs.length === 1 ? "foto nova" : "fotos novas"} para avaliar<small>Toque para ver</small></span></a><span class="drop-sep"></span>` : "") +
        (trocas.length ? '<span class="drop-title">Fichas para trocar</span>' + htmlTrocas + '<span class="drop-sep"></span>' : "") +
        (insc.length ? '<span class="drop-title">Novas inscrições</span>' + htmlInsc + '<span class="drop-sep"></span>' : "") +
        `<div class="drop-head"><span class="drop-title">Feedbacks dos alunos</span>${feedbacks.length ? '<button type="button" class="drop-link" id="fb-todos-lidos">Marcar como lidos</button>' : ""}</div>` +
        (htmlFeedbacks || '<span class="drop-vazio">Nenhum feedback novo.</span>') +
        (deps.length ? '<span class="drop-title sep">Depoimentos</span>' +
            `<a href="#/depoimentos" class="aviso-item"><i class="fa-solid fa-star" style="color:#fbbf24"></i><span>${deps.length} ${deps.length === 1 ? "depoimento novo" : "depoimentos novos"}<small>Toque para ler e escolher os que vão para o site</small></span></a>` : "") +
        '<span class="drop-title sep">Planos vencendo</span>' +
        (htmlVenc || '<span class="drop-vazio">Nenhum plano vencendo. Tudo em dia!</span>');
}

function quando(ts) {
    if (!ts) return "";
    const min = Math.round((Date.now() - ts) / 60000);
    if (min < 1) return "agora";
    if (min < 60) return "há " + min + " min";
    if (min < 1440) return "há " + Math.round(min / 60) + " h";
    return new Date(ts).toLocaleDateString("pt-BR");
}

// Abre na hora com a cópia do aparelho (se houver); o login é conferido em paralelo
abrirDoCache();
