# Entre Contas

Controle financeiro privado para Cassiano e Kethellen. Web Next.js/PWA, backend Convex e cliente Expo Go. Interface pt-BR, BRL em centavos, temas claro/escuro, sem neon e sem emojis.

## Testar agora neste computador

1. Use Node.js **24.7 ou superior da linha 24 LTS**. A aplicação usa a implementação nativa de Argon2id do Node.
2. Abra `INICIAR.bat` ou execute, na raiz, `pnpm dev`. Se pnpm não estiver instalado, `npm run dev` executa o mesmo sistema.
3. Abra **http://localhost:3000**.
4. Entre com um dos dois emails e a senha que você forneceu para aquele perfil. Nesta instalação, os dois acessos já foram configurados em `.env.local`, com hashes Argon2id. Senhas não estão no código nem nesta documentação.

A instalação local começa **vazia**, com os dois acessos e as categorias básicas. Não cria contas, saldos, cartões, despesas, investimentos ou metas fictícios. Alterações ficam no arquivo `.local/finance.enc`, criptografado com AES-256-GCM. Este modo funciona sem conta externa. O processo local precisa ficar aberto; a versão hospedada usa Convex/Netlify.

Em outro computador, use Node 24 e pnpm 10.30.0, instale dependências com `pnpm install --frozen-lockfile`, execute `pnpm setup` e informe os dois acessos. O script gera hashes e chaves novas e não imprime segredos. Não substitua uma chave de criptografia de uma base existente: mantenha backup de `.env.local` e de `.local/finance.enc` em local seguro, fora do Git.

## Fluxos disponíveis

- **Visão Geral:** saldos atuais, entradas/saídas do período, evolução anual, categorias, orçamentos, alertas e vencimentos.
- **Casal & Divisão:** quem pagou, rateio exato, saldo a acertar, quitação parcial/total registrada e metas compartilhadas. Registrar acerto não transfere dinheiro pelo banco.
- **Patrimônio & Invest:** posições informadas, valor aplicado, variação, reservas/metas e simulação de CDI com taxa fornecida pelo usuário. A simulação usa ponto fixo e não altera posições reais.
- **Cartões & Cashback:** cadastro, limites, fatura por competência, compras parceladas, cashback estimado e registro de pagamento sem duplicar consumo. Nenhum CVV ou número completo é solicitado.
- **Extrato & Conciliação:** lançamentos manuais, pendências, filtros, categorização, regras aprendidas, estorno, exclusão, CSV/OFX, aprovação/reprovação e exportação sanitizada contra fórmulas de planilha.
- **Contas & conexões:** cadastrar/editar contas e saldo inicial, configurar/remover Meu Pluggy e consultar a auditoria sanitizada. Simulações só ficam disponíveis com demonstração explicitamente habilitada em uma base separada.
- **Dois perfis:** Individual mostra dados próprios; Casal mostra compartilhados; Consolidado reúne os dois. A escrita em contas pessoais do outro perfil é recusada no servidor.

Os agentes são regras próprias: Albert (suspeitas/assinaturas), Sherlock (categorias), Marie (comparação de períodos equivalentes), Megamen (orçamento), Julius (compras acima da mediana histórica) e Rita (missões sugeridas). Sem WhatsApp, tokens de IA ou LLM externo. Ausência de alerta não comprova ausência de problema.

## Importação

Use os arquivos exportados pelo seu banco. Os arquivos fictícios em `examples/` servem exclusivamente para testes isolados e nunca são importados automaticamente. CSV padrão: `Data;Descrição;Valor;ID`, com despesas negativas e formato brasileiro. Há mapeamento de colunas e escolha de separador decimal no formulário. OFX suporta transações `STMTTRN` com `DTPOSTED`, `TRNAMT`, `FITID`, `MEMO`/`NAME`.

Limites de segurança desta versão: 2 MB e 1.000 transações por arquivo/lote. Não existe tarifa ou cota comercial do aplicativo. Identificadores são contextualizados por conta e fonte; descrições externas permanecem dados. Importações ficam em `NEEDS_REVIEW` e só entram no saldo depois da aprovação.

Importar de duas fontes diferentes pode representar a mesma compra com IDs diferentes: isso exige conciliação e não deve ser confundido com duas cobranças bancárias reais. O detector apenas sinaliza suspeitas; não apaga cobranças parecidas.

## Meu Pluggy

Conecte os próprios bancos no Meu Pluggy, autorize o conector MeuPluggy no Dashboard e configure Client ID, Client Secret e itemIds pelo formulário autenticado. O servidor criptografa as credenciais, consulta o fornecedor e separa transações por conta bancária de origem. A atualização do serviço é diária; o botão não força uma nova coleta no banco.

O limite gratuito pessoal publicado é até cinco conexões. A meta de cinco para cada titular requer elegibilidade confirmada pelo fornecedor. Não há contratação automática. Integração real **não foi validada com credenciais bancárias nesta entrega**. Veja fontes em `docs/DECISIONS.md`.

## Publicar em Convex + Netlify

O projeto Git local já foi inicializado. O destino informado é `https://github.com/OnaiZk/controlefinanceiro.git`; envio e visibilidade remota ainda não foram verificados. Envie somente arquivos versionáveis, ou use o pacote de fontes em `artifacts/`. Nunca envie `.env.local`, `.local/`, `node_modules/`, `.next/` ou dados financeiros.

Siga **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**. A URL Convex informada foi registrada somente no ambiente local; uma URL de projeto não substitui a implantação das funções. Login e gravação em produção recusam fallback para arquivo/mock se o Convex estiver ausente.

Este Next.js usa funções de servidor. **Netlify Drop com HTML estático não publica a aplicação completa.** Importe o repositório e configure as variáveis de runtime.

## Aplicativo no celular

- **PWA:** depois de publicado com HTTPS, abra o site no celular e use “Adicionar à tela inicial”/“Instalar aplicativo”. A operação hospedada independe do PC. Quando offline, a interface informa a indisponibilidade; respostas financeiras não são salvas pelo service worker.
- **Expo Go:** `apps/mobile` contém um cliente React Native com WebView, tela de conexão, SecureStore para o endereço, tratamento de erros, navegação e compartilhamento explícito de CSV. Ele reutiliza integralmente os fluxos responsivos e a autenticação HttpOnly da web, sem guardar senhas ou JWT em AsyncStorage/ponte JavaScript.

Para testar Expo: as dependências de `apps/mobile` são instaladas com `pnpm install --frozen-lockfile` na raiz. Configure `.env` a partir de `.env.example` com a URL do Netlify e execute `pnpm --filter @finance/mobile start`. Use Expo Go compatível com o SDK 58 declarado no pacote. Para teste local, informe o IP LAN do computador, não `localhost` do telefone. Adicione essa origem exata (ex.: `http://192.168.0.10:3000`) a `DEV_ALLOWED_ORIGINS` em `.env.local` e reinicie o servidor. Use dados de teste numa base separada na LAN; dados reais devem usar a versão HTTPS publicada.

O carregamento inicial pelo Metro no Expo Go continua sendo um fluxo de desenvolvimento. A distribuição permanente do bundle Expo sem PC exige um fluxo adicional que não foi publicado nesta entrega. Para uso imediato hospedado sem PC e sem lojas, use a **PWA**. Não houve validação em celulares/Expo nesta sessão.

## Segurança

- Argon2id: salt aleatório de 16 bytes, 64 MiB, três passagens, uma via e hash PHC padrão. Sem senha em texto puro persistida.
- JWT HS256: expiração de oito horas, emissor/audiência fixos e sessão revogável no servidor. Cookie web HttpOnly, SameSite Strict e Secure em produção.
- AES-256-GCM: IV aleatório de 12 bytes, tag autenticada e contexto por titular. Credenciais Pluggy cifradas; arquivo local inteiro também cifrado. Sessões guardam somente digest do token.
- Origin/CSRF, validação Zod, lista fechada de usuários e autorização no backend. Identidade do ator sempre vem da sessão verificada.
- Auditoria com ator, ação, referência, resultado e horário; sem valores financeiros, descrições ou tokens. Exportações também são auditadas.
- Produção usa um segredo de ponte somente entre servidor Netlify e Convex; nunca no navegador. Nenhuma tabela possui endpoint público de leitura sem essa verificação.

## Comandos e validação

```text
pnpm install --frozen-lockfile
pnpm setup
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:browser
pnpm build
pnpm convex:deploy
pnpm package:source
```

Os equivalentes `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:browser` e `npm run build` usam os mesmos scripts. O projeto usa pnpm 10.30.0 e o lockfile incluído; `typecheck` verifica web/API/shared/Convex e também o cliente Expo. As dependências desta instalação foram reinstaladas pelo lockfile, sem referências a outros projetos.

`test:browser` usa Chrome ou Edge já instalado (ou o caminho em `BROWSER_EXECUTABLE`), inicia um servidor separado na porta 3107 e cria acessos e dados temporários em `.local/browser-*`. Nunca usa a base pessoal. Os resultados e capturas ficam nessa pasta ignorada. A sincronização bancária real e a instalação no celular continuam sendo verificações próprias.

O runner Vitest usa transpilação TypeScript em processo e workers de threads para compatibilidade com esta restrição do Windows. O servidor de desenvolvimento também inicia em processo; a publicação Netlify usa o build Next.js padrão.

Resultados e limites da verificação: **[docs/QA.md](docs/QA.md)**. Docker, backend Convex real, publicação Netlify, Meu Pluggy real, instalação PWA e execução Expo são verificações separadas dos testes locais de código/API.
