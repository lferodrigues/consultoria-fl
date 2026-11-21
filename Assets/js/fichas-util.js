// Funções das fichas de treino — usadas no painel e na área do aluno (sem Firebase)
//
// fichas/{alunoId}/{fichaId} -> {
//   nome, objetivo, nivel, inicio (AAAA-MM-DD), obs, diasPorSemana,
//   dias: { seg: { nome, exercicios: [{ nome, series, reps, carga, descanso, video, obs }] }, qua: {...} },
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
