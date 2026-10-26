# Plano do Produto e Implementação — Controle Financeiro Pessoal & Casal (Cassiano & Kethellen — Custo Zero)

Este documento consolida:

1. **O modelo exclusivo para 2 usuários (`Cassiano` e `Kethellen`)**, com visão individual e visão compartilhada do casal.
2. **As funcionalidades desejadas a partir da análise do Pierre (`lp.pierre.finance`) relatada na conversa**, adaptadas para custo zero: seis agentes, cartões/cashback, investimentos, vencimentos e conciliação. A implementação local e os clientes foram criados após autorização do usuário; publicação e validação externa têm status próprio em `QA.md`. Os artefatos REA citados abaixo não foram auditados nesta pasta.
3. **A integração bancária por adapters**: mock, arquivos `.OFX`/`.CSV` e Meu Pluggy opcional com credenciais separadas dos dois. A meta é até cinco conexões para cada um; elegibilidade conjunta e comportamento no limite dependem de validação do fornecedor registrada em `DECISIONS.md`.
4. **A arquitetura de telas e design** baseada nas 4 referências visuais enviadas + `lp.pierre.finance`, **sem cores neon e sem emojis**.
5. **As 4 fases de implementação**.

**Referência vigente:** resumo completo e autorização posterior do usuário para implementar o sistema em 2026-10-25. Convex e a evolução do design foram escolhas dele; Netlify foi confirmado como hospedagem. Sem WhatsApp e sem APIs pagas de IA. As dez tabelas e os campos implementados estão em [SCHEMA.md](SCHEMA.md). Roteiro de execução: `README.md`; publicação: `DEPLOYMENT.md`; evidências e limites: `QA.md`.

**Execução:** desenvolvimento local com mocks e arquivo integral cifrado, além de compose para Convex Self-Hosted; uso cotidiano via Convex Cloud Free e Netlify Free. `DatabaseAdapter` possui implementações mock, local persistente e Convex. As regras e estatísticas dos agentes rodam no nosso backend, sem LLM pago; “local” descreve a lógica própria, não uma dependência do PC no uso hospedado. Qualquer API necessária também deve funcionar hospedada. O cliente Expo Go reutiliza os fluxos web em WebView; a PWA é a opção de uso sem Metro/PC após publicação. Não houve publicação nas lojas.

---

## 1. Modelo Exclusivo para Você e a Kethellen (2 Usuários + Modo Casal)

O sistema será **fechado e exclusivo para duas pessoas**: **Cassiano** e **Kethellen**.

### 1.1. Dois Logins Independentes (Sem Cadastro Público)

- Apenas 2 contas existem no sistema (configuradas via `.env` / seed inicial):
  1. **Cassiano** (`owner: CAS`)
  2. **Kethellen** (`owner: KET`)
- Cada um entra com seu próprio login e senha (protegidos com `argon2` e sessão JWT). Ninguém de fora consegue criar conta.

### 1.2. Seletor de Escopo no Topo: `Individual` vs. `Casal / Conjunto`

No topo do aplicativo (Web e Mobile), vocês terão um seletor rápido de visualização:

1. **`Minha Visão` (Individual — Cassiano ou Kethellen):**
   - Mostra apenas as suas contas pessoais, seus cartões, seus investimentos e seus gastos individuais.
2. **`Visão Casal` (Compartilhado — `CAS + KET`):**
   - Mostra as despesas marcadas como **Compartilhadas (`SHARED`)**, metas em conjunto (ex.: viagem, reserva do casal, compras para casa) e o **Balanço de Acerto do Casal**:
     - Ao lançar ou aprovar uma despesa compartilhada, você pode definir se a divisão é **50% / 50%** ou **valor/percentual personalizado** (sempre calculado em centavos exatos, sem sobra de arredondamento).
     - O sistema calcula automaticamente no mês: _"Quem pagou o quê"_ e o **saldo de acerto líquido** entre Cassiano e Kethellen (com botão de `Quitar Acerto do Mês`).
3. **`Patrimônio Consolidado` (Visão Geral dos Dois):**
   - Permite enxergar a soma das contas, reservas, cartões e investimentos dos dois juntos, identificando cada item com uma sigla discreta em fonte monoespaçada (`[CAS]` Cassiano, `[KET]` Kethellen, `[CNJ]` Conjunto — zero emojis).

---

## 2. Engenharia Reversa do Pierre (`lp.pierre.finance`) via REA -> Nosso Sistema (R$ 0,00)

A conversa anterior relata uso do servidor MCP **REA (`reverse-engineer-anything`)** para capturar DOM, árvore de acessibilidade, 18 pacotes JavaScript e 70.874 nós AST de `https://lp.pierre.finance/`. Identificadores preservados como referência ao relato, sem comprovação dos artefatos nesta pasta: `ev_4138d77dcdff0279db745e88d29b20f8557bf99eacc08966b340d4ea07dc4b95`, `ev_82e2768de6ab0e7420d76c2d3e532962cf054de5d7a286819d26129c6e822be8`, `ev_19669ab5276f825e91bf025f8789c5be9d951ad4c79f1368db0c551205a2e28e`.

A tabela preserva a referência de produto da conversa e os equivalentes desejados. Não é comprovação de algoritmos internos nem de paridade integral. O escopo adotado é o enumerado neste plano; WhatsApp, chat com LLM pago e automações generalistas do Computer não entram.

| Funcionalidade no Pierre (`lp.pierre.finance`)                   | Como funciona no Pierre                                                                                    | Como funciona para Cassiano & Kethellen (**Custo R$ 0,00**)                                                                                                                                                                                           |
| :--------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Conexão Multi-bancos (Open Finance Somente Leitura)**          | Referência de agregação bancária anunciada na página pública.                                              | Credenciais Meu Pluggy separadas, visando até cinco conexões para cada um, condicionado às regras verificadas do fornecedor. Importação `.OFX`/`.CSV` sem cobrança ou cota comercial própria; formatos e limites técnicos de arquivo serão definidos. |
| **Agente "Albert" (Cobranças Suspeitas e Duplicadas)**           | Alerta em tempo real: _"Cobrança repetida: R$ 89,90"_ ou aumento silencioso de assinatura.                 | **Detector Local de Duplicidades (Individual e Casal):** avisa se um banco cobrou duas vezes o mesmo valor **ou se tanto o Cassiano quanto a Kethellen pagaram a mesma conta/assinatura em duplicidade**.                                             |
| **Agente "Sherlock" (Auto-Categorização que Aprende)**           | _"Corrige suas categorias e aprende com você"_ conforme o usuário altera uma categoria.                    | **Motor de Regras Aprendidas (`CategoryRule`):** quando você ou a Kethellen categorizam um estabelecimento (ex.: `"IFD*MERCADO"` -> `Supermercado` e marca se é `Individual` ou `Casal`), o sistema aprende e classifica sozinho nas próximas vezes.  |
| **Agente "Marie" (Insights de Variação por Categoria)**          | Mostra desvios de hábito: _"Restaurantes subiram R$ 280"_ comparado ao histórico.                          | **Analisador de Ritmo e Média Móvel:** compara o gasto acumulado de cada categoria (individual e do casal) com a média dos últimos 3 meses.                                                                                                           |
| **Agente "Megamen" (Alerta de Limite de Gastos)**                | _"Alerta quando você ultrapassar o limite de gastos"_ definido para a categoria.                           | **Monitor de Orçamento (`Budgets`):** tetos de gastos individuais (Cassiano / Kethellen) e tetos conjuntos do casal, com alertas em `80%` e `100%`.                                                                                                   |
| **Agente "Julius" (Auditor de Gastos Fora da Curva)**            | _"Reclama quando você gastar de um jeito absurdo"_ (compras atípicas ou pico de gastos supérfluos).        | **Detector de Outliers (`Z-Score` / Picos):** sinaliza transações individuais muito acima do ticket médio da categoria ou concentração semanal de gastos não essenciais.                                                                              |
| **Agente "Rita" (Missões de Economia)**                          | _"Dá uma missão inesperada para quebrar sua rotina"_ e economizar.                                         | **Gerador de Missões Semanais (`SavingsMissions`):** propõe metas semanais individuais ou em dupla (ex.: _"Missão do Casal: economizar R$ 150 em Delivery esta semana para a meta de Viagem"_).                                                       |
| **Pierre One (Cartões + Rastreador de Cashback)**                | Mostra faturas de cartão e quanto voltou em cada compra (_"Mercado R$ 420,00 -> 3% de volta: +R$ 12,60"_). | **Gestão de Cartões e Cashback (`Cards`):** cartões do Cassiano e da Kethellen (incluindo cartões adicionais/compartilhados), `%` de cashback de cada cartão, cálculo automático do cashback por compra e fatura aberta.                              |
| **Pierre Invest (Reserva em `% do CDI` + FGC + Exterior)**       | Mostra investimentos rendendo até `111,11% do CDI` com proteção FGC e _"Ações lá fora"_.                   | **Painel de Patrimônio (`Wealth / Invest`):** investimentos individuais de cada um e **Metas/Reservas Conjuntas do Casal** rendendo `% do CDI` (calcula quanto rendeu no mês em centavos) e cobertura FGC.                                            |
| **Aprovação / Reprovação com 1 Clique (`Aprovar` / `Reprovar`)** | Toda sugestão ou ação pendente pede confirmação explícita (`[Reprovar] [Aprovar]`).                        | **Fila de Confirmação Inline (`[✓]` / `[✕]`):** exatamente como na sua **Imagem 2 de referência** e no Pierre, transações importadas ou despesas compartilhadas lançadas exibem os botões de aprovar/rejeitar direto na linha.                        |
| **Lembretes de Pagamentos e Vencimentos**                        | Avisa contas, boletos e faturas próximas do vencimento.                                                    | **Calendário de Vencimentos (Pessoais e da Casa):** painel de próximas contas e faturas do Cassiano, da Kethellen e conjuntas a vencer em 7/15/30 dias.                                                                                               |

---

## 3. Como Funciona a Integração com Bancos Reais para os Dois (R$ 0,00)

Tudo fica atrás da interface `BankSyncAdapter`, com **3 modos**:

1. **Sincronização Automática Open Finance (`PluggyBankSyncAdapter`):**
   - Usa o **Meu Pluggy (`meu.pluggy.ai`)**, 100% gratuito para Pessoa Física acessar os próprios dados.
   - Suporta credenciais separadas do Cassiano e da Kethellen, com objetivo de até cinco conexões de cada um. A documentação confirma até cinco conexões de uso pessoal, mas a garantia de dez para este uso conjunto e o comportamento exato no limite ainda precisam ser validados. Nunca ativar plano pago para completar a conexão.
   - O Meu Pluggy atualiza a origem a cada 24 horas; consultar dados disponíveis não força atualização bancária. Guardar os `itemId`, tratar expiração de autorização e exibir a última atualização. Fontes e condições em `DECISIONS.md`.
2. **Importador Universal `.OFX` e `.CSV` (`FileBankSyncAdapter`):**
   - Qualquer um dos dois pode enviar extratos `.ofx` ou `.csv`, sem tarifa ou cota comercial do app. Validar variantes OFX, mapear colunas CSV e definir limites técnicos. No desenvolvimento, processar localmente; na versão hospedada, processar no backend hospedado.
   - Deduplicação usa `FITID` / hash no contexto da conta e origem; ambiguidades entre fontes exigem conciliação. Aplica o **Auto-Categorizador ("Sherlock")** e o **Detector de Duplicidades ("Albert")** e coloca os lançamentos na fila de confirmação rápida (`[✓]` / `[✕]`). Aprovação repetida não pode duplicar o lançamento.
   - Nenhuma transação importada afeta o saldo contábil antes de aprovação explícita. Separar esse saldo da fotografia recebida do banco. Reprovar não exclui silenciosamente o histórico da revisão.
3. **Modo Mock (`MockBankSyncAdapter`):**
   - Já vem pré-carregado com dados simulados realistas para **Cassiano** e **Kethellen** para rodar localmente com `docker-compose` sem configurar chaves externas.

---

## 4. Arquitetura Visual e Layout (Baseado nas 4 Imagens de Referência + Pierre — Sem Neon, Sem Emojis)

Unimos a estrutura limpa e moderna das **4 imagens que você enviou** com os cards de inteligência do **Pierre**, aplicando suas regras estritas (**zero cores neon, zero emojis**):

### 4.1. Navegação Principal e Seletor de Perfil (`Cassiano` | `Kethellen` | `Casal`)

No cabeçalho superior (seguindo o layout da **Imagem 2**):

- **Saudação personalizada:** `"Olá, Cassiano"` ou `"Olá, Kethellen"` conforme quem está logado, acompanhado do seletor de escopo: **`[ Individual ]`** | **`[ Casal ]`** | **`[ Consolidado ]`**.
- **Abas Principais (Pills no Topo no Web / Barra Inferior no Mobile):**
  1. **`Visão Geral` (`Overview`):**
     - **Card de Saldo Principal:** Seletor de conta, botão de privacidade (olho), variação `% vs mês passado` e ações rápidas (`+ Nova Transação`, `Importar Extrato / Sincronizar`, `Dividir Despesa`).
     - **Feed de Inteligência dos Agentes (Estilo Pierre):** Alertas ativos do _Albert_, _Marie_, _Megamen_, _Julius_ e _Rita_.
     - **Gráfico de Rosca (`Donut Chart` — Imagens 1, 2 e 4):** Total gasto no centro da rosca + distribuição percentual por categoria.
     - **Gráfico de Linha Suave (`Spending Trend` — Imagens 1 e 2):** Evolução mensal de `Jan` a `Dez` com tooltip de destaque.
     - **Últimas Transações + Aprovação Inline (`[✓]` / `[✕]` — Imagem 2):** Lista com ícone geométrico SVG limpo, código da categoria (`ALM`, `MOR`, `TRN`), tag discreta do titular (`CAS`, `KET`, `CNJ`), valor em `JetBrains Mono` e botões `[✓]` / `[✕]`.
     - **Principais Categorias & Orçamento (`Top Categories` — Imagens 2, 3 e 4):** Barras de progresso horizontais mostrando `R$ 640 / R$ 800 (80%)`.
  2. **`Casal & Divisão` (`Couple Split`):**
     - Resumo de gastos compartilhados do mês, proporção de divisão (`50/50` ou customizada), saldo de acerto entre **Cassiano** e **Kethellen** e metas conjuntas.
  3. **`Patrimônio & Invest` (`Wealth` — Estilo Pierre Invest):**
     - Reservas e investimentos de cada um e do casal, rendimento em `% do CDI` (ex.: `110% do CDI`, proteção FGC) e evolução patrimonial.
  4. **`Cartões & Cashback` (`Cards` — Estilo Pierre One):**
     - Cartões do Cassiano e da Kethellen, barra de limite utilizado/disponível, fatura aberta, vencimento e **painel de Cashback acumulado no mês (`+ R$ ...` calculado por compra)**.
  5. **`Extrato & Conciliação` (`Transactions & Bank Sync`):**
     - Livro-razão completo com filtros por titular (`Cassiano`, `Kethellen`, `Casal`), conta, cartão, categoria e período, além de upload `.OFX`/`.CSV`, sincronização Meu Pluggy e regras aprendidas pelo _Sherlock_.

### 4.2. Paleta de Cores Sóbria e Sofisticada (Zero Neon, Zero Emojis)

- **Tema Claro (Pedra & Papel):** Fundo `#F5F4F0`, Cards `#FFFFFF` com borda sutil `1px solid #E6E4DD`, texto principal carvão `#141413`, destaque primário em **Verde Floresta Profundo (`#1E4D3B`)** e **Grafite Escuro (`#1C1C1A`)**.
- **Tema Escuro (Obsidiana Matte):** Fundo `#0F100F`, Cards em ardósia escura `#171817` com borda fina `1px solid #262826`, texto principal `#ECEAE4`, destaque em **Verde Sálvia/Pinho Matte (`#4E876C`)** e **Champanhe Seco (`#C5A880`)** para alertas.
- **Diferenciação Visual Sóbria entre Cassiano, Kethellen e Casal (Sem Neon):**
  - `CAS` (Cassiano): Verde Floresta Profundo (`#1E4D3B` / `#4E876C`)
  - `KET` (Kethellen): Terracota / Ameixa Seca Sóbria (`#6E3B3B` / `#B07BAC`)
  - `CNJ` (Casal / Conjunto): Bronze / Pedra Escura (`#5C5346` / `#A39682`)
- **Zero Emojis:** Exclusivamente **ícones vetoriais geométricos SVG de traço fino (`1.5px`)** + siglas monoespaçadas (`ALM`, `MOR`, `TRN`, `INV`, `CAS`, `KET`, `CNJ`).
- A proibição de emojis também se aplica aos campos do banco. As quatro referências visuais permanecem válidas; sua fidelidade só será avaliada quando os arquivos estiverem disponíveis na etapa visual.

### 4.3. Contratos de cálculo e de domínio

- `cashbackBps`: `100` = `1%`, `300` = `3%`. Cálculo em centavos com arredondamento explícito; diferenciar valor calculado do crédito efetivamente recebido.
- `cdiPercentageBps`: `10000` = `100% do CDI`, `11111` = `111,11% do CDI`. Distinguir projeção de rendimento observado; não deduzir proteção FGC somente do nome do investimento.
- Rateios somam `10000` bps e seus centavos somam exatamente o valor da despesa. Não contar novamente pagamento de fatura, transferência própria ou quitação do casal como consumo.
- Os modos de visualização são `INDIVIDUAL`, `COUPLE` e `CONSOLIDATED`; titulares de registros usam `CAS`, `KET` e `COUPLE`; `CNJ` é a etiqueta visual. Consolidado reúne os dois membros autenticados, conforme solicitado, sem cadastro público ou acesso de terceiros.

---

## 5. Fases de Implementação

### Fase 1: Fundação do Monorepo, Convex Local (`docker-compose`) e `packages/shared`

- Configuração do `pnpm-workspace.yaml`, TypeScript estrito, ESLint e Vitest.
- `docker-compose.yml` com Convex Self-Hosted local (`3210` / `6791`) + `.env.example` (com variáveis iniciais para os perfis de **Cassiano** e **Kethellen**).
- `packages/shared`:
  - Schemas Zod e tipos para os 2 Usuários (`Cassiano` e `Kethellen`), Escopo de Visão (`INDIVIDUAL`, `COUPLE`, `CONSOLIDATED`), Divisão de Despesas do Casal (`CoupleSplit`), Contas, Cartões (com `%` de cashback), Investimentos (`% do CDI` + FGC), Categorias, Regras de Auto-Categorização (_Sherlock_), Transações (com aprovação inline `[✓]`/`[✕]` e cashback), Alertas dos Agentes (_Albert_, _Marie_, _Megamen_, _Julius_, _Rita_), Conciliação Bancária (`OFX`/`CSV`/Open Finance) e Orçamentos.
  - Calculadores matemáticos em centavos (`BRL`, divisão exata de despesas entre o casal sem perder 1 centavo, `% do CDI`, cashback, variações mensais) + suíte de testes no Vitest.

### Fase 2: Backend (`apps/api`) + Convex, Motor de Agentes Financeiros, Modo Casal e Conciliação Bancária

- Schema do Convex e `DatabaseAdapter` (`MockDatabaseAdapter` + `ConvexDatabaseAdapter`).
- **`FinancialAgentsEngine` (100% local e gratuito):** _Albert_ (incluindo detecção de conta paga em duplicidade pelos dois), _Sherlock_, _Marie_, _Megamen_, _Julius_ e _Rita_.
- **`BankSyncAdapter`:** Parser nativo `.ofx` e `.csv` + `PluggyBankSyncAdapter` (suportando as credenciais Meu Pluggy do Cassiano e da Kethellen) + `MockBankSyncAdapter`.
- Autenticação `argon2` + JWT para os 2 usuários (`Cassiano` e `Kethellen`), criptografia `AES-256-GCM`, auditoria LGPD e testes no Vitest.
- Usar como base as dez tabelas em [SCHEMA.md](SCHEMA.md), com autorização do ator no servidor e validação dos inteiros. Operações que aprovam lançamentos, alteram saldo e registram acerto precisam preservar atomicidade no Convex.
- Os agentes processam dados disponíveis no backend, sem WhatsApp nem LLM pago. Comparativos usam períodos equivalentes e deixam explícito quando falta histórico.

### Fase 3: Aplicação Web PWA (`apps/web`)

- Dashboard Bento Grid completo inspirado nas 4 imagens de referência e no Pierre (sem neon e sem emojis), com seletor `Individual / Casal / Consolidado`, gráficos de Rosca e Evolução Mensal, Barras de Orçamento, Divisão do Casal, Feed dos Agentes Financeiros e Aprovação Inline (`[✓]` / `[✕]`).
- Planejar publicação do frontend com HTTPS e Convex Cloud Free, com fontes/limites do provedor registrados antes da escolha. Critério de aceite: site/PWA e tarefas de backend funcionam com o computador pessoal desligado. Configurar cache sem misturar dados dos dois logins. Nenhuma publicação faz parte desta atualização documental.

### Fase 4: Aplicativo Mobile via Expo Go (`apps/mobile`)

- App React Native (Expo Go) para você e a Kethellen usarem no celular, seguindo o fluxo das Imagens 1 e 4 (`Home & Saldo`, `Transações & Aprovação Rápida`, `Análise de Gastos, Orçamentos & Acerto do Casal`).
- Usar o backend hospedado e validar nos dois celulares sem depender do computador pessoal ligado para servir o aplicativo. O modo de distribuição compatível com Expo Go e esse requisito ainda deve ser especificado; testar pelo servidor de desenvolvimento no PC não cumpre esse aceite. Sem publicação nas lojas e sem presumir serviço de distribuição pago.
