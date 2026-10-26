# Verificação da entrega

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

Abra `http://localhost:3000` com o servidor iniciado e use dados demonstrativos. Entre nos dois perfis; alterne as cinco áreas e os três escopos. Teste lançamento, edição, pendência, transferência, parcela, pagamento de fatura, orçamento, rateio/acerto, meta e avaliação de investimento. Importe `examples/extrato-demo.csv` duas vezes, revise e confirme o saldo. Faça o mesmo no celular após publicar, verificando contraste, tema escuro, ocultação de valores, tabelas, modais, exportação e retorno de erro. Não use o estado demonstrativo como base real.

O arquivo `artifacts/entre-contas-source.zip` é a entrega de fontes; `.env.local`, banco local, dependências e artefatos de build são excluídos. Ele não é uma publicação funcional no Netlify Drop.
