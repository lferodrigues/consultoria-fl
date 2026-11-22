// Tela: Vitrine do site — troca as fotos e o vídeo de apresentação da página inicial
//   vitrine/video -> { id, atualizadoEm }   vitrine/principal -> { src, atualizadoEm }   vitrine/sobre/{id} -> { src, ordem }
import { ref, onValue, set, remove, push } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { db } from "./firebase-app.js?v=2";
import { VIDEO_PADRAO, SOBRE_PADRAO, idDoYoutube, videoValido, urlEmbed, principalDe, sobreDe } from "./vitrine-util.js?v=1";
import { $, esc, aviso, confirmar, mensagemErro, ocupado } from "./admin-core.js?v=1";

let vitrine = {};

export function iniciar() {
    onValue(ref(db, "vitrine"), (snap) => { vitrine = snap.val() || {}; desenhar(); }, (e) => {
        console.error(e);
        aviso("Sem permissão para ler \"vitrine\". Confira as regras do Realtime Database.", "error");
    });

    $("vt-video-url").addEventListener("input", previaVideo);
    $("vt-video-form").addEventListener("submit", salvarVideo);
    $("vt-video-padrao").addEventListener("click", videoPadrao);

    $("vt-principal-arq").addEventListener("change", trocarPrincipal);
    $("vt-principal-padrao").addEventListener("click", principalPadrao);

    $("vt-sobre-arq").addEventListener("change", adicionarSobre);
    $("vt-sobre-padrao").addEventListener("click", sobrePadrao);
    $("vt-sobre-lista").addEventListener("click", acaoSobre);
    $("vt-sobre-lista").addEventListener("change", (ev) => {
        if (ev.target.matches("input[data-trocar]")) trocarSobre(ev.target);
    });
}

/* =================== Desenho =================== */

function desenhar() {
    // Vídeo
    const id = videoValido(vitrine.video);
    if (document.activeElement !== $("vt-video-url")) $("vt-video-url").value = "https://www.youtube.com/watch?v=" + id;
    mostrarVideo(id);
    $("vt-video-badge").innerHTML = vitrine.video ? '<span class="badge ok">Personalizado</span>' : '<span class="badge off">Original</span>';
    $("vt-video-padrao").hidden = !vitrine.video;

    // Foto principal
    $("vt-principal-img").src = principalDe(vitrine);
    $("vt-principal-badge").innerHTML = vitrine.principal ? '<span class="badge ok">Personalizada</span>' : '<span class="badge off">Original</span>';
    $("vt-principal-padrao").hidden = !vitrine.principal;

    // Fotos da seção "Sobre"
    const salvas = sobreDe(vitrine);
    const lista = salvas.length ? salvas : SOBRE_PADRAO.map((src, i) => ({ id: "padrao-" + i, src }));
    $("vt-sobre-badge").innerHTML = salvas.length ? '<span class="badge ok">Personalizadas</span>' : '<span class="badge off">Originais</span>';
    $("vt-sobre-padrao").hidden = !salvas.length;
    $("vt-sobre-n").textContent = lista.length + (lista.length === 1 ? " foto" : " fotos");
    $("vt-sobre-lista").innerHTML = lista.map((f, i) => `
        <figure class="vt-foto">
            <img src="${esc(f.src)}" alt="Foto ${i + 1} da seção Sobre" loading="lazy">
            <span class="vt-foto-n">${i + 1}º</span>
            <figcaption class="actions">
                <button type="button" class="icon-btn" data-acao="subir" data-i="${i}" title="Mover para antes" aria-label="Mover a foto ${i + 1} para antes" ${i === 0 ? "disabled" : ""}><i class="fa-solid fa-arrow-left"></i></button>
                <button type="button" class="icon-btn" data-acao="descer" data-i="${i}" title="Mover para depois" aria-label="Mover a foto ${i + 1} para depois" ${i === lista.length - 1 ? "disabled" : ""}><i class="fa-solid fa-arrow-right"></i></button>
                <label class="icon-btn" title="Trocar foto" aria-label="Trocar a foto ${i + 1}"><i class="fa-solid fa-image"></i><input type="file" accept="image/*" data-trocar data-i="${i}" hidden></label>
                <button type="button" class="icon-btn danger" data-acao="excluir" data-i="${i}" title="Remover" aria-label="Remover a foto ${i + 1}" ${lista.length === 1 ? "disabled" : ""}><i class="fa-solid fa-trash"></i></button>
            </figcaption>
        </figure>`).join("");
}

function mostrarVideo(id) {
    const iframe = $("vt-video-prev");
    const src = urlEmbed(id);
    if (iframe.getAttribute("src") !== src) iframe.src = src;
}

/* =================== Vídeo =================== */

function previaVideo() {
    const id = idDoYoutube($("vt-video-url").value);
    $("vt-video-msg").textContent = $("vt-video-url").value.trim() && !id ? "Link do YouTube não reconhecido." : "";
    if (id) mostrarVideo(id);
}

async function salvarVideo(ev) {
    ev.preventDefault();
    const msg = $("vt-video-msg");
    const id = idDoYoutube($("vt-video-url").value);
    if (!id) return (msg.textContent = "Cole o link de um vídeo do YouTube. Ex.: https://www.youtube.com/watch?v=" + VIDEO_PADRAO);
    msg.textContent = "";
    const botao = $("vt-video-salvar");
    ocupado(botao, true);
    try {
        await set(ref(db, "vitrine/video"), { id, atualizadoEm: Date.now() });
        $("vt-video-url").blur();
        aviso("Vídeo de apresentação atualizado no site.", "ok");
    } catch (e) {
        console.error(e);
        msg.textContent = mensagemErro(e);
    } finally {
        ocupado(botao, false);
    }
}

async function videoPadrao() {
    if (!(await confirmar({ titulo: "Voltar ao vídeo original?", texto: "O site volta a mostrar o vídeo de apresentação de antes.", botao: "Voltar ao original" }))) return;
    await gravar(() => remove(ref(db, "vitrine/video")), "Vídeo original restaurado.");
}

/* =================== Foto principal =================== */

async function trocarPrincipal(ev) {
    const arq = ev.target.files[0];
    ev.target.value = "";
    if (!arq) return;
    const src = await prepararFoto(arq);
    if (!src) return;
    await gravar(() => set(ref(db, "vitrine/principal"), { src, atualizadoEm: Date.now() }), "Foto principal atualizada no site.");
}

async function principalPadrao() {
    if (!(await confirmar({ titulo: "Voltar à foto original?", texto: "O topo do site volta a mostrar a foto de antes.", botao: "Voltar à original" }))) return;
    await gravar(() => remove(ref(db, "vitrine/principal")), "Foto principal original restaurada.");
}

/* =================== Fotos da seção "Sobre" =================== */

// Lista atual; enquanto nada foi salvo, são as originais (ainda sem id no banco)
function listaSobre() {
    const salvas = sobreDe(vitrine);
    return salvas.length ? salvas.map((f) => f.src) : SOBRE_PADRAO.slice();
}

// Regrava a lista inteira na ordem dada
function salvarSobre(srcs) {
    const dados = {};
    srcs.forEach((src, i) => { dados[push(ref(db, "vitrine/sobre")).key] = { src, ordem: i }; });
    return set(ref(db, "vitrine/sobre"), dados);
}

async function adicionarSobre(ev) {
    const arqs = [...ev.target.files];
    ev.target.value = "";
    if (!arqs.length) return;
    const novas = [];
    for (const arq of arqs) {
        const src = await prepararFoto(arq);
        if (src) novas.push(src);
    }
    if (!novas.length) return;
    await gravar(() => salvarSobre([...listaSobre(), ...novas]), novas.length === 1 ? "Foto adicionada ao site." : novas.length + " fotos adicionadas ao site.");
}

async function trocarSobre(input) {
    const arq = input.files[0];
    const i = Number(input.dataset.i);
    input.value = "";
    if (!arq) return;
    const src = await prepararFoto(arq);
    if (!src) return;
    const lista = listaSobre();
    lista[i] = src;
    await gravar(() => salvarSobre(lista), "Foto trocada no site.");
}

async function acaoSobre(ev) {
    const b = ev.target.closest("button[data-acao]");
    if (!b) return;
    const i = Number(b.dataset.i);
    const lista = listaSobre();
    if (b.dataset.acao === "subir" || b.dataset.acao === "descer") {
        const j = b.dataset.acao === "subir" ? i - 1 : i + 1;
        if (j < 0 || j >= lista.length) return;
        [lista[i], lista[j]] = [lista[j], lista[i]];
        return gravar(() => salvarSobre(lista), "Ordem das fotos atualizada.");
    }
    if (b.dataset.acao === "excluir") {
        if (lista.length <= 1) return aviso("Deixe pelo menos uma foto na seção Sobre.", "error");
        if (!(await confirmar({ titulo: "Remover esta foto?", texto: "Ela deixa de aparecer na seção Sobre do site.", botao: "Remover" }))) return;
        lista.splice(i, 1);
        return gravar(() => salvarSobre(lista), "Foto removida do site.");
    }
}

async function sobrePadrao() {
    if (!(await confirmar({ titulo: "Voltar às fotos originais?", texto: "A seção Sobre volta a mostrar as 5 fotos de antes. As fotos enviadas por aqui serão apagadas.", botao: "Voltar às originais" }))) return;
    await gravar(() => remove(ref(db, "vitrine/sobre")), "Fotos originais restauradas.");
}

/* =================== Apoio =================== */

async function gravar(fn, ok) {
    document.body.classList.add("vt-salvando");
    try {
        await fn();
        aviso(ok, "ok");
    } catch (e) {
        console.error(e);
        aviso(mensagemErro(e), "error");
    } finally {
        document.body.classList.remove("vt-salvando");
    }
}

// Reduz a foto (lado maior até 1400 px, JPEG) para caber no banco e carregar rápido no site
const LIMITE = 900000; // caracteres do base64 (~650 KB)

async function prepararFoto(arq) {
    if (!/^image\//.test(arq.type)) { aviso("Escolha um arquivo de imagem (JPG, PNG ou WEBP).", "error"); return ""; }
    aviso("Preparando a foto...", "ok");
    try {
        const img = await carregarImagem(arq);
        for (const [lado, qualidade] of [[1400, .85], [1400, .75], [1200, .7], [1000, .65], [800, .6]]) {
            const src = reduzir(img, lado, qualidade);
            if (src.length < LIMITE) return src;
        }
        aviso("Não foi possível reduzir essa foto. Tente outra.", "error");
    } catch (e) {
        console.error(e);
        aviso("Não foi possível abrir essa imagem. Tente outra.", "error");
    }
    return "";
}

function carregarImagem(arq) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(arq);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
        img.src = url;
    });
}

function reduzir(img, lado, qualidade) {
    const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * escala);
    c.height = Math.round(img.naturalHeight * escala);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#000"; // fundo para PNG transparente
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", qualidade);
}

