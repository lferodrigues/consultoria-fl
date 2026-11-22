// Porcentagem nas telas de carregamento com o supino (login, área do aluno e painel).
//
// Coloca um número em % e uma barra embaixo de cada animação de supino. Enquanto a tela
// está à mostra, a % sobe sozinha, cada vez mais devagar, até 95%. Quando a tela some,
// volta a zero para a próxima vez. O Firebase não informa quanto falta, então é uma estimativa.
// A ficha de inscrição (cadastro.html) tem a sua própria versão, que também avança por etapa.
(function () {
    const TETO = 95;      // a % nunca passa disso sozinha
    const PASSO = 0.06;   // quanto do que falta anda a cada 80 ms
    const LIMITE = 10000; // depois de 10 s na tela, oferece "Tentar de novo"

    function preparar(supino) {
        if (supino.dataset.pct || supino.closest(".cad-loading")) return;
        supino.dataset.pct = "1";
        const tela = supino.closest("[id]") || supino.parentElement;

        const caixa = document.createElement("span");
        caixa.className = "supino-pct";
        caixa.setAttribute("aria-live", "polite");
        caixa.innerHTML = '<b>0%</b><span class="supino-pct-barra"><i></i></span>' +
            '<span class="supino-lento" hidden>Está demorando mais que o normal. Confira a sua internet.' +
            '<button type="button">Tentar de novo</button></span>';
        const lento = caixa.querySelector(".supino-lento");
        lento.querySelector("button").addEventListener("click", () => location.reload());
        const texto = supino.querySelector(".supino-texto");
        if (texto) supino.insertBefore(caixa, texto);
        else supino.insertAdjacentElement("afterend", caixa);

        const num = caixa.querySelector("b");
        const barra = caixa.querySelector("i");
        let pct = 0;
        let timer = null;
        let alarme = null;

        const mostrar = () => {
            const n = Math.floor(pct);
            num.textContent = n + "%";
            barra.style.width = n + "%";
        };
        const visivel = () => tela.isConnected && !tela.hidden && !supino.closest("[hidden]");

        function atualizar() {
            if (visivel()) {
                if (timer) return;
                pct = 0;
                mostrar();
                timer = setInterval(() => { pct += (TETO - pct) * PASSO; mostrar(); }, 80);
                lento.hidden = true;
                alarme = setTimeout(() => { lento.hidden = false; }, LIMITE);
            } else if (timer) {
                clearInterval(timer);
                clearTimeout(alarme);
                timer = null;
                lento.hidden = true;
                pct = 100;
                mostrar();
            }
        }

        new MutationObserver(atualizar).observe(tela, { attributes: true, attributeFilter: ["hidden", "class", "style"] });
        atualizar();
    }

    function iniciar() { document.querySelectorAll(".supino").forEach(preparar); }
    // O app do aluno (spa-aluno.js) chama de novo quando troca de tela
    window.flPrepararSupinos = iniciar;
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
    else iniciar();
})();
