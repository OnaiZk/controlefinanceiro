# Revisão do plano de controle financeiro

**Registro histórico da análise inicial.** O usuário autorizou posteriormente a implementação completa. O código foi criado; o estado atual e os limites de validação estão em [QA.md](QA.md), [IMPLEMENTATION.md](IMPLEMENTATION.md) e [DEPLOYMENT.md](DEPLOYMENT.md). Afirmações de ausência de código abaixo descrevem a leitura anterior à implementação.

Data: 2026-10-25. Escopo: análise documental e consulta a fontes públicas oficiais; nenhuma implementação iniciada. As recomendações abaixo ainda precisam ser incorporadas a uma revisão aprovada do plano.

Correção após esclarecimento do usuário em 2026-10-25: a troca para Convex e a evolução do design foram solicitadas por ele. A revisão inicial errou ao tratar essas escolhas como desvios não autorizados. O objetivo de uso é acessar o sistema com o computador pessoal desligado; a análise deve avaliar o plano a partir desse requisito.

Atualização após o resumo completo do usuário: `agents.md` e `PLAN.md` agora refletem as escolhas; as dez tabelas estão em `SCHEMA.md` e as decisões atuais em `DECISIONS.md`, seção 7. Consolidado reúne os dados dos dois conforme solicitado. WhatsApp e APIs pagas de IA estão explicitamente fora do escopo. As observações de arquivos/linhas abaixo se referem à leitura inicial, antes dessa consolidação documental.

## Parecer

O produto proposto é viável como controle financeiro para Cassiano e Kethellen, com Convex hospedado para uso sem depender do computador pessoal e ambiente local com mocks para desenvolvimento. Convex e o design atualizado são escolhas do usuário. Os pontos a detalhar são a operação hospedada, as regras financeiras, as permissões e as garantias de integração que ainda não foram demonstradas.

Recomendação: revisar o plano antes da Fase 1, preservando custo zero, importação local, dois acessos privados, visão do casal e identidade visual própria. Retirar a promessa de equivalência integral ao Pierre Premium.

## Material verificado e limites desta revisão

- Lidos integralmente: `agents.md`, `docs/PLAN.md` e `docs/DECISIONS.md`.
- O projeto contém esses três arquivos e diretórios vazios em `packages/shared/src`. Não há `package.json`, workspace pnpm, aplicação, testes, Docker Compose ou evidências REA salvas nesta árvore. Não há repositório Git inicializado nesta pasta.
- Os identificadores `ev_...` estão escritos nos documentos, mas os respectivos relatórios, scripts exportados, capturas e resultados não estão disponíveis no projeto. Isso impede auditar a execução relatada; não demonstra que ela não aconteceu em outro ambiente.
- Consultados o repositório oficial do REA e as páginas públicas dos fornecedores. O REA não foi instalado nem executado nesta revisão; não houve acesso autenticado ao aplicativo Pierre ou a bancos reais.
- As quatro imagens mencionadas não estão disponíveis nos arquivos nem anexadas à conversa atual. Sua correspondência com o layout descrito não foi validada.
- `node` e `npm` estão disponíveis; `pnpm` e `docker` não foram encontrados no PATH desta sessão. Instalação e execução local ainda precisam ser verificadas na fase apropriada.

## O que está bem encaminhado

1. Monorepo TypeScript, schemas compartilhados e validação nas bordas.
2. Valores monetários em centavos e divisão determinística das despesas.
3. Mock de integração bancária e importação de arquivos como caminho independente de serviços externos.
4. Revisão explícita antes de incorporar lançamentos importados ao livro financeiro.
5. Dois logins fechados, sem cadastro público, com visão individual e compartilhada.
6. Alertas por regras locais para categorias, orçamento, recorrências e variações de gasto.
7. Paleta sóbria, sem neon nem emojis, compatível com uma interface financeira de uso diário.

## Problemas que devem ser resolvidos antes de implementar

### 1. Convex autorizado; explicitar operação hospedada e desenvolvimento local

Referências: `agents.md:4`, `PLAN.md:108-119` e decisão 4 original.

O usuário confirmou que solicitou a substituição por Convex para não depender de manter o computador ligado. Essa instrução prevalece sobre PostgreSQL/Prisma no `agents.md`, que ficou desatualizado nesse ponto, assim como no trecho sobre um único dono. Não há motivo para recomendar retorno ao PostgreSQL apenas por constar no arquivo antigo.

O ajuste necessário é distinguir o Convex local para desenvolvimento do Convex Cloud para uso cotidiano. Um container Convex no computador pessoal continua dependendo de ele estar ligado. Para cumprir o objetivo, dados e funções do backend devem estar hospedados, e o frontend web também precisa de hospedagem. Se restar uma API Node ou um agendador indispensável fora do Convex, sua execução também não pode depender do computador pessoal. [Produção no Convex](https://docs.convex.dev/production/overview), [hospedagem do frontend](https://docs.convex.dev/production/hosting/).

Na revisão do plano, alinhar `agents.md` e as fases com essa decisão. Preservar desenvolvimento local com mocks e a regra de custo zero; não adicionar outro provedor de hospedagem sem verificar plano gratuito, limites e comportamento ao excedê-los. Nenhuma conta ou publicação é necessária para esta análise.

O registro de custos também precisa separar Free de Starter: o primeiro tem limites rígidos; o segundo permite excedentes cobrados por uso. Logo, “nunca cobra” não é uma propriedade de qualquer plano Convex. Os limites da nuvem não descrevem o ambiente self-hosted. [Limites oficiais](https://docs.convex.dev/production/state/limits), [planos e cobrança](https://www.convex.dev/pricing).

### 2. Integração gratuita existe, mas foi descrita com garantias excessivas

Referências: `PLAN.md:43,60-65,118` e decisões 1 e 3 originais.

**Confirmado:** a documentação descreve acesso gratuito aos próprios dados pelo Meu Pluggy, sem expirar junto com o trial, para uso pessoal e até cinco conexões. O guia requer Meu Pluggy, Dashboard, conector MeuPluggy, credenciais e identificação das conexões. Não basta colocar duas chaves no `.env`. [Uso pessoal](https://docs.pluggy.ai/en/docs/guides/meu-pluggy-personal-use), [guia de acesso](https://meu.pluggy.ai/api-guide).

**Correções necessárias:**

- A documentação consultada fala em até cinco conexões de uso pessoal. Não comprova a formulação “cinco por CPF, portanto dez garantidas neste sistema de casal”. A elegibilidade do uso conjunto com duas integrações separadas precisa ser confirmada antes dessa promessa. A FAQ informa que múltiplos titulares na mesma conta estão sob revisão; não depender desse arranjo. [FAQ oficial](https://docs.pluggy.ai/en/docs/get-started/faq).
- A atualização da conexão original ocorre a cada 24 horas. O item proxy acompanha essa atualização e não aceita atualização manual pela API. O botão pode consultar os dados já disponíveis, mas não deve prometer forçar uma atualização bancária imediata. Alertas decorrentes da importação também não são detecção bancária em tempo real. [Funcionamento dos itens](https://docs.pluggy.ai/en/docs/connections/item).
- É necessário guardar os `itemId`: a listagem geral por `GET /v2/items` não está disponível para contas Meu Pluggy. A autorização do aplicativo dura um ano, separada do consentimento bancário. Expiração pode produzir listas vazias; isso não deve apagar o histórico local. [Guia de uso pessoal](https://docs.pluggy.ai/en/docs/guides/meu-pluggy-personal-use).
- A gratuidade atual não comprova gratuidade perpétua, ausência de cartão em todo fluxo nem o comportamento exato ao tentar a sexta conexão. Esses pontos devem constar como não comprovados, sem transformar ausência de informação em garantia.
- Acesso aos dados e inteligência do fornecedor são ofertas diferentes: categorização e enriquecimento não estão incluídos no gratuito. Usar o motor próprio de regras no backend, sem depender da inteligência paga do fornecedor nem da execução no computador pessoal. [O que o gratuito inclui](https://v2.docs.pluggy.ai/en/docs/get-started/contact).

Recomendação: importação manual + mock como base garantida pelo próprio software; Meu Pluggy como integração opcional e condicionada à validação de elegibilidade, limites e onboarding. Sem assinatura, migração de plano ou criação de contas nesta etapa. No modo hospedado, dados importados são processados pelo backend hospedado; o caminho bancário também passa pelo fornecedor. Não chamar esse uso de 100% offline.

### 3. Engenharia reversa da landing page não comprova o aplicativo inteiro

Referências: `PLAN.md:5,35-53` e decisão 2 original.

A página pública confirma recursos anunciados, seis agentes exemplificados e os preços mensais citados, incluindo uma oferta Premium com dez agentes. Isso não demonstra algoritmos, schemas, fluxos autenticados ou comportamento de todos os recursos. [Página oficial do Pierre](https://lp.pierre.finance/).

Mesmo uma captura legítima de DOM e scripts da landing page mostra o que aquele alvo expõe. Webflow, animações, telemetria e detecção de WebView não revelam, por si, a arquitetura do produto autenticado. Contagem de nós AST não é medida de cobertura funcional. O REA trabalha com evidências e limitações; os resultados devem ser retidos para revisão. [Repositório REA](https://github.com/morluto/rea), [documentação de evidências](https://github.com/morluto/rea/blob/main/docs/cli.md).

Os seis motores próprios são implementações propostas, não algoritmos recuperados do Pierre. O resumo completo define o conjunto funcional desejado; WhatsApp e APIs pagas de IA estão fora do escopo. Não exigir esses recursos para aprovar o conjunto solicitado nem usar ausência deles como falha do plano. A afirmação de paridade integral com outro produto continua sem comprovação e não é necessária para implementar esse escopo.

Criar uma matriz futura com: recurso observado, fonte/captura, comportamento testado, equivalente proposto, diferenças, fase e critério de aceite. Não usar nomes, personagens ou ativos do Pierre como identidade do nosso produto.

### 4. Política definida pelo usuário para os três modos

Referências: `PLAN.md:24-31,75-93` e `agents.md:17`.

O resumo completo resolve a ambiguidade inicial: Individual mostra dados próprios, Casal mostra compartilhados e Consolidado reúne os dados dos dois. Essa funcionalidade foi solicitada; não é necessário impor um fluxo extra de consentimento para sua existência. Filtrar exclusivamente por `userId` ainda não resolve registros compartilhados ou consolidados: as permissões dos dois membros devem ser verificadas no servidor.

Recomendação para o plano:

- Dois usuários pertencem a um único núcleo de casal. Autenticação determina o usuário; nenhum `userId` enviado pelo cliente concede acesso.
- Separar proprietário do recurso, autor do lançamento, pagador, participantes do rateio e permissões de leitura. Uma compra paga em conta pessoal pode ser compartilhada sem expor o extrato inteiro dessa conta.
- Visão do casal inclui os registros compartilhados. Consolidado reúne recursos dos dois usuários conforme o requisito, identificando os titulares; o modo individual continua restrito ao próprio usuário. Credenciais bancárias e hashes nunca aparecem nas consultas dos clientes, mesmo no consolidado.
- Validar permissões no servidor para detalhe, busca, gráficos, exportação, importação, regras e alertas; o seletor de tela apenas escolhe uma visão já autorizada.
- Definir quem pode corrigir, aprovar e desfazer uma despesa compartilhada e como ficam as revisões concorrentes. Não inferir que um lançamento exige aprovação dos dois sem definir essa política.

Os três modos são requisitos do usuário. A separação de proprietário, pagador e ator é recomendação de modelagem para implementá-los corretamente.

### 5. Falta o núcleo que impede dupla contagem de dinheiro

O plano descreve telas e agentes antes de definir regras essenciais. Devem existir exemplos e critérios para:

| Situação                                  | Comportamento necessário                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Transferência entre contas próprias       | Movimentar as contas, sem classificar como receita e despesa de consumo.                                      |
| Compra no cartão e pagamento da fatura    | Reconhecer a compra uma vez; pagamento liquida a obrigação, sem repetir o gasto.                              |
| Compra parcelada                          | Separar valor total, parcelas, competência e vencimentos, mantendo soma exata em centavos.                    |
| Estorno, reembolso e cancelamento         | Vincular ao original e refletir saldo/orçamento conforme a política definida.                                 |
| Despesa compartilhada                     | Registrar um gasto e seu rateio; não somar novamente as parcelas de cada pessoa no consolidado.               |
| Acerto do casal                           | Reduzir a dívida entre os dois; não gerar novo consumo nem sugerir que o botão transfere dinheiro pelo banco. |
| Saldo inicial e saldo bancário consultado | Separar saldo inicial, lançamentos confirmados, pendências e fotografia do banco, com data de referência.     |
| Reservas e metas                          | Não contar o dinheiro de uma mesma conta novamente por também estar associado a uma meta.                     |

Exemplo obrigatório: Cassiano paga uma despesa compartilhada de 10.001 centavos. Com a regra de resto atual, sua parte é 5.001 e a de Kethellen é 5.000. O casal gastou 10.001, Kethellen deve 5.000 e a quitação posterior não aumenta o gasto. Incluir estorno e quitação parcial nesse mesmo cenário.

Percentuais devem ter representação inteira ou decimal exata documentada; valores em centavos não dispensam uma política de arredondamento para cashback e juros. Definir limites seguros de inteiros, conversão para JSON, parsing de `1.234,56`, sinal, datas e competência em `America/Sao_Paulo`.

### 6. “Nunca duplica” não é um contrato realista de importação

Referências: `PLAN.md:63-65,118`.

OFX e CSV precisam de formatos suportados e arquivos de exemplo; não presumir que todo banco e toda fatura exportem os mesmos campos. CSV exige mapeamento de colunas, separador, encoding, datas e sinal. OFX precisa de tratamento das variantes efetivamente aceitas.

Separar três problemas:

1. **Mesmo lançamento importado novamente:** chave de origem no contexto de titular/conta/provedor, restrição única e aprovação idempotente no banco de dados.
2. **Mesmo lançamento em OFX, CSV e API:** conciliação entre fontes com confirmação quando a identidade for ambígua. Um hash simples não resolve mudanças de descrição ou data.
3. **Duas cobranças reais parecidas:** são dois registros; gerar alerta, sem apagar uma possível cobrança duplicada como se fosse repetição do arquivo.

Tratar lançamento pendente que depois é efetivado, estornos e mudança de conexão após reautorização. Aprovação em lote precisa de transação atômica ou resultado individual explícito, proteção contra duplo clique e histórico de quem confirmou. Recusar um item não deve apagá-lo silenciosamente nem fazê-lo reaparecer como novo na importação seguinte.

O saldo consultado do banco pode incluir movimentos ainda não aprovados no app. A interface precisa explicar essa diferença, sem somar pendências ao saldo que já as contém.

### 7. Os agentes precisam de limites e critérios de qualidade

Referências: `PLAN.md:44-49,117`.

Os seis tipos de alerta são plausíveis com regras locais. Isso não equivale a um assistente conversacional generalista nem garante a qualidade de outro produto.

- Duplicidade por valor/loja/data é suspeita, não prova; permitir descartar o alerta.
- Regras de categorias precisam de prioridade, contexto individual/compartilhado, prévia e opção de desfazer. Uma correção não deve recategorizar todo o histórico ou expor dados do parceiro automaticamente.
- Comparar períodos equivalentes. Mês parcial contra três meses inteiros tende a produzir conclusões enganosas.
- Definir histórico mínimo, sazonalidade, amostra vazia e dispersão zero para anomalias. “Acima de duas vezes o desvio-padrão” precisa esclarecer distância em relação a qual centro.
- Identificar cada alerta com origem, período, explicação e confiança; impedir notificações repetidas pelo mesmo fato.
- Missões de economia são sugestões com base verificável; não prometer economia certa nem alterar orçamento, categoria ou meta sem confirmação.

### 8. Cashback e investimentos são acompanhamento, não benefícios gerados pelo app

Referências: `PLAN.md:50-51,88-91,113`.

O Pierre anuncia um cartão próprio e ofertas de investimento. Nosso painel para acompanhar cartões e ativos existentes tem outro alcance funcional. [Produtos anunciados](https://lp.pierre.finance/).

Para o nosso plano, definir cashback estimado, elegível, confirmado e creditado, com tetos e estornos; cadastrar uma porcentagem não comprova recebimento. Não duplicar receita estimada e crédito efetivo.

Em investimentos, separar posições, aportes, resgates, rendimentos observados e projeções. Uma taxa de “% do CDI” sozinha não produz rentabilidade real exata: o cálculo depende de série de taxas, datas, convenção, capitalização e tributação aplicável. Primeiro suportar valores informados/importados e projeção claramente identificada; qualquer fonte externa de índices exige adapter, mock, fonte e condições verificadas.

A etiqueta FGC deve refletir o instrumento e informações verificadas, não uma garantia atribuída pelo software a toda a carteira. Adiar cálculos internacionais e conversão cambial até definir dados, moeda de origem e tratamento de câmbio.

### 9. Preservar o design solicitado e validar sua execução

Referências: conversa fornecida versus `PLAN.md:71-102,122`.

A evolução visual foi solicitada pelo usuário. Bento Grid, cards, abas e gráficos não constituem erro de planejamento por diferirem da primeira proposta editorial. A preferência do revisor pelo estilo anterior não deve substituir as referências e escolhas do usuário.

Recomendação: seguir a direção atual do plano e as referências fornecidas, preservando a exigência de personalidade própria, sem neon e sem emojis. Validar a qualidade na execução, a coerência da paleta e da tipografia e a utilidade dos gráficos. As quatro imagens ainda não estão disponíveis nesta revisão, portanto sua fidelidade não foi avaliada.

Antes de construir todas as telas, aprovar uma amostra com dados realistas em desktop e celular: visão geral, transações e casal. Validar leitura de números, contraste, estados de erro/vazio/carregamento, teclado, toque e labels acessíveis para aprovar/rejeitar. Cor e sigla não devem ser as únicas formas de identificar pessoas ou categorias.

### 10. Operação, segurança e entrega ainda estão incompletas

- **Sessões:** especificar expiração, revogação, logout, tentativas de login e armazenamento seguro de tokens no web/mobile. `argon2` é hash de senha; não criptografia reversível. `JWT` e `AES-256-GCM` sozinhos não constituem um fluxo de segurança.
- **Chaves:** permanecer no servidor, com gestão da chave mestra e recuperação de backup. Não embutir segredos em variáveis públicas do Next.js/Expo. Não usar senha padrão fixa em seed com dados reais.
- **Auditoria:** registrar ator, ação, referência e resultado, sem copiar valores financeiros, descrições, arquivos importados ou tokens para logs.
- **Persistência:** definir evolução do schema Convex, exportação e restauração testada, além de volume persistente no ambiente local de desenvolvimento. Mock de banco externo não deve significar perda de dados reais a cada reinício.
- **Disponibilidade:** uso cotidiano deve depender do backend hospedado e do frontend publicado, conforme o objetivo do usuário. Verificar web e mobile com o computador pessoal desligado. Rede local serve para desenvolvimento e testes, não é o destino final do produto. Planos gratuitos têm limites e não constituem garantia de disponibilidade contínua.
- **PWA:** usar HTTPS na versão hospedada e política de cache que não misture usuários nem guarde respostas financeiras indiscriminadamente. No desenvolvimento, `localhost` e loopback são exceções; não equivalem a qualquer IP HTTP na LAN. [Requisitos de instalação PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).
- **Escopo offline:** funcionar localmente não significa mobile offline com sincronização bidirecional. A opção inicial mais simples é exigir conexão à API para gravar; definir conflitos antes de prometer gravação offline.
- **Avisos:** definir primeiro alertas dentro do app e processamento no backend. WhatsApp está fora do escopo por escolha do usuário; push e automações com outros serviços não foram adicionados nesta consolidação.

## Sequência recomendada para revisar as quatro fases

Esta é uma proposta para revisão, não autorização para executar fases.

| Fase                         | Recorte recomendado                                                                                                                                                                                                                                                                 | Critério de saída                                                                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Fundação                 | pnpm, TypeScript, lint, Vitest, Convex e mocks para desenvolvimento local, contratos mínimos de dinheiro/usuário/casal, `.env.example`, README. Documentar o destino Convex Cloud escolhido para uso real. Sem contratos completos de todos os investimentos e agentes futuros.     | Subir ambiente de desenvolvimento sem conta externa, persistir dados mock e executar os três checks.                                                                      |
| 2 — API e regras financeiras | Dois logins, permissões, contas, lançamentos, transferências, cartões/faturas básicos, rateio/acerto, importação de formatos definidos e auditoria. Orçamento e alertas simples depois da integridade financeira. Meu Pluggy permanece uma subetapa opcional com validação própria. | Testes de autorização, centavos, concorrência/idempotência, importação e dupla contagem; demonstração com dados fictícios dos dois.                                       |
| 3 — Web                      | Design solicitado, fluxo completo de lançar/importar/revisar/dividir/quitar, depois gráficos e PWA. Planejar frontend hospedado e Convex Cloud respeitando custo zero. Recursos avançados de investimento/cashback condicionados a especificação.                                   | Fluxos reais em navegador e celular, estados de falha e permissões conferidos; instalação e cache validados. Validar versão hospedada com o computador pessoal desligado. |
| 4 — Expo Go                  | Reutilizar contratos/backend hospedado e os fluxos aprovados na web, sem publicação nas lojas.                                                                                                                                                                                      | Validação nos dois celulares com o computador pessoal desligado, sessão, importação e tratamento de indisponibilidade.                                                    |

Nenhuma fase deve terminar apenas com telas ou testes unitários aprovados: o fluxo correspondente precisa ser demonstrável. Testes Vitest cobrem regras e integrações locais; não provam conexão com bancos reais, instalação PWA ou funcionamento em dispositivos.

## Verificação desta entrega

Entrega exclusivamente documental. Não foram criados código, dependências, contas, integrações, commits ou infraestrutura. O plano, as instruções e as decisões foram posteriormente alinhados ao resumo completo do usuário; `SCHEMA.md` registra o modelo solicitado. A leitura original foi preservada nos apontamentos históricos desta revisão quando pertinente.

Os checks exigidos pelo projeto foram tentados nesta sessão: `pnpm lint`, `pnpm typecheck` e `pnpm test`. Os três não puderam iniciar porque `pnpm` não está no PATH. Também não existe `package.json` com esses scripts. Portanto, nenhum check de código foi aprovado ou validado nesta revisão.
