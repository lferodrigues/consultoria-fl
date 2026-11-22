// Aviso de cookies (LGPD) — páginas públicas do site
//
// Categorias:
//   necessarios  sempre ligados (login do Firebase, esta escolha)
//   midia        vídeos do YouTube incorporados no site (o YouTube pode gravar cookies próprios)
//
// A escolha fica no próprio navegador (localStorage "fl-cookies") e pode ser revista pelo link "Cookies" do rodapé
// e pela política de privacidade (window.FLCookies.abrir()).
// Iframes com data-consent="midia" só recebem o src (guardado em data-src) depois do aceite.
// Outros scripts usam: window.FLCookies.permitido("midia"), .aplicar(), .abrir()
(function () {
    var CHAVE = "fl-cookies";
    var VERSAO = 1; // aumente se mudarem as categorias: o aviso volta a aparecer para todos
    var POLITICA = "./politica-de-privacidade.html#cookies";

    function ler() {
        try {
            var v = JSON.parse(localStorage.getItem(CHAVE) || "null");
            if (!v || v.v !== VERSAO) return null;
            // a escolha vale por 12 meses; depois o aviso aparece de novo
            if (Date.now() - new Date(v.em).getTime() > 365 * 24 * 60 * 60 * 1000) return null;
            return v;
        } catch (e) { return null; }
    }
    function gravar(midia) {
        escolha = { v: VERSAO, midia: !!midia, em: new Date().toISOString() };
        try { localStorage.setItem(CHAVE, JSON.stringify(escolha)); } catch (e) { /* navegação privada */ }
        fecharTudo();
        aplicar();
    }

    var escolha = ler();
    var banner, modal;

    function permitido(cat) {
        if (cat === "necessarios") return true;
        return !!(escolha && escolha[cat]);
    }

    /* ---------- Conteúdo bloqueado (vídeos) ---------- */
    function aplicar() {
        var itens = document.querySelectorAll('iframe[data-consent]');
        for (var i = 0; i < itens.length; i++) {
            var f = itens[i];
            var ok = permitido(f.getAttribute("data-consent"));
            var alvo = f.getAttribute("data-src") || "";
            var bloqueio = f.parentNode.querySelector(".ck-bloqueio");
            if (ok) {
                if (bloqueio) bloqueio.remove();
                if (alvo && f.getAttribute("src") !== alvo) f.setAttribute("src", alvo);
            } else {
                if (f.getAttribute("src")) f.removeAttribute("src");
                if (!bloqueio) f.parentNode.appendChild(criarBloqueio(alvo));
                else atualizarLinkBloqueio(bloqueio, alvo);
            }
        }
    }

    function linkYoutube(src) {
        var m = /\/embed\/([A-Za-z0-9_-]{11})/.exec(src || "");
        return m ? "https://www.youtube.com/watch?v=" + m[1] : "https://www.youtube.com/";
    }
    function criarBloqueio(src) {
        var d = document.createElement("div");
        d.className = "ck-bloqueio";
        d.innerHTML =
            '<i class="fa-brands fa-youtube" aria-hidden="true"></i>' +
            '<p>Este vídeo é do YouTube, que pode gravar cookies no seu navegador. Para assistir aqui, permita os vídeos do YouTube.</p>' +
            '<button type="button" class="ck-btn ck-prim">Permitir e assistir</button>' +
            '<a target="_blank" rel="noopener">Ou abrir direto no YouTube</a>';
        d.querySelector("button").addEventListener("click", function () { gravar(true); });
        atualizarLinkBloqueio(d, src);
        return d;
    }
    function atualizarLinkBloqueio(d, src) { d.querySelector("a").href = linkYoutube(src); }

    /* ---------- Aviso, botão e preferências ---------- */
    function el(html) {
        var t = document.createElement("div");
        t.innerHTML = html.trim();
        return t.firstChild;
    }

    function montar() {
        banner = el(
            '<section class="ck-banner" role="region" aria-label="Aviso de cookies" hidden>' +
            '<span class="ck-ico" aria-hidden="true">🍪</span>' +
            '<div class="ck-txt"><strong>Este site respeita a sua privacidade</strong>' +
            'Usamos apenas o necessário para o site funcionar. Não usamos cookies de anúncios nem de rastreamento. ' +
            'O vídeo de apresentação vem do YouTube, que pode gravar cookies próprios: ele só carrega se você permitir. ' +
            '<a href="' + POLITICA + '">Política de privacidade</a></div>' +
            '<div class="ck-btns">' +
            '<button type="button" class="ck-btn ck-link" data-ck="pref">Personalizar</button>' +
            '<button type="button" class="ck-btn" data-ck="recusar">Só os necessários</button>' +
            '<button type="button" class="ck-btn ck-prim" data-ck="aceitar">Aceitar todos</button>' +
            '</div></section>');

        modal = el(
            '<div class="ck-modal" hidden><div class="ck-box" role="dialog" aria-modal="true" aria-labelledby="ck-titulo">' +
            '<h2 id="ck-titulo">Preferências de cookies</h2>' +
            '<p>Escolha o que pode ser usado no seu navegador. Você pode mudar quando quiser pelo link “Cookies” no rodapé do site. ' +
            'Saiba mais na <a href="' + POLITICA + '">política de privacidade</a>.</p>' +
            '<div class="ck-cat"><div class="ck-cat-top"><strong>Necessários</strong><span class="ck-fixo">Sempre ativos</span></div>' +
            '<p>Mantêm o login da área do aluno (Google Firebase), fazem a verificação “Não sou um robô” na tela de login (Cloudflare) e guardam esta escolha. Sem eles o site não funciona.</p></div>' +
            '<div class="ck-cat"><div class="ck-cat-top"><strong>Vídeos do YouTube</strong>' +
            '<label class="ck-sw"><input type="checkbox" id="ck-midia"><span aria-hidden="true"></span></label></div>' +
            '<p>Mostra o vídeo de apresentação dentro do site. O YouTube (Google) pode gravar cookies e saber que você assistiu, conforme a política de privacidade do Google.</p></div>' +
            '<div class="ck-btns">' +
            '<button type="button" class="ck-btn" data-ck="recusar">Só os necessários</button>' +
            '<button type="button" class="ck-btn ck-prim" data-ck="salvar">Salvar escolha</button>' +
            '</div></div></div>');
        modal.querySelector(".ck-sw input").setAttribute("aria-label", "Permitir vídeos do YouTube");

        document.body.appendChild(banner);
        document.body.appendChild(modal);

        document.addEventListener("click", function (e) {
            var b = e.target.closest ? e.target.closest("[data-ck]") : null;
            if (b) {
                var a = b.getAttribute("data-ck");
                if (a === "aceitar") gravar(true);
                else if (a === "recusar") gravar(false);
                else if (a === "salvar") gravar(document.getElementById("ck-midia").checked);
                else if (a === "pref") abrir();
                e.preventDefault();
            } else if (e.target === modal) {
                fecharModal();
            }
        });
        document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !modal.hidden) fecharModal(); });

        if (!escolha) banner.hidden = false;
    }

    function abrir() {
        document.getElementById("ck-midia").checked = permitido("midia");
        modal.hidden = false;
        banner.hidden = true;
        setTimeout(function () { modal.querySelector(".ck-btn.ck-prim").focus(); }, 30);
    }
    function fecharModal() {
        modal.hidden = true;
        if (!escolha) banner.hidden = false;
    }
    function fecharTudo() {
        if (!banner) return;
        banner.hidden = true;
        modal.hidden = true;
    }

    window.FLCookies = { permitido: permitido, aplicar: aplicar, abrir: abrir };

    function iniciar() { montar(); aplicar(); }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
    else iniciar();
})();
