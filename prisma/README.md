# Prisma

O schema deste diretório define as tabelas de autenticação e as entidades
operacionais usadas pelo runtime. Nenhuma migração é executada automaticamente
pela aplicação.

Antes de criar uma migração, configure:

- `DATABASE_URL`: conexão pooled usada pelo runtime;
- `DIRECT_URL`: conexão direta usada pelo Prisma CLI.

O DDL operacional original não está versionado neste repositório. Os modelos
operacionais foram adicionados a partir do contrato usado pela aplicação, mas
precisam ser comparados com uma cópia PostgreSQL descartável antes de gerar a
baseline final. Revise principalmente IDs, tipos `numeric`, datas `date`, FKs,
defaults, constraints e índices.

Fluxo seguro para concluir a baseline:

1. Carregue um dump somente de estrutura do banco atual em um PostgreSQL local.
2. Configure `DATABASE_URL` e `DIRECT_URL` para essa instância descartável.
3. Execute `prisma db pull --print` ou use um schema temporário para comparar a
   introspecção com `prisma/schema.prisma`.
4. Gere o SQL da baseline com `npm run prisma:migration:sql` e revise o diff.
5. Só depois de validar o SQL, crie a migration e marque-a como aplicada em um
   banco já existente com `prisma migrate resolve --applied`.

Não use SQLite para essa validação: o runtime depende de PostgreSQL/Neon e de
semânticas específicas de `Decimal`, datas e transações serializáveis.

Revise o SQL gerado e execute a migração somente depois dessa revisão.
