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
import { initializeAppCheck, CustomProvider } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app-check.js";

const SITEKEY = "0x4AAAAAAGNTPIYBtbz6t-xS"; // Site Key pública do Turnstile
const ENDPOINT = "/api/app-check";
const ACAO = "app-check";                    // a mesma "action" conferida no servidor

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
            if (Date.now() - inicio > 20000) return reject(new Error("Turnstile demorou demais"));
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
        const caixa = document.createElement("div");
        caixa.setAttribute("aria-live", "polite");
        caixa.style.cssText = "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:10000;";
        document.body.appendChild(caixa);
        let id = null;
        const fim = () => { try { if (id !== null) ts.remove(id); } catch { /* já removido */ } caixa.remove(); };
        const tempo = setTimeout(() => { fim(); reject(new Error("Verificação não concluída")); }, 120000);
        id = ts.render(caixa, {
            sitekey: SITEKEY,
            action: ACAO,
            appearance: "interaction-only",
            theme: "dark",
            language: "pt-br",
            callback: (token) => { clearTimeout(tempo); fim(); resolve(token); },
            "error-callback": () => { clearTimeout(tempo); fim(); reject(new Error("Erro no Turnstile")); return true; }
        });
    });
}

const provedor = new CustomProvider({
    getToken: async () => {
        const token = await tokenTurnstile();
        const r = await fetch(ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token })
        });
        if (!r.ok) throw new Error("App Check recusado (" + r.status + ")");
        const d = await r.json();
        return { token: d.token, expireTimeMillis: d.expiresAt };
    }
});

export function ativarAppCheck(app) {
    try {
        initializeAppCheck(app, { provider: provedor, isTokenAutoRefreshEnabled: true });
    } catch (e) {
        console.error("App Check não iniciou", e);
    }
}
