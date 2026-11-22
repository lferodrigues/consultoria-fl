// Vitrine do site: fotos e vídeo de apresentação da página inicial
//   vitrine/video     -> { id (11 caracteres do YouTube), atualizadoEm }
//   vitrine/principal -> { src, atualizadoEm }               foto do topo (hero)
//   vitrine/sobre/{id} -> { src, ordem }                     fotos que passam na seção "Sobre"
// Sem nada salvo, o site usa as fotos e o vídeo originais abaixo.

export const VIDEO_PADRAO = "Ls7xSzsZ_Js";
// A foto 4 saiu do padrão: a alça do cabo na mão parecia um gesto ofensivo
export const PRINCIPAL_PADRAO = "./administrador/Assets/img/5.webp";
export const SOBRE_PADRAO = [1, 2, 3, 5].map((n) => "./administrador/Assets/img/" + n + ".webp");

const ID_YT = /^[A-Za-z0-9_-]{11}$/;

// Aceita o link em qualquer formato do YouTube (watch, youtu.be, shorts, embed, live) ou só o código
export function idDoYoutube(texto) {
    const t = String(texto || "").trim();
    if (ID_YT.test(t)) return t;
    let url;
    try { url = new URL(/^https?:\/\//i.test(t) ? t : "https://" + t); } catch { return ""; }
    const host = url.hostname.replace(/^www\.|^m\./, "");
    let id = "";
    if (host === "youtu.be") id = url.pathname.split("/")[1];
    else if (host.endsWith("youtube.com") || host === "youtube-nocookie.com") {
        id = url.searchParams.get("v") || "";
        const m = url.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/);
        if (!id && m) id = m[2];
    }
    return ID_YT.test(id) ? id : "";
}

export function videoValido(v) {
    return v && ID_YT.test(v.id || "") ? v.id : VIDEO_PADRAO;
}

// youtube-nocookie: modo de privacidade aprimorada do YouTube
export const urlEmbed = (id) => "https://www.youtube-nocookie.com/embed/" + id;

// Só aceita imagens enviadas pelo painel (base64) ou as fotos do próprio site
export function srcSeguro(src) {
    const s = String(src || "");
    if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s)) return s;
    // Fotos do próprio site: sempre a versão .webp (mais leve), mesmo se o banco guardou .jpeg/.png
    if (/^\.\/administrador\/Assets\/img\/[\w.-]+$/.test(s)) return s.replace(/\.(jpe?g|png)$/i, ".webp");
    return "";
}

export function principalDe(vitrine) {
    return srcSeguro(vitrine?.principal?.src) || PRINCIPAL_PADRAO;
}

// Lista ordenada das fotos da seção "Sobre" -> [{ id, src }]
export function sobreDe(vitrine) {
    const lista = Object.entries(vitrine?.sobre || {})
        .map(([id, f]) => ({ id, src: srcSeguro(f?.src), ordem: Number(f?.ordem) || 0 }))
        .filter((f) => f.src)
        .sort((a, b) => a.ordem - b.ordem);
    return lista;
}

/* ---------- Textos do site ----------
   vitrine/textos/{chave} -> texto. No index, cada texto editável tem data-texto="chave".
   Palavras entre *asteriscos* ficam em destaque (vermelho), como em "Prazer, sou o *Fagner Lage*". */
export const TEXTO_MAX = 600;

const escHtml = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function textoParaHtml(t) {
    return escHtml(t).replace(/\*([^*]+)\*/g, '<span class="accent">$1</span>');
}

// Texto original de um elemento do index, no mesmo formato (destaques viram *asteriscos*)
export function textoDoElemento(el) {
    let t = "";
    el.childNodes.forEach((n) => {
        if (n.nodeType === 3) t += n.textContent;
        else if (n.nodeType === 1) t += n.classList.contains("accent") ? "*" + n.textContent + "*" : n.textContent;
    });
    return t.replace(/\s+/g, " ").trim();
}

export function textosDe(vitrine) {
    const out = {};
    Object.entries(vitrine?.textos || {}).forEach(([k, v]) => {
        if (typeof v === "string" && v.trim() && v.length <= TEXTO_MAX) out[k] = v;
    });
    return out;
}
