// Função da Vercel: troca um token do Cloudflare Turnstile por um token do Firebase App Check.
//
//   POST /api/app-check   { "token": "<token do Turnstile>" }
//   200 -> { "token": "<token do App Check>", "expiresAt": <milissegundos> }
//
// Variáveis de ambiente (Vercel > Settings > Environment Variables). Nunca coloque esses valores no código:
//   TURNSTILE_SECRET_KEY       Secret Key do widget Turnstile do login (painel da Cloudflare)
//   TURNSTILE_SECRET_KEY_INVISIVEL  opcional; Secret Key do 2º widget, no modo "Invisível"
//   FIREBASE_SERVICE_ACCOUNT   JSON inteiro da chave da conta de serviço (Firebase > Configurações > Contas de serviço)
//   FIREBASE_APP_ID            opcional; padrão = App ID do site
//
// Velocidade: o caminho normal NÃO carrega o firebase-admin (pesado, deixava a 1ª chamada lenta).
// Ele assina o token com o módulo crypto do Node e chama a API do App Check direto.
// Se algo der errado nesse caminho, cai no firebase-admin, como era antes.
import { createSign } from "node:crypto";

const APP_ID_PADRAO = "1:907260382682:web:b456647534f5b58df444e3";
// "action" aceitas: a caixinha do login e a verificação do App Check
const ACOES = ["login", "app-check"];
const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000; // máximo aceito pelo App Check (30 min a 7 dias)

let contaCache = null;
const conta = () => (contaCache ||= JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));

const b64url = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
function jwt(payload, chave) {
    const corpo = b64url({ alg: "RS256", typ: "JWT" }) + "." + b64url(payload);
    const assinatura = createSign("RSA-SHA256").update(corpo).sign(chave).toString("base64url");
    return corpo + "." + assinatura;
}

// Token de acesso do Google (OAuth) da conta de serviço; fica guardado enquanto a função estiver "quente"
let acesso = null;
async function tokenDeAcesso() {
    if (acesso && acesso.expira > Date.now() + 60000) return acesso.token;
    const c = conta();
    const agora = Math.floor(Date.now() / 1000);
    const assertion = jwt({
        iss: c.client_email, scope: "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase",
        aud: "https://oauth2.googleapis.com/token", iat: agora, exp: agora + 3600
    }, c.private_key);
    const r = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion })
    });
    const d = await r.json();
    if (!r.ok || !d.access_token) throw new Error("OAuth recusado: " + r.status);
    acesso = { token: d.access_token, expira: Date.now() + (d.expires_in || 3600) * 1000 };
    return acesso.token;
}

// Caminho rápido: mesmo processo do firebase-admin (token personalizado -> exchangeCustomToken)
async function tokenRapido(appId) {
    const c = conta();
    const agora = Math.floor(Date.now() / 1000);
    const customToken = jwt({
        iss: c.client_email, sub: c.client_email,
        aud: "https://firebaseappcheck.googleapis.com/google.firebase.appcheck.v1.TokenExchangeService",
        iat: agora, exp: agora + 300, app_id: appId, ttl: VALIDADE_MS / 1000 + "s"
    }, c.private_key);
    const numero = appId.split(":")[1];
    const r = await fetch(`https://firebaseappcheck.googleapis.com/v1/projects/${numero}/apps/${appId}:exchangeCustomToken`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await tokenDeAcesso()) },
        body: JSON.stringify({ customToken })
    });
    const d = await r.json();
    if (!r.ok || !d.token) throw new Error("exchangeCustomToken recusado: " + r.status + " " + JSON.stringify(d).slice(0, 200));
    const ttlMs = Math.round(parseFloat(String(d.ttl || "3600s")) * 1000);
    return { token: d.token, ttlMillis: ttlMs };
}

// Caminho antigo (reserva): firebase-admin, carregado só se o rápido falhar
async function tokenAdmin(appId) {
    const { initializeApp, cert, getApps } = await import("firebase-admin/app");
    const { getAppCheck } = await import("firebase-admin/app-check");
    if (!getApps().length) initializeApp({ credential: cert(conta()) });
    return getAppCheck().createToken(appId, { ttlMillis: VALIDADE_MS });
}

function ipDoVisitante(req) {
    const xff = String(req.headers["x-forwarded-for"] || "");
    return xff.split(",")[0].trim() || String(req.headers["x-real-ip"] || "");
}

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ erro: "Método não permitido." });
    }
    if (!process.env.TURNSTILE_SECRET_KEY || !process.env.FIREBASE_SERVICE_ACCOUNT) {
        console.error("Faltam variáveis de ambiente: TURNSTILE_SECRET_KEY e/ou FIREBASE_SERVICE_ACCOUNT");
        return res.status(500).json({ erro: "Servidor não configurado." });
    }

    const token = typeof req.body?.token === "string" ? req.body.token : "";
    if (!token || token.length > 2048) return res.status(400).json({ erro: "Verificação ausente." });
    // Cada widget tem a sua Secret Key
    const segredo = req.body?.tipo === "invisivel" ? process.env.TURNSTILE_SECRET_KEY_INVISIVEL : process.env.TURNSTILE_SECRET_KEY;
    if (!segredo) return res.status(400).json({ erro: "Tipo de verificação não configurado." });

    // 1) Confere o token na Cloudflare (Siteverify). Cada token só vale uma vez.
    let verificacao;
    try {
        const corpo = new URLSearchParams({ secret: segredo, response: token });
        const ip = ipDoVisitante(req);
        if (ip) corpo.set("remoteip", ip);
        const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: corpo });
        verificacao = await r.json();
    } catch (e) {
        console.error("Siteverify indisponível", e);
        return res.status(502).json({ erro: "Não foi possível verificar agora." });
    }
    if (!verificacao.success || !ACOES.includes(verificacao.action)) {
        console.warn("Turnstile recusado", verificacao["error-codes"], verificacao.action, verificacao.hostname);
        return res.status(403).json({ erro: "Verificação recusada." });
    }

    // 2) Gera o token do App Check para o site
    try {
        const appId = process.env.FIREBASE_APP_ID || APP_ID_PADRAO;
        let resultado;
        try {
            resultado = await tokenRapido(appId);
        } catch (e) {
            console.warn("Caminho rápido falhou, usando o firebase-admin", e);
            resultado = await tokenAdmin(appId);
        }
        return res.status(200).json({ token: resultado.token, expiresAt: Date.now() + resultado.ttlMillis });
    } catch (e) {
        console.error("Falha ao gerar o token do App Check", e);
        return res.status(500).json({ erro: "Não foi possível gerar o acesso." });
    }
}
