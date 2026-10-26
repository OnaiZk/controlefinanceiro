import assert from 'node:assert/strict';
const base = process.env.TEST_ORIGIN || 'http://localhost:3000';
if (process.stdin.isTTY) {
  console.error(
    'Forneça um JSON de credenciais por stdin: perfis CAS e KET, cada um com email e password. As credenciais não são impressas.',
  );
  process.exit(1);
}
let input = '';
for await (const chunk of process.stdin) input += chunk;
const credentials = JSON.parse(input),
  cookies = {},
  created = [];
let checks = 0;
async function request(path, method = 'GET', data, cookie, origin = base) {
  const response = await fetch(base + '/api/' + path, {
    method,
    headers: {
      ...(method === 'POST' ? { 'Content-Type': 'application/json', Origin: origin } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(90000),
  });
  const body = await response.json();
  return {
    status: response.status,
    data: body,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  };
}
function check(value, label) {
  assert.ok(value, label);
  checks++;
  console.log('OK:', label);
}
try {
  check((await request('health')).status === 200, 'servidor responde');
  check((await request('snapshot')).status === 401, 'dados protegidos sem login');
  check(
    (await request('auth/login', 'POST', credentials.CAS, undefined, 'https://external.invalid'))
      .status === 403,
    'origem externa bloqueada',
  );
  for (const slug of ['CAS', 'KET']) {
    const result = await request('auth/login', 'POST', credentials[slug]);
    check(
      result.status === 200 && result.data.user.slug === slug && !result.data.token,
      `login web ${slug} sem JWT no corpo`,
    );
    cookies[slug] = result.cookie;
    check(Boolean(result.cookie), `cookie de sessão ${slug}`);
  }
  const cas = await request('snapshot?view=INDIVIDUAL', 'GET', undefined, cookies.CAS),
    ket = await request('snapshot?view=INDIVIDUAL', 'GET', undefined, cookies.KET);
  check(
    cas.status === 200 && cas.data.accounts.every((a) => a.ownerScope === 'CAS'),
    'visão individual de Cassiano isolada',
  );
  check(
    ket.status === 200 && ket.data.accounts.every((a) => a.ownerScope === 'KET'),
    'visão individual de Kethellen isolada',
  );
  check(
    !JSON.stringify(cas.data).includes('passwordHash') &&
      !JSON.stringify(cas.data).includes('encryptedPluggyCredentials'),
    'snapshot sem hashes e segredos',
  );
  const consolidated = await request('snapshot?view=CONSOLIDATED', 'GET', undefined, cookies.CAS);
  check(consolidated.status === 200, 'consolidado autorizado');
  const account = cas.data.fundingAccounts.find((a) => a.ownerScope === 'CAS');
  assert.ok(account, 'Cadastre uma conta de teste CAS antes do smoke.');
  const month = cas.data.month,
    date = month + '-15',
    unique = 'Teste automático ' + Date.now();
  const forged = await request(
    'command',
    'POST',
    { kind: 'createTransaction', userId: 'KET', data: {} },
    cookies.CAS,
  );
  check(forged.status === 400, 'userId injetado recusado');
  const createdTx = await request(
    'command',
    'POST',
    {
      kind: 'createTransaction',
      data: {
        ownerScope: 'CAS',
        accountId: account.id,
        categoryId: 'cat-ALM',
        type: 'EXPENSE',
        amountCents: 10001,
        description: unique,
        occurredAt: date,
        status: 'PENDING',
        installments: 1,
        casShareBps: 5000,
      },
    },
    cookies.CAS,
  );
  check(createdTx.status === 200, 'lançamento pendente criado');
  const pending = (await request('snapshot', 'GET', undefined, cookies.CAS)).data;
  const tx = pending.transactions.find((t) => t.description === unique);
  assert.ok(tx);
  created.push(tx.id);
  check(
    pending.summary.balanceCents === cas.data.summary.balanceCents,
    'pendência não altera saldo',
  );
  check(
    (await request('command', 'POST', { kind: 'deleteTransaction', id: tx.id }, cookies.KET))
      .status === 400,
    'outro perfil não altera lançamento pessoal',
  );
  check(
    (await request('command', 'POST', { kind: 'markPaid', id: tx.id }, cookies.CAS)).status === 200,
    'realização confirmada',
  );
  const after = (await request('snapshot', 'GET', undefined, cookies.CAS)).data;
  check(
    after.summary.balanceCents === cas.data.summary.balanceCents - 10001,
    'saldo alterado exatamente em centavos',
  );
  const importData = {
    filename: 'smoke.csv',
    accountId: account.id,
    content: `Data;Descrição;Valor;ID\n${date};${unique} importado;-12,34;${unique}`,
  };
  const imported = await request('import', 'POST', importData, cookies.CAS);
  check(imported.status === 200 && imported.data.imported === 1, 'CSV enviado para revisão');
  const repeat = await request('import', 'POST', importData, cookies.CAS);
  check(repeat.data.imported === 0 && repeat.data.duplicates === 1, 'reimportação deduplicada');
  const staging = (await request('snapshot', 'GET', undefined, cookies.CAS)).data;
  const row = staging.transactions.find((t) => t.externalId === unique);
  assert.ok(row);
  created.push(row.id);
  check(row.status === 'NEEDS_REVIEW', 'item importado exige aprovação');
  const concurrent = await Promise.all([
    request('command', 'POST', { kind: 'review', id: row.id, approve: true }, cookies.CAS),
    request('command', 'POST', { kind: 'review', id: row.id, approve: true }, cookies.CAS),
  ]);
  check(
    concurrent.filter((r) => r.status === 200).length === 1,
    'aprovação concorrente incorpora uma única vez',
  );
  await request('auth/logout', 'POST', {}, cookies.KET);
  check(
    (await request('snapshot', 'GET', undefined, cookies.KET)).status === 401,
    'logout revoga sessão no servidor',
  );
  console.log(
    `Smoke concluído: ${checks} verificações HTTP aprovadas. Não comprova publicação ou banco real.`,
  );
} finally {
  for (const id of created)
    await request('command', 'POST', { kind: 'deleteTransaction', id }, cookies.CAS);
  for (const slug of ['CAS', 'KET'])
    if (cookies[slug]) await request('auth/logout', 'POST', {}, cookies[slug]);
}
