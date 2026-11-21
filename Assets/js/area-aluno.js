// Área do Aluno — só entra quem está logado, cadastrado, ativo e no prazo.
// Mostra a ficha de treino atual, o vídeo de cada exercício e o feedback do dia.
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { ref, get, onValue, push, update } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { auth, db, ehAdmin, chaveEmail, hojeISO, PAGINAS } from "./firebase-app.js?v=2";
import { situacao, diasEntre, dataBR } from "./alunos-util.js?v=2";
import { DIAS, diaPorId, diaDeHoje, diasDaFicha, exerciciosDe, resumoExercicio, fichaAtual, idYoutube, ESFORCO } from "./fichas-util.js?v=1";
import { mostrarAcessoNegado } from "./acesso-negado.js?v=1";

// WhatsApp que recebe os feedbacks (55 = Brasil, 32 = DDD)
const WHATSAPP = "5532998528266";

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let saindo = false;
let aluno = null;      // { id, nome, email }
let ficha = null;      // ficha atual
let diaSel = null;     // "seg", "ter"...
let exAberto = null;   // índice do exercício no pop-up

/* =================== Acesso =================== */

onAuthStateChanged(auth, async (user) => {
    if (saindo) return;
    if (!user) return mostrarAcessoNegado({ texto: "Faça o seu login para entrar." });
    if (ehAdmin(user)) return window.location.replace(PAGINAS.admin);

    try {
        const snap = await get(ref(db, "emails/" + chaveEmail(user.email)));
        const cadastro = snap.val();
        const hoje = hojeISO();

        if (!cadastro) {
            return mostrarAcessoNegado({ texto: "O e-mail " + (user.email || "") + " não está cadastrado. Escolha um plano para começar.", botao: "Ver planos", link: PAGINAS.planos });
        }
        if (cadastro.ativo === false) {
            return mostrarAcessoNegado({ texto: "Seu acesso está desativado. Fale com o personal para liberar.", botao: "Voltar ao login" });
        }
        if (cadastro.vencimento && cadastro.vencimento < hoje) {
            return mostrarAcessoNegado({ texto: "Seu plano venceu. Fale com o personal para renovar.", botao: "Ver planos", link: PAGINAS.planos });
        }

        const nome = cadastro.nome || user.displayName || user.email;
        aluno = { id: cadastro.aluno, nome, email: user.email };
        $("aluno-nome").textContent = nome.split(" ")[0];
        $("aluno-plano").textContent = cadastro.plano || "Consultoria";
        $("aluno-venc").textContent = dataBR(cadastro.vencimento);
        if (cadastro.vencimento) {
            const dias = diasEntre(hoje, cadastro.vencimento);
            $("aluno-dias").textContent = dias === 0 ? "Vence hoje" : "Faltam " + dias + (dias === 1 ? " dia" : " dias");
        }
        const s = situacao(cadastro, hoje);
        $("aluno-status").textContent = s.texto;
        $("aluno-status").className = "badge " + s.classe;
        $("gate").hidden = true;

        escutarFicha();
    } catch (e) {
        console.error(e);
        mostrarAcessoNegado({ texto: "Não foi possível verificar o seu acesso. Faça o login de novo.", botao: "Fazer login" });
    }
});

$("logout-btn").addEventListener("click", async () => {
    saindo = true;
    await signOut(auth);
    window.location.replace(PAGINAS.login);
});

/* =================== Ficha de treino =================== */

function escutarFicha() {
    onValue(ref(db, "fichas/" + aluno.id), (snap) => {
        const lista = Object.entries(snap.val() || {}).map(([id, f]) => ({ id, ...f }));
        ficha = fichaAtual(lista);
        if (!ficha || !diasDaFicha(ficha).length) {
            $("treino-vazio").hidden = false;
            $("treino-grid").hidden = true;
            return;
        }
        $("treino-vazio").hidden = true;
        $("treino-grid").hidden = false;
        const dias = diasDaFicha(ficha).map((d) => d.id);
        if (!dias.includes(diaSel)) diaSel = dias.includes(diaDeHoje()) ? diaDeHoje() : dias[0];
        desenharFicha();
    }, (erro) => {
        console.error(erro);
        $("treino-vazio").hidden = false;
        $("treino-vazio").querySelector("p").textContent = "Não foi possível carregar a sua ficha agora. Tente novamente em instantes.";
    });
}

const diaAtual = () => diasDaFicha(ficha).find((d) => d.id === diaSel);

// Exercícios concluídos ficam salvos no aparelho, por ficha, dia e data
const chaveFeitos = () => `fl-feitos-${ficha.id}-${diaSel}-${hojeISO()}`;
function lerFeitos() {
    try { return new Set(JSON.parse(localStorage.getItem(chaveFeitos()) || "[]")); } catch { return new Set(); }
}
function gravarFeitos(set) {
    try { localStorage.setItem(chaveFeitos(), JSON.stringify([...set])); } catch { /* navegação privada */ }
}

function desenharFicha() {
    const dias = diasDaFicha(ficha);
    const hoje = diaDeHoje();
    const dia = diaAtual();
    const ex = exerciciosDe(dia);
    const feitos = lerFeitos();

    $("tr-dia-nome").textContent = dia.nome || "Treino";
    $("tr-sub").textContent = diaPorId(diaSel).nome + (diaSel === hoje ? " (hoje)" : "") + " · " + (ficha.nome || "Ficha de treino");
    $("tr-ficha-nome").textContent = ficha.nome || "Ficha de treino";
    $("tr-tags").innerHTML = [ficha.objetivo, ficha.nivel, dias.length + (dias.length === 1 ? " dia" : " dias") + " por semana"]
        .filter(Boolean).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
    $("tr-obs-bloco").hidden = !ficha.obs;
    $("tr-obs").textContent = ficha.obs || "";

    const ativos = new Set(dias.map((d) => d.id));
    $("tr-semana").innerHTML = DIAS.map((d) => {
        const treina = ativos.has(d.id);
        return `<button type="button" class="sem-dia${d.id === diaSel ? " ativo" : ""}${d.id === hoje ? " hoje" : ""}" data-dia="${d.id}" ${treina ? "" : "disabled"} role="tab" aria-selected="${d.id === diaSel}" title="${d.nome}${treina ? "" : " — descanso"}">${d.letra}</button>`;
    }).join("");
    $("tr-descanso").hidden = ativos.has(hoje);
    $("tr-descanso").innerHTML = '<i class="fa-solid fa-bed"></i> Hoje (' + diaPorId(hoje).nome.toLowerCase() + ") é dia de descanso. Abaixo está o treino de " + diaPorId(diaSel).nome.toLowerCase() + ".";

    $("tr-lista").innerHTML = ex.map((e, i) => `
        <li class="${feitos.has(i) ? "feito" : ""}">
            <button type="button" class="ex-abrir" data-i="${i}" aria-label="Ver vídeo de ${esc(e.nome)}">
                <strong>${esc(e.nome)}</strong>
                <small>${esc([resumoExercicio(e), e.carga].filter(Boolean).join(" · ")) || "Toque para ver os detalhes"}</small>
                ${e.video ? '<i class="fa-solid fa-circle-play ex-play" aria-hidden="true"></i>' : ""}
            </button>
            <button type="button" class="ex-check" data-i="${i}" aria-pressed="${feitos.has(i)}" aria-label="${feitos.has(i) ? "Desmarcar" : "Marcar"} ${esc(e.nome)} como feito"><i class="fa-solid fa-check"></i></button>
        </li>`).join("");

    const pct = ex.length ? Math.round((feitos.size / ex.length) * 100) : 0;
    $("tr-barra").style.width = pct + "%";
    $("tr-prog-txt").textContent = feitos.size + " de " + ex.length + (ex.length === 1 ? " concluído" : " concluídos") + (pct === 100 ? " · Treino completo! 💪" : "");
}

$("tr-semana").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-dia]");
    if (!b || b.disabled) return;
    diaSel = b.dataset.dia;
    desenharFicha();
});

$("tr-lista").addEventListener("click", (ev) => {
    const check = ev.target.closest(".ex-check");
    if (check) return alternarFeito(Number(check.dataset.i));
    const abrir = ev.target.closest(".ex-abrir");
    if (abrir) abrirVideo(Number(abrir.dataset.i));
});

function alternarFeito(i) {
    const feitos = lerFeitos();
    if (feitos.has(i)) feitos.delete(i); else feitos.add(i);
    gravarFeitos(feitos);
    desenharFicha();
}

/* =================== Pop-ups =================== */

function abrirModal(id, foco) {
    $(id).hidden = false;
    document.body.classList.add("modal-aberto");
    if (foco) setTimeout(() => $(foco)?.focus(), 50);
}
function fecharModal(id) {
    $(id).hidden = true;
    if (id === "modal-video") $("mv-video").innerHTML = ""; // para o vídeo
    if (!document.querySelector(".modal:not([hidden])")) document.body.classList.remove("modal-aberto");
}
document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fechar]");
    if (b) fecharModal(b.closest(".modal").id);
    else if (e.target.classList?.contains("modal")) fecharModal(e.target.id);
});
document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const aberto = [...document.querySelectorAll(".modal:not([hidden])")].pop();
    if (aberto) fecharModal(aberto.id);
});

function abrirVideo(i) {
    const e = exerciciosDe(diaAtual())[i];
    if (!e) return;
    exAberto = i;
    $("mv-titulo").textContent = e.nome;
    const id = idYoutube(e.video);
    if (id) {
        $("mv-video").innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1" title="Vídeo: ${esc(e.nome)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    } else if (e.video) {
        $("mv-video").innerHTML = `<div class="video-vazio"><i class="fa-solid fa-film"></i><p>Este vídeo não é do YouTube.</p><a class="btn btn-ghost btn-sm" href="${esc(e.video)}" target="_blank" rel="noopener">Abrir vídeo</a></div>`;
    } else {
        $("mv-video").innerHTML = `<div class="video-vazio"><i class="fa-solid fa-video-slash"></i><p>O personal ainda não cadastrou um vídeo para este exercício.</p></div>`;
    }
    const dados = [["Séries", e.series], ["Repetições", e.reps], ["Carga", e.carga], ["Descanso", e.descanso]].filter(([, v]) => v);
    $("mv-dados").innerHTML = dados.map(([k, v]) => `<div><small>${k}</small><strong>${esc(v)}</strong></div>`).join("");
    $("mv-obs").hidden = !e.obs;
    $("mv-obs").textContent = e.obs || "";
    const feito = lerFeitos().has(i);
    $("mv-feito").innerHTML = feito ? '<i class="fa-solid fa-rotate-left"></i> Desmarcar' : '<i class="fa-solid fa-check"></i> Marcar como feito';
    abrirModal("modal-video");
}

$("mv-feito").addEventListener("click", () => {
    if (exAberto === null) return;
    alternarFeito(exAberto);
    fecharModal("modal-video");
});

/* =================== Feedback do dia =================== */

$("tr-feedback-btn").addEventListener("click", () => {
    const dia = diaAtual();
    const total = exerciciosDe(dia).length;
    $("fb-resumo").textContent = diaPorId(diaSel).nome + " · " + (dia.nome || "Treino") + " — " + lerFeitos().size + " de " + total + " exercícios feitos";
    $("feedback-form").reset();
    $("fb-msg").textContent = "";
    abrirModal("modal-feedback");
});

document.querySelectorAll('input[name="esforco"]').forEach((r) => r.addEventListener("change", () => { $("fb-msg").textContent = ""; }));

$("feedback-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const esforco = document.querySelector('input[name="esforco"]:checked')?.value;
    const comentario = $("fb-comentario").value.trim();
    if (!esforco) return ($("fb-msg").textContent = "Escolha o nível de esforço: mínimo, médio ou alto.");

    const dia = diaAtual();
    const total = exerciciosDe(dia).length;
    const feitos = lerFeitos().size;
    const registro = {
        alunoId: aluno.id, nome: aluno.nome, email: aluno.email,
        fichaId: ficha.id, fichaNome: ficha.nome || "",
        dia: diaSel, diaNome: dia.nome || "", data: hojeISO(),
        esforco, comentario, feitos, total,
        criadoEm: Date.now(), lido: false
    };

    // Abre o WhatsApp já no clique (navegadores bloqueiam janelas abertas depois de esperar o banco)
    const texto = [
        "*Feedback do treino* 💪",
        "Aluno: " + aluno.nome,
        "Ficha: " + (ficha.nome || "Ficha de treino"),
        "Dia: " + diaPorId(diaSel).nome + " — " + (dia.nome || "Treino"),
        "Esforço: " + ESFORCO[esforco].nome,
        "Exercícios feitos: " + feitos + " de " + total,
        comentario ? "Comentário: " + comentario : ""
    ].filter(Boolean).join("\n");
    const janela = window.open("https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(texto), "_blank");
    if (janela) janela.opener = null;

    const botao = $("fb-enviar");
    botao.disabled = true;
    try {
        const id = push(ref(db, "feedbacks")).key;
        await update(ref(db), { ["feedbacks/" + id]: registro });
        fecharModal("modal-feedback");
        aviso(janela ? "Feedback enviado! Finalize o envio no WhatsApp." : "Feedback enviado ao personal!", "ok");
    } catch (e) {
        console.error(e);
        $("fb-msg").textContent = "Não foi possível registrar no painel. A mensagem do WhatsApp continua valendo.";
    } finally {
        botao.disabled = false;
    }
});

let timerAviso;
function aviso(texto, tipo = "ok") {
    const t = $("toast");
    t.textContent = texto;
    t.className = "toast show " + tipo;
    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => { t.className = "toast " + tipo; }, 4000);
}
