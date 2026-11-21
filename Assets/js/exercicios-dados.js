// Categorias da biblioteca de exercícios e uma lista inicial sugerida (editável no painel)

export const CATEGORIAS = [
    { id: "corrida", nome: "Corrida", icone: "fa-person-running" },
    { id: "peito", nome: "Peito", icone: "fa-dumbbell" },
    { id: "costas", nome: "Costas", icone: "fa-arrows-up-down" },
    { id: "ombro", nome: "Ombro", icone: "fa-child-reaching" },
    { id: "biceps", nome: "Bíceps", icone: "fa-hand-fist" },
    { id: "triceps", nome: "Tríceps", icone: "fa-weight-hanging" },
    { id: "trapezio", nome: "Trapézio", icone: "fa-arrows-up-to-line" },
    { id: "perna", nome: "Perna", icone: "fa-person-walking" },
    { id: "gluteo", nome: "Glúteo", icone: "fa-fire" },
    { id: "abdominal", nome: "Abdominal", icone: "fa-bullseye" },
    { id: "funcional", nome: "Funcional", icone: "fa-bolt" },
    { id: "alongamentos", nome: "Alongamentos", icone: "fa-spa" }
];

export const categoriaPorId = (id) => CATEGORIAS.find((c) => c.id === id) || { id, nome: id || "—", icone: "fa-dumbbell" };

// [nome, equipamento]
export const SUGERIDOS = {
    corrida: [["Trote leve", "Esteira ou rua"], ["Corrida contínua", "Esteira ou rua"], ["Tiro de 400 m", "Pista"], ["Fartlek", "Rua"], ["Subida em rampa", "Esteira ou ladeira"], ["Educativo: skipping", "Livre"]],
    peito: [["Supino reto com barra", "Barra e banco"], ["Supino inclinado com halteres", "Halteres e banco"], ["Crucifixo com halteres", "Halteres e banco"], ["Crossover na polia", "Polia"], ["Flexão de braço", "Peso corporal"], ["Peck deck", "Máquina"]],
    costas: [["Puxada frontal", "Polia alta"], ["Remada curvada com barra", "Barra"], ["Remada unilateral com halter", "Halter e banco"], ["Remada baixa no cabo", "Polia baixa"], ["Barra fixa", "Barra fixa"], ["Pulldown com braços estendidos", "Polia alta"]],
    ombro: [["Desenvolvimento com halteres", "Halteres"], ["Elevação lateral", "Halteres"], ["Elevação frontal", "Halteres ou anilha"], ["Crucifixo inverso", "Halteres ou máquina"], ["Desenvolvimento Arnold", "Halteres"], ["Face pull", "Polia com corda"]],
    biceps: [["Rosca direta com barra", "Barra"], ["Rosca alternada", "Halteres"], ["Rosca martelo", "Halteres"], ["Rosca Scott", "Banco Scott"], ["Rosca concentrada", "Halter"], ["Rosca no cabo", "Polia baixa"]],
    triceps: [["Tríceps corda", "Polia com corda"], ["Tríceps testa", "Barra W"], ["Tríceps francês", "Halter"], ["Mergulho no banco", "Banco"], ["Tríceps coice", "Halter"], ["Supino fechado", "Barra e banco"]],
    trapezio: [["Encolhimento com barra", "Barra"], ["Encolhimento com halteres", "Halteres"], ["Remada alta", "Barra ou polia"], ["Encolhimento no smith", "Smith"], ["Caminhada do fazendeiro", "Halteres"]],
    perna: [["Agachamento livre", "Barra"], ["Leg press 45°", "Máquina"], ["Cadeira extensora", "Máquina"], ["Mesa flexora", "Máquina"], ["Afundo", "Halteres"], ["Stiff", "Barra ou halteres"], ["Panturrilha em pé", "Máquina ou degrau"]],
    gluteo: [["Elevação pélvica (hip thrust)", "Barra e banco"], ["Glúteo na polia", "Polia baixa"], ["Abdução na máquina", "Máquina"], ["Agachamento búlgaro", "Halteres e banco"], ["Ponte de glúteo", "Peso corporal"], ["Coice no solo", "Caneleira"]],
    abdominal: [["Prancha", "Peso corporal"], ["Abdominal supra", "Colchonete"], ["Abdominal infra", "Colchonete"], ["Prancha lateral", "Peso corporal"], ["Abdominal bicicleta", "Colchonete"], ["Elevação de pernas", "Barra ou banco"]],
    funcional: [["Burpee", "Peso corporal"], ["Kettlebell swing", "Kettlebell"], ["Polichinelo", "Peso corporal"], ["Agachamento com salto", "Peso corporal"], ["Mountain climber", "Peso corporal"], ["Corda naval", "Corda naval"]],
    alongamentos: [["Alongamento de posteriores de coxa", "Colchonete"], ["Alongamento de quadríceps", "Livre"], ["Alongamento de peitoral", "Parede ou batente"], ["Alongamento de ombros", "Livre"], ["Gato e camelo", "Colchonete"], ["Alongamento de panturrilha", "Parede ou degrau"]]
};
