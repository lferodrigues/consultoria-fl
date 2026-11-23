// Funções das fichas de treino — usadas no painel e na área do aluno (sem Firebase)
//
// fichas/{alunoId}/{fichaId} -> {
//   nome, objetivo, nivel, inicio (AAAA-MM-DD), obs, diasPorSemana,
//   dias: { seg: { nome, exercicios: [{ nome, series, reps, carga, descanso, video, obs }] }, qua: {...} },
//   duracaoMeses (1-12, opcional), troca (AAAA-MM-DD: inicio + duracaoMeses),
//   criadoEm, atualizadoEm
// }

export const DIAS = [
    { id: "seg", letra: "S", curto: "Seg", nome: "Segunda" },
    { id: "ter", letra: "T", curto: "Ter", nome: "Terça" },
    { id: "qua", letra: "Q", curto: "Qua", nome: "Quarta" },
    { id: "qui", letra: "Q", curto: "Qui", nome: "Quinta" },
    { id: "sex", letra: "S", curto: "Sex", nome: "Sexta" },
    { id: "sab", letra: "S", curto: "Sáb", nome: "Sábado" },
    { id: "dom", letra: "D", curto: "Dom", nome: "Domingo" }
];

export const diaPorId = (id) => DIAS.find((d) => d.id === id) || { id, letra: "?", curto: id, nome: id };

// Sugestão de dias para cada quantidade de treinos na semana
export const PADRAO_DIAS = {
    1: ["seg"], 2: ["seg", "qui"], 3: ["seg", "qua", "sex"], 4: ["seg", "ter", "qui", "sex"],
    5: ["seg", "ter", "qua", "qui", "sex"], 6: ["seg", "ter", "qua", "qui", "sex", "sab"], 7: DIAS.map((d) => d.id)
};

// Dia da semana de hoje no formato "seg", "ter"...
export function diaDeHoje(data = new Date()) {
    return ["dom", "seg", "ter", "qua", "qui", "sex", "sab"][data.getDay()];
}

// Dias da ficha na ordem da semana
export function diasDaFicha(ficha) {
    return DIAS.filter((d) => ficha?.dias && ficha.dias[d.id]).map((d) => ({ ...d, ...ficha.dias[d.id] }));
}

export function exerciciosDe(dia) {
    const e = dia?.exercicios;
    return (Array.isArray(e) ? e.filter(Boolean) : Object.values(e || {})).filter((x) => x && x.nome);
}

// "4 × 8 · 90s"
export function resumoExercicio(e) {
    const sr = e.series && e.reps ? `${e.series} × ${e.reps}` : e.series ? `${e.series} séries` : e.reps ? `${e.reps} reps` : "";
    return [sr, e.descanso].filter(Boolean).join(" · ");
}

// Ficha atual = a mais recente (pela data de início e, no empate, pela criação)
export function ordenarFichas(lista) {
    return [...lista].sort((a, b) => (b.inicio || "").localeCompare(a.inicio || "") || (b.criadoEm || 0) - (a.criadoEm || 0));
}
export const fichaAtual = (lista) => ordenarFichas(lista)[0] || null;

// ID de vídeo do YouTube a partir de qualquer link comum (watch, youtu.be, shorts, embed)
export function idYoutube(url) {
    const u = String(url || "").trim();
    const m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i);
    return m ? m[1] : "";
}

export const ESFORCO = {
    minimo: { nome: "Mínimo", classe: "ok" },
    medio: { nome: "Médio", classe: "warn" },
    alto: { nome: "Alto", classe: "bad" }
};

/* ---------- Validade da ficha (troca) ---------- */
export const AVISO_TROCA_DIAS = 5; // avisa o personal e o aluno a partir de 5 dias antes

// Data da troca: a salva na ficha ou início + duração
export function trocaDaFicha(f) {
    if (!f) return "";
    if (f.troca) return f.troca;
    const meses = Number(f.duracaoMeses);
    if (!f.inicio || !meses) return "";
    const [a, m, d] = f.inicio.split("-").map(Number);
    const alvo = new Date(a, m - 1 + meses, 1);
    alvo.setDate(Math.min(d, new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate()));
    return alvo.getFullYear() + "-" + String(alvo.getMonth() + 1).padStart(2, "0") + "-" + String(alvo.getDate()).padStart(2, "0");
}

// Dias que faltam para a troca (negativo = já passou); null = ficha sem prazo
export function diasParaTroca(f, hojeIso) {
    const t = trocaDaFicha(f);
    if (!t) return null;
    const [y1, m1, d1] = hojeIso.split("-").map(Number);
    const [y2, m2, d2] = t.split("-").map(Number);
    return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

// "vence em 3 dias" / "vence hoje" / "venceu há 2 dias"
export function textoTroca(dias) {
    if (dias === null) return "";
    if (dias > 1) return "vence em " + dias + " dias";
    if (dias === 1) return "vence amanhã";
    if (dias === 0) return "vence hoje";
    return "venceu há " + -dias + (dias === -1 ? " dia" : " dias");
}

/* ---------- Dias escolhidos para treinar (agenda) ----------
   agendas/{alunoId} -> { dias: "seg,qua,sex", por: "aluno" | "personal", atualizadoEm }
   O aluno e/ou o personal escolhem EM QUAIS dias da semana o aluno treina. Os treinos da ficha
   (na ordem da semana: 1º, 2º, 3º...) passam para os dias escolhidos, na mesma ordem.
   Só vale quando a quantidade de dias escolhidos é igual à quantidade de treinos da ficha. */
export function lerAgenda(agenda) {
    const ids = String(agenda?.dias ?? agenda ?? "").split(",").map((t) => t.trim()).filter(Boolean);
    const unicos = [...new Set(ids)].filter((id) => DIAS.some((d) => d.id === id));
    return DIAS.map((d) => d.id).filter((id) => unicos.includes(id)); // na ordem da semana
}
export const agendaTexto = (ids) => ids.map((id) => diaPorId(id).curto).join(" · ");

export function agendaServe(ficha, agenda) {
    const ids = lerAgenda(agenda);
    return !!ficha && ids.length > 0 && ids.length === diasDaFicha(ficha).length;
}

// Ficha com os treinos movidos para os dias escolhidos (sem mudar nada no banco)
export function aplicarAgenda(ficha, agenda) {
    if (!agendaServe(ficha, agenda)) return ficha;
    const treinos = diasDaFicha(ficha);
    const ids = lerAgenda(agenda);
    const dias = {};
    ids.forEach((id, i) => { dias[id] = ficha.dias[treinos[i].id]; });
    return { ...ficha, dias, agenda: ids.join(",") };
}
