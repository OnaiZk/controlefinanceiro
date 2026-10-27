# Preparação para uso — 2026-10-26

Escopo autorizado pelo usuário: executar os passos 1 e 5 do diagnóstico, orientar a obtenção da deploy key e verificar os botões. Publicação Netlify e teste nos celulares serão feitos pelo usuário depois.

1. Gerar lockfile com pnpm fixado e validar instalação limpa e build, sem reutilizar dependências de outros projetos.
2. Desativar dados demonstrativos por padrão, limpar a base local preservando os dois acessos e categorias, e bloquear importações simuladas em bases reais. Preservar backup cifrado antes da limpeza.
3. Revisar ações e formulários, corrigir falhas e executar testes de interação em navegador contra uma base isolada. Não adicionar movimentos de teste à base de uso.
4. Executar lint, typecheck, Vitest e build; registrar resultados e limites. Documentar chave Convex, inicialização real e backup/restauração.

As quatro etapas concretizam o pedido atual e o roteiro que o usuário aprovou nesta conversa. Nenhuma publicação ou conexão bancária será presumida validada por testes locais.

## Resultado

Instalação limpa, lockfile e build concluídos. Demonstração removida da base local, com backup cifrado verificado e preservação dos dois acessos. Os fluxos de interface foram exercitados em Chrome numa base separada; 20 grupos aprovados. Lint, tipos (incluindo Expo) e 82 testes passaram. Evidências e limites em [QA.md](QA.md); início real e recuperação em [REAL-DATA.md](REAL-DATA.md).

O usuário ainda deve obter a chave pelo [passo a passo](DEPLOYMENT.md), publicar o backend, configurar/publicar o Netlify e testar nos dispositivos. Nenhum dado da nuvem foi apagado e nenhum serviço pago foi habilitado.
