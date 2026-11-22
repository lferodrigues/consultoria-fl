// Função da Vercel (tarefa diária, configurada em vercel.json > crons):
// apaga do banco as fotos de avaliação com mais de 15 dias (avaliacoes/{id} e avaliacoesFotos/{id}).
//
//   GET /api/limpar-avaliacoes   (chamada pela Vercel uma vez por dia)
//
// Variáveis de ambiente (Vercel > Settings > Environment Variables):
//   FIREBASE_SERVICE_ACCOUNT   JSON da conta de serviço (o mesmo usado em /api/app-check)
//   CRON_SECRET                recomendado: a Vercel manda "Authorization: Bearer <CRON_SECRET>" na tarefa diária
import { createSign } from "node:crypto";

const BANCO = "https://flconsultoria-default-rtdb.firebaseio.com";

const b64url = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
function jwt(payload, chave) {
    const corpo = b64url({ alg: "RS256", typ: "JWT" }) + "." + b64url(payload);
    return corpo + "." + createSign("RSA-SHA256").update(corpo).sign(chave).toString("base64url");
}

// Token de acesso do Google para o Realtime Database (acesso de administrador, ignora as regras)
async function tokenDoBanco() {
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
    return d.access_token;
}

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    // Só a tarefa da Vercel pode chamar
    const segredo = process.env.CRON_SECRET;
    const ehCron = segredo
        ? req.headers.authorization === "Bearer " + segredo
        : /vercel-cron/i.test(String(req.headers["user-agent"] || ""));
    if (!ehCron) return res.status(401).json({ erro: "Não autorizado." });
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) return res.status(500).json({ erro: "Falta FIREBASE_SERVICE_ACCOUNT." });

    try {
        const token = await tokenDoBanco();
        const auth = { Authorization: "Bearer " + token };
        const url = `${BANCO}/avaliacoes.json?orderBy=${encodeURIComponent('"expiraEm"')}&endAt=${Date.now()}`;
        const r = await fetch(url, { headers: auth });
        if (!r.ok) throw new Error("Leitura recusada: " + r.status + " " + (await r.text()).slice(0, 200));
        const vencidas = Object.keys((await r.json()) || {});
        if (vencidas.length) {
            const apagar = {};
            vencidas.forEach((id) => { apagar["avaliacoes/" + id] = null; apagar["avaliacoesFotos/" + id] = null; });
            const w = await fetch(`${BANCO}/.json`, { method: "PATCH", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(apagar) });
            if (!w.ok) throw new Error("Exclusão recusada: " + w.status + " " + (await w.text()).slice(0, 200));
        }
        return res.status(200).json({ apagadas: vencidas.length });
    } catch (e) {
        console.error("Limpeza das avaliações falhou", e);
        return res.status(500).json({ erro: "Limpeza falhou." });
    }
}
