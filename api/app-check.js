// Função da Vercel: troca um token do Cloudflare Turnstile por um token do Firebase App Check.
//
//   POST /api/app-check   { "token": "<token do Turnstile>" }
//   200 -> { "token": "<token do App Check>", "expiresAt": <milissegundos> }
//
// Variáveis de ambiente (Vercel > Settings > Environment Variables). Nunca coloque esses valores no código:
//   TURNSTILE_SECRET_KEY       Secret Key do widget Turnstile (painel da Cloudflare)
//   FIREBASE_SERVICE_ACCOUNT   JSON inteiro da chave da conta de serviço (Firebase > Configurações > Contas de serviço)
//   FIREBASE_APP_ID            opcional; padrão = App ID do site
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAppCheck } from "firebase-admin/app-check";

const APP_ID_PADRAO = "1:907260382682:web:b456647534f5b58df444e3";
const ACAO = "app-check";             // tem que ser a mesma "action" usada no navegador
const VALIDADE_MS = 12 * 60 * 60 * 1000; // o App Check aceita de 30 min a 7 dias

function iniciarFirebase() {
    if (getApps().length) return;
    const conta = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({ credential: cert(conta) });
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

    // 1) Confere o token na Cloudflare (Siteverify). Cada token só vale uma vez.
    let verificacao;
    try {
        const corpo = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token });
        const ip = ipDoVisitante(req);
        if (ip) corpo.set("remoteip", ip);
        const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: corpo });
        verificacao = await r.json();
    } catch (e) {
        console.error("Siteverify indisponível", e);
        return res.status(502).json({ erro: "Não foi possível verificar agora." });
    }
    if (!verificacao.success || verificacao.action !== ACAO) {
        console.warn("Turnstile recusado", verificacao["error-codes"], verificacao.action, verificacao.hostname);
        return res.status(403).json({ erro: "Verificação recusada." });
    }

    // 2) Gera o token do App Check para o site
    try {
        iniciarFirebase();
        const appId = process.env.FIREBASE_APP_ID || APP_ID_PADRAO;
        const resultado = await getAppCheck().createToken(appId, { ttlMillis: VALIDADE_MS });
        return res.status(200).json({ token: resultado.token, expiresAt: Date.now() + resultado.ttlMillis });
    } catch (e) {
        console.error("Falha ao gerar o token do App Check", e);
        return res.status(500).json({ erro: "Não foi possível gerar o acesso." });
    }
}
