# Agro-Gestão

O Agro-Gestão é uma aplicação web para apoiar a gestão de propriedades agrícolas. O projeto concentra informações de culturas, custos de produção, registros de campo e movimentações financeiras em um único sistema.

> **Status:** projeto em desenvolvimento.

## Funcionalidades atuais

- Landing page institucional do Agro-Gestão.
- Cadastro e login com e-mail e senha.
- Login opcional com Google por meio do Auth.js.
- Dashboard com visão geral da propriedade e das culturas.
- Cadastro e acompanhamento de culturas.
- Custo de produção por cultura.
- Registros de campo.
- Controle financeiro e demonstrativo de resultados.
- Upload e consulta de arquivos da propriedade.
- Recursos de apoio por IA para custos e projeções, quando o Gemini está configurado.

## Tecnologias

- Next.js 16.2.6 com App Router e Server Actions.
- React 19 e TypeScript.
- Tailwind CSS 4.
- Auth.js/NextAuth para autenticação.
- Neon Postgres para persistência de dados.
- Vercel Blob para armazenamento de arquivos.
- Google Generative AI para recursos de IA.
- GSAP e Lenis para animações e rolagem da interface.

## Requisitos

- Node.js `>=20.9.0`.
- npm.
- Uma base PostgreSQL compatível com o Neon.
- Credenciais OAuth do Google, caso o login com Google seja utilizado.
- Uma chave da API Gemini, caso os recursos de IA sejam utilizados.

## Configuração local

Clone o repositório e instale as dependências:

```bash
git clone https://github.com/g-tavares14/agro-gestao.git
cd agro-gestao
npm ci
```

Crie um arquivo `.env.local` na raiz do projeto. Nunca versione credenciais reais:

```env
DATABASE_URL=postgresql://usuario:senha@host/banco
AUTH_SECRET=gere-um-segredo-longo-e-aleatorio
AUTH_GOOGLE_ID=seu-client-id-do-google
AUTH_GOOGLE_SECRET=seu-client-secret-do-google
GEMINI_API_KEY=sua-chave-da-api-gemini
```

As variáveis `AUTH_GOOGLE_ID` e `AUTH_GOOGLE_SECRET` são necessárias para o login com Google. `GEMINI_API_KEY` é necessária apenas para as funções que usam IA.

Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

A aplicação ficará disponível em [http://localhost:3000](http://localhost:3000).

O banco precisa estar configurado antes de usar cadastro, autenticação e funcionalidades operacionais. Esta cópia do projeto não contém um arquivo de schema ou migrations versionado; a estrutura esperada do banco deve ser tratada separadamente.

## Comandos disponíveis

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento. |
| `npm run build` | Gera a build de produção. |
| `npm run start` | Inicia a aplicação em modo de produção após o build. |
| `npm run lint` | Executa o ESLint. |

## Scripts de banco e demonstração

Os scripts da pasta `scripts/` usam `DATABASE_URL` e devem ser executados somente em um banco apropriado.

```bash
node --env-file=.env scripts/seed-demo.mjs <email-do-usuario>
node --env-file=.env scripts/seed-lancamentos.mjs <email> <cultura> [<cultura>...]
node --env-file=.env scripts/seed-demo-dre.mjs
node --env-file=.env scripts/add-lancamentos-grupo.mjs
node --env-file=.env scripts/rename-custos-operacionais.mjs
node --env-file=.env scripts/wipe-user.mjs <email>
```

`wipe-user.mjs` possui uma opção `--yes` para confirmar a exclusão dos dados operacionais de um usuário. Use-a somente quando a remoção for intencional.

## Estrutura principal

- `app/page.tsx`: landing page pública.
- `app/login/` e `app/cadastro/`: autenticação e cadastro.
- `app/(app)/dashboard/`: dashboard principal.
- `app/(app)/[cultura]/`: funcionalidades específicas de cada cultura.
- `app/(app)/actions/`: Server Actions de negócio.
- `app/api/`: endpoints de autenticação e arquivos.
- `app/lib/`: acesso ao banco, sessão, arquivos e utilitários.
- `scripts/`: scripts auxiliares para dados e manutenção.

## Estado atual e próximos passos

O projeto já possui o fluxo principal da aplicação e integrações com banco, autenticação, armazenamento de arquivos e IA. Ainda é necessário consolidar o schema/migrations do banco, ampliar a documentação operacional e definir uma rotina automatizada de validação antes de considerar o projeto pronto para produção.
