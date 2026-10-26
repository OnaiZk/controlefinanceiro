import {
  accountBalance,
  addMonths,
  assertWrite,
  brl,
  canRead,
  commandSchema,
  coupleBalance,
  dateInMonth,
  distributeCents,
  invoiceBalance,
  monthSchema,
  normalizeMerchant,
  percentageCents,
  publicUser,
  splitCents,
  stateSchema,
  today,
  type AgentAlert,
  type Command,
  type ImportRecord,
  type Scope,
  type Slug,
  type Snapshot,
  type State,
  type Transaction,
  type View,
} from './index';

export function emptyState(): State {
  return {
    version: 1,
    users: [],
    accounts: [],
    cards: [],
    categories: [],
    categoryRules: [],
    transactions: [],
    budgets: [],
    investments: [],
    agentAlerts: [],
    auditLogs: [],
    goals: [],
    recurringBills: [],
    settlements: [],
    bankConnections: [],
    sessions: [],
    loginThrottles: [],
  };
}
export const categorySeed: State['categories'] = [
  ['ALM', 'Alimentação', true],
  ['MOR', 'Moradia', true],
  ['TRN', 'Transporte', true],
  ['ASS', 'Assinaturas', false],
  ['LAZ', 'Lazer', false],
  ['SAU', 'Saúde', true],
  ['INV', 'Investimentos', true],
  ['OUT', 'Outros', false],
].map(([code, name, essential]) => ({
  id: `cat-${code}`,
  code: String(code),
  name: String(name),
  iconName: String(code),
  type: 'EXPENSE' as const,
  isEssential: Boolean(essential),
}));
categorySeed.push({
  id: 'cat-SAL',
  code: 'SAL',
  name: 'Receitas',
  iconName: 'SAL',
  type: 'INCOME',
  isEssential: true,
});

export function seedState(users: State['users'], now: number, demo: boolean): State {
  const state = emptyState();
  state.users = users;
  state.categories = categorySeed.map((category) => ({ ...category }));
  if (!demo) return state;
  const month = today(now).slice(0, 7);
  state.accounts = [
    {
      id: 'acc-cas',
      ownerScope: 'CAS',
      name: 'Conta principal',
      institution: 'Banco demonstração',
      type: 'CHECKING',
      balanceCents: 485000,
      archived: false,
    },
    {
      id: 'acc-ket',
      ownerScope: 'KET',
      name: 'Conta pessoal',
      institution: 'Banco demonstração',
      type: 'CHECKING',
      balanceCents: 342000,
      archived: false,
    },
    {
      id: 'acc-couple',
      ownerScope: 'COUPLE',
      name: 'Reserva da casa',
      institution: 'Conta compartilhada de teste',
      type: 'SAVINGS',
      balanceCents: 180000,
      archived: false,
    },
  ];
  state.cards = [
    {
      id: 'card-cas',
      ownerScope: 'CAS',
      name: 'Essencial',
      last4: '4821',
      limitCents: 800000,
      closingDay: 20,
      dueDay: 27,
      cashbackBps: 100,
      archived: false,
    },
    {
      id: 'card-ket',
      ownerScope: 'KET',
      name: 'Cotidiano',
      last4: '9036',
      limitCents: 500000,
      closingDay: 18,
      dueDay: 25,
      cashbackBps: 150,
      archived: false,
    },
  ];
  let seq = 0;
  const push = (
    ownerScope: Scope,
    payer: Slug,
    amount: number,
    desc: string,
    code: string,
    date: string,
    type: 'INCOME' | 'EXPENSE',
    card = false,
    status: Transaction['status'] = 'PAID',
  ) => {
    state.transactions.push({
      id: `demo-${seq++}`,
      ownerScope,
      paidByUserId: payer,
      ...(card
        ? { cardId: `card-${payer.toLowerCase()}` }
        : { accountId: `acc-${payer.toLowerCase()}` }),
      categoryId: `cat-${code}`,
      type,
      status,
      amountCents: amount,
      cashbackEarnedCents:
        card && type === 'EXPENSE' ? percentageCents(amount, payer === 'CAS' ? 100 : 150) : 0,
      description: desc,
      merchantNormalized: normalizeMerchant(desc),
      occurredAt: date,
      ...(ownerScope === 'COUPLE' ? { coupleSplit: splitCents(amount, 5000, payer) } : {}),
      source: 'MOCK',
      entryKind: 'STANDARD',
      createdBy: payer,
      createdAt: now,
    });
  };
  for (let offset = -5; offset <= 0; offset++) {
    const m = addMonths(`${month}-01`, offset).slice(0, 7);
    push('CAS', 'CAS', 620000, 'Salário', 'SAL', `${m}-02`, 'INCOME');
    push('KET', 'KET', 480000, 'Salário', 'SAL', `${m}-03`, 'INCOME');
    push('COUPLE', 'CAS', 185000, 'Aluguel da casa', 'MOR', `${m}-05`, 'EXPENSE');
    push(
      'COUPLE',
      'KET',
      48650 + (offset + 5) * 2150,
      'Mercado da semana',
      'ALM',
      `${m}-08`,
      'EXPENSE',
    );
    push(
      'CAS',
      'CAS',
      18900 + (offset + 5) * 750,
      'Mobilidade urbana',
      'TRN',
      `${m}-10`,
      'EXPENSE',
    );
    push('KET', 'KET', 14500, 'Consulta de rotina', 'SAU', `${m}-12`, 'EXPENSE');
    push('CAS', 'CAS', 3990, 'Assinatura de música', 'ASS', `${m}-14`, 'EXPENSE', true);
    push(
      'COUPLE',
      'CAS',
      16890 + (offset + 5) * 1100,
      'Jantar a dois',
      'LAZ',
      `${m}-15`,
      'EXPENSE',
      true,
    );
    push('KET', 'KET', 8990, 'Livraria', 'LAZ', `${m}-16`, 'EXPENSE', true);
    push('CAS', 'CAS', 12990, 'Restaurante', 'ALM', `${m}-18`, 'EXPENSE');
  }
  state.transactions = state.transactions.filter((t) => t.occurredAt <= today(now));
  push(
    'CAS',
    'CAS',
    8990,
    'Assinatura a conferir',
    'ASS',
    today(now),
    'EXPENSE',
    false,
    'NEEDS_REVIEW',
  );
  state.budgets = [
    {
      id: 'budget-1',
      ownerScope: 'COUPLE',
      categoryId: 'cat-ALM',
      monthKey: month,
      limitCents: 90000,
    },
    {
      id: 'budget-2',
      ownerScope: 'COUPLE',
      categoryId: 'cat-MOR',
      monthKey: month,
      limitCents: 210000,
    },
    {
      id: 'budget-3',
      ownerScope: 'CAS',
      categoryId: 'cat-ALM',
      monthKey: month,
      limitCents: 50000,
    },
    {
      id: 'budget-4',
      ownerScope: 'KET',
      categoryId: 'cat-LAZ',
      monthKey: month,
      limitCents: 40000,
    },
  ];
  state.investments = [
    {
      id: 'invest-cas',
      ownerScope: 'CAS',
      name: 'Reserva de emergência',
      type: 'CDB_CDI',
      principalCents: 1250000,
      currentBalanceCents: 1294500,
      cdiPercentageBps: 10000,
      hasFgcProtection: true,
      valuationDate: today(now),
    },
    {
      id: 'invest-ket',
      ownerScope: 'KET',
      name: 'Plano de longo prazo',
      type: 'TESOURO',
      principalCents: 750000,
      currentBalanceCents: 773800,
      cdiPercentageBps: 0,
      hasFgcProtection: false,
      valuationDate: today(now),
    },
  ];
  state.goals = [
    {
      id: 'goal-1',
      ownerScope: 'COUPLE',
      name: 'Nossa próxima viagem',
      targetCents: 1200000,
      savedCents: 385000,
      targetDate: addMonths(today(now), 8),
    },
  ];
  state.recurringBills = [
    {
      id: 'bill-1',
      ownerScope: 'COUPLE',
      name: 'Internet da casa',
      amountCents: 12990,
      dueDay: 28,
      categoryId: 'cat-MOR',
      active: true,
    },
    {
      id: 'bill-2',
      ownerScope: 'CAS',
      name: 'Plano de celular',
      amountCents: 5990,
      dueDay: 26,
      categoryId: 'cat-ASS',
      active: true,
    },
  ];
  return stateSchema.parse(state);
}

export function audit(state: State, actor: Slug, action: string, entityId: string, now: number) {
  state.auditLogs.push({
    id: `audit-${entityId}-${now}-${state.auditLogs.length}`,
    actorSlug: actor,
    action,
    metadataSanitized: { entityId, result: 'SUCCESS' },
    createdAt: now,
  });
}
export function applyCommand(
  original: State,
  actor: Slug,
  raw: Command,
  now: number,
  requestId: string,
  localDate = today(now),
): State {
  const command = commandSchema.parse(raw);
  const state = stateSchema.parse(original);
  if (!state.users.some((u) => u.slug === actor)) throw new Error('Usuário não autorizado.');
  const tx = (id: string) => {
    const item = state.transactions.find((t) => t.id === id);
    if (!item) throw new Error('Lançamento não encontrado.');
    assertWrite(item.ownerScope, actor);
    return item;
  };
  const account = (id: string) => {
    const item = state.accounts.find((a) => a.id === id && !a.archived);
    if (!item) throw new Error('Conta não encontrada.');
    assertWrite(item.ownerScope, actor);
    return item;
  };
  switch (command.kind) {
    case 'createAccount':
      assertWrite(command.data.ownerScope, actor);
      state.accounts.push({ ...command.data, id: requestId, archived: false });
      break;
    case 'updateAccount': {
      const item = account(command.id);
      if (item.ownerScope !== command.data.ownerScope)
        throw new Error('Não é possível trocar o titular de uma conta com histórico.');
      Object.assign(item, command.data);
      break;
    }
    case 'createCard':
      assertWrite(command.data.ownerScope, actor);
      state.cards.push({ ...command.data, id: requestId, archived: false });
      break;
    case 'saveBudget': {
      assertWrite(command.data.ownerScope, actor);
      if (!state.categories.some((c) => c.id === command.data.categoryId && c.type === 'EXPENSE'))
        throw new Error('Categoria de despesa inválida.');
      const existing = state.budgets.find(
        (b) =>
          b.ownerScope === command.data.ownerScope &&
          b.categoryId === command.data.categoryId &&
          b.monthKey === command.data.monthKey,
      );
      if (existing) Object.assign(existing, command.data);
      else state.budgets.push({ ...command.data, id: requestId });
      break;
    }
    case 'createInvestment':
      assertWrite(command.data.ownerScope, actor);
      if (
        command.data.hasFgcProtection &&
        ['TESOURO', 'FII_ACOES', 'GLOBAL'].includes(command.data.type)
      )
        throw new Error('Esse tipo de ativo não deve ser marcado com FGC.');
      state.investments.push({ ...command.data, id: requestId });
      break;
    case 'valueInvestment': {
      const item = state.investments.find((i) => i.id === command.id);
      if (!item) throw new Error('Investimento não encontrado.');
      assertWrite(item.ownerScope, actor);
      item.currentBalanceCents = command.currentBalanceCents;
      item.valuationDate = command.valuationDate;
      break;
    }
    case 'createGoal':
      assertWrite(command.data.ownerScope, actor);
      state.goals.push({ ...command.data, id: requestId });
      break;
    case 'contributeGoal': {
      const item = state.goals.find((g) => g.id === command.id);
      if (!item) throw new Error('Meta não encontrada.');
      assertWrite(item.ownerScope, actor);
      item.savedCents += command.amountCents;
      break;
    }
    case 'createRecurring':
      assertWrite(command.data.ownerScope, actor);
      if (!state.categories.some((c) => c.id === command.data.categoryId && c.type === 'EXPENSE'))
        throw new Error('Categoria inválida.');
      state.recurringBills.push({ ...command.data, active: true, id: requestId });
      break;
    case 'toggleRecurring': {
      const item = state.recurringBills.find((b) => b.id === command.id);
      if (!item) throw new Error('Conta recorrente não encontrada.');
      assertWrite(item.ownerScope, actor);
      item.active = !item.active;
      break;
    }
    case 'payRecurring': {
      const bill = state.recurringBills.find((b) => b.id === command.id && b.active);
      if (!bill) throw new Error('Conta recorrente não encontrada ou inativa.');
      assertWrite(bill.ownerScope, actor);
      const externalId = `recurring:${bill.id}:${command.monthKey}`;
      if (
        state.transactions.some(
          (t) =>
            t.externalId === externalId &&
            t.source === 'MANUAL' &&
            t.entryKind === 'STANDARD' &&
            t.status === 'PAID',
        )
      )
        throw new Error('Essa conta já foi registrada como paga nesta competência.');
      const date = dateInMonth(command.monthKey, bill.dueDay);
      const result = applyCommand(
        state,
        actor,
        {
          kind: 'createTransaction',
          data: {
            ownerScope: bill.ownerScope,
            accountId: command.accountId,
            categoryId: bill.categoryId,
            type: 'EXPENSE',
            amountCents: bill.amountCents,
            description: bill.name,
            occurredAt: localDate,
            dueDate: date,
            status: 'PAID',
            casShareBps: 5000,
            installments: 1,
          },
        },
        now,
        requestId,
        localDate,
      );
      Object.assign(state, result);
      const row = state.transactions.find((t) => t.id === `${requestId}-0`)!;
      row.relatedId = bill.id;
      row.externalId = externalId;
      break;
    }
    case 'createTransaction': {
      const d = command.data;
      assertWrite(d.ownerScope, actor);
      if (d.status === 'PAID' && d.occurredAt > localDate)
        throw new Error('Para uma data futura, selecione a situação A pagar / a receber.');
      const payer = d.ownerScope === 'COUPLE' ? (d.paidByUserId ?? actor) : actor;
      if (
        !state.categories.some(
          (c) => c.id === d.categoryId && (d.type === 'TRANSFER' || c.type === d.type),
        )
      )
        throw new Error('Categoria incompatível com o lançamento.');
      if (Boolean(d.accountId) === Boolean(d.cardId))
        throw new Error('Selecione uma conta ou um cartão.');
      if (d.accountId) {
        const a = account(d.accountId);
        if (a.ownerScope !== 'COUPLE' && a.ownerScope !== payer)
          throw new Error('O pagador deve corresponder ao titular da conta.');
      }
      const card = d.cardId ? state.cards.find((c) => c.id === d.cardId && !c.archived) : undefined;
      if (d.cardId && !card) throw new Error('Cartão não encontrado.');
      if (card) {
        assertWrite(card.ownerScope, actor);
        if (card.ownerScope !== 'COUPLE' && card.ownerScope !== payer)
          throw new Error('Pagador incompatível com o cartão.');
        if (d.type !== 'EXPENSE')
          throw new Error('Use o fluxo de estorno para créditos no cartão.');
      }
      if (d.type === 'TRANSFER') {
        if (!d.destinationAccountId || d.destinationAccountId === d.accountId || !d.accountId)
          throw new Error('Transferência precisa de duas contas diferentes.');
        account(d.destinationAccountId);
        if (d.ownerScope === 'COUPLE') throw new Error('Transferência não é despesa do casal.');
      } else if (d.destinationAccountId)
        throw new Error('Conta de destino só é usada em transferência.');
      if (d.installments > 1 && !card)
        throw new Error('Parcelamento é permitido apenas no cartão.');
      if (d.amountCents < d.installments)
        throw new Error('Cada parcela deve ter pelo menos um centavo.');
      const amounts = distributeCents(d.amountCents, d.installments);
      for (let n = 0; n < amounts.length; n++) {
        const amount = amounts[n];
        state.transactions.push({
          id: `${requestId}-${n}`,
          ownerScope: d.ownerScope,
          paidByUserId: payer,
          ...(d.accountId ? { accountId: d.accountId } : {}),
          ...(d.cardId ? { cardId: d.cardId } : {}),
          ...(d.destinationAccountId ? { destinationAccountId: d.destinationAccountId } : {}),
          categoryId: d.categoryId,
          type: d.type,
          status: d.status,
          amountCents: amount,
          cashbackEarnedCents: card ? percentageCents(amount, card.cashbackBps) : 0,
          description: d.description + (amounts.length > 1 ? ` (${n + 1}/${amounts.length})` : ''),
          merchantNormalized: normalizeMerchant(d.description),
          occurredAt: addMonths(d.occurredAt, n),
          ...(d.dueDate ? { dueDate: d.dueDate } : {}),
          ...(d.ownerScope === 'COUPLE' && d.type === 'EXPENSE'
            ? { coupleSplit: splitCents(amount, d.casShareBps, payer) }
            : {}),
          ...(amounts.length > 1
            ? {
                installmentGroup: requestId,
                installmentNumber: n + 1,
                installmentTotal: amounts.length,
              }
            : {}),
          source: 'MANUAL',
          entryKind: 'STANDARD',
          createdBy: actor,
          createdAt: now,
        });
      }
      break;
    }
    case 'updateTransaction': {
      const item = tx(command.id);
      if (
        item.source !== 'MANUAL' ||
        item.entryKind !== 'STANDARD' ||
        item.installmentGroup ||
        state.transactions.some((t) => t.relatedId === item.id) ||
        command.data.installments !== 1
      )
        throw new Error(
          'Lançamento vinculado ou importado deve ser corrigido por categoria ou estorno.',
        );
      state.transactions = state.transactions.filter((t) => t.id !== item.id);
      const result = applyCommand(
        state,
        actor,
        { kind: 'createTransaction', data: command.data },
        now,
        requestId,
        localDate,
      );
      const changed = result.transactions.find((t) => t.id === `${requestId}-0`)!;
      changed.id = item.id;
      changed.createdAt = item.createdAt;
      result.auditLogs.pop();
      Object.assign(state, result);
      break;
    }
    case 'review': {
      const item = tx(command.id);
      if (item.status !== 'NEEDS_REVIEW') throw new Error('Esse lançamento já foi revisado.');
      if (command.approve && item.occurredAt > localDate)
        throw new Error(
          'Lançamento com data futura deve ser registrado como previsão. Confira a data antes de aprovar.',
        );
      item.status = command.approve ? 'PAID' : 'REJECTED';
      break;
    }
    case 'reopenReview': {
      const item = tx(command.id);
      if (item.status !== 'REJECTED')
        throw new Error('Somente um lançamento reprovado pode voltar à revisão.');
      item.status = 'NEEDS_REVIEW';
      break;
    }
    case 'markPaid': {
      const item = tx(command.id);
      if (item.status !== 'PENDING')
        throw new Error('Esse lançamento não está pendente de pagamento.');
      if (item.occurredAt > localDate)
        throw new Error('Confira a data futura antes de marcar o lançamento como realizado.');
      item.status = 'PAID';
      break;
    }
    case 'deleteTransaction': {
      const item = tx(command.id);
      if (item.entryKind !== 'STANDARD' || state.transactions.some((t) => t.relatedId === item.id))
        throw new Error('Lançamento vinculado não pode ser excluído. Use um estorno.');
      state.transactions = state.transactions.filter((t) => t.id !== item.id);
      break;
    }
    case 'categorize': {
      const item = tx(command.id);
      const contextScope =
        state.accounts.find((a) => a.id === item.accountId)?.ownerScope ?? item.ownerScope;
      const category = state.categories.find(
        (c) => c.id === command.categoryId && c.type === item.type,
      );
      if (!category) throw new Error('Categoria inválida.');
      item.categoryId = command.categoryId;
      if (command.ownerScope && command.ownerScope !== item.ownerScope) {
        assertWrite(command.ownerScope, actor);
        if (item.paidByUserId !== actor)
          throw new Error('Somente o pagador altera o escopo dessa despesa.');
        item.ownerScope = command.ownerScope;
        if (item.ownerScope === 'COUPLE' && item.type === 'EXPENSE')
          item.coupleSplit = splitCents(item.amountCents, 5000, actor);
        else delete item.coupleSplit;
      }
      if (command.learn) {
        assertWrite(contextScope, actor);
        const existing = state.categoryRules.find(
          (r) => r.ownerScope === contextScope && r.merchantPattern === item.merchantNormalized,
        );
        if (existing) {
          existing.categoryId = category.id;
          existing.defaultOwnerScope = item.ownerScope;
          existing.matchCount++;
        } else
          state.categoryRules.push({
            id: requestId,
            ownerScope: contextScope,
            merchantPattern: item.merchantNormalized,
            categoryId: category.id,
            defaultOwnerScope: item.ownerScope,
            matchCount: 1,
          });
      }
      break;
    }
    case 'refund': {
      const item = tx(command.id);
      if (
        item.status !== 'PAID' ||
        item.type !== 'EXPENSE' ||
        item.entryKind !== 'STANDARD' ||
        state.transactions.some((t) => t.relatedId === item.id && t.entryKind === 'REFUND')
      )
        throw new Error('Esse lançamento não pode ser estornado novamente.');
      state.transactions.push({
        ...item,
        id: requestId,
        type: 'INCOME',
        amountCents: item.amountCents,
        cashbackEarnedCents: 0,
        description: `Estorno: ${item.description}`.slice(0, 160),
        occurredAt: localDate,
        ...(item.cardId ? { invoiceMonth: monthSchema.parse(localDate.slice(0, 7)) } : {}),
        relatedId: item.id,
        entryKind: 'REFUND',
        createdBy: actor,
        createdAt: now,
        source: 'MANUAL',
      });
      break;
    }
    case 'payInvoice': {
      const card = state.cards.find((c) => c.id === command.cardId);
      if (!card) throw new Error('Cartão não encontrado.');
      assertWrite(card.ownerScope, actor);
      account(command.accountId);
      const amount = invoiceBalance(state, card.id, command.monthKey);
      if (amount <= 0) throw new Error('Essa fatura já está paga ou não tem saldo a quitar.');
      state.transactions.push({
        id: requestId,
        ownerScope: card.ownerScope === 'COUPLE' ? actor : card.ownerScope,
        paidByUserId: actor,
        accountId: command.accountId,
        cardId: card.id,
        categoryId: 'cat-OUT',
        type: 'TRANSFER',
        status: 'PAID',
        amountCents: amount,
        cashbackEarnedCents: 0,
        description: `Pagamento de fatura ${card.name}`,
        merchantNormalized: '',
        occurredAt: localDate,
        source: 'MANUAL',
        invoiceMonth: command.monthKey,
        entryKind: 'INVOICE_PAYMENT',
        createdBy: actor,
        createdAt: now,
      });
      break;
    }
    case 'settle': {
      const debt = coupleBalance(state, command.monthKey);
      const from = debt > 0 ? 'KET' : 'CAS';
      if (debt === 0 || command.amountCents > Math.abs(debt))
        throw new Error('Valor maior que o acerto pendente.');
      state.settlements.push({
        id: requestId,
        monthKey: command.monthKey,
        from,
        to: from === 'CAS' ? 'KET' : 'CAS',
        amountCents: command.amountCents,
        paidAt: localDate,
        createdBy: actor,
      });
      break;
    }
    case 'dismissAlert': {
      if (
        (command.id.startsWith('CAS:') && actor !== 'CAS') ||
        (command.id.startsWith('KET:') && actor !== 'KET')
      )
        throw new Error('Alerta pertence ao outro perfil.');
      if (!state.agentAlerts.some((a) => a.id === command.id)) {
        const alert = generateAlerts(state, now, localDate).find((a) => a.id === command.id);
        if (!alert) throw new Error('Alerta não encontrado.');
        assertWrite(alert.targetScope, actor);
        state.agentAlerts.push({ ...alert, dismissed: true });
      } else
        state.agentAlerts = state.agentAlerts.map((a) =>
          a.id === command.id ? { ...a, dismissed: true } : a,
        );
      break;
    }
  }
  const monthlyDebts = new Map<string, number>();
  for (const item of state.transactions)
    if (item.coupleSplit) {
      const month = item.occurredAt.slice(0, 7);
      if (!monthlyDebts.has(month)) monthlyDebts.set(month, coupleBalance(state, month));
      item.coupleSplit.settled = monthlyDebts.get(month) === 0;
    }
  audit(state, actor, command.kind, 'id' in command ? command.id : requestId, now);
  return stateSchema.parse(state);
}

export function applyImport(
  original: State,
  actor: Slug,
  accountId: string,
  records: ImportRecord[],
  source: 'FILE' | 'MOCK' | 'PLUGGY',
  now: number,
  batchId: string,
) {
  const state = stateSchema.parse(original);
  const card = state.cards.find((c) => c.id === accountId && !c.archived);
  const account = state.accounts.find((a) => a.id === accountId && !a.archived) ?? card;
  if (!account) throw new Error('Conta ou cartão não encontrado.');
  assertWrite(account.ownerScope, actor);
  if (card && records.some((record) => record.type !== 'EXPENSE'))
    throw new Error(
      'Este extrato de cartão contém créditos. Importe apenas as compras e use os fluxos de pagamento de fatura ou estorno para os créditos.',
    );
  let imported = 0,
    duplicates = 0;
  for (const record of records) {
    if (
      state.transactions.some(
        (t) =>
          (card ? t.cardId === accountId : t.accountId === accountId) &&
          t.externalId === record.externalId &&
          t.source === source,
      )
    ) {
      duplicates++;
      continue;
    }
    const merchant = normalizeMerchant(record.description);
    const rule = state.categoryRules.find(
      (r) => r.ownerScope === account.ownerScope && r.merchantPattern === merchant,
    );
    const scope = rule?.defaultOwnerScope ?? account.ownerScope;
    assertWrite(scope, actor);
    const category = state.categories.find(
      (c) => c.id === rule?.categoryId && c.type === record.type,
    );
    state.transactions.push({
      id: `${batchId}-${imported++}`,
      ownerScope: scope,
      paidByUserId: actor,
      ...(card ? { cardId: accountId } : { accountId }),
      categoryId: category?.id ?? (record.type === 'INCOME' ? 'cat-SAL' : 'cat-OUT'),
      type: record.type,
      status: 'NEEDS_REVIEW',
      amountCents: record.amountCents,
      cashbackEarnedCents: card ? percentageCents(record.amountCents, card.cashbackBps) : 0,
      description: record.description,
      merchantNormalized: merchant,
      occurredAt: record.occurredAt,
      ...(scope === 'COUPLE' && record.type === 'EXPENSE'
        ? { coupleSplit: splitCents(record.amountCents, 5000, actor) }
        : {}),
      externalId: record.externalId,
      sourceAccountKey: `${source}:${accountId}`,
      source,
      entryKind: 'STANDARD',
      createdBy: actor,
      createdAt: now,
    });
  }
  audit(state, actor, 'import.staged', batchId, now);
  return { state: stateSchema.parse(state), imported, duplicates };
}

function spending(transactions: Transaction[]) {
  return transactions.reduce(
    (s, t) =>
      s + (t.entryKind === 'REFUND' ? -t.amountCents : t.type === 'EXPENSE' ? t.amountCents : 0),
    0,
  );
}
export function generateAlerts(state: State, now: number, localDate = today(now)): AgentAlert[] {
  const month = localDate.slice(0, 7);
  const alerts: AgentAlert[] = [];
  const emit = (
    scope: Scope,
    agentId: AgentAlert['agentId'],
    key: string,
    title: string,
    message: string,
    severity: AgentAlert['severity'] = 'INFO',
    relatedTransactionId?: string,
  ) =>
    alerts.push({
      id: `${scope}:${agentId}:${month}:${key}`,
      agentId,
      targetScope: scope,
      severity,
      title,
      message,
      ...(relatedTransactionId ? { relatedTransactionId } : {}),
      dismissed: false,
      period: month,
    });
  const approved = state.transactions.filter(
    (t) => t.status === 'PAID' && t.entryKind === 'STANDARD' && t.type === 'EXPENSE',
  );
  for (const t of approved.filter((t) => t.occurredAt.startsWith(month))) {
    const other = approved.find(
      (o) =>
        o.id < t.id &&
        o.paidByUserId !== t.paidByUserId &&
        o.merchantNormalized === t.merchantNormalized &&
        o.amountCents === t.amountCents &&
        Math.abs(Date.parse(o.occurredAt) - Date.parse(t.occurredAt)) <= 3 * 86400000,
    );
    if (other)
      emit(
        'COUPLE',
        'ALBERT',
        `cross-${t.id}`,
        'Vocês podem ter pago a mesma conta',
        `${t.description}: os dois perfis registraram valores iguais em datas próximas. Confiram os comprovantes; isso é uma suspeita.`,
        'WARNING',
        t.id,
      );
  }
  for (const scope of ['CAS', 'KET', 'COUPLE'] as const) {
    const items = approved.filter((t) => t.ownerScope === scope);
    const current = items.filter((t) => t.occurredAt.startsWith(month));
    for (const t of current) {
      const same = approved.find(
        (other) =>
          other.id < t.id &&
          other.merchantNormalized === t.merchantNormalized &&
          other.amountCents === t.amountCents &&
          Math.abs(Date.parse(other.occurredAt) - Date.parse(t.occurredAt)) <= 3 * 86400000 &&
          (other.ownerScope === scope || (other.ownerScope === 'COUPLE' && scope === 'COUPLE')),
      );
      if (same)
        emit(
          scope,
          'ALBERT',
          t.id,
          'Confira uma possível cobrança repetida',
          `${t.description}: ${brl(t.amountCents)}. Compare os comprovantes antes de concluir.`,
          'WARNING',
          t.id,
        );
      const history = items
        .filter((o) => o.occurredAt < `${month}-01` && o.categoryId === t.categoryId)
        .map((o) => o.amountCents)
        .sort((a, b) => a - b);
      if (history.length >= 5 && t.amountCents > history[Math.floor(history.length / 2)] * 3)
        emit(
          scope,
          'JULIUS',
          t.id,
          'Compra acima do seu padrão',
          `${t.description} ficou acima de três vezes a mediana histórica da categoria.`,
          'WARNING',
          t.id,
        );
      if (t.categoryId === 'cat-ASS') {
        const previous = items
          .filter(
            (o) => o.merchantNormalized === t.merchantNormalized && o.occurredAt < `${month}-01`,
          )
          .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
        if (previous && t.amountCents > previous.amountCents)
          emit(
            scope,
            'ALBERT',
            `subscription-${t.id}`,
            'Assinatura com valor diferente',
            `${t.description} aumentou ${brl(t.amountCents - previous.amountCents)}. Confira se o reajuste era esperado.`,
            'WARNING',
            t.id,
          );
      }
    }
    for (const budget of state.budgets.filter(
      (b) => b.ownerScope === scope && b.monthKey === month,
    )) {
      const used = spending(
        state.transactions.filter(
          (t) =>
            t.ownerScope === scope &&
            t.categoryId === budget.categoryId &&
            t.status === 'PAID' &&
            t.occurredAt.startsWith(month),
        ),
      );
      if (used * 100 >= budget.limitCents * 80)
        emit(
          scope,
          'MEGAMEN',
          budget.id,
          used >= budget.limitCents ? 'Orçamento atingido' : 'Seu orçamento pede atenção',
          `${state.categories.find((c) => c.id === budget.categoryId)?.name}: ${brl(used)} de ${brl(budget.limitCents)}.`,
          used >= budget.limitCents ? 'CRITICAL' : 'WARNING',
        );
    }
    const day = Number(localDate.slice(8, 10));
    for (const category of state.categories.filter((c) => c.type === 'EXPENSE')) {
      const historyMonths = [-1, -2, -3].map((n) => addMonths(`${month}-01`, n).slice(0, 7));
      if (!historyMonths.every((m) => items.some((t) => t.occurredAt.startsWith(m)))) continue;
      const past = historyMonths.map((m) =>
        items
          .filter(
            (t) =>
              t.categoryId === category.id &&
              t.occurredAt.startsWith(m) &&
              Number(t.occurredAt.slice(8, 10)) <= day,
          )
          .reduce((s, t) => s + t.amountCents, 0),
      );
      const average = Math.floor(past.reduce((s, n) => s + n, 0) / 3);
      const value = current
        .filter((t) => t.categoryId === category.id)
        .reduce((s, t) => s + t.amountCents, 0);
      if (average > 0 && value > average + Math.max(2000, Math.floor(average / 5)))
        emit(
          scope,
          'MARIE',
          category.id,
          `${category.name} mudou de ritmo`,
          `${brl(value - average)} acima da média dos mesmos dias dos três meses anteriores.`,
        );
    }
    const discretionary = current
      .filter((t) => !state.categories.find((c) => c.id === t.categoryId)?.isEssential)
      .reduce((s, t) => s + t.amountCents, 0);
    if (discretionary > 0)
      emit(
        scope,
        'RITA',
        'mission',
        'Uma pequena meta para esta semana',
        `Experimente limitar gastos não essenciais a ${brl(Math.max(1000, Math.floor(discretionary / 5)))}. É uma sugestão, sem alterar seu orçamento.`,
      );
    const rules = state.categoryRules.filter((r) => r.ownerScope === scope);
    if (rules.length)
      emit(
        scope,
        'SHERLOCK',
        'rules',
        'Suas escolhas viraram regras',
        `${rules.length} regras pessoais aplicadas às próximas importações; os dados anteriores não são alterados.`,
      );
  }
  return alerts.filter(
    (a) => !state.agentAlerts.some((saved) => saved.id === a.id && saved.dismissed),
  );
}

export function snapshot(
  state: State,
  actor: Slug,
  view: View,
  month: string,
  mode: 'local' | 'convex',
  now: number,
): Snapshot {
  monthSchema.parse(month);
  const user = state.users.find((u) => u.slug === actor);
  if (!user) throw new Error('Usuário não autorizado.');
  const visible = (scope: Scope) => canRead(scope, actor, view);
  const all = state.transactions.filter((t) => visible(t.ownerScope));
  const transactions = all
    .filter((t) => t.occurredAt.startsWith(month))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.createdAt - a.createdAt);
  const approved = transactions.filter((t) => t.status === 'PAID');
  const accounts = state.accounts
    .filter((a) => visible(a.ownerScope))
    .map((a) => ({ ...a, currentBalanceCents: accountBalance(state, a.id) }));
  const cards = state.cards
    .filter((c) => visible(c.ownerScope))
    .map((c) => {
      const used = state.transactions
        .filter((t) => t.cardId === c.id && t.status === 'PAID')
        .reduce(
          (sum, t) =>
            sum +
            (t.entryKind === 'INVOICE_PAYMENT' || t.entryKind === 'REFUND'
              ? -t.amountCents
              : t.type === 'EXPENSE'
                ? t.amountCents
                : 0),
          0,
        );
      const cashback = approved
        .filter((t) => t.cardId === c.id && t.type === 'EXPENSE')
        .reduce((sum, t) => sum + t.cashbackEarnedCents, 0);
      return {
        ...c,
        usedCents: Math.max(0, used),
        availableCents: Math.max(0, c.limitCents - used),
        invoiceCents: invoiceBalance(state, c.id, month),
        cashbackCents: cashback,
      };
    });
  const investments = state.investments.filter((i) => visible(i.ownerScope));
  const balance = accounts.reduce((s, a) => s + a.currentBalanceCents, 0),
    invested = investments.reduce((s, i) => s + i.currentBalanceCents, 0);
  const connection = state.bankConnections.find((c) => c.userSlug === actor);
  const elapsed =
    month === today(now).slice(0, 7)
      ? Number(today(now).slice(8, 10))
      : new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  return {
    user: publicUser(user),
    view,
    month,
    mode,
    accounts,
    cards,
    fundingAccounts: state.accounts.filter(
      (a) => !a.archived && (a.ownerScope === actor || a.ownerScope === 'COUPLE'),
    ),
    fundingCards: state.cards.filter(
      (c) => !c.archived && (c.ownerScope === actor || c.ownerScope === 'COUPLE'),
    ),
    categories: state.categories,
    transactions,
    investments,
    goals: state.goals.filter((g) => visible(g.ownerScope)),
    recurringBills: state.recurringBills
      .filter((b) => visible(b.ownerScope))
      .map((b) => ({
        ...b,
        paidMonths: state.transactions
          .filter(
            (t) =>
              t.relatedId === b.id &&
              t.source === 'MANUAL' &&
              t.status === 'PAID' &&
              t.externalId?.startsWith(`recurring:${b.id}:`),
          )
          .map((t) => t.externalId!.split(':').at(-1)!),
      })),
    categoryRules: state.categoryRules.filter((r) => visible(r.ownerScope)),
    upcomingTransactions: all
      .filter((t) => t.status === 'PENDING' && t.dueDate)
      .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
      .slice(0, 100),
    alerts: generateAlerts(state, now).filter((a) => visible(a.targetScope)),
    auditLogs: state.auditLogs
      .filter((a) => view === 'CONSOLIDATED' || a.actorSlug === actor)
      .slice(-40)
      .reverse(),
    settlements: state.settlements.filter((s) => s.monthKey === month),
    budgets: state.budgets
      .filter((b) => visible(b.ownerScope) && b.monthKey === month)
      .map((b) => {
        const spent = spending(
          approved.filter((t) => t.ownerScope === b.ownerScope && t.categoryId === b.categoryId),
        );
        return { ...b, spentCents: spent, projectedCents: Math.round((spent * days) / elapsed) };
      }),
    bankConnections: {
      configured: Boolean(user.encryptedPluggyCredentials),
      itemCount: connection?.itemIds.length ?? 0,
      ...(connection ? { provider: connection.provider, lastSyncAt: connection.lastSyncAt } : {}),
    },
    summary: {
      balanceCents: balance,
      incomeCents: approved
        .filter((t) => t.type === 'INCOME' && t.entryKind !== 'REFUND')
        .reduce((s, t) => s + t.amountCents, 0),
      expenseCents: spending(approved),
      pendingCents: transactions
        .filter((t) => t.status === 'PENDING' || t.status === 'NEEDS_REVIEW')
        .reduce((s, t) => s + t.amountCents, 0),
      investmentCents: invested,
      netWorthCents: balance + invested - cards.reduce((s, c) => s + c.usedCents, 0),
      cashbackCents: cards.reduce((s, c) => s + c.cashbackCents, 0),
      coupleDebtCents: coupleBalance(state, month),
      previousExpenseCents: spending(
        all.filter(
          (t) =>
            t.status === 'PAID' &&
            t.occurredAt.startsWith(addMonths(`${month}-01`, -1).slice(0, 7)),
        ),
      ),
    },
    trend: Array.from({ length: 12 }, (_, i) => {
      const m = `${month.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`;
      const list = all.filter((t) => t.status === 'PAID' && t.occurredAt.startsWith(m));
      return {
        month: m,
        incomeCents: list
          .filter((t) => t.type === 'INCOME' && t.entryKind !== 'REFUND')
          .reduce((s, t) => s + t.amountCents, 0),
        expenseCents: spending(list),
      };
    }),
    distribution: state.categories
      .filter((c) => c.type === 'EXPENSE')
      .map((c) => ({
        categoryId: c.id,
        amountCents: spending(approved.filter((t) => t.categoryId === c.id)),
      }))
      .filter((d) => d.amountCents > 0),
  };
}
