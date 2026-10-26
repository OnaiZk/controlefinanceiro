# Modelo implementado no Convex

Atualizado em 2026-10-25. O contrato validado está em `packages/shared/src/index.ts`; as tabelas e os índices estão em `convex/schema.ts`. Valores monetários são inteiros em centavos, com limites validados por Zod na entrada e antes da persistência. Percentuais usam pontos-base inteiros.

## Tabelas principais

| Tabela          | Conteúdo e invariantes                                                                                                                                                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`         | Apenas CAS/Cassiano e KET/Kethellen; email, hash PHC Argon2id e credenciais Pluggy opcionais cifradas com AES-256-GCM. Sem cadastro público.                                                                                                                      |
| `accounts`      | Titular CAS, KET ou COUPLE; instituição, tipo, saldo inicial, estado de arquivamento e ID externo opcional. O saldo contábil é calculado com os lançamentos aprovados. `bankBalanceCents` e `bankBalanceAt` registram separadamente a última observação bancária. |
| `cards`         | Titular, nome, últimos quatro dígitos, limite em centavos, fechamento/vencimento entre 1 e 31 e cashback em pontos-base. Datas são ajustadas ao último dia de meses curtos.                                                                                       |
| `categories`    | Código tipográfico, nome, identificador SVG, receita/despesa e essencialidade. Nenhum emoji.                                                                                                                                                                      |
| `categoryRules` | Contexto do titular/origem, estabelecimento normalizado, categoria aprendida, escopo sugerido e contagem. Correções confirmadas alimentam o Sherlock.                                                                                                             |
| `transactions`  | Escopo econômico, pagador CAS/KET, conta ou cartão, categoria, tipo, status, centavos, descrição, data civil e origem. Inclui destino de transferência, parcelas, vínculo de estorno/pagamento de fatura, ID externo contextualizado e rateio exato opcional.     |
| `budgets`       | Escopo, categoria, competência YYYY-MM e teto em centavos. Atualização substitui a configuração da mesma competência/categoria.                                                                                                                                   |
| `investments`   | Escopo, modalidade, principal e saldo observado em centavos, participação no CDI em pontos-base, informação de FGC e data de avaliação. Projeção não é rendimento realizado.                                                                                      |
| `agentAlerts`   | Agente, escopo, severidade, título, mensagem, competência, lançamento relacionado opcional e dispensa. Alertas nunca executam pagamentos.                                                                                                                         |
| `auditLogs`     | Ator, ação, referência opaca de entidade, resultado e horário. Sem valores financeiros, descrições, senhas ou tokens.                                                                                                                                             |

## Tabelas auxiliares

| Tabela            | Finalidade                                                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `goals`           | Metas e reservas com alvo, valor reservado e prazo; o valor reservado não é somado novamente ao patrimônio.                                   |
| `recurringBills`  | Contas recorrentes com dia de vencimento, categoria e estado ativo. Pagamentos possuem identificador por competência para impedir duplicação. |
| `settlements`     | Acertos efetivados entre CAS/KET por competência. Liquidações parciais reduzem o saldo devedor sem criar nova despesa.                        |
| `bankConnections` | Titular autenticado, provedor, itemIds autorizados e última sincronização. Credenciais ficam cifradas no perfil correspondente.               |
| `sessions`        | ID de sessão, titular, digest do JWT e expiração. Logout revoga a sessão; o token completo não é persistido.                                  |
| `loginThrottles`  | Chave derivada do email, tentativas e janela temporal para limitar autenticações.                                                             |

## Identidade, autorização e consistência

- O campo `id` é um identificador lógico da aplicação; `_id` é gerado pelo Convex. CAS/KET são slugs fechados, não IDs arbitrários fornecidos pelo navegador.
- O navegador acessa o servidor Next.js. O servidor verifica JWT e sessão, deriva o ator e chama a ponte privada `finance:execute`. `BACKEND_BRIDGE_SECRET` existe apenas nos servidores e protege toda operação Convex.
- Individual permite somente dados próprios; Casal permite dados compartilhados; Consolidado inclui leitura dos dois perfis conforme solicitado. Escrita pessoal do outro perfil continua bloqueada.
- A ponte valida o envelope Zod, executa a alteração atomicamente em uma mutation e persiste apenas documentos alterados. Nenhuma tabela possui endpoint público de consulta sem essa ponte.
- Importados começam em NEEDS_REVIEW. Aprovação é idempotente; rejeição não altera saldo. IDs bancários são contextualizados por conta e fonte. Possíveis repetições entre fontes diferentes geram suspeita, sem exclusão automática.
- Esta implementação pessoal carrega o estado limitado em uma mutation. Há proteção de 20.000 documentos por tabela; ela não substitui paginação/arquitetura apropriada para um produto público. Limites de leitura, execução e armazenamento do plano gratuito também se aplicam.

O adaptador local usa o mesmo contrato e um arquivo inteiro cifrado em `.local/finance.enc`; produção exige Convex e recusa fallback para arquivo, memória ou mock.
