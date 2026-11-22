# consultoria-fl

## App do aluno (SPA)

Login, ficha de inscrição e área do aluno funcionam como um app só: trocar de tela não recarrega a página
(o Firebase e a verificação de segurança continuam carregados).

- As telas ficam em `aluno-spa/vistas/` (`login.html`, `cadastro.html`, `area-do-aluno.html`).
- `login.html`, `cadastro.html`, `cadastrolivre.html` e `area-do-aluno.html` na raiz são **gerados**. Depois de editar uma tela, rode:
  `node aluno-spa/gerar.mjs` (ou `npm run gerar:aluno`).
- A troca de telas fica em `Assets/js/spa-aluno.js`. Ao mudar o `?v=` de um módulo ou CSS de tela, mude também em `aluno-spa/gerar.mjs`.

## Tarefa diária (Vercel)

`api/diario.js` roda todo dia às 8h (horário de Brasília, configurado em `vercel.json > crons`):
apaga as fotos de avaliação com mais de 15 dias e manda para `fagnerlage10@gmail.com` um resumo dos avisos do painel
(fichas para trocar, fotos para avaliar, inscrições, planos vencendo, feedbacks e depoimentos). Variáveis na Vercel:
`FIREBASE_SERVICE_ACCOUNT`, `RESEND_API_KEY` (resend.com), opcionais `EMAIL_AVISOS`, `EMAIL_REMETENTE` e `CRON_SECRET`.
