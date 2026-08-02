# Prisma

O schema deste diretório define as tabelas de autenticação e as entidades
operacionais que passam a usar `User.id` textual. Nenhuma migração é executada
automaticamente pela aplicação.

Antes de criar uma migração, configure:

- `DATABASE_URL`: conexão pooled usada pelo runtime;
- `DIRECT_URL`: conexão direta usada pelo Prisma CLI.

O DDL operacional atual não está versionado neste repositório. Portanto, as
FKs das tabelas operacionais devem ser revisadas com uma cópia descartável do
schema ou em um ambiente de introspecção antes de gerar a migração final.

Revise o SQL gerado e execute a migração somente depois dessa revisão.
