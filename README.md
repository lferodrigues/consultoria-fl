# Consultoria Fagner Lage

Site da consultoria online do personal trainer **Fagner Lage**: página de apresentação e planos, ficha de inscrição, área do aluno e painel do administrador.

🌐 **Site:** [personalfagnerlage.com.br](https://personalfagnerlage.com.br)

---

## Visão geral

| Página | Para quem | O que faz |
|---|---|---|
| `index.html` | Público | Apresentação da consultoria, planos e depoimentos publicados |
| `planos.html` | Público | Todos os planos, com descrição e benefícios |
| `cadastro.html` | Novo aluno | Ficha de inscrição em 5 etapas (plano e conta → dados → saúde → treino e fatura → termos LGPD) |
| `login.html` | Aluno e administrador | Login por e-mail e senha, Google ou Apple |
| `area-do-aluno.html` | Aluno ativo | Treino do dia, progresso, e-books, depoimentos e faturas (Pix) |
| `painel-admin.html` | Administrador | Inscrições, alunos, treinos, exercícios, biblioteca, financeiro, planos e depoimentos |

A área do aluno e o painel funcionam como **SPA**: as telas mudam pela rota (`#/inicio`, `#/treino`, `#/alunos`…) sem recarregar a página.

## Tecnologias

- **HTML, CSS e JavaScript puro** (módulos ES, sem etapa de build)
- **Firebase Authentication** — login por e-mail/senha, Google e Apple
- **Firebase Realtime Database** — todos os dados do site, protegidos por `database.rules.json`
- **Vercel** — hospedagem, URLs limpas e cabeçalhos de segurança (`vercel.json`)
- **Font Awesome** — ícones

## Fluxo do aluno

1. Escolhe um plano no site → abre `cadastro.html?plano=<id>`.
2. Preenche a ficha de inscrição; ela é salva em `inscricoes/{uid}` com status **pendente**, e o WhatsApp do personal é aberto com o link da inscrição.
3. No painel, o personal **aprova** a inscrição → o aluno é criado e a primeira ficha de treino é aberta.
4. Ao salvar a primeira ficha, a inscrição passa a **ativo** e a área do aluno é liberada.

### Para onde cada pessoa vai depois do login

| Situação | Destino |
|---|---|
| E-mail do administrador | Painel do administrador |
| Aluno cadastrado, ativo e no prazo | Área do aluno |
| Inscrição enviada, aguardando a 1ª ficha | Área do aluno (tela de espera) |
| Cadastro desativado ou plano vencido | Fica no login, com aviso |
| E-mail sem cadastro (inclusive quem entra com Google pela 1ª vez) | Página de planos |

## Estrutura

```
.
├── index.html, planos.html, cadastro.html, login.html
├── area-do-aluno.html, painel-admin.html
├── Assets/
│   ├── css/
│   ├── img/
│   └── js/
│       ├── firebase-app.js      # configuração única do Firebase, e-mail do admin e rotas
│       ├── login-aluno.js       # login e redirecionamento
│       ├── inscricao.js         # ficha de inscrição
│       ├── area-aluno.js        # área do aluno (SPA)
│       ├── painel-admin.js      # painel (SPA): acesso, dados em tempo real e rotas
│       ├── admin-*.js           # uma tela do painel por arquivo
│       ├── planos-card.js       # card de plano (site e prévia do painel)
│       ├── planos-site.js       # planos do banco no index e em planos.html
│       ├── depoimentos-site.js  # depoimentos publicados no index
│       └── *-util.js            # funções compartilhadas (datas, moeda, fichas, Pix)
├── database.rules.json          # regras de segurança do Realtime Database
└── vercel.json                  # configuração da Vercel
```

## Banco de dados (Realtime Database)

| Nó | Conteúdo | Quem lê |
|---|---|---|
| `planos` | Planos exibidos no site | Público |
| `depoimentosPublicos` | Depoimentos aprovados para o site | Público |
| `inscricoes/{uid}` | Fichas de inscrição | Admin e o próprio inscrito |
| `alunos`, `emails` | Cadastro dos alunos e índice por e-mail | Admin (o aluno lê só o próprio e-mail) |
| `fichas/{alunoId}` | Fichas de treino | Admin e o próprio aluno |
| `feedbacks`, `depoimentos` | Registros enviados pelos alunos | Admin e o próprio aluno |
| `biblioteca`, `arquivos` | E-books e materiais | Admin e alunos ativos |
| `exercicios`, `financeiro` | Biblioteca de exercícios e lançamentos | Somente admin |
| `config/pix` | Chave Pix para as faturas | Admin e alunos ativos |

> O Realtime Database não aceita `.` nas chaves; por isso os e-mails são gravados com `,` no lugar do ponto (função `chaveEmail`).

## Configuração

- **Firebase:** os dados do projeto ficam em `Assets/js/firebase-app.js`. As regras de `database.rules.json` devem ser publicadas no console do Firebase sempre que forem alteradas.
- **Administrador:** o e-mail do admin está em `firebase-app.js` (`ADMIN_EMAIL`) e também em `database.rules.json`. Se mudar em um, mude no outro.
- **Domínios autorizados:** o domínio do site precisa estar em *Authentication → Settings → Authorized domains* no Firebase, senão o login com Google/Apple falha.
- **Cache dos scripts:** os imports usam `?v=N`. Ao alterar um módulo, aumente a versão onde ele é importado para que os navegadores baixem a nova.

## Rodando localmente

Como os scripts são módulos ES, abra o site por um servidor local (não pelo `file://`):

```bash
npx serve .
# ou
python3 -m http.server 8000
```

Para o login funcionar, `localhost` deve estar entre os domínios autorizados do Firebase.

## Deploy

O deploy é feito pela **Vercel** a partir da branch `main`. O `vercel.json` ativa URLs sem `.html`, aplica cabeçalhos de segurança em todas as páginas e marca login, área do aluno e painel como `noindex` e sem cache.

---

© Consultoria Fagner Lage. Todos os direitos reservados.