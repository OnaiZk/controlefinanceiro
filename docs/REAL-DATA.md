# Começar com dados reais

## Estado inicial

Em 2026-10-26, a base local foi preparada sem dados demonstrativos. Permanecem somente os dois acessos e nove categorias. Não há contas, transações, cartões, metas, orçamentos, investimentos, recorrências, conexões, sessões ou alertas fictícios. Senhas e chaves existentes foram preservadas. O arquivo anterior foi guardado cifrado em `.local/finance.enc.before-real-<data>.enc`, com leitura e comparação verificadas antes da substituição.

O seed e os exemplos permanecem disponíveis exclusivamente para testes isolados. `SEED_DEMO_DATA=false` é o padrão no setup, no exemplo de ambiente e na configuração local. O servidor também recusa sincronização `MOCK` quando essa opção está desligada, inclusive no ambiente local.

## Primeiro uso

1. Reinicie o servidor e entre com o seu acesso habitual.
2. Em Contas & conexões, cadastre a conta com saldo inicial referente ao dia anterior ao primeiro lançamento que será registrado/importado. Não cadastre saldos sugeridos por exemplos.
3. Cadastre os cartões e investimentos com dados do próprio extrato. Os valores das metas representam reservas já existentes; não criam dinheiro.
4. Importe somente arquivos reais do banco, confira as pendências e aprove os itens correspondentes. Confirme o saldo com o banco antes de passar a depender do controle.
5. No Netlify, configure `SEED_DEMO_DATA=false` e `DATABASE_MODE=convex`. O primeiro login inicializa somente os dois acessos e categorias quando a base Convex está vazia. Alterar a variável não limpa uma base Convex existente. Esta tarefa não alterou dados na nuvem.

## Backup e recuperação

**Local:** pare o servidor antes de copiar ou restaurar. Guarde `.local/finance.enc` e uma cópia de `.env.local` em local privado fora do Git. A base é cifrada: sem a `ENCRYPTION_KEY` original, não é possível recuperar o conteúdo. Para restaurar, preserve o arquivo atual como outra cópia, reponha a cópia cifrada como `.local/finance.enc` e utilize a configuração com a mesma chave. Reinicie e confira os saldos. Nunca restaure o backup de demonstração como base real.

Os testes em `tests/local-store.test.mjs` verificam backup, leitura com a mesma chave, restauração em arquivo isolado, recusa de chave incorreta e proteção contra sobrescrita do backup. Não imprimem valores, chaves ou senhas.

**Convex hospedado:** depois da publicação, use Settings → Backup & Restore no deployment de produção ou exportação integral oficial. Preserve separadamente a chave de criptografia usada pelo servidor. Valide uma restauração em deployment de teste antes de depender do procedimento. O CSV do extrato não contém a base integral e não substitui esse backup.

**Não habilite demonstração numa base real.** Para repetir testes de interface, use `pnpm test:browser`: o roteiro cria seus próprios acessos e um arquivo cifrado separado, sem utilizar as senhas pessoais.
