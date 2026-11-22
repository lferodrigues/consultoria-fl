// App do aluno em página única (SPA): login, ficha de inscrição e área do aluno.
//
// As três telas ficam em <template> dentro da mesma página (login.html, cadastro.html,
// cadastrolivre.html e area-do-aluno.html são a mesma "casca", geradas por aluno-spa/gerar.mjs).
// Trocar de tela não recarrega nada: o Firebase, o login e a verificação de segurança (App Check)
// continuam carregados, então a próxima tela aparece na hora.
//
// Regras:
//  - Cada tela tem o seu CSS; só o CSS da tela aberta fica ligado.
//  - O módulo de cada tela roda uma vez só. Voltar para uma tela que já rodou (ex.: sair da conta
//    e cair no login de novo) recarrega a página, para começar do zero com segurança.
//  - Voltar/avançar do navegador também recarrega.
(function () {
    const VISTAS = {
        login: {
            titulo: "Área do Aluno | Fagner Lage",
            appCheck: "login",
            css: ["./Assets/css/login.css?v=5"],
            modulo: "./Assets/js/login-aluno.js?v=13"
        },
        cadastro: {
            titulo: "Ficha de inscrição | Consultoria Fagner Lage",
            appCheck: "on",
            css: ["./Assets/css/cadastro.css?v=2"],
            modulo: "./Assets/js/inscricao.js?v=6"
        },
        area: {
            titulo: "Área do Aluno | Fagner Lage",
            appCheck: "on",
            robots: "noindex, nofollow",
            css: ["./Assets/css/admin.css?v=4", "./Assets/css/aluno.css?v=14", "./Assets/css/aluno-claro.css?v=2"],
            modulo: "./Assets/js/area-aluno.js?v=14"
        }
    };

    // Qual tela é cada endereço (vale com e sem .html, e no GitHub Pages com a pasta do repositório)
    function vistaDe(url) {
        const u = new URL(url, location.href);
        if (u.origin !== location.origin) return null;
        const nome = u.pathname.replace(/\/+$/, "").split("/").pop().replace(/\.html$/i, "").toLowerCase();
        if (nome === "login") return "login";
        if (nome === "cadastro" || nome === "cadastrolivre") return "cadastro";
        if (nome === "area-do-aluno") return "area";
        return null;
    }

    let atual = null;          // tela aberta
    let urlAtual = "";         // endereço que abriu a tela atual
    const nos = {};            // elementos de cada tela (guardados quando ela sai)
    const linksCss = {};       // <link> de CSS de cada tela
    const carregadas = new Set();

    function meta(nome, valor) {
        let m = document.querySelector(`meta[name="${nome}"]`);
        if (!valor) { if (m) m.remove(); return; }
        if (!m) { m = document.createElement("meta"); m.name = nome; document.head.appendChild(m); }
        m.content = valor;
    }

    // Liga o CSS da tela e espera ele carregar (no máximo 1,5 s) para não piscar sem estilo
    function ligarCss(vista) {
        if (!linksCss[vista]) {
            linksCss[vista] = VISTAS[vista].css.map((href) => {
                const existente = document.querySelector(`link[rel="stylesheet"][data-vista="${vista}"][href="${href}"]`);
                if (existente) return existente;
                const l = document.createElement("link");
                l.rel = "stylesheet";
                l.href = href;
                l.dataset.vista = vista;
                document.head.appendChild(l);
                return l;
            });
        }
        const esperas = linksCss[vista].map((l) => {
            l.disabled = false;
            if (l.sheet) return Promise.resolve();
            return new Promise((ok) => { l.addEventListener("load", ok, { once: true }); l.addEventListener("error", ok, { once: true }); });
        });
        return Promise.race([Promise.all(esperas), new Promise((ok) => setTimeout(ok, 1500))]);
    }
    function desligarCss(vista) { (linksCss[vista] || []).forEach((l) => { l.disabled = true; }); }

    async function montar(vista, url, { substituir = false, inicial = false } = {}) {
        const cfg = VISTAS[vista];
        if (!inicial) {
            if (substituir) history.replaceState(null, "", url);
            else history.pushState(null, "", url);
        }
        await ligarCss(vista);

        // Tira a tela anterior (os elementos ficam guardados, fora da página)
        if (atual && atual !== vista) {
            nos[atual] = nos[atual] || [];
            nos[atual].forEach((n) => n.remove());
            desligarCss(atual);
        }
        document.querySelectorAll(".an-tela").forEach((n) => n.remove());
        document.body.className = "";
        // Tema claro/escuro: só a área do aluno tem (escolha guardada no aparelho)
        let tema = "";
        try { tema = vista === "area" ? localStorage.getItem("fl-tema-aluno") || "" : ""; } catch { /* sem armazenamento */ }
        if (tema === "claro") document.documentElement.dataset.tema = "claro";
        else delete document.documentElement.dataset.tema;

        // Coloca a nova tela antes dos scripts da casca
        const modelo = document.getElementById("vista-" + vista);
        const conteudo = modelo.content.cloneNode(true);
        nos[vista] = Array.from(conteudo.childNodes);
        document.body.insertBefore(conteudo, document.getElementById("spa-fim"));
        // Área do aluno com dados salvos no aparelho: abre direto, sem tela de carregamento
        if (vista === "area") {
            let temCopia = false;
            try { temCopia = !!localStorage.getItem("fl-aluno-cache-v1"); } catch { /* sem armazenamento */ }
            if (temCopia) document.getElementById("gate").hidden = true;
        }

        document.title = cfg.titulo;
        meta("fl-app-check", cfg.appCheck);
        meta("robots", cfg.robots || "");
        atual = vista;
        urlAtual = new URL(url, location.href).href;
        if (!inicial) window.scrollTo(0, 0);
        if (window.flPrepararSupinos) window.flPrepararSupinos();

        carregadas.add(vista);
        // Caminho a partir da página (o import() resolveria a partir da pasta deste script)
        import(new URL(cfg.modulo, document.baseURI).href).catch((e) => {
            console.error("Não carregou a tela", vista, e);
            const aviso = document.createElement("div");
            aviso.className = "spa-erro";
            aviso.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:300;padding:14px 18px;border-radius:12px;background:#15171d;color:#f3f4f6;font:500 .9rem Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5);text-align:center";
            aviso.innerHTML = 'Não foi possível carregar esta tela. Confira a sua internet. <button type="button" style="margin-left:8px;padding:7px 12px;border:0;border-radius:8px;background:#e3202b;color:#fff;font-weight:700;cursor:pointer">Tentar de novo</button>';
            aviso.querySelector("button").addEventListener("click", () => location.reload());
            document.body.appendChild(aviso);
        });
    }

    function ir(url, { substituir = false } = {}) {
        const destino = new URL(url, location.href);
        const vista = vistaDe(destino.href);
        // Fora do app (planos, painel, site) ou tela que já rodou: navegação normal
        if (!vista || carregadas.has(vista)) {
            if (vista === atual && destino.href === urlAtual) return;
            if (substituir) location.replace(destino.href);
            else location.assign(destino.href);
            return;
        }
        montar(vista, destino.href, { substituir });
    }

    window.flSpa = { ir };

    // Links normais (<a href="./area-do-aluno.html">) também trocam de tela sem recarregar
    document.addEventListener("click", (ev) => {
        if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
        const a = ev.target.closest("a[href]");
        if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
        const vista = vistaDe(a.href);
        if (!vista || carregadas.has(vista)) return;
        ev.preventDefault();
        ir(a.href);
    });

    // Voltar/avançar: recarrega o endereço (cada tela começa do zero)
    window.addEventListener("popstate", () => location.reload());

    // Abre a tela do endereço atual
    montar(vistaDe(location.href) || "login", location.href, { inicial: true });
})();
