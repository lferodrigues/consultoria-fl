// Planos do site (index.html e planos.html) — lidos do Realtime Database em tempo real.
// Se o banco não tiver nenhum plano visível, a página mantém os cards fixos do HTML.
import { ref, onValue } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { db } from "./firebase-app.js?v=2";
import { cardPlano, ordenarPlanos } from "./planos-card.js?v=2";

document.querySelectorAll("[data-planos]").forEach((grade) => {
    const variante = grade.dataset.planos; // "index" ou "pagina"
    const fixos = grade.innerHTML;

    onValue(ref(db, "planos"), (snap) => {
        const lista = ordenarPlanos(Object.entries(snap.val() || {}).map(([id, p]) => ({ id, ...p })))
            .filter((p) => p.visivel !== false);

        if (!lista.length) {
            grade.classList.remove("plans-grid");
            grade.innerHTML = fixos;
            grade.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
            return;
        }
        grade.classList.add("plans-grid");
        grade.innerHTML = lista.map((p) => cardPlano(p, variante)).join("");
    }, (erro) => {
        // Sem acesso ao banco: continua com os cards fixos
        console.warn("Planos: usando os cards fixos da página.", erro);
    });
});
