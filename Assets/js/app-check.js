// Firebase App Check com Cloudflare Turnstile (verificação no servidor)
//
// Como funciona:
//   1. Quando o Firebase precisa, o navegador resolve uma verificação do Turnstile.
//      Ela é invisível; a caixinha só aparece se a Cloudflare desconfiar.
//   2. O token vai para /api/app-check (função da Vercel), que confere na Cloudflare com a Secret Key
//      e devolve um token do App Check.
//   3. O Firebase passa a aceitar as chamadas deste navegador. Com o App Check "aplicado" no console,
//      quem não passou pela verificação (ex.: robô chamando o Firebase direto) é recusado.
//
// Só é ativado nas páginas com <meta name="fl-app-check" content="on"> (login, ficha, área do aluno e painel).
import { initializeAppCheck, CustomProvider, getToken } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app-check.js";

const SITEKEY = "0x4AAAAAAGNTPIYBtbz6t-xS"; // Site Key pública do Turnstile (widget do login)
// Opcional: Site Key de um 2º widget no modo "Invisível" da Cloudflare. Com ela, a renovação do
// passe nas outras páginas nunca mostra caixinha. Precisa da variável TURNSTILE_SECRET_KEY_INVISIVEL na Vercel.
const SITEKEY_INVISIVEL = "";
const ENDPOINT = "/api/app-check";
const ACAO = "app-check";                    // a mesma "action" conferida no servidor

let appCheck = null;
// Troca da caixinha do login pelo passe (iniciada assim que a pessoa marca a caixinha)
let trocaDoLogin = null;
const ehPaginaDeLogin = () => document.querySelector('meta[name="fl-app-check"]')?.content === "login";

let carregando = null;

// Carrega a biblioteca do Turnstile uma única vez (o login já carrega a dele)
function bibliotecaTurnstile() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (carregando) return carregando;
    carregando = new Promise((resolve, reject) => {
        if (!document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')) {
            const s = document.createElement("script");
            s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
            s.async = true;
            s.onerror = () => reject(new Error("Turnstile não carregou"));
            document.head.appendChild(s);
        }
        const inicio = Date.now();
        (function esperar() {
            if (window.turnstile) return resolve(window.turnstile);
            if (Date.now() - inicio > 7000) return reject(new Error("Turnstile demorou demais"));
            setTimeout(esperar, 100);
        })();
    });
    carregando.catch(() => { carregando = null; });
    return carregando;
}

// Resolve uma verificação e devolve o token. A caixinha só aparece se for preciso interagir.
async function tokenTurnstile() {
    const ts = await bibliotecaTurnstile();
    return new Promise((resolve, reject) => {
        // Fica fora da tela: se a Cloudflare pedir clique, a verificação simplesmente não conclui
        // (o site segue sem o passe) em vez de mostrar uma caixinha para a pessoa.
        const caixa = document.createElement("div");
        caixa.setAttribute("aria-hidden", "true");
        caixa.style.cssText = "position:fixed;left:-10000px;top:0;width:300px;height:65px;overflow:hidden;";
        document.body.appendChild(caixa);
        let id = null;
        const fim = () => { try { if (id !== null) ts.remove(id); } catch { /* já removido */ } caixa.remove(); };
        const tempo = setTimeout(() => { fim(); reject(new Error("Verificação não concluída")); }, 7000);
        id = ts.render(caixa, {
            sitekey: SITEKEY_INVISIVEL || SITEKEY,
            action: ACAO,
            appearance: "interaction-only",
            theme: "dark",
            language: "pt-br",
            callback: (token) => { clearTimeout(tempo); fim(); resolve(token); },
            "error-callback": () => { clearTimeout(tempo); fim(); reject(new Error("Erro no Turnstile")); return true; },
            "before-interactive-callback": () => { clearTimeout(tempo); fim(); reject(new Error("Turnstile pediu interação")); }
        });
    });
}

// Envia o token do Turnstile ao servidor e recebe o passe do Firebase
async function trocar(token, tipo) {
    const r = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, tipo })
    });
    if (!r.ok) throw new Error("App Check recusado (" + r.status + ")");
    const d = await r.json();
    return { token: d.token, expireTimeMillis: d.expiresAt };
}

const provedor = new CustomProvider({
    getToken: async () => {
        // No login: só vale a caixinha que a pessoa marcou. Nunca abre uma 2ª verificação.
        if (ehPaginaDeLogin()) {
            if (!trocaDoLogin) throw new Error("Aguardando a caixinha do login");
            try { return await trocaDoLogin; } catch (e) { trocaDoLogin = null; throw e; }
        }
        // Outras páginas: verificação escondida (o passe do login normalmente ainda vale)
        const token = await tokenTurnstile();
        return trocar(token, SITEKEY_INVISIVEL ? "invisivel" : "login");
    }
});

export function ativarAppCheck(app) {
    try {
        // No login: sem renovação automática (o passe vem da caixinha que a pessoa marca).
        // Nas outras páginas: renova em segundo plano antes de vencer, sem segurar o carregamento.
        appCheck = initializeAppCheck(app, { provider: provedor, isTokenAutoRefreshEnabled: !ehPaginaDeLogin() });
    } catch (e) {
        console.error("App Check não iniciou", e);
    }
}

// Chamado pelo login assim que a caixinha "Não sou um robô" é resolvida:
// já troca o token pelo passe do Firebase, para o "Entrar" ser imediato.
export function prepararAppCheck(tokenTurnstileLogin) {
    if (!appCheck || !tokenTurnstileLogin) return;
    trocaDoLogin = trocar(tokenTurnstileLogin, "login");
    trocaDoLogin.catch(() => {});
    getToken(appCheck, true).catch((e) => console.warn("App Check:", e));
}
