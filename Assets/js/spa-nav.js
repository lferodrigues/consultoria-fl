// Troca de tela no app do aluno (login, ficha de inscrição e área do aluno) sem recarregar a página.
// Se o app não estiver rodando (página aberta fora dele), faz a navegação normal.
export function navegar(url, { substituir = false } = {}) {
    if (window.flSpa) return window.flSpa.ir(url, { substituir });
    if (substituir) location.replace(url);
    else location.href = url;
}
