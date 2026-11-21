// Depoimentos do index — lidos de "depoimentosPublicos" (só o que o personal publicou pelo painel).
// Sem nenhum publicado, a seção fica escondida.
import { ref, onValue } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { db } from "./firebase-app.js?v=2";

const secao = document.getElementById("depoimentos");
const lista = document.getElementById("depo-lista");
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

if (secao && lista) {
    onValue(ref(db, "depoimentosPublicos"), (snap) => {
        const itens = Object.values(snap.val() || {})
            .filter((d) => d && d.texto)
            .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
        secao.hidden = itens.length === 0;
        lista.innerHTML = itens.map((d) => {
            const nota = Math.max(1, Math.min(5, Number(d.nota) || 5));
            const nome = String(d.nome || "Aluno");
            return `
            <article class="depo-card">
                <div class="depo-estrelas" aria-label="${nota} de 5 estrelas">${"★".repeat(nota)}<em>${"★".repeat(5 - nota)}</em></div>
                <blockquote>${esc(d.texto)}</blockquote>
                <div class="depo-autor">
                    <span class="depo-avatar" aria-hidden="true">${esc(nome.trim()[0] || "A").toUpperCase()}</span>
                    <div><strong>${esc(nome)}</strong><small>Aluno da consultoria</small></div>
                </div>
            </article>`;
        }).join("");
    }, (erro) => {
        console.warn("Depoimentos indisponíveis:", erro);
        secao.hidden = true;
    });
}
