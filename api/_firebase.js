// Apoio das funções da Vercel: acesso de administrador ao Realtime Database pela API REST.
// (Arquivos que começam com "_" na pasta api/ não viram endereço público.)
import { createSign } from "node:crypto";

export const BANCO = "https://flconsultoria-default-rtdb.firebaseio.com";

const b64url = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
function jwt(payload, chave) {
    const corpo = b64url({ alg: "RS256", typ: "JWT" }) + "." + b64url(payload);
    return corpo + "." + createSign("RSA-SHA256").update(corpo).sign(chave).toString("base64url");
}

let acesso = null;
// Token do Google para o banco (ignora as regras, como o firebase-admin)
export async function tokenDoBanco() {
    if (acesso && acesso.expira > Date.now() + 60000) return acesso.token;
    const conta = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    const agora = Math.floor(Date.now() / 1000);
    const assertion = jwt({
        iss: conta.client_email,
        scope: "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email",
        aud: "https://oauth2.googleapis.com/token", iat: agora, exp: agora + 3600
    }, conta.private_key);
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

// Lê um caminho do banco (ex.: "alunos" ou 'avaliacoes.json?orderBy="expiraEm"&endAt=123' já montado)
export async function ler(caminho, consulta = "") {
    const r = await fetch(`${BANCO}/${caminho}.json${consulta}`, { headers: { Authorization: "Bearer " + (await tokenDoBanco()) } });
    if (!r.ok) throw new Error("Leitura de " + caminho + " recusada: " + r.status + " " + (await r.text()).slice(0, 200));
    return (await r.json()) || {};
}

// Grava várias chaves de uma vez (null apaga)
export async function gravar(mudancas) {
    const r = await fetch(`${BANCO}/.json`, {
        method: "PATCH",
        headers: { Authorization: "Bearer " + (await tokenDoBanco()), "Content-Type": "application/json" },
        body: JSON.stringify(mudancas)
    });
    if (!r.ok) throw new Error("Gravação recusada: " + r.status + " " + (await r.text()).slice(0, 200));
}

// Só a tarefa agendada da Vercel pode chamar
export function ehTarefaDaVercel(req) {
    const segredo = process.env.CRON_SECRET;
    return segredo
        ? req.headers.authorization === "Bearer " + segredo
        : /vercel-cron/i.test(String(req.headers["user-agent"] || ""));
}
