// Vitrine do index — foto do topo, fotos da seção "Sobre" (slideshow) e vídeo de apresentação.
// Lê "vitrine" no banco (o personal muda pelo painel). Sem nada salvo, ficam as originais.
import { ref, onValue } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { db } from "./firebase-app.js?v=2";
import { SOBRE_PADRAO, principalDe, sobreDe, videoValido, urlEmbed } from "./vitrine-util.js?v=1";

const heroImg = document.getElementById("hero-foto");
const slideImg = document.getElementById("slideshow");
const video = document.getElementById("video-apresentacao");

/* ---------- Slideshow da seção "Sobre" ---------- */
let fotos = SOBRE_PADRAO.slice();
let atual = 0;

function preCarregar(lista) { lista.forEach((src) => { new Image().src = src; }); }

function trocar(img, src) {
    if (!img || !src || img.getAttribute("src") === src) return;
    img.style.opacity = 0;
    setTimeout(() => { img.src = src; img.style.opacity = 1; }, 400);
}

if (slideImg) {
    preCarregar(fotos);
    setInterval(() => {
        if (fotos.length < 2) return;
        slideImg.style.opacity = 0;
        setTimeout(() => {
            atual = (atual + 1) % fotos.length;
            slideImg.src = fotos[atual];
            slideImg.style.opacity = 1;
        }, 1000);
    }, 5000);
}

/* ---------- Dados do painel ---------- */
onValue(ref(db, "vitrine"), (snap) => {
    const v = snap.val() || {};

    trocar(heroImg, principalDe(v));

    const novas = sobreDe(v).map((f) => f.src);
    fotos = novas.length ? novas : SOBRE_PADRAO.slice();
    preCarregar(fotos);
    atual = 0;
    trocar(slideImg, fotos[0]);

    // O vídeo só carrega depois do aceite dos cookies do YouTube (Assets/js/cookies.js)
    if (video) {
        video.dataset.src = urlEmbed(videoValido(v.video));
        if (window.FLCookies) window.FLCookies.aplicar();
    }
}, (erro) => console.warn("Vitrine indisponível, usando as fotos originais:", erro));
