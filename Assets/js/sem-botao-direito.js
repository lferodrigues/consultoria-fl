// Desativa o botão direito do mouse (menu de contexto) em todo o site.
// Dentro de campos de texto ele continua funcionando, para a pessoa poder colar e corrigir o que digitou.
// Também impede arrastar imagens para fora da página.
(function () {
    function ehCampo(el) {
        return !!(el && el.closest && el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
    }
    document.addEventListener("contextmenu", function (e) {
        if (!ehCampo(e.target)) e.preventDefault();
    });
    document.addEventListener("dragstart", function (e) {
        if (e.target && e.target.tagName === "IMG") e.preventDefault();
    });
})();
