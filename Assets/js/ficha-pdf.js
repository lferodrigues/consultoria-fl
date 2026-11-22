// Ficha de treino em PDF (área do aluno), no modelo da planilha do personal:
// cabeçalho com logo e "TREINO N", bloco com os dados do aluno e a tabela
// GRUPO · EXERCÍCIO · SÉRIES · REPS · KG · DESCANSO · OBSERVAÇÃO. Uma página por dia de treino.
//
// Usa a biblioteca pdf-lib (Assets/js/vendor), carregada só quando o aluno pede o PDF.
// Não usa Firebase: recebe os dados prontos.
import { diasDaFicha, exerciciosDe, diaPorId } from "./fichas-util.js?v=1";
import { CATEGORIAS, SUGERIDOS } from "./exercicios-dados.js?v=1";

// Dados do personal no cabeçalho (preencha o CREF para ele aparecer)
const PERSONAL = { nome: "Fagner Lage", titulo: "Fagner Lage - Personal Trainer", cref: "" };
const SITE = "personalfagnerlage.com.br";

let carregando = null;
function pdfLib() {
    if (window.PDFLib) return Promise.resolve(window.PDFLib);
    if (!carregando) {
        carregando = new Promise((ok, falha) => {
            const s = document.createElement("script");
            s.src = new URL("./Assets/js/vendor/pdf-lib-1.17.1.min.js", document.baseURI).href;
            s.onload = () => (window.PDFLib ? ok(window.PDFLib) : falha(new Error("pdf-lib não carregou")));
            s.onerror = () => { carregando = null; falha(new Error("pdf-lib não carregou")); };
            document.head.appendChild(s);
        });
    }
    return carregando;
}

const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
// Grupo muscular: o da ficha (se tiver) ou o da lista de exercícios conhecidos pelo nome
const GRUPO_POR_NOME = new Map();
Object.entries(SUGERIDOS).forEach(([cat, lista]) => {
    const nome = (CATEGORIAS.find((c) => c.id === cat) || {}).nome || cat;
    lista.forEach(([ex]) => GRUPO_POR_NOME.set(norm(ex), nome));
});
function grupoDe(e) {
    if (e.grupo) return e.grupo;
    if (e.categoria) return (CATEGORIAS.find((c) => c.id === e.categoria) || {}).nome || e.categoria;
    return GRUPO_POR_NOME.get(norm(e.nome)) || "";
}

// A fonte padrão do PDF (Helvetica) só tem os caracteres do português "comum": troca o resto
const EXTRA = "‘’‚“”„•…–—€™";
function limpo(t) {
    return Array.from(String(t ?? "").replace(/×/g, "x").replace(/\s+/g, " ").trim())
        .map((c) => (c.charCodeAt(0) < 256 || EXTRA.includes(c) ? c : "")).join("");
}

const dataBR = (iso) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join("/") : "");

export async function gerarFichaPDF({ aluno, ficha, inscricao }) {
    const { PDFDocument, StandardFonts, rgb } = await pdfLib();
    const doc = await PDFDocument.create();
    doc.setTitle("Ficha de treino - " + limpo(aluno.nome));
    doc.setAuthor(PERSONAL.nome);
    const fonte = await doc.embedFont(StandardFonts.Helvetica);
    const negrito = await doc.embedFont(StandardFonts.HelveticaBold);

    let logo = null;
    try {
        const bytes = await fetch(new URL("./Assets/img/logo.png", document.baseURI)).then((r) => r.arrayBuffer());
        logo = await doc.embedPng(bytes);
    } catch (e) { console.warn("Logo fora do PDF", e); }

    // Cores do modelo (preto, cinza claro) com o vermelho da marca no lugar do amarelo
    const PRETO = rgb(0, 0, 0), CINZA = rgb(0.91, 0.91, 0.91), BRANCO = rgb(1, 1, 1);
    const DESTAQUE = rgb(0.89, 0.13, 0.17), TEXTO = rgb(0.08, 0.08, 0.08), APAGADO = rgb(0.45, 0.45, 0.45);

    const L = 595.28, A = 841.89, M = 24, W = L - 2 * M, G = 3; // A4 em pé, margem e espaço entre caixas

    // Quebra o texto em linhas que caibam na largura
    function linhas(texto, f, tam, larg) {
        const palavras = limpo(texto).split(" ").filter(Boolean);
        const out = [];
        let atual = "";
        palavras.forEach((p) => {
            const tent = atual ? atual + " " + p : p;
            if (f.widthOfTextAtSize(tent, tam) <= larg) { atual = tent; return; }
            if (atual) out.push(atual);
            // palavra maior que a caixa: corta
            let resto = p;
            while (f.widthOfTextAtSize(resto, tam) > larg && resto.length > 1) {
                let n = resto.length;
                while (n > 1 && f.widthOfTextAtSize(resto.slice(0, n), tam) > larg) n--;
                out.push(resto.slice(0, n));
                resto = resto.slice(n);
            }
            atual = resto;
        });
        if (atual) out.push(atual);
        return out.length ? out : [""];
    }

    // Caixa com texto (topo em y, medido de cima). alinha: "c" centro, "e" esquerda
    function caixa(pg, x, yTopo, w, h, { fundo = CINZA, texto = "", f = fonte, tam = 9, cor = TEXTO, alinha = "c" } = {}) {
        pg.drawRectangle({ x, y: A - yTopo - h, width: w, height: h, color: fundo });
        if (!texto) return;
        const ls = linhas(texto, f, tam, w - 10);
        const alt = ls.length * tam * 1.2;
        let y = A - yTopo - (h - alt) / 2 - tam * 0.95;
        ls.forEach((l) => {
            const lw = f.widthOfTextAtSize(l, tam);
            pg.drawText(l, { x: alinha === "c" ? x + (w - lw) / 2 : x + 6, y, size: tam, font: f, color: cor });
            y -= tam * 1.2;
        });
    }
    const alturaTexto = (texto, f, tam, w, min) => Math.max(min, linhas(texto, f, tam, w - 10).length * tam * 1.2 + 10);

    // Campos do aluno
    const altura = inscricao?.altura ? String(inscricao.altura).replace(".", ",") + " cm" : "";
    const peso = inscricao?.peso ? String(inscricao.peso).replace(".", ",") + " kg" : "";
    const idade = inscricao?.idade ? inscricao.idade + " anos" : "";
    const dias = diasDaFicha(ficha);
    const freq = (ficha.diasPorSemana || dias.length) ? (ficha.diasPorSemana || dias.length) + "x por semana" : "";
    const objetivo = ficha.objetivo || inscricao?.objetivo || "";
    const inicio = dataBR(ficha.inicio);

    // Colunas da tabela (somam W)
    const COLS = [
        { t: "GRUPO", w: 78 }, { t: "EXERCÍCIO", w: 165 }, { t: "SÉRIES", w: 44 }, { t: "REPS", w: 44 },
        { t: "KG", w: 40 }, { t: "DESCANSO", w: 60 }
    ];
    COLS.push({ t: "OBSERVAÇÃO", w: W - COLS.reduce((s, c) => s + c.w + G, 0) });

    function cabecalho(pg, numero, diaTexto) {
        const hTopo = 96, wDir = 120, wEsq = W - wDir - G;
        caixa(pg, M, M, wEsq, hTopo);
        if (logo) {
            const lado = 74, esc = lado / Math.max(logo.width, logo.height);
            pg.drawImage(logo, { x: M + 12, y: A - M - hTopo + (hTopo - logo.height * esc) / 2, width: logo.width * esc, height: logo.height * esc });
        }
        const cx = M + 90, cw = wEsq - 100;
        caixa(pg, cx, M + 18, cw, 22, { texto: PERSONAL.titulo, f: negrito, tam: 13, fundo: CINZA });
        caixa(pg, cx, M + 52, cw, 26, { texto: PERSONAL.cref ? "CREF " + PERSONAL.cref : "Consultoria online · " + SITE, f: negrito, tam: 11, fundo: CINZA });
        caixa(pg, M + wEsq + G, M, wDir, 30, { fundo: PRETO, texto: "TREINO", f: negrito, tam: 13, cor: DESTAQUE });
        caixa(pg, M + wEsq + G, M + 30 + G, wDir, hTopo - 30 - G, { texto: String(numero), f: negrito, tam: 40 });
        // nome do dia embaixo do número
        const dt = limpo(diaTexto);
        if (dt) {
            const ls = linhas(dt, fonte, 7.5, wDir - 8).slice(0, 2);
            let y = A - M - hTopo + 6 + (ls.length - 1) * 9;
            ls.forEach((l) => { pg.drawText(l, { x: M + wEsq + G + (wDir - fonte.widthOfTextAtSize(l, 7.5)) / 2, y, size: 7.5, font: fonte, color: APAGADO }); y -= 9; });
        }
        return M + hTopo + 10;
    }

    function dadosAluno(pg, y) {
        const lab = (x, w, t) => caixa(pg, x, y, w, 22, { fundo: PRETO, texto: t, f: negrito, tam: 8.5, cor: DESTAQUE });
        const val = (x, w, t, h = 22) => caixa(pg, x, y, w, h, { texto: t, tam: 9, alinha: "e" });
        const wl = 118, x2 = M + wl + G;
        lab(M, wl, "NOME:"); val(x2, W - wl - G, aluno.nome); y += 22 + G;
        // idade | altura | peso
        const wv1 = 150, wl2 = 62, wv2 = 80, wl3 = 62;
        lab(M, wl, "IDADE:"); val(x2, wv1, idade);
        let x = x2 + wv1 + G; lab(x, wl2, "ALTURA:"); x += wl2 + G; val(x, wv2, altura);
        x += wv2 + G; lab(x, wl3, "PESO:"); x += wl3 + G; val(x, M + W - x, peso); y += 22 + G;
        // objetivos | frequência
        const wv3 = 230, wl4 = 98;
        lab(M, wl, "OBJETIVOS:"); val(x2, wv3, objetivo);
        x = x2 + wv3 + G; lab(x, wl4, "FREQUÊNCIA:"); x += wl4 + G; val(x, M + W - x, freq); y += 22 + G;
        lab(M, wl, "PROFISSIONAL RESP:"); val(x2, wv3, PERSONAL.nome);
        x = x2 + wv3 + G; lab(x, wl4, "DATA DE INÍCIO:"); x += wl4 + G; val(x, M + W - x, inicio); y += 22 + G;
        const hObs = alturaTexto(ficha.obs || "", fonte, 9, W - wl - G, 22);
        caixa(pg, M, y, wl, hObs, { fundo: PRETO, texto: "OBSERVAÇÕES:", f: negrito, tam: 8.5, cor: DESTAQUE });
        val(x2, W - wl - G, ficha.obs || "", hObs);
        return y + hObs + 10;
    }

    function cabecalhoTabela(pg, y) {
        let x = M;
        COLS.forEach((c) => { caixa(pg, x, y, c.w, 16, { fundo: PRETO, texto: c.t, f: negrito, tam: 8, cor: DESTAQUE }); x += c.w + G; });
        return y + 16 + G;
    }

    function rodape(pg) {
        const t = limpo("Ficha gerada em " + new Date().toLocaleDateString("pt-BR") + " · " + SITE);
        pg.drawText(t, { x: M, y: 14, size: 7, font: fonte, color: APAGADO });
    }

    const listaDias = dias.length ? dias : [{ nome: "", exercicios: [] }];
    listaDias.forEach((dia, i) => {
        const numero = i + 1;
        // "Segunda · Peito e tríceps"
        const rotulo = [dia.id ? diaPorId(dia.id).nome : "", ficha.dias?.[dia.id]?.nome || ""].filter(Boolean).join(" · ");
        let pg = doc.addPage([L, A]);
        let y = cabecalho(pg, numero, rotulo);
        y = dadosAluno(pg, y);
        y = cabecalhoTabela(pg, y);

        const exs = exerciciosDe(dia);
        const linhasTabela = exs.map((e) => [grupoDe(e), e.nome, e.series, e.reps, e.carga, e.descanso, e.obs]);
        while (linhasTabela.length < 8) linhasTabela.push(["", "", "", "", "", "", ""]); // linhas em branco, como na planilha

        linhasTabela.forEach((cel) => {
            const h = Math.max(...cel.map((t, k) => alturaTexto(t, fonte, 8.5, COLS[k].w, 24)));
            if (y + h > A - 30) { // não cabe: continua na próxima página
                rodape(pg);
                pg = doc.addPage([L, A]);
                y = cabecalho(pg, numero, (rotulo || "") + " (continuação)");
                y = cabecalhoTabela(pg, y);
            }
            let x = M;
            cel.forEach((t, k) => {
                caixa(pg, x, y, COLS[k].w, h, { texto: t == null ? "" : String(t), tam: 8.5, alinha: k === 1 || k === 6 ? "e" : "c" });
                x += COLS[k].w + G;
            });
            y += h + G;
        });
        rodape(pg);
    });

    return new Blob([await doc.save()], { type: "application/pdf" });
}

// Gera e baixa (no celular, o navegador oferece abrir ou salvar)
export async function baixarFichaPDF(dados) {
    const blob = await gerarFichaPDF(dados);
    const url = URL.createObjectURL(blob);
    const nome = "ficha-de-treino-" + norm(dados.aluno.nome).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".pdf";
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}
