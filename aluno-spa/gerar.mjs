// Gera as páginas do app do aluno (SPA) a partir das telas em aluno-spa/vistas/.
//
//   node aluno-spa/gerar.mjs
//
// Saída (na raiz do site): login.html, cadastro.html, cadastrolivre.html e area-do-aluno.html.
// As quatro têm as MESMAS três telas; muda só qual abre primeiro (título, CSS e módulo pré-carregados).
// Para mudar o conteúdo de uma tela, edite aluno-spa/vistas/<tela>.html e rode este script.
// Não edite os quatro arquivos da raiz à mão: eles são sobrescritos.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");
const vista = (nome) => readFileSync(join(AQUI, "vistas", nome + ".html"), "utf8").trimEnd();

// Mantenha estes caminhos iguais aos de Assets/js/spa-aluno.js
const CSS = {
    login: ["./Assets/css/login.css?v=5"],
    cadastro: ["./Assets/css/cadastro.css?v=2"],
    area: ["./Assets/css/admin.css?v=4", "./Assets/css/aluno.css?v=15", "./Assets/css/aluno-claro.css?v=2"]
};
const MODULOS = {
    login: ["./Assets/js/login-aluno.js?v=13"],
    cadastro: ["./Assets/js/planos-card.js?v=2", "./Assets/js/inscricao.js?v=6"],
    area: ["./Assets/js/alunos-util.js?v=2", "./Assets/js/fichas-util.js?v=1", "./Assets/js/pix-util.js?v=1",
        "./Assets/js/acesso-negado.js?v=1", "./Assets/js/area-aluno.js?v=15"]
};

const PAGINAS = [
    { arquivo: "login.html", vista: "login", titulo: "Área do Aluno | Fagner Lage", appCheck: "login",
        descricao: "Acesse a área do aluno da consultoria online do personal Fagner Lage." },
    { arquivo: "cadastro.html", vista: "cadastro", titulo: "Ficha de inscrição | Consultoria Fagner Lage", appCheck: "on",
        descricao: "Faça a sua inscrição na consultoria online de treino do personal Fagner Lage." },
    { arquivo: "cadastrolivre.html", vista: "cadastro", titulo: "Ficha de inscrição | Consultoria Fagner Lage", appCheck: "on",
        descricao: "Faça a sua inscrição na consultoria online de treino do personal Fagner Lage." },
    { arquivo: "area-do-aluno.html", vista: "area", titulo: "Área do Aluno | Fagner Lage", appCheck: "on", robots: true }
];

const telas = { login: vista("login"), cadastro: vista("cadastro"), area: vista("area-do-aluno") };

function pagina(p) {
    const outrasCss = Object.entries(CSS).filter(([v]) => v !== p.vista).flatMap(([, l]) => l);
    const outrosModulos = Object.entries(MODULOS).filter(([v]) => v !== p.vista).flatMap(([, l]) => l);
    return `<!DOCTYPE html>
<!-- GERADO por aluno-spa/gerar.mjs — não edite aqui. Edite aluno-spa/vistas/ e rode: node aluno-spa/gerar.mjs -->
<html lang="pt-BR">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="fl-app-check" content="${p.appCheck}">
${p.robots ? '    <meta name="robots" content="noindex, nofollow">\n' : ""}    <title>${p.titulo}</title>
${p.descricao ? `    <meta name="description" content="${p.descricao}">\n` : ""}    <meta name="theme-color" content="#07080b">
    <!-- Carregamento mais rápido: abre as conexões e baixa os módulos em paralelo -->
    <link rel="preconnect" href="https://www.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://flconsultoria-default-rtdb.firebaseio.com">
    <link rel="preconnect" href="https://identitytoolkit.googleapis.com">
    <link rel="preconnect" href="https://securetoken.googleapis.com">
    <link rel="preconnect" href="https://challenges.cloudflare.com">
    <link rel="modulepreload" href="https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js">
    <link rel="modulepreload" href="https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js">
    <link rel="modulepreload" href="https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js">
    <link rel="modulepreload" href="https://www.gstatic.com/firebasejs/11.1.0/firebase-app-check.js">
    <link rel="modulepreload" href="./Assets/js/app-check.js?v=4">
    <link rel="modulepreload" href="./Assets/js/firebase-app.js?v=2">
    <link rel="modulepreload" href="./Assets/js/spa-nav.js?v=1">
${MODULOS[p.vista].map((m) => `    <link rel="modulepreload" href="${m}">`).join("\n")}
    <link rel="stylesheet" href="./Assets/css/supino.css?v=3">
    <link rel="icon" href="Assets/img/logo.ico" type="image/x-icon">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@700;800;900&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"></noscript>
${CSS[p.vista].map((c) => `    <link rel="stylesheet" href="${c}" data-vista="${p.vista}">`).join("\n")}
    <link rel="stylesheet" href="./Assets/css/cookies.css?v=1">
    <!-- As outras telas do app: baixadas com calma, para a troca ser instantânea -->
${outrasCss.map((c) => `    <link rel="prefetch" as="style" href="${c}">`).join("\n")}
${outrosModulos.map((m) => `    <link rel="modulepreload" href="${m}">`).join("\n")}
</head>

<body>
    <!-- ===================== Tela: login ===================== -->
    <template id="vista-login">
${telas.login}
    </template>

    <!-- ===================== Tela: ficha de inscrição ===================== -->
    <template id="vista-cadastro">
${telas.cadastro}
    </template>

    <!-- ===================== Tela: área do aluno ===================== -->
    <template id="vista-area">
${telas.area}
    </template>

    <span id="spa-fim" hidden></span>

    <!-- Cloudflare Turnstile: avisa o login quando a biblioteca terminar de carregar -->
    <script>
        window.flTurnstilePronto = false;
        window.flTurnstileCarregou = function () { window.flTurnstilePronto = true; document.dispatchEvent(new Event("fl-turnstile")); };
    </script>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=flTurnstileCarregou" async defer></script>
    <script src="./Assets/js/spa-aluno.js?v=6"></script>
    <script src="./Assets/js/cookies.js?v=3"></script>
    <script src="./Assets/js/supino-pct.js?v=3" defer></script>
    <script src="./Assets/js/sem-botao-direito.js?v=1"></script>
</body>

</html>
`;
}

for (const p of PAGINAS) {
    writeFileSync(join(RAIZ, p.arquivo), pagina(p));
    console.log("gerado", p.arquivo);
}
