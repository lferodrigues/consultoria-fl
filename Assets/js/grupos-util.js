// Grupamentos musculares de cada exercício e de cada dia de treino (sem Firebase).
// O exercício salvo na ficha traz "categoria" quando veio da biblioteca do painel;
// nas fichas antigas, o grupo é descoberto pelo nome, comparando com a lista padrão de exercícios.
import { CATEGORIAS, SUGERIDOS } from "./exercicios-dados.js?v=1";
import { exerciciosDe } from "./fichas-util.js?v=3";

const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const nomeCategoria = (id) => (CATEGORIAS.find((c) => c.id === id) || {}).nome || "";

const GRUPO_POR_NOME = new Map();
Object.entries(SUGERIDOS).forEach(([cat, lista]) => lista.forEach(([ex]) => GRUPO_POR_NOME.set(norm(ex), nomeCategoria(cat) || cat)));

// Biblioteca de exercícios do painel (exercicios/{id} -> { nome, categoria }): vale primeiro,
// então se o Fagner mudar o grupo de um exercício na biblioteca, a tela do aluno acompanha.
let BIBLIOTECA = new Map();
export function definirBiblioteca(lista) {
    BIBLIOTECA = new Map();
    (lista || []).forEach((x) => { if (x && x.nome && x.categoria) BIBLIOTECA.set(norm(x.nome), x.categoria); });
}

// "Peito", "Tríceps"... ("" quando não dá para saber)
export function grupoDe(e) {
    if (!e) return "";
    const daBib = BIBLIOTECA.get(norm(e.nome));
    if (daBib) return nomeCategoria(daBib) || daBib;
    if (e.grupo) return e.grupo;
    if (e.categoria) return nomeCategoria(e.categoria) || e.categoria;
    return GRUPO_POR_NOME.get(norm(e.nome)) || "";
}

// Grupos de um dia, sem repetir, na ordem em que aparecem no treino
export function gruposDoDia(dia) {
    const lista = [];
    exerciciosDe(dia).forEach((e) => { const g = grupoDe(e); if (g && !lista.includes(g)) lista.push(g); });
    return lista;
}

// "Peito, Ombro e Tríceps"
export function gruposTexto(grupos) {
    if (grupos.length <= 1) return grupos[0] || "";
    return grupos.slice(0, -1).join(", ") + " e " + grupos[grupos.length - 1];
}
