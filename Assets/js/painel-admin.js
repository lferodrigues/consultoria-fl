// Painel de Controle (SPA) — acesso, dados em tempo real, rotas e menu
//
// Rotas (tudo na mesma página, sem recarregar):
//   #/inicio  #/alunos  #/treinos  #/biblioteca  #/financeiro  #/planos
//   #/<tela>/novo abre o cadastro daquela tela
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { auth, db, ehAdmin, hojeISO, PAGINAS } from "./firebase-app.js?v=2";
import { situacao, dataBR, listaDe } from "./alunos-util.js?v=2";
import { mostrarAcessoNegado } from "./acesso-negado.js?v=1";
import { $, estado, aoMudar, notificar, esc, aviso } from "./admin-core.js?v=1";
import * as Alunos from "./admin-alunos.js?v=1";
import * as Treinos from "./admin-treinos.js?v=1";
import * as Biblioteca from "./admin-biblioteca.js?v=1";
import * as Financeiro from "./admin-financeiro.js?v=1";
import * as Planos from "./admin-planos.js?v=1";

const TELAS = ["inicio", "alunos", "treinos", "biblioteca", "financeiro", "planos"];
const TITULOS = { inicio: "Início", alunos: "Alunos", treinos: "Treinos", biblioteca: "Biblioteca", financeiro: "Financeiro", planos: "Planos" };
const MODULOS = { alunos: Alunos, treinos: Treinos, biblioteca: Biblioteca, financeiro: Financeiro, planos: Planos };
const NOS = ["alunos", "treinos", "biblioteca", "financeiro", "planos"];

let saindo = false;
let iniciado = false;
const pararEscutas = [];

/* =================== Acesso =================== */

onAuthStateChanged(auth, (user) => {
    if (saindo) return;
    if (!user || !ehAdmin(user)) {
        pararEscutas.forEach((p) => p());
        mostrarAcessoNegado(user
            ? { texto: "Esta área é exclusiva do administrador.", botao: "Ir para a área do aluno", link: PAGINAS.aluno || PAGINAS.login }
            : { texto: "Faça o seu login para entrar." });
        return;
    }
    if (iniciado) return;
    iniciado = true;
    iniciarPainel(user);
});

function iniciarPainel(user) {
    const nome = (user.displayName || "Fagner Lage").trim();
    $("admin-nome").textContent = nome.split(" ")[0];
    $("admin-email").textContent = user.email;
    $("avatar").textContent = nome.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

    Object.values(MODULOS).forEach((m) => m.iniciar());
    aoMudar(desenharAvisos);
    iniciarMenu();
    iniciarTopo();

    // Escuta os dados em tempo real (os PDFs em "arquivos" só são baixados quando pedidos)
    NOS.forEach((no) => {
        pararEscutas.push(onValue(ref(db, no), (snap) => {
            estado[no] = listaDe(snap.val());
            if (no === "alunos") estado.alunos.sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
            notificar();
        }, (erro) => {
            console.error(no, erro);
            aviso("Sem permissão para ler \"" + no + "\". Confira as regras do Realtime Database.", "error");
        }));
    });

    window.addEventListener("hashchange", rotear);
    rotear();
    notificar();
    $("gate").hidden = true;
}

/* =================== Rotas =================== */

function rotear() {
    const [base, acao] = location.hash.replace(/^#\/?/, "").split("/");
    const tela = TELAS.includes(base) ? base : "inicio";

    TELAS.forEach((t) => { $("view-" + t).hidden = t !== tela; });
    document.title = TITULOS[tela] + " | Painel Fagner Lage";

    // Menu: item ativo, grupo aberto e subitem marcado
    document.querySelectorAll(".menu-item").forEach((li) => {
        const ativo = li.dataset.rota === tela;
        li.classList.toggle("ativo", ativo);
        if (ativo && li.classList.contains("has-sub")) abrirGrupo(li, true);
    });
    const sub = tela + (acao === "novo" ? "/novo" : "");
    document.querySelectorAll(".submenu a").forEach((a) => a.classList.toggle("ativo", a.dataset.sub === sub));

    if (window.innerWidth <= 1024) document.body.classList.remove("side-aberta");
    window.scrollTo(0, 0);

    if (acao === "novo" && MODULOS[tela]) {
        MODULOS[tela].novo(() => {
            // ao fechar o cadastro, o menu volta para a lista
            document.querySelectorAll(".submenu a").forEach((a) => a.classList.toggle("ativo", a.dataset.sub === tela));
        });
        history.replaceState(null, "", "#/" + tela);
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
        if (e.target.closest("a")) { $("bell-menu").hidden = true; }
    });
    $("logout-btn").addEventListener("click", async () => {
        saindo = true;
        pararEscutas.forEach((p) => p());
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

function desenharAvisos() {
    const lista = alunosComAviso();
    $("bell-n").textContent = lista.length;
    $("bell-n").classList.toggle("zero", lista.length === 0);
    $("bell-menu").innerHTML = '<span class="drop-title">Avisos</span>' + (lista.length
        ? lista.slice(0, 8).map(({ a, s }) => `
            <a href="#/alunos" class="aviso-item"><i class="fa-solid ${s.chave === "vencidos" ? "fa-circle-exclamation" : "fa-clock"}" style="color:${s.chave === "vencidos" ? "var(--red-2)" : "var(--warn)"}"></i>
            <span>${esc(a.nome)}<small>${s.texto} · ${dataBR(a.vencimento)}</small></span></a>`).join("")
        : '<span class="drop-email" style="border:0">Nenhum plano vencendo. Tudo em dia!</span>');
}
