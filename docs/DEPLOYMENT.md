# Publicação gratuita — Convex e Netlify

Referência: 2026-10-25. Configuração preparada; não representa publicação concluída.

## 1. Preparar o repositório

Repositório informado: `https://github.com/OnaiZk/controlefinanceiro.git`. A visibilidade e o conteúdo remoto ainda não foram verificados. Prefira mantê-lo privado. Na raiz deste projeto, envie somente os arquivos que o Git não ignora. O Git local já está inicializado. Não execute `git add -f` em arquivos de configuração privada.

```powershell
git remote add origin https://github.com/OnaiZk/controlefinanceiro.git
git add .
git commit -m "Implementa controle financeiro do casal"
git push -u origin main
```

Se não usar Git no terminal, o pacote `artifacts/entre-contas-source.zip` contém somente fontes, exemplos e documentação. Ele não contém suas credenciais e não deve ser enviado ao Netlify Drop; descompacte e use-o para criar o repositório.

## 2. Publicar as funções no seu Convex

Projeto informado: `https://neat-perch-479.convex.cloud`. Endpoint HTTP informado: `https://neat-perch-479.convex.site`. Estas URLs são públicas; não são chaves de administração. O SDK deste projeto utiliza a URL `.cloud`; a URL `.site` não a substitui.

1. Preserve o **BACKEND_BRIDGE_SECRET** aleatório de `.env.local`. Não copie JWT_SECRET ou ENCRYPTION_KEY para o frontend.
2. Gere uma deploy key do deployment pretendido. Configure `CONVEX_DEPLOY_KEY` em `.env.local` ou no ambiente do terminal, sem enviar pelo chat e sem gravar no Git.
3. Execute `pnpm convex:deploy` na raiz, ou abra `CONFIGURAR-CONVEX.bat`. O script carrega o ambiente local, configura o segredo de ponte via stdin no CLI oficial e publica as funções. Confirme que o deployment publicado é o da URL pretendida; se for outro, use a URL retornada para esse deployment no Netlify.
4. No Dashboard, verifique as tabelas e `finance:execute`. Não habilite leitura pública de tabelas.

O segredo de ponte deve corresponder exatamente nos dois servidores. Login inicial no site cria somente os dois usuários com hashes já configurados; os clientes nunca conseguem disparar bootstrap sem passar pelo servidor autenticador/segredo de ponte.

Para experimentar o backend sem conta externa: use o compose e o CLI oficial para self-hosting, conforme a seção local abaixo. O adapter de arquivo cifrado já permite testar toda a lógica sem Docker.

## 3. Importar no Netlify

Selecione o plano **Free**. Não ative recarga, Starter de outros serviços, add-ons ou cartão para compensar limites.

Importe o repositório e configure:

| Campo             | Valor                            |
| ----------------- | -------------------------------- |
| Base directory    | Raiz do repositório, deixe vazio |
| Package directory | `apps/web`                       |
| Build command     | `pnpm build`                     |
| Publish directory | `apps/web/.next`                 |
| Node.js           | Linha 24, versão >= 24.7         |

O arquivo `apps/web/netlify.toml` configura build e publicação. O adapter Next.js do Netlify é detectado pela plataforma; não há plugin legado instalado. Gere e versionе o lockfile ao instalar com pnpm em um ambiente com rede antes de adotar builds congelados.

Crie o site para receber seu endereço `.netlify.app`; a primeira tentativa sem segredos pode exibir erro de configuração no login. Configure então as variáveis abaixo no painel, com escopo de **Functions/runtime** (e Build quando necessário), e publique novamente.

| Variável                                 | Valor/configuração                                                                     |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| `DATABASE_MODE`                          | `convex`                                                                               |
| `SEED_DEMO_DATA`                         | `false` para uma base real vazia, ou `true` **apenas em deployment dedicado de teste** |
| `CONVEX_URL`                             | URL do deployment publicado                                                            |
| `APP_ORIGIN`                             | URL HTTPS exata do Netlify, sem barra final                                            |
| `BACKEND_BRIDGE_SECRET`                  | Mesmo segredo do Convex                                                                |
| `JWT_SECRET`                             | Chave aleatória de 64 caracteres hexadecimais, de `.env.local`                         |
| `ENCRYPTION_KEY`                         | Chave aleatória de 64 caracteres hexadecimais, de `.env.local`; preserve-a em backup   |
| `CAS_EMAIL`, `KET_EMAIL`                 | Emails dos dois perfis                                                                 |
| `CAS_PASSWORD_HASH`, `KET_PASSWORD_HASH` | Hashes PHC Argon2id do ambiente local, copiando o valor **sem aspas externas**         |
| `PLUGGY_API_URL`                         | URL oficial configurada no ambiente de exemplo                                         |
| `PRIVACY_MODE`                           | `local` (sem LLM externo)                                                              |
| `AWS_LAMBDA_JS_RUNTIME`                  | `nodejs24.x`, configurado **no painel**, não no TOML                                   |

Não prefixar segredos com `NEXT_PUBLIC_` ou `EXPO_PUBLIC_`. A deploy key do Convex não é necessária ao navegador nem ao runtime Next.js: é usada somente para publicar o backend. As credenciais bancárias são configuradas pelo próprio login na interface e cifradas antes de persistir.

**Dados de teste e reais:** não ative dados de demonstração num deployment com dados reais. A inicialização é executada somente se a tabela de usuários estiver vazia. Mudar `SEED_DEMO_DATA` depois não apaga nem converte uma base. Não há exclusão automática de histórico.

## 4. Conferir antes de usar dados reais

1. Abrir a URL HTTPS e entrar com cada login.
2. Verificar Individual, Casal e Consolidado; conferir se a escrita nos dados pessoais do outro é recusada.
3. Criar conta com saldo inicial correto, lançamento, transferência, compra e pagamento de fatura.
4. Importar o arquivo de exemplo duas vezes; conferir contagem, pendências e aprovação única.
5. Registrar despesa compartilhada e acerto parcial; conferir centavos e ausência de dupla contagem.
6. Sair, confirmar revogação, abrir no outro celular e testar instalação da PWA.
7. Desligar o computador pessoal e repetir login, consulta e gravação pela URL publicada.
8. Fazer exportação de backup pelo Dashboard Convex e preservar a chave de criptografia em local seguro. Não usar o CSV do extrato como substituto de um backup integral.

Falha de configuração ou cota deve ficar visível; produção não cai silenciosamente para mock, memória ou arquivo temporário do Netlify.

## 5. Convex local via Docker

O compose fornece backend em `127.0.0.1:3210`, endpoint HTTP em `3211` e Dashboard em `6791`, com volume persistente. Execute `docker compose up -d`, obtenha a chave administrativa conforme o guia oficial e configure o CLI para o deployment self-hosted. Configure o mesmo `BACKEND_BRIDGE_SECRET`, publique as funções e defina `DATABASE_MODE=convex`/`CONVEX_URL` para o endpoint local quando quiser exercitar esse adapter.

**Não testado nesta sessão:** Docker não está instalado no ambiente. O compose usa as imagens oficiais; revise e fixe um digest após validar a versão que você utilizar. Nunca exponha as portas do backend/Dashboard à internet sem uma implantação própria adequada.

## Fontes oficiais consultadas em 2026-10-25

- [Monorepos Netlify](https://docs.netlify.com/build/configure-builds/monorepos/): base, package directory e localização do TOML.
- [Next.js no Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/): adapter e funções de servidor.
- [Runtime Node das funções](https://docs.netlify.com/build/functions/configuration/?fn-language=js): Node 24 e variável definida no painel.
- [Convex com Netlify](https://docs.convex.dev/production/hosting/netlify): deployment e uso da deploy key.
- [Convex self-hosted](https://docs.convex.dev/self-hosting): configuração do ambiente próprio.
