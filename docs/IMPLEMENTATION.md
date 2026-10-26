# Implementação autorizada — 2026-10-25

O usuário solicitou implementar o sistema completo para testes, confirmou Netlify como hospedagem e forneceu os dois logins. Essa solicitação autoriza executar as quatro fases do plano, em sequência, sem nova aprovação entre elas. Não é autorização para cobrar serviços, publicar em lojas ou apresentar integrações externas não testadas como operacionais.

1. Fundação: pnpm/TypeScript, schemas Zod, cálculos em centavos e testes.
2. Backend: Argon2id, JWT, AES-256-GCM, sessões revogáveis, auditoria sanitizada; adapters mock/local e Convex; regras financeiras, importação e agentes.
3. Web: Next.js/PWA para Netlify, cinco áreas completas, CRUD, conciliação, modo casal, gráficos e fluxos de falha.
4. Mobile: cliente Expo Go/WebView reutilizando os fluxos responsivos, com sessão em cookie HttpOnly e endereço salvo em SecureStore; roteiro de teste e configuração hospedada. Execução nativa e distribuição permanente do bundle não foram validadas. PWA HTTPS é o caminho hospedado sem PC.

Senhas fornecidas serão usadas apenas para gerar hashes de bootstrap em arquivos locais ignorados. Não serão persistidas em texto puro em código, exemplos ou documentação. Chaves de integração são criptografadas, não submetidas a hash de senha. O servidor determina a identidade autenticada; dados importados não executam instruções.

Sem credenciais de implantação Convex/Netlify, preparar código, configuração, bootstrap e instruções, sem inventar publicação. O modo local usa persistência de teste separada; produção recusa fallback silencioso para mock ou arquivo. Usar mocks de banco para teste completo sem contas externas; Meu Pluggy real exige configuração e consentimento.
