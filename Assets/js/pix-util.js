// Chave Pix: validação, formatação e "Pix copia e cola" (BR Code estático do Banco Central). Sem Firebase.

export const TIPOS_PIX = {
    cpf: { nome: "CPF", placeholder: "000.000.000-00" },
    cnpj: { nome: "CNPJ", placeholder: "00.000.000/0000-00" },
    email: { nome: "E-mail", placeholder: "seuemail@exemplo.com" },
    telefone: { nome: "Celular", placeholder: "(32) 99999-9999" },
    aleatoria: { nome: "Chave aleatória", placeholder: "123e4567-e89b-12d3-a456-426614174000" }
};

const digitos = (t) => String(t || "").replace(/\D/g, "");

function cpfValido(c) {
    if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
    const dv = (n) => {
        let s = 0;
        for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
        const r = (s * 10) % 11;
        return r === 10 ? 0 : r;
    };
    return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

function cnpjValido(c) {
    if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
    const dv = (n) => {
        const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        const s = pesos.reduce((t, p, i) => t + p * Number(c[i]), 0);
        const r = s % 11;
        return r < 2 ? 0 : 11 - r;
    };
    return dv(12) === Number(c[12]) && dv(13) === Number(c[13]);
}

// Devolve { ok, chave (formato que vai para o Banco Central), erro }
export function normalizarChave(tipo, valor) {
    const v = String(valor || "").trim();
    switch (tipo) {
        case "cpf": {
            const d = digitos(v);
            return cpfValido(d) ? { ok: true, chave: d } : { ok: false, erro: "CPF inválido. Confira os 11 números." };
        }
        case "cnpj": {
            const d = digitos(v);
            return cnpjValido(d) ? { ok: true, chave: d } : { ok: false, erro: "CNPJ inválido. Confira os 14 números." };
        }
        case "email": {
            const e = v.toLowerCase();
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 77 ? { ok: true, chave: e } : { ok: false, erro: "E-mail inválido." };
        }
        case "telefone": {
            let d = digitos(v);
            if (d.length === 13 && d.startsWith("55")) d = d.slice(2);
            return d.length === 11 && d[2] === "9" ? { ok: true, chave: "+55" + d } : { ok: false, erro: "Celular inválido. Use DDD + número com 9 dígitos, ex.: (32) 99852-8266." };
        }
        case "aleatoria": {
            const a = v.toLowerCase();
            return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(a) ? { ok: true, chave: a } : { ok: false, erro: "Chave aleatória inválida. Ela tem 36 caracteres, com hífens." };
        }
        default:
            return { ok: false, erro: "Escolha o tipo da chave." };
    }
}

// Como a chave aparece na tela
export function chaveFormatada(tipo, chave) {
    const d = digitos(chave);
    if (tipo === "cpf" && d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    if (tipo === "cnpj" && d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    if (tipo === "telefone") { const n = d.slice(-11); return "(" + n.slice(0, 2) + ") " + n.slice(2, 7) + "-" + n.slice(7); }
    return chave || "";
}

// Texto em maiúsculas, sem acentos e só com caracteres aceitos no BR Code
function limpar(t, max) {
    return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 ]/g, "").trim().toUpperCase().slice(0, max);
}

const campo = (id, valor) => id + String(valor.length).padStart(2, "0") + valor;

function crc16(texto) {
    let crc = 0xffff;
    for (let i = 0; i < texto.length; i++) {
        crc ^= texto.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
}

// "Pix copia e cola" estático. valorCentavos e descricao são opcionais.
export function pixCopiaECola({ chave, nome, cidade, valorCentavos = 0, descricao = "", txid = "***" }) {
    const conta = campo("00", "br.gov.bcb.pix") + campo("01", chave) + (descricao ? campo("02", limpar(descricao, 40)) : "");
    const corpo =
        campo("00", "01") +
        campo("26", conta) +
        campo("52", "0000") +
        campo("53", "986") +
        (valorCentavos > 0 ? campo("54", (valorCentavos / 100).toFixed(2)) : "") +
        campo("58", "BR") +
        campo("59", limpar(nome, 25) || "RECEBEDOR") +
        campo("60", limpar(cidade, 15) || "BRASIL") +
        campo("62", campo("05", txid)) +
        "6304";
    return corpo + crc16(corpo);
}

export const _crc16 = crc16; // usado nos testes
