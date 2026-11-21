// Tela: Inscrições (fichas de inscrição enviadas pelo site)
//   inscricoes/{uid} -> { uid, email, nome, cpf, whatsapp, sexo, idade, endereco{..}, foto, peso, altura, objetivo,
//                         lesao{tem,qual}, saude{tem,qual}, medicamento{tem,qual}, diasTreino, tempoDia,
//                         planoId, planoNome, valor, diaVencimento, primeiroVencimento, responsavel?, lgpd{..},
//                         status: pendente | aprovada | ativo, visto, alunoId?, criadoEm, aprovadoEm?, primeiraFichaEm? }
// Fluxo: pendente -> (Aprovar) cria o aluno e abre a 1ª ficha -> aprovada -> (salvar 1ª ficha) -> ativo
import { ref, get, push, update } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { db, chaveEmail, hojeISO } from "./firebase-app.js?v=2";
import { $, estado, aoMudar, esc, aviso, abrirModal, fecharModal, confirmar, mensagemErro, ocupado } from "./admin-core.js?v=1";
import { dataBR, moeda, somarMeses, MESES_POR_PLANO } from "./alunos-util.js?v=2";

const STATUS = {
    pendente: { nome: "Aguardando análise", classe: "warn" },
    aprovada: { nome: "Aguardando 1ª ficha", classe: "bad" },
    ativo: { nome: "Aluno ativo", classe: "ok" }
};
const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const so = (t) => String(t || "").replace(/\D/g, "");

export const cpfBR = (c) => so(c).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
export function foneBR(f) {
    const d = so(f);
    return d.length === 11 ? d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3") : d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
}
// Número para o wa.me (55 + DDD + número)
export function foneWhats(f) {
    let d = so(f);
    if (d.length === 10 || d.length === 11) d = "55" + d;
    return d.length >= 12 ? d : "";
}

if (!Array.isArray(estado.inscricoes)) estado.inscricoes = [];

let atual = null; // uid aberto no detalhe

export function iniciar() {
    aoMudar(() => { desenharLista(); if (atual) desenharDetalhe(); });
    $("in-busca").addEventListener("input", desenharLista);
    $("in-filtro").addEventListener("change", desenharLista);
    document.querySelectorAll("[data-in-filtro]").forEach((b) => b.addEventListener("click", () => { $("in-filtro").value = b.dataset.inFiltro; desenharLista(); }));
    $("in-detalhe").addEventListener("click", (ev) => {
        const b = ev.target.closest("[data-acao]");
        if (!b) return;
        const i = estado.inscricoes.find((x) => x.id === atual);
        if (!i) return;
        if (b.dataset.acao === "aprovar") abrirAprovar(i);
        if (b.dataset.acao === "ficha") location.hash = "#/treinos/primeira/" + i.alunoId;
        if (b.dataset.acao === "excluir") excluir(i);
    });
    $("ap-plano").addEventListener("change", recalcularVenc);
    $("ap-inicio").addEventListener("change", recalcularVenc);
    $("aprovar-form").addEventListener("submit", aprovar);
}

export const pendentes = () => estado.inscricoes.filter((i) => (i.status || "pendente") === "pendente");
export const novas = () => pendentes().filter((i) => !i.visto);
export const daAluno = (alunoId, uid) => estado.inscricoes.find((i) => i.alunoId === alunoId || (uid && i.uid === uid));

/* =================== Lista =================== */

export function mostrarLista() {
    atual = null;
    $("in-lista-wrap").hidden = false;
    $("in-detalhe").hidden = true;
    desenharLista();
}

function desenharLista() {
    const todos = [...estado.inscricoes].sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
    const conta = (s) => todos.filter((i) => (i.status || "pendente") === s).length;
    $("in-pend").textContent = conta("pendente");
    $("in-aprov").textContent = conta("aprovada");
    $("in-ativos").textContent = conta("ativo");
    const n = pendentes().length;
    $("menu-ins-n").textContent = n;
    $("menu-ins-n").hidden = n === 0;

    const termo = norm($("in-busca").value.trim());
    const filtro = $("in-filtro").value;
    const lista = todos.filter((i) => (!filtro || (i.status || "pendente") === filtro) &&
        (!termo || norm([i.nome, i.email, i.planoNome, i.whatsapp, i.cpf, i.endereco?.cidade].join(" ")).includes(termo)));

    $("in-lista").innerHTML = lista.map((i) => {
        const st = STATUS[i.status || "pendente"] || STATUS.pendente;
        const alerta = i.lesao?.tem || i.saude?.tem || i.medicamento?.tem;
        return `
        <a href="#/inscricoes/${esc(i.id)}" class="item-card ins-card">
            <div class="ins-top">
                ${fotoHTML(i, "ins-foto")}
                <div class="ins-nome"><h3>${esc(i.nome)}</h3><small>${esc(i.endereco?.cidade || "")}${i.endereco?.uf ? "/" + esc(i.endereco.uf) : ""} · ${quando(i.criadoEm)}</small></div>
            </div>
            <div class="ins-tags">
                <span class="badge ${st.classe}">${st.nome}</span>
                ${!i.visto && (i.status || "pendente") === "pendente" ? '<span class="badge warn">Nova</span>' : ""}
                ${alerta ? '<span class="badge bad" title="Informou lesão, problema de saúde ou medicamento">Saúde</span>' : ""}
            </div>
            <div class="ins-linha"><span>${esc(i.planoNome || "Plano")}</span><b>${moeda(i.valor)}</b></div>
            <div class="ins-linha"><span>${esc(i.objetivo || "")}</span><span>${i.diasTreino || "?"}x/semana · ${esc(i.tempoDia || "")}</span></div>
        </a>`;
    }).join("");
    $("in-vazio").hidden = lista.length > 0;
    $("in-vazio-txt").textContent = todos.length ? "Nenhuma inscrição encontrada com esse filtro." : "Nenhuma inscrição ainda. Quando alguém preencher a ficha no site, ela aparece aqui.";
}

function fotoHTML(i, classe) {
    const ok = typeof i.foto === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(i.foto);
    const ini = String(i.nome || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
    return ok ? `<img class="${classe}" src="${i.foto}" alt="Foto de ${esc(i.nome)}">` : `<span class="${classe} sem">${esc(ini)}</span>`;
}

function quando(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/* =================== Detalhe =================== */

export function abrir(uid) {
    atual = uid;
    $("in-lista-wrap").hidden = true;
    $("in-detalhe").hidden = false;
    desenharDetalhe();
    const i = estado.inscricoes.find((x) => x.id === uid);
    if (i && !i.visto) update(ref(db), { ["inscricoes/" + uid + "/visto"]: true }).catch((e) => console.error(e));
}

function desenharDetalhe() {
    const i = estado.inscricoes.find((x) => x.id === atual);
    if (!i) {
        $("in-detalhe").innerHTML = `<a href="#/inscricoes" class="btn btn-ghost"><i class="fa-solid fa-arrow-left"></i> Inscrições</a>
            <div class="empty card-empty"><i class="fa-solid fa-magnifying-glass"></i><p>Inscrição não encontrada. Ela pode ter sido excluída.</p></div>`;
        return;
    }
    const status = i.status || "pendente";
    const st = STATUS[status] || STATUS.pendente;
    const e = i.endereco || {};
    const imc = i.peso && i.altura ? (i.peso / ((i.altura / 100) ** 2)).toFixed(1).replace(".", ",") : "—";
    const zap = foneWhats(i.whatsapp);
    const resp = (r) => r?.tem ? `<span class="badge bad">Sim</span><p>${esc(r.qual)}</p>` : '<span class="badge ok">Não</span>';
    const linha = (rotulo, valor) => `<div class="in-dado"><small>${rotulo}</small><span>${valor}</span></div>`;

    let acoes = "";
    if (status === "pendente") acoes = `<button type="button" class="btn btn-primary" data-acao="aprovar"><i class="fa-solid fa-user-check"></i> Aprovar e montar 1ª ficha</button>`;
    if (status === "aprovada") acoes = `<button type="button" class="btn btn-primary" data-acao="ficha"><i class="fa-solid fa-dumbbell"></i> Montar 1ª ficha</button>`;
    if (status === "ativo") acoes = `<a class="btn btn-ghost" href="#/treinos/aluno/${esc(i.alunoId)}"><i class="fa-solid fa-dumbbell"></i> Ver fichas</a>`;

    $("in-detalhe").innerHTML = `
        <a href="#/inscricoes" class="btn btn-ghost in-voltar"><i class="fa-solid fa-arrow-left"></i> Inscrições</a>
        <div class="in-cab">
            ${fotoHTML(i, "in-foto")}
            <div class="in-cab-txt">
                <span class="badge ${st.classe}">${st.nome}</span>
                <h1>${esc(i.nome)}</h1>
                <p>${esc(i.sexo || "")} · ${i.idade || "?"} anos · inscrito em ${quando(i.criadoEm)}</p>
            </div>
            <div class="in-cab-acoes">
                ${acoes}
                ${zap ? `<a class="btn btn-ghost" href="https://wa.me/${zap}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>` : ""}
                <button type="button" class="icon-btn danger" data-acao="excluir" title="Excluir inscrição" aria-label="Excluir inscrição"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>

        <div class="in-grid">
            <section class="in-bloco">
                <h2><i class="fa-solid fa-id-card"></i> Dados pessoais</h2>
                ${linha("E-mail", esc(i.email))}
                ${linha("WhatsApp", esc(foneBR(i.whatsapp)))}
                ${linha("CPF", esc(cpfBR(i.cpf)))}
                ${linha("Endereço", esc([e.rua, e.numero].filter(Boolean).join(", ") + (e.complemento ? " — " + e.complemento : "")) + "<br>" + esc([e.bairro, (e.cidade || "") + (e.uf ? "/" + e.uf : "")].filter(Boolean).join(" · ")) + "<br>CEP " + esc(String(e.cep || "").replace(/(\d{5})(\d{3})/, "$1-$2")))}
                ${i.responsavel ? linha("Responsável legal", esc(i.responsavel.nome) + ' <span class="badge ok">Consentiu</span>') : ""}
            </section>

            <section class="in-bloco">
                <h2><i class="fa-solid fa-weight-scale"></i> Corpo e objetivo</h2>
                <div class="in-numeros">
                    <div><b>${i.peso ?? "—"}</b><small>kg</small></div>
                    <div><b>${i.altura ?? "—"}</b><small>cm</small></div>
                    <div><b>${imc}</b><small>IMC</small></div>
                    <div><b>${i.idade ?? "—"}</b><small>anos</small></div>
                </div>
                ${linha("Objetivo", esc(i.objetivo))}
                ${linha("Treino", (i.diasTreino || "?") + " dias por semana · " + esc(i.tempoDia || "") + " por dia")}
            </section>

            <section class="in-bloco${i.lesao?.tem || i.saude?.tem || i.medicamento?.tem ? " alerta" : ""}">
                <h2><i class="fa-solid fa-heart-pulse"></i> Saúde</h2>
                <div class="in-resp"><small>Lesão</small>${resp(i.lesao)}</div>
                <div class="in-resp"><small>Problema de saúde</small>${resp(i.saude)}</div>
                <div class="in-resp"><small>Medicamento</small>${resp(i.medicamento)}</div>
            </section>

            <section class="in-bloco">
                <h2><i class="fa-solid fa-receipt"></i> Plano e fatura</h2>
                ${linha("Plano", esc(i.planoNome || "—"))}
                ${linha("Valor", "<b>" + moeda(i.valor) + "</b>")}
                ${linha("Vencimento da fatura", "Todo dia " + esc(i.diaVencimento) + " · primeira em " + dataBR(i.primeiroVencimento))}
                ${linha("Termos LGPD", i.lgpd?.aceito ? `<span class="badge ok">Aceitos</span> versão ${esc(i.lgpd.versao || "")} em ${quando(i.lgpd.em)}` : '<span class="badge bad">Não aceitos</span>')}
                ${linha("Dados de saúde", i.lgpd?.saude ? '<span class="badge ok">Consentimento dado</span>' : '<span class="badge bad">Sem consentimento</span>')}
            </section>
        </div>`;
}

/* =================== Aprovar =================== */

// Meses do plano: pelo nome (trimestral/semestral/anual) ou pela duração ("6 meses", "1 ano")
export function mesesDoPlano(nome, duracao) {
    const chave = norm(nome).trim();
    if (MESES_POR_PLANO[chave]) return MESES_POR_PLANO[chave];
    const t = norm(duracao + " " + nome);
    const m = t.match(/(\d+)\s*mes/); if (m) return Number(m[1]);
    const a = t.match(/(\d+)\s*ano/); if (a) return Number(a[1]) * 12;
    if (/mensal/.test(t)) return 1;
    if (/anual/.test(t)) return 12;
    return 6;
}

function abrirAprovar(i) {
    const plano = estado.planos.find((p) => p.id === i.planoId);
    const chave = norm(i.planoNome).trim();
    $("ap-nome").textContent = i.nome;
    $("ap-plano").value = MESES_POR_PLANO[chave] ? chave : "semestral";
    $("ap-plano").dataset.meses = mesesDoPlano(i.planoNome, plano?.duracao || "");
    $("ap-plano-nome").textContent = (i.planoNome || "Plano") + " · " + moeda(i.valor);
    $("ap-inicio").value = hojeISO();
    $("ap-msg").textContent = "";
    $("aprovar-form").dataset.uid = i.id;
    recalcularVenc(true);
    abrirModal("modal-aprovar", "ap-inicio");
}

function recalcularVenc(primeiraVez) {
    const plano = $("ap-plano");
    const meses = primeiraVez === true ? Number(plano.dataset.meses) : MESES_POR_PLANO[plano.value];
    if ($("ap-inicio").value) $("ap-venc").value = somarMeses($("ap-inicio").value, meses || 6);
}

async function aprovar(ev) {
    ev.preventDefault();
    const i = estado.inscricoes.find((x) => x.id === $("aprovar-form").dataset.uid);
    if (!i) return;
    const inicio = $("ap-inicio").value, vencimento = $("ap-venc").value;
    if (!inicio || !vencimento) return ($("ap-msg").textContent = "Preencha início e vencimento.");
    if (vencimento < inicio) return ($("ap-msg").textContent = "O vencimento não pode ser antes do início.");

    const botao = $("ap-salvar");
    ocupado(botao, true);
    try {
        const email = String(i.email || "").toLowerCase();
        const chave = chaveEmail(email);
        // Se o e-mail já é de um aluno, só liga a inscrição a ele
        const existe = await get(ref(db, "emails/" + chave));
        const id = existe.exists() && existe.val().aluno ? existe.val().aluno : push(ref(db, "alunos")).key;
        const antigo = estado.alunos.find((a) => a.id === id);
        const agora = Date.now();
        const plano = $("ap-plano").value;
        const aluno = {
            ...(antigo || {}),
            nome: i.nome, email, telefone: foneBR(i.whatsapp), plano, inicio, vencimento, ativo: true,
            obs: antigo?.obs || "", uid: i.uid, inscricao: i.id,
            diaFatura: i.diaVencimento || null, primeiraFatura: i.primeiroVencimento || null, valor: i.valor || null,
            criadoEm: antigo?.criadoEm || agora, atualizadoEm: agora
        };
        delete aluno.id;
        await update(ref(db), {
            ["alunos/" + id]: aluno,
            ["emails/" + chave]: { aluno: id, ativo: true, vencimento, nome: i.nome, plano, diaFatura: i.diaVencimento || null, valor: i.valor || null },
            ["inscricoes/" + i.id + "/status"]: "aprovada",
            ["inscricoes/" + i.id + "/alunoId"]: id,
            ["inscricoes/" + i.id + "/aprovadoEm"]: agora,
            ["inscricoes/" + i.id + "/visto"]: true
        });
        fecharModal("modal-aprovar");
        aviso(i.nome.split(" ")[0] + " foi aprovado. Agora monte a primeira ficha.", "ok");
        location.hash = "#/treinos/primeira/" + id;
    } catch (e) {
        console.error(e);
        $("ap-msg").textContent = mensagemErro(e);
    } finally {
        ocupado(botao, false);
    }
}

async function excluir(i) {
    const ok = await confirmar({
        titulo: "Excluir inscrição?",
        texto: "A ficha de inscrição de " + i.nome + " será apagada (inclusive os dados de saúde)." + (i.alunoId ? " O cadastro de aluno continua em Alunos." : "") + " Essa ação não pode ser desfeita."
    });
    if (!ok) return;
    try {
        await update(ref(db), { ["inscricoes/" + i.id]: null });
        aviso("Inscrição excluída.", "ok");
        location.hash = "#/inscricoes";
    } catch (e) {
        console.error(e);
        aviso(mensagemErro(e, "Não foi possível excluir."), "error");
    }
}
