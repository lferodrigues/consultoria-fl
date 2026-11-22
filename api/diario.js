// Tarefa diária da Vercel (vercel.json > crons), todo dia de manhã:
//   1. Apaga as fotos de avaliação com mais de 15 dias.
//   2. Manda para o e-mail do Fagner um resumo com os avisos do painel:
//      fichas para trocar, planos vencendo, fotos para avaliar, inscrições, feedbacks e depoimentos novos.
//      Se não houver nada, não manda e-mail.
//
// Variáveis de ambiente (Vercel > Settings > Environment Variables):
//   FIREBASE_SERVICE_ACCOUNT  JSON da conta de serviço (o mesmo de /api/app-check)
//   RESEND_API_KEY            chave da Resend (resend.com), o serviço que envia o e-mail
//   EMAIL_AVISOS              opcional; para quem vai o resumo (padrão: fagnerlage10@gmail.com)
//   EMAIL_REMETENTE           opcional; remetente (padrão: "Site Fagner Lage <onboarding@resend.dev>")
//   CRON_SECRET               recomendado; protege a chamada
//
// Teste manual (com CRON_SECRET): curl -H "Authorization: Bearer <CRON_SECRET>" https://personalfagnerlage.com.br/api/diario
import { ler, gravar, ehTarefaDaVercel } from "./_firebase.js";
import { situacao, diasEntre } from "../Assets/js/alunos-util.js";
import { ordenarFichas, trocaDaFicha, diasParaTroca, textoTroca, AVISO_TROCA_DIAS } from "../Assets/js/fichas-util.js";

const SITE = "https://personalfagnerlage.com.br";
const PAINEL = SITE + "/painel-admin";

const lista = (obj) => Object.entries(obj || {}).map(([id, v]) => ({ id, ...v }));
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const dataBR = (iso) => (iso ? iso.split("-").reverse().join("/") : "");

// Data de hoje no horário de Brasília (AAAA-MM-DD)
function hojeBR() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

async function limparAvaliacoes() {
    const vencidas = Object.keys(await ler("avaliacoes", `?orderBy=${encodeURIComponent('"expiraEm"')}&endAt=${Date.now()}`));
    if (!vencidas.length) return 0;
    const apagar = {};
    vencidas.forEach((id) => { apagar["avaliacoes/" + id] = null; apagar["avaliacoesFotos/" + id] = null; });
    await gravar(apagar);
    return vencidas.length;
}

// Junta os avisos (as mesmas regras do sino do painel)
async function montarAvisos() {
    const hoje = hojeBR();
    const [alunosObj, fichasObj, inscObj, avObj, fbObj, depObj] = await Promise.all([
        ler("alunos"), ler("fichas"), ler("inscricoes"), ler("avaliacoes"), ler("feedbacks"), ler("depoimentos")
    ]);
    const alunos = lista(alunosObj);
    const nome = (id) => alunos.find((a) => a.id === id)?.nome || "Aluno";

    // Fichas para trocar: de 5 dias antes até 7 dias depois da data (depois disso para de avisar)
    const trocas = alunos
        .filter((a) => a.ativo !== false && !(a.vencimento && a.vencimento < hoje))
        .map((a) => {
            const f = ordenarFichas(lista(fichasObj[a.id]))[0];
            return { a, f, dias: f ? diasParaTroca(f, hoje) : null };
        })
        .filter((x) => x.dias !== null && x.dias <= AVISO_TROCA_DIAS && x.dias >= -7)
        .sort((x, y) => x.dias - y.dias);

    // Planos vencendo (até 7 dias) ou vencidos há até 7 dias
    const planos = alunos
        .map((a) => ({ a, s: situacao(a, hoje) }))
        .filter(({ a, s }) => s.chave === "vencendo" || (s.chave === "vencidos" && diasEntre(a.vencimento, hoje) <= 7))
        .sort((x, y) => (x.a.vencimento || "").localeCompare(y.a.vencimento || ""));

    const avaliacoes = lista(avObj).filter((v) => !v.visto && (v.expiraEm || 0) > Date.now());
    const inscricoes = lista(inscObj).filter((i) => (i.status || "pendente") === "pendente" && !i.visto);
    const feedbacks = lista(fbObj).filter((f) => !f.lido && (f.criadoEm || 0) > Date.now() - 7 * 86400000);
    const depoimentos = lista(depObj).filter((d) => !d.visto);

    return { hoje, trocas, planos, avaliacoes, inscricoes, feedbacks, depoimentos, nome };
}

function montarEmail(av) {
    const secao = (titulo, itens) => !itens.length ? "" : `
        <h2 style="font:700 16px Arial,sans-serif;color:#e3202b;margin:26px 0 10px">${titulo}</h2>
        <ul style="margin:0;padding:0;list-style:none">${itens.map((t) => `<li style="font:14px Arial,sans-serif;color:#1f2937;padding:9px 12px;margin-bottom:6px;background:#f3f4f6;border-radius:8px">${t}</li>`).join("")}</ul>`;
    const link = (href, txt) => `<a href="${href}" style="color:#e3202b;font-weight:700;text-decoration:none">${txt}</a>`;

    const partes = [
        secao("Fichas para trocar", av.trocas.map(({ a, f, dias }) =>
            `<b>${esc(a.nome)}</b> · ficha "${esc(f.nome || "Ficha de treino")}" ${textoTroca(dias)} (${dataBR(trocaDaFicha(f))}) · ${link(PAINEL + "#/treinos/aluno/" + encodeURIComponent(a.id), "abrir")}`)),
        secao("Fotos para avaliar", av.avaliacoes.map((v) =>
            `<b>${esc(v.nome)}</b>${v.obs ? ` · “${esc(v.obs)}”` : ""} · ${link(PAINEL + "#/avaliacoes/" + encodeURIComponent(v.id), "ver foto")}`)),
        secao("Novas inscrições", av.inscricoes.map((i) =>
            `<b>${esc(i.nome)}</b> · ${esc(i.planoNome || "")} · ${link(PAINEL + "#/inscricoes/" + encodeURIComponent(i.id), "ver ficha")}`)),
        secao("Planos vencendo", av.planos.map(({ a, s }) => `<b>${esc(a.nome)}</b> · ${esc(s.texto)} (${dataBR(a.vencimento)})`)),
        secao("Feedbacks de treino", av.feedbacks.slice(0, 15).map((f) =>
            `<b>${esc(av.nome(f.alunoId))}</b> · esforço ${esc(f.esforco)}${f.comentario ? ` · “${esc(String(f.comentario).slice(0, 120))}”` : ""}`)),
        av.depoimentos.length ? secao("Depoimentos", [`${av.depoimentos.length} ${av.depoimentos.length === 1 ? "depoimento novo" : "depoimentos novos"} · ${link(PAINEL + "#/depoimentos", "ler")}`]) : ""
    ].join("");

    const total = av.trocas.length + av.avaliacoes.length + av.inscricoes.length + av.planos.length + av.feedbacks.length + av.depoimentos.length;
    const assunto = av.trocas.length
        ? `${av.trocas.length} ${av.trocas.length === 1 ? "ficha para trocar" : "fichas para trocar"} · resumo do dia`
        : `${total} ${total === 1 ? "aviso" : "avisos"} do painel · resumo do dia`;
    const html = `<div style="max-width:620px;margin:0 auto;padding:24px;background:#ffffff">
        <p style="font:700 20px Arial,sans-serif;color:#111;margin:0">Resumo do dia · ${dataBR(av.hoje)}</p>
        <p style="font:14px Arial,sans-serif;color:#6b7280;margin:6px 0 0">Os avisos do painel da consultoria.</p>
        ${partes}
        <p style="font:15px Arial,sans-serif;margin:28px 0 0">${link(PAINEL, "Abrir o painel")}</p>
        <p style="font:12px Arial,sans-serif;color:#9ca3af;margin:18px 0 0">Enviado automaticamente pelo site ${SITE.replace("https://", "")} uma vez por dia, só quando há avisos.</p>
    </div>`;
    return { total, assunto, html };
}

async function enviarEmail({ assunto, html }) {
    const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
            from: process.env.EMAIL_REMETENTE || "Site Fagner Lage <onboarding@resend.dev>",
            to: [process.env.EMAIL_AVISOS || "fagnerlage10@gmail.com"],
            subject: assunto,
            html
        })
    });
    if (!r.ok) throw new Error("Resend recusou: " + r.status + " " + (await r.text()).slice(0, 300));
}

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (!ehTarefaDaVercel(req)) return res.status(401).json({ erro: "Não autorizado." });
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) return res.status(500).json({ erro: "Falta FIREBASE_SERVICE_ACCOUNT." });

    const resultado = {};
    try { resultado.fotosApagadas = await limparAvaliacoes(); } catch (e) { console.error("Limpeza falhou", e); resultado.erroLimpeza = true; }

    try {
        const email = montarEmail(await montarAvisos());
        resultado.avisos = email.total;
        if (!email.total) resultado.email = "nada para avisar";
        else if (!process.env.RESEND_API_KEY) resultado.email = "falta RESEND_API_KEY";
        else { await enviarEmail(email); resultado.email = "enviado"; }
    } catch (e) {
        console.error("Resumo por e-mail falhou", e);
        resultado.erroEmail = true;
    }
    return res.status(resultado.erroLimpeza || resultado.erroEmail ? 500 : 200).json(resultado);
}
