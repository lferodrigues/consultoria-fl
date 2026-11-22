// Configuração única do Firebase — usada pelo login e pelo painel do administrador
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { ativarAppCheck } from "./app-check.js?v=1";

export const firebaseConfig = {
    apiKey: "AIzaSyALkfMd9sTok0tuFgRmDkqgK6NCh4kAGr0",
    authDomain: "flconsultoria.firebaseapp.com",
    databaseURL: "https://flconsultoria-default-rtdb.firebaseio.com",
    projectId: "flconsultoria",
    storageBucket: "flconsultoria.firebasestorage.app",
    messagingSenderId: "907260382682",
    appId: "1:907260382682:web:b456647534f5b58df444e3",
    measurementId: "G-7GPBGL18YG"
};

export const app = initializeApp(firebaseConfig);
// App Check (Turnstile + /api/app-check) nas páginas que usam login; precisa vir antes do Auth e do banco
if (document.querySelector('meta[name="fl-app-check"]')) ativarAppCheck(app);
export const auth = getAuth(app);
auth.languageCode = "pt";
export const db = getDatabase(app);

// E-mail do administrador. Se mudar aqui, mude também no database.rules.json.
export const ADMIN_EMAIL = "contato@fagnerlage.com.br";

export const PAGINAS = {
    login: "./login.html",
    admin: "./painel-admin.html",
    planos: "./planos.html",
    // Página da área do aluno (deixe "" para o login mostrar só a mensagem de boas-vindas)
    aluno: "./area-do-aluno.html"
};

export function ehAdmin(user) {
    return !!user && (user.email || "").toLowerCase() === ADMIN_EMAIL;
}

// O Realtime Database não aceita "." nas chaves; trocamos por ","
// (a mesma conversão está nas regras do banco).
export function chaveEmail(email) {
    return (email || "").trim().toLowerCase().replace(/\./g, ",");
}

// Data de hoje no formato AAAA-MM-DD (horário local)
export function hojeISO() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
