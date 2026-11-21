// Área do Aluno — só entra quem está logado, cadastrado, ativo e no prazo
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";
import { auth, db, ehAdmin, chaveEmail, hojeISO, PAGINAS } from "./firebase-app.js?v=2";
import { situacao, diasEntre, dataBR } from "./alunos-util.js?v=1";
import { mostrarAcessoNegado } from "./acesso-negado.js?v=1";

const $ = (id) => document.getElementById(id);
let saindo = false;

onAuthStateChanged(auth, async (user) => {
    if (saindo) return;

    if (!user) {
        mostrarAcessoNegado({ texto: "Faça o seu login para entrar." });
        return;
    }
    if (ehAdmin(user)) {
        window.location.replace(PAGINAS.admin);
        return;
    }

    try {
        const snap = await get(ref(db, "emails/" + chaveEmail(user.email)));
        const cadastro = snap.val();
        const hoje = hojeISO();

        if (!cadastro) {
            mostrarAcessoNegado({
                texto: "O e-mail " + (user.email || "") + " não está cadastrado. Escolha um plano para começar.",
                botao: "Ver planos",
                link: PAGINAS.planos
            });
            return;
        }
        if (cadastro.ativo === false) {
            mostrarAcessoNegado({ texto: "Seu acesso está desativado. Fale com o personal para liberar.", botao: "Voltar ao login" });
            return;
        }
        if (cadastro.vencimento && cadastro.vencimento < hoje) {
            mostrarAcessoNegado({ texto: "Seu plano venceu. Fale com o personal para renovar.", botao: "Ver planos", link: PAGINAS.planos });
            return;
        }

        // Liberado: preenche a tela
        const nome = cadastro.nome || user.displayName || user.email;
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
