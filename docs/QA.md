# Verificação da entrega

## Atualização — 2026-10-26

Esta seção substitui as limitações antigas sobre ausência de lockfile, dependências emprestadas, falta de inspeção no navegador e exclusão do mobile da checagem de tipos. Os resultados de 2026-10-25 permanecem abaixo como histórico.

| Verificação | Resultado |
| --- | --- |
| Instalação limpa | pnpm 10.30.0, `pnpm-lock.yaml`, `install --frozen-lockfile` aprovado em cópia sem dependências prévias; 619 pacotes instalados. |
| Diretório de uso | Dependências antigas preservadas em `.local/node_modules-before-pnpm-20261026`; nova instalação pelo mesmo lockfile, sem referências a outros projetos. |
| ESLint | `pnpm lint`, aprovado. |
| TypeScript | `pnpm typecheck`, aprovado; agora inclui uma checagem própria de `apps/mobile`. |
| Vitest | `pnpm test`: 85 testes aprovados em 11 arquivos após a correção do deploy. Inclui índices Convex, certificados do CLI, bloqueio de mock em base real e backup/restauração cifrados. |
| Convex Cloud (Development) | `npm run convex:deploy` aprovado em `neat-perch-479`: schema validado, índices criados e funções publicadas. Leitura autenticada de `finance:execute` aprovada e leitura sem segredo correto recusada; nenhum registro criado nessa verificação. |
| Produção | `pnpm build`, compilação Next.js e geração de rotas aprovadas com as dependências limpas. |
| Chrome real | `test:browser`: 20 grupos de fluxos aprovados, sem exceções de JavaScript; larguras 1440 e 390 px. [Relatório sanitizado](qa/browser-results-2026-10-26.json). |
| Base local | Dados demonstrativos removidos, acessos e nove categorias preservados, sem registros financeiros. Backup cifrado verificado antes da substituição. |

Os cliques reais exercitaram login dos dois perfis, erro de senha, mostrar/ocultar senha, modos e clique repetido, meses/gráfico por teclado, tema, privacidade, erro de consulta e nova tentativa, abrir/fechar/cancelar/Escape, contas e edição, pendências/realização, edição/categoria/regra, receitas/transferências/despesas compartilhadas, filtros, download CSV, importação/reimportação/aprovação/rejeição/reabertura, estorno/exclusão e cancelamento da confirmação, orçamento, recorrência/pagamento, janela de vencimentos, dispensar alerta, acerto do casal via formulário, meta/reserva, investimento/posição/CDI, cartão/compra/fatura/parcelamento, configuração/erro seguro/desconexão bancária, navegação móvel, logout e isolamento KET. O relatório descreve os grupos; isso não significa cobertura de todas as combinações ou garantia de ausência de defeitos.

Correções verificadas: clicar no modo já selecionado deixava a página presa no carregamento; receita compartilhada enviava pagador vazio; o mock local podia inserir movimentos em base real; indicador de desenvolvimento interceptava o botão Início na largura móvel; aviso anterior podia permanecer após troca de perfil. A tipagem genérica do WebView foi corrigida para as dependências instaladas. As alterações anteriores do cliente Expo foram preservadas.

As capturas de página vazia e o relatório bruto ficam na pasta ignorada `.local/clean-install/.local/browser-<id>/`. A inspeção das capturas confirmou estado vazio, sem valores fictícios e sem transbordamento horizontal na largura testada. Os movimentos do roteiro ficam exclusivamente na sua própria base cifrada de teste. Sessões e auditoria de acessos legítimos posteriores à limpeza não são dados financeiros fictícios.

**Ainda não comprovado:** deployment Production do Convex, fluxos financeiros completos na nuvem, Netlify, integração bancária real, PWA instalada por HTTPS, execução em celular físico/Expo Go e recuperação de backup hospedado. A publicação e a fronteira de leitura do Convex foram verificadas somente no deployment Development indicado acima. O teste do botão de consulta bancária cobre a apresentação de erro seguro, sem conectar bancos reais. O consentimento e a sincronização real continuam pendentes.

## Histórico — 2026-10-25

Data: 2026-10-25. Ambiente Windows, Node 24.16.0. Esta página distingue testes executados de integrações ainda pendentes.

## Executado com sucesso

| Verificação        | Resultado                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint             | `npm run lint`, sem avisos/erros.                                                                                                                       |
| TypeScript estrito | `npm run typecheck`, sem erros. Inclui web, API, shared, funções Convex e testes; não inclui o cliente Expo sem dependências instaladas.                |
| Vitest             | `npm test`: 77 testes aprovados em 8 arquivos.                                                                                                          |
| Build de produção  | `npm run build`: Next.js 16.2.9 compilado, verificação TypeScript e geração de rotas concluídas.                                                        |
| API HTTP local     | `scripts/smoke.mjs`: 22 verificações aprovadas com os dois logins reais configurados, sem imprimir senhas/tokens.                                       |
| Entrada web        | HTTP 200 no documento inicial; componentes de gráficos também renderizados no servidor em testes. Isso não equivale a uma inspeção visual no navegador. |

Cobertura de regras: centavos e rateios com resto; parcelas; transferências e faturas sem dupla contagem; cashback e estorno; acertos parciais; recorrências; datas em meses curtos; pendências, rejeição e reabertura; arquivos OFX/CSV e deduplicação; categorias aprendidas; agentes; projeção CDI por ponto fixo; AES-GCM autenticado; Argon2id; JWT revogável; persistência local cifrada e concorrência; ponte Convex recusando acesso sem segredo.

O smoke HTTP verificou autenticação de CAS/KET, cookie sem JWT no corpo, rejeição de origem externa, isolamento individual, leitura consolidada autorizada, recusa de identidade injetada, recusa de escrita nos dados pessoais do outro, ausência de hashes/segredos na resposta, pendência sem efeito no saldo, realização em centavos, importação em revisão, reimportação sem duplicação, aprovação concorrente única e logout revogável. Os lançamentos criados pelo smoke são removidos ao encerrar; a auditoria é preservada.

## Restrições do ambiente

- `pnpm lint`, `pnpm typecheck` e `pnpm test` foram tentados. pnpm não está no PATH. Foram executados com sucesso os mesmos scripts via npm.
- Instalação limpa pela rede não foi concluída: o proxy configurado retorna ECONNREFUSED em 127.0.0.1:9. Dependências já instaladas em outros projetos foram referenciadas apenas no ambiente ignorado `node_modules`; não foram alteradas nem incluídas no pacote.
- Não há lockfile de instalação limpa nesta entrega. Instalar com o gerenciador escolhido em ambiente com rede e versionar seu lockfile é uma etapa pendente antes de garantir builds reproduzíveis.
- Tentativa de Chrome headless não disponibilizou a porta de automação. Não houve inspeção visual/interação real em navegador nem celular. Os quatro testes de UI são renderização React no servidor.
- Docker não está disponível. O compose self-hosted não foi executado.
- Leitura remota GitHub foi bloqueada pelo proxy. Configurar `origin` também foi recusado porque `.git/config` está sem permissão de escrita neste ambiente. Não houve commit nem push; não foi comprovada a visibilidade/conteúdo do repositório informado.

## Pendente em serviços/dispositivos reais

1. **Convex Cloud:** URL SDK `.cloud` e endpoint HTTP `.site` recebidos. Deploy key ainda não configurada; funções/tabelas não foram publicadas nem exercitadas nesse projeto. Os testes locais da fronteira não comprovam o runtime hospedado.
2. **Netlify:** nenhum site publicado nesta sessão. Configurar variáveis de servidor e Node 24 conforme `DEPLOYMENT.md`, publicar e repetir os fluxos com o computador desligado.
3. **Meu Pluggy:** adapter implementado, porém sem credenciais/consentimento reais para validar sincronização. Conta e saldo observado ficam separados por origem; contas de crédito não são sincronizadas automaticamente nesta versão, com aviso explícito e alternativa de fatura por arquivo/manual.
4. **PWA:** manifest, ícones e shell offline preparados. Instalação, atualização, acessibilidade e comportamento nos navegadores móveis precisam de teste HTTPS real.
5. **Expo Go:** cliente WebView implementado; dependências nativas e execução em dispositivo não foram validadas. Reutiliza os fluxos da web. Metro continua sendo desenvolvimento; a PWA é o caminho de uso hospedado sem PC nesta entrega.

## Roteiro de teste do usuário

Para repetir os testes fictícios, use `pnpm test:browser`, que cria base e acessos isolados. Não importe os exemplos na base pessoal. Depois de publicar com `SEED_DEMO_DATA=false`, siga [REAL-DATA.md](REAL-DATA.md) e teste no celular os dois perfis, cinco áreas, três escopos, contraste, tema escuro, ocultação de valores, tabelas, modais, exportação e retorno de erro. Confira saldos com o banco e repita com o computador desligado.

O arquivo `artifacts/entre-contas-source.zip` é a entrega de fontes; `.env.local`, banco local, dependências e artefatos de build são excluídos. Ele não é uma publicação funcional no Netlify Drop.
