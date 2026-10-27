import assert from 'node:assert/strict';
import { argon2Sync, randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright-core';

// Credenciais e dados exclusivos desta execução. Nunca usa a base nem as senhas pessoais.
const root = resolve(import.meta.dirname, '..');
const folder = resolve(root, '.local', `browser-${randomUUID()}`);
await mkdir(folder, { recursive: true });
const port = Number(process.env.BROWSER_TEST_PORT ?? 3107);
const origin = `http://localhost:${port}`;
const password = randomBytes(24).toString('hex');
const hash = () => {
  const salt = randomBytes(16);
  const value = argon2Sync('argon2id', {
    message: password,
    nonce: salt,
    parallelism: 1,
    memory: 65536,
    passes: 3,
    tagLength: 32,
  });
  return `$argon2id$v=19$m=65536,t=3,p=1$${salt.toString('base64').replace(/=+$/, '')}$${value.toString('base64').replace(/=+$/, '')}`;
};
const provider = createServer((_req, res) => {
  res.writeHead(503, { 'Content-Type': 'application/json' });
  res.end('{}');
});
await new Promise((resolveReady) => provider.listen(0, '127.0.0.1', resolveReady));
const env = {
  ...process.env,
  NODE_ENV: 'development',
  NODE_TLS_REJECT_UNAUTHORIZED: '1',
  PORT: String(port),
  DATABASE_MODE: 'local',
  LOCAL_DATA_PATH: resolve(folder, 'finance.enc'),
  SEED_DEMO_DATA: 'false',
  APP_ORIGIN: origin,
  DEV_ALLOWED_ORIGINS: '',
  NETLIFY: 'false',
  NEXT_TELEMETRY_DISABLED: '1',
  CAS_EMAIL: 'qa-cas@example.com',
  KET_EMAIL: 'qa-ket@example.com',
  CAS_PASSWORD_HASH: hash(),
  KET_PASSWORD_HASH: hash(),
  JWT_SECRET: randomBytes(32).toString('hex'),
  ENCRYPTION_KEY: randomBytes(32).toString('hex'),
  BACKEND_BRIDGE_SECRET: randomBytes(32).toString('hex'),
  PLUGGY_API_URL: `http://127.0.0.1:${provider.address().port}`,
};
const server = spawn(process.execPath, [resolve(root, 'scripts/web.mjs'), 'dev'], {
  cwd: root,
  env,
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverError;
server.on('error', (error) => {
  serverError = error;
});
let log = '';
for (const stream of [server.stdout, server.stderr])
  stream.on('data', (chunk) => {
    log = (log + chunk).slice(-16000);
  });
const checks = [];
let browser;
let page;
const record = (label) => {
  checks.push(label);
  console.log('OK:', label);
};
try {
  const deadline = Date.now() + 120000;
  for (;;) {
    if (serverError) throw serverError;
    if (server.exitCode !== null) throw new Error('O servidor de teste encerrou antes de iniciar.');
    try {
      if (
        (
          await fetch(`${origin}/api/health`, {
            signal: AbortSignal.timeout(3000),
          })
        ).ok
      )
        break;
    } catch {
      /* aguardar início */
    }
    if (Date.now() > deadline) throw new Error('O servidor isolado não iniciou em dois minutos.');
    await delay(500);
  }
  const executablePath =
    process.env.BROWSER_EXECUTABLE ??
    [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    ].find((path) => existsSync(path));
  browser = await chromium.launch({
    ...(executablePath ? { executablePath } : { channel: 'chrome' }),
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const button = (name, area = page) => area.getByRole('button', { name, exact: true });
  const field = (name) => page.getByRole('dialog').locator(`[name="${name}"]`);
  const dialog = () => page.getByRole('dialog');
  const ready = async () => {
    await page.waitForSelector('.workspace[aria-busy="false"]');
    await page.waitForFunction(
      () => !document.querySelector('.skeleton-grid') && !document.querySelector('.page-error'),
    );
  };
  const nav = async (name) => {
    await button(name, page.locator('.section-tabs')).click();
    await ready();
  };
  const save = async (label = 'Confirmar registro') => {
    const response = page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().startsWith(`${origin}/api/`),
    );
    await button(label, dialog()).click();
    const result = await response;
    if (!result.ok()) throw new Error(`Formulário recusado: ${(await result.json()).error}`);
    await dialog().waitFor({ state: 'hidden' });
    await ready();
  };
  const state = async (view = 'INDIVIDUAL') =>
    (await context.request.get(`${origin}/api/snapshot?view=${view}`)).json();
  const row = (name) =>
    page.locator('.transaction-row').filter({ has: page.getByText(name, { exact: true }) });
  const menu = async (name, action) => {
    const target = row(name);
    if ((await target.locator('details').getAttribute('open')) === null)
      await target.locator('summary').click();
    await button(action, target).click();
  };
  await page.goto(origin, { timeout: 120000, waitUntil: 'domcontentloaded' });
  await button('Mostrar senha').click();
  assert.equal(await page.locator('[name=password]').getAttribute('type'), 'text');
  await button('Ocultar senha').click();
  await page.locator('[name=email]').fill(env.CAS_EMAIL);
  await page.locator('[name=password]').fill('senha-invalida');
  await button('Entrar no meu espaço').click();
  await page.getByRole('alert').filter({ hasText: 'incorretos' }).waitFor();
  record('mostrar/ocultar senha e erro de login');
  await page.locator('[name=password]').fill(password);
  await button('Entrar no meu espaço').click();
  await ready();
  assert.equal((await state()).accounts.length, 0);
  assert.equal((await state()).transactions.length, 0);
  assert.equal((await state()).demoEnabled, false);
  record('login CAS em base vazia sem demonstração');
  await page.screenshot({ path: resolve(folder, 'desktop-empty.png'), fullPage: true });

  for (const view of ['Individual', 'Casal', 'Consolidado', 'Individual']) {
    await button(view, page.locator('.view-switch')).click();
    await ready();
    await button(view, page.locator('.view-switch')).click();
    await ready();
  }
  record('três modos e clique repetido no modo atual');
  const currentMonth = await page.getByLabel('Selecionar mês', { exact: true }).inputValue();
  await button('Mês anterior').click();
  await ready();
  assert.notEqual(
    await page.getByLabel('Selecionar mês', { exact: true }).inputValue(),
    currentMonth,
  );
  await button('Próximo mês').click();
  await ready();
  assert.equal(await page.getByLabel('Selecionar mês', { exact: true }).inputValue(), currentMonth);
  await page.getByLabel('Selecionar mês', { exact: true }).fill(currentMonth.slice(0, 4) + '-01');
  await ready();
  await page.getByLabel('Selecionar mês', { exact: true }).fill(currentMonth);
  await ready();
  await page
    .getByRole('button', { name: `Selecionar ${currentMonth}`, exact: true })
    .press('Enter');
  await ready();
  record('mês anterior, próximo, seletor e gráfico por teclado');
  await button('Alternar tema').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await button('Alternar tema').click();
  await button('Ocultar valores').click();
  assert.ok(await page.getByLabel('Valor oculto', { exact: true }).count());
  await button('Mostrar valores').click();
  record('tema claro/escuro e privacidade de valores');

  await page.route(/\/api\/snapshot\?/, route => route.fulfill({
    status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Falha temporária de teste' }),
  }), { times: 1 });
  await button('Próximo mês').click();
  await page.locator('.page-error').waitFor();
  await button('Tentar novamente', page.locator('.page-error')).click();
  await ready();
  await button('Mês anterior').click();
  await ready();
  record('erro de consulta visível e botão Tentar novamente');

  await button('Novo lançamento').click();
  await button('Cancelar', dialog()).click();
  await button('Novo lançamento').click();
  await button('Fechar', dialog()).click();
  await button('Novo lançamento').click();
  await page.keyboard.press('Escape');
  await dialog().waitFor({ state: 'hidden' });
  record('abrir, cancelar, fechar e Escape nos formulários');

  await button('Ver minhas contas').click();
  assert.equal(await button('Importar movimentos simulados').count(), 0);
  await button('Cadastrar conta').click();
  await field('name').fill('Conta QA');
  await field('institution').fill('Instituição QA');
  await field('amount').fill('1000,00');
  await save();
  const accountId = (await state()).accounts[0].id;
  await button('Editar conta Conta QA').click();
  await field('name').fill('Conta QA editada');
  await save();
  assert.equal((await state()).accounts[0].name, 'Conta QA editada');
  await button('Adicionar conta').click();
  await field('name').fill('Carteira QA');
  await field('institution').fill('Carteira');
  await field('amount').fill('0,00');
  await save();
  const secondId = (await state()).accounts.find((a) => a.name === 'Carteira QA').id;
  const mock = await context.request.post(`${origin}/api/bank/sync`, {
    headers: { Origin: origin },
    data: { provider: 'MOCK', accountId },
  });
  assert.equal(mock.status(), 400);
  record('cadastrar/editar contas e recusar simulação no servidor');

  await nav('Extrato & Conciliação');
  const transaction = async (name, options = {}) => {
    await button('Novo lançamento').click();
    if (options.scope) await field('ownerScope').selectOption(options.scope);
    if (options.type)
      await dialog().getByLabel(/Tipo de lançamento/).selectOption(options.type);
    await field('description').fill(name);
    await field('amount').fill(options.amount ?? '10,01');
    if (options.card) {
      await field('occurredAt').fill(`${currentMonth}-01`);
      await dialog().getByLabel(/Forma de pagamento/).selectOption('card');
      await field('cardId').selectOption(options.card);
      if (options.installments) await field('installments').fill(options.installments);
    } else await field('accountId').selectOption(accountId);
    if (options.destination) await field('destinationAccountId').selectOption(options.destination);
    if (options.status) await field('status').selectOption(options.status);
    await save();
  };
  await transaction('Despesa QA', { status: 'PENDING' });
  assert.equal((await state()).summary.balanceCents, 100000);
  await menu('Despesa QA', 'Marcar como realizado');
  await ready();
  await page.waitForFunction(
    () => !document.querySelector('.transaction-row')?.textContent?.includes('Pendente'),
  );
  await menu('Despesa QA', 'Editar lançamento');
  await field('description').fill('Despesa QA editada');
  await field('amount').fill('12,34');
  await save();
  assert.equal(
    (await state()).transactions.find((t) => t.description === 'Despesa QA editada').amountCents,
    1234,
  );
  await menu('Despesa QA editada', 'Categoria & regra');
  await field('categoryId').selectOption('cat-LAZ');
  await save();
  assert.equal((await state()).categoryRules.length, 1);
  record('lançamento pendente, realização, edição e categoria aprendida');
  await transaction('Receita QA', { type: 'INCOME', amount: '20,00' });
  await transaction('Transferência QA', {
    type: 'TRANSFER',
    destination: secondId,
    amount: '5,00',
  });
  await transaction('Receita casal QA', {
    type: 'INCOME',
    scope: 'COUPLE',
    amount: '30,00',
  });
  await transaction('Despesa casal QA', { scope: 'COUPLE', amount: '10,02' });
  record('receita, transferência e receita/despesa compartilhadas');

  await page.getByLabel('Buscar lançamento', { exact: true }).fill('Receita QA');
  assert.equal(await page.locator('.transaction-row').count(), 1);
  await page.getByLabel('Buscar lançamento', { exact: true }).fill('');
  await page.getByLabel('Filtrar situação').selectOption('PENDING');
  assert.equal(await page.locator('.transaction-row').count(), 0);
  await page.getByLabel('Filtrar situação').selectOption('ALL');
  await page.getByLabel('Filtrar categoria').selectOption('cat-SAL');
  assert.equal(await page.locator('.transaction-row').count(), 1);
  await page.getByLabel('Filtrar categoria').selectOption('ALL');
  record('busca e filtros de situação/categoria');
  const downloadEvent = page.waitForEvent('download');
  await button('Exportar CSV').click();
  const download = await downloadEvent;
  assert.match(download.suggestedFilename(), /\.csv$/);
  await download.saveAs(resolve(folder, 'extrato.csv'));
  await button('Fechar mensagem').click();
  record('exportação CSV e fechar mensagem');

  const importedFile = {
    name: 'qa.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      `Data;Descrição;Valor;ID\n${currentMonth}-01;Importação aprovar QA;-3,00;qa-1\n${currentMonth}-01;Importação reprovar QA;-4,00;qa-2`,
    ),
  };
  const importFile = async () => {
    await button('Importar extrato').click();
    await field('accountId').selectOption(accountId);
    await dialog().locator('input[type=file]').setInputFiles(importedFile);
    await save('Importar para revisão');
  };
  await importFile();
  await button('Revisar agora').click();
  await button('Aprovar Importação aprovar QA').click();
  await ready();
  await page
    .getByRole('button', { name: 'Aprovar Importação aprovar QA', exact: true })
    .waitFor({ state: 'hidden' });
  await button('Reprovar Importação reprovar QA').click();
  await ready();
  await page.getByLabel('Filtrar situação').selectOption('REJECTED');
  await menu('Importação reprovar QA', 'Reabrir revisão');
  await ready();
  await page.getByLabel('Filtrar situação').selectOption('NEEDS_REVIEW');
  await button('Aprovar Importação reprovar QA').click();
  await ready();
  await importFile();
  assert.equal((await state()).transactions.filter((t) => t.source === 'FILE').length, 2);
  await page.getByLabel('Filtrar situação').selectOption('ALL');
  record('arquivo CSV, aprovar/reprovar/reabrir revisão e deduplicação');

  await menu('Despesa QA editada', 'Registrar estorno');
  await button('Cancelar', page.getByRole('alertdialog')).click();
  await menu('Despesa QA editada', 'Registrar estorno');
  await button('Confirmar', page.getByRole('alertdialog')).click();
  await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
  await ready();
  assert.equal((await state()).transactions.filter((t) => t.entryKind === 'REFUND').length, 1);
  await transaction('Excluir QA');
  await menu('Excluir QA', 'Excluir lançamento');
  await button('Confirmar', page.getByRole('alertdialog')).click();
  await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
  await ready();
  assert.equal(
    (await state()).transactions.some((t) => t.description === 'Excluir QA'),
    false,
  );
  record('cancelar/confirmar estorno e excluir lançamento');

  await nav('Visão Geral');
  await button('Criar orçamento').click();
  await field('amount').fill('200,00');
  await save();
  await button('Ajustar planejamento').click();
  await field('amount').fill('250,00');
  await save();
  await button('Adicionar conta recorrente').click();
  await field('name').fill('Recorrente QA');
  await field('amount').fill('15,00');
  await save();
  await button('Registrar pagamento de Recorrente QA').click();
  await field('accountId').selectOption(accountId);
  await save();
  await page.getByLabel('Janela de vencimentos').selectOption('7');
  await page.getByLabel('Janela de vencimentos').selectOption('30');
  const dismiss = page.getByRole('button', { name: /^Dispensar alerta / });
  if (await dismiss.count()) {
    await dismiss.first().click();
    await ready();
  }
  record('criar/ajustar orçamento, recorrência, pagamento, janela e dispensar alerta');

  await nav('Casal & Divisão');
  await button('Ver nosso espaço').click();
  await ready();
  await button('Registrar acerto').click();
  await save();
  assert.equal((await state('COUPLE')).summary.coupleDebtCents, 0);
  await button('Criar meta').click();
  await field('name').fill('Meta QA');
  await field('target').fill('1000,00');
  await field('targetDate').fill(`${Number(currentMonth.slice(0, 4)) + 1}-12-01`);
  await save();
  await button('Atualizar reserva').click();
  await field('amount').fill('20,00');
  await save();
  assert.equal((await state('COUPLE')).goals[0].savedCents, 2000);
  record('espaço do casal, acerto e criar/atualizar meta');

  await button('Individual', page.locator('.view-switch')).click();
  await ready();
  await nav('Patrimônio & Invest');
  await button('Adicionar ativo').click();
  await field('name').fill('Investimento QA');
  await field('principal').fill('100,00');
  await field('current').fill('101,00');
  await save();
  await button('Atualizar Investimento QA').click();
  await field('amount').fill('102,00');
  await save();
  assert.equal((await state()).investments[0].currentBalanceCents, 10200);
  await page.locator('.simulation-form [name=principal]').fill('1000,00');
  await page.locator('.simulation-form [name=annual]').fill('10');
  await button('Simular cenário').click();
  await page.locator('.simulation-result').waitFor();
  record('cadastrar/atualizar investimento e simulação CDI');

  await nav('Cartões & Cashback');
  await button('Adicionar cartão').click();
  await field('name').fill('Cartão QA');
  await field('last4').fill('1234');
  await field('amount').fill('1000,00');
  await save();
  const cardId = (await state()).cards[0].id;
  await transaction('Compra QA', { card: cardId });
  await button('Registrar pagamento').click();
  await field('accountId').selectOption(accountId);
  await save();
  assert.equal((await state()).cards[0].invoiceCents, 0);
  await transaction('Parcelas QA', {
    card: cardId,
    installments: '3',
    amount: '10,00',
  });
  assert.ok(
    (await state()).transactions.some(
      (t) => t.description.includes('Parcelas QA') && t.installmentGroup,
    ),
  );
  record('cadastrar cartão, compra, quitar fatura e parcelamento');

  await nav('Extrato & Conciliação');
  await button('Consultar bancos').click();
  await field('clientId').fill('qa-client-id');
  await field('clientSecret').fill('qa-client-secret');
  await field('itemIds').fill('qa-item-id');
  await save('Salvar conexão');
  await button('Contas e configurações').click();
  await button('Consultar meus dados').click();
  await page
    .getByRole('status')
    .filter({
      hasText: /Pluggy|conexão|consulta|serviço|respondeu|fornecedor|HTTPS/i,
    })
    .waitFor();
  await button('Desconectar').click();
  await ready();
  await button('Configurar conexão').waitFor();
  record('configurar banco, apresentar erro de configuração segura e desconectar');

  await page.setViewportSize({ width: 390, height: 844 });
  for (const tab of ['Início', 'Casal', 'Patrimônio', 'Cartões', 'Extrato']) {
    await button(tab, page.locator('.mobile-nav')).click();
    await ready();
  }
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await button('Contas e configurações').click();
  await page.getByRole('heading', { name: 'Suas contas', exact: true }).waitFor();
  await button('Sair da conta').click();
  await button('Entrar no meu espaço').waitFor();
  await page.locator('[name=email]').fill(env.KET_EMAIL);
  await page.locator('[name=password]').fill(password);
  await button('Entrar no meu espaço').click();
  await ready();
  assert.equal((await state()).accounts.length, 0);
  assert.ok((await state('CONSOLIDATED')).accounts.length >= 2);
  assert.equal(await page.getByRole('status').count(), 0, 'Avisos do perfil anterior devem ser descartados');
  await page.screenshot({ path: resolve(folder, 'mobile-empty.png'), fullPage: true });
  record('navegação em largura móvel, configurações, logout, login KET e isolamento');
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(folder, 'results.json'),
    JSON.stringify(
      {
        checks,
        pageErrors: errors,
        realProviderTested: false,
        realDeviceTested: false,
      },
      null,
      2,
    ),
  );
  console.log(
    `Navegador: ${checks.length} grupos aprovados. Dados e resultados isolados em ${folder}.`,
  );
} catch (error) {
  await page?.screenshot({ path: resolve(folder, 'failure.png'), fullPage: true }).catch(() => {});
  if (page) await writeFile(resolve(folder, 'failure-page.txt'), await page.locator('body').innerText().catch(() => ''));
  await writeFile(resolve(folder, 'failure.log'), log);
  console.error(error instanceof Error ? error.message : 'Falha no teste de navegador.');
  process.exitCode = 1;
} finally {
  await browser?.close();
  provider.closeAllConnections();
  provider.close();
  server.kill('SIGTERM');
}
