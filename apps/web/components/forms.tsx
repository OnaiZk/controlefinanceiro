'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  brl,
  parseMoney,
  parseSignedMoney,
  today,
  type Snapshot,
  type Slug,
} from '../../../packages/shared/src/index';
import { Icon } from './ui';
export type FormKind =
  | 'transaction'
  | 'account'
  | 'card'
  | 'budget'
  | 'investment'
  | 'goal'
  | 'recurring'
  | 'import'
  | 'bank'
  | 'settle'
  | 'payInvoice'
  | 'valueInvestment'
  | 'contributeGoal'
  | 'categorize'
  | 'payRecurring';
export interface FormSelection {
  kind: FormKind;
  id?: string;
}
export async function api<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    ...(data !== undefined
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      : {}),
    cache: 'no-store',
    credentials: 'same-origin',
  });
  let value: { error?: string } & T;
  try {
    value = await response.json();
  } catch {
    throw new Error('O servidor não respondeu corretamente. Tente novamente.');
  }
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('session-expired'));
    throw new Error(value.error ?? 'Não foi possível concluir.');
  }
  return value;
}
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
const titles: Record<FormKind, string> = {
  transaction: 'Novo lançamento',
  account: 'Adicionar conta',
  card: 'Adicionar cartão',
  budget: 'Planejar um orçamento',
  investment: 'Adicionar investimento',
  goal: 'Um plano para o futuro',
  recurring: 'Cadastrar conta recorrente',
  import: 'Importar extrato',
  bank: 'Conectar Meu Pluggy',
  settle: 'Registrar acerto do casal',
  payInvoice: 'Quitar fatura',
  valueInvestment: 'Atualizar posição',
  contributeGoal: 'Atualizar valor reservado',
  categorize: 'Organizar lançamento',
  payRecurring: 'Registrar pagamento recorrente',
};
export default function FinanceForm({
  selection,
  data,
  onClose,
  onSaved,
}: {
  selection: FormSelection;
  data: Snapshot;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [file, setFile] = useState<File | null>(null),
    [txType, setTxType] = useState(
      data.transactions.find((t) => t.id === selection.id)?.type ?? 'EXPENSE',
    ),
    [source, setSource] = useState(
      data.transactions.find((t) => t.id === selection.id)?.cardId ? 'card' : 'account',
    ),
    [scope, setScope] = useState(
      data.transactions.find((t) => t.id === selection.id)?.ownerScope ??
        (data.view === 'COUPLE' ? 'COUPLE' : data.user.slug),
    ),
    [investmentType, setInvestmentType] = useState('CDB_CDI');
  const { kind, id } = selection;
  const editableAccounts = data.fundingAccounts;
  const editableCards = data.fundingCards;
  const existing = data.transactions.find((t) => t.id === id);
  const currentAccount = data.accounts.find((a) => a.id === id);
  const currentBill = data.recurringBills.find((b) => b.id === id);
  const investment = data.investments.find((i) => i.id === id);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    first.current?.querySelector<HTMLElement>('input,select,button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
      if (event.key === 'Tab') {
        const nodes = dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)',
        );
        if (!nodes?.length) return;
        const start = nodes[0],
          end = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === start) {
          event.preventDefault();
          end.focus();
        } else if (!event.shiftKey && document.activeElement === end) {
          event.preventDefault();
          start.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [onClose, busy]);
  const scopeField = (
    <Field label="De quem é este registro?">
      <select
        name="ownerScope"
        disabled={kind === 'account' && Boolean(id)}
        value={kind === 'account' && currentAccount ? currentAccount.ownerScope : scope}
        onChange={(e) => setScope(e.target.value as Slug | 'COUPLE')}
      >
        <option value={data.user.slug}>{data.user.name} · pessoal</option>
        <option value="COUPLE">Casal · compartilhado</option>
      </select>
    </Field>
  );
  const categoryField = (
    <Field label="Categoria">
      <select name="categoryId" required defaultValue={existing?.categoryId}>
        {data.categories
          .filter((c) =>
            kind === 'transaction'
              ? txType === 'TRANSFER' || c.type === txType
              : c.type === 'EXPENSE' || c.id === existing?.categoryId,
          )
          .map((c) => (
            <option key={c.id} value={c.id}>
              [{c.code}] {c.name}
            </option>
          ))}
      </select>
    </Field>
  );
  const accountField = (
    <Field label="Conta">
      <select
        name="accountId"
        required
        defaultValue={existing?.accountId ?? editableAccounts[0]?.id}
      >
        <option value="">Selecione uma conta</option>
        {editableAccounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} · {a.ownerScope === 'COUPLE' ? 'Casal' : data.user.name}
          </option>
        ))}
      </select>
    </Field>
  );
  const amountField = (label = 'Valor', name = 'amount', value?: string) => (
    <Field label={label}>
      <div className="input-money">
        <span>R$</span>
        <input
          name={name}
          defaultValue={value}
          inputMode="decimal"
          placeholder="0,00"
          required
          pattern={kind === 'account' ? '-?[0-9.,]+' : '[0-9.,]+'}
          autoComplete="off"
        />
      </div>
    </Field>
  );
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const fields = new FormData(event.currentTarget);
    const get = (name: string) => String(fields.get(name) ?? '');
    const integer = (name: string) => Number(get(name));
    const money = (name = 'amount') => parseMoney(get(name));
    let command: unknown;
    try {
      switch (kind) {
        case 'transaction':
          command = {
            kind: id ? 'updateTransaction' : 'createTransaction',
            ...(id ? { id } : {}),
            data: {
              ownerScope: get('ownerScope'),
              ...(scope === 'COUPLE' ? { paidByUserId: get('paidByUserId') } : {}),
              ...(source === 'card' && txType === 'EXPENSE'
                ? { cardId: get('cardId') }
                : { accountId: get('accountId') }),
              ...(txType === 'TRANSFER'
                ? { destinationAccountId: get('destinationAccountId') }
                : {}),
              categoryId: get('categoryId'),
              type: txType,
              amountCents: money(),
              description: get('description'),
              occurredAt: get('occurredAt'),
              ...(get('dueDate') ? { dueDate: get('dueDate') } : {}),
              status: get('status'),
              casShareBps: scope === 'COUPLE' ? Math.round(integer('casPercent') * 100) : 5000,
              installments: source === 'card' ? integer('installments') : 1,
            },
          };
          break;
        case 'account':
          command = {
            kind: id ? 'updateAccount' : 'createAccount',
            ...(id ? { id } : {}),
            data: {
              ownerScope: currentAccount?.ownerScope ?? get('ownerScope'),
              name: get('name'),
              institution: get('institution'),
              type: get('type'),
              balanceCents: parseSignedMoney(get('amount')),
            },
          };
          break;
        case 'card':
          command = {
            kind: 'createCard',
            data: {
              ownerScope: get('ownerScope'),
              name: get('name'),
              last4: get('last4'),
              limitCents: money(),
              closingDay: integer('closingDay'),
              dueDay: integer('dueDay'),
              cashbackBps: parseMoney(get('cashback')),
            },
          };
          break;
        case 'budget':
          command = {
            kind: 'saveBudget',
            data: {
              ownerScope: get('ownerScope'),
              categoryId: get('categoryId'),
              monthKey: data.month,
              limitCents: money(),
            },
          };
          break;
        case 'investment':
          command = {
            kind: 'createInvestment',
            data: {
              ownerScope: get('ownerScope'),
              name: get('name'),
              type: investmentType,
              principalCents: money('principal'),
              currentBalanceCents: money('current'),
              cdiPercentageBps: parseMoney(get('cdi') || '0'),
              hasFgcProtection: get('fgc') === 'on',
              valuationDate: get('valuationDate'),
            },
          };
          break;
        case 'valueInvestment':
          command = {
            kind: 'valueInvestment',
            id,
            currentBalanceCents: money(),
            valuationDate: get('valuationDate'),
          };
          break;
        case 'goal':
          command = {
            kind: 'createGoal',
            data: {
              ownerScope: get('ownerScope'),
              name: get('name'),
              targetCents: money('target'),
              savedCents: money('saved'),
              targetDate: get('targetDate'),
            },
          };
          break;
        case 'contributeGoal':
          command = { kind: 'contributeGoal', id, amountCents: money() };
          break;
        case 'recurring':
          command = {
            kind: 'createRecurring',
            data: {
              ownerScope: get('ownerScope'),
              name: get('name'),
              amountCents: money(),
              dueDay: integer('dueDay'),
              categoryId: get('categoryId'),
            },
          };
          break;
        case 'settle':
          command = { kind: 'settle', monthKey: data.month, amountCents: money() };
          break;
        case 'payInvoice':
          command = {
            kind: 'payInvoice',
            cardId: id,
            accountId: get('accountId'),
            monthKey: data.month,
          };
          break;
        case 'payRecurring':
          command = {
            kind: 'payRecurring',
            id,
            accountId: get('accountId'),
            monthKey: get('paymentMonth'),
          };
          break;
        case 'categorize':
          command = {
            kind: 'categorize',
            id,
            categoryId: get('categoryId'),
            ownerScope: get('ownerScope'),
            learn: get('learn') === 'on',
          };
          break;
        case 'bank':
          await api('bank/configure', {
            clientId: get('clientId'),
            clientSecret: get('clientSecret'),
            itemIds: get('itemIds')
              .split(/[\s,]+/)
              .filter(Boolean),
          });
          break;
        case 'import': {
          if (!file) throw new Error('Escolha um arquivo .ofx ou .csv.');
          if (file.size > 2_000_000) throw new Error('O limite é 2 MB por arquivo.');
          const buffer = await file.arrayBuffer();
          let content: string;
          try {
            content = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
          } catch {
            content = new TextDecoder('windows-1252').decode(buffer);
          }
          const result = await api<{ imported: number; duplicates: number }>('import', {
            filename: file.name,
            content,
            accountId: get('accountId'),
            options: {
              ...(get('dateColumn') ? { dateColumn: get('dateColumn') } : {}),
              ...(get('descriptionColumn') ? { descriptionColumn: get('descriptionColumn') } : {}),
              ...(get('amountColumn') ? { amountColumn: get('amountColumn') } : {}),
              ...(get('idColumn') ? { idColumn: get('idColumn') } : {}),
              ...(get('decimalFormat') ? { decimalFormat: get('decimalFormat') } : {}),
            },
          });
          await onSaved(
            `${result.imported} lançamentos para revisar; ${result.duplicates} já existentes.`,
          );
          onClose();
          return;
        }
      }
      if (command) await api('command', command);
      await onSaved(
        kind === 'settle'
          ? 'Acerto registrado. Não houve transferência bancária.'
          : kind === 'contributeGoal'
            ? 'Reserva atualizada. Nenhum dinheiro foi movimentado.'
            : 'Registro salvo com sucesso.',
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }
  return createPortal(
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialog}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="modal-top">
          <span className="eyebrow">ENTRE CONTAS</span>
          <button
            type="button"
            className="icon-button"
            aria-label="Fechar"
            disabled={busy}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        <h2 id="dialog-title">
          {id && kind === 'transaction'
            ? 'Editar lançamento'
            : id && kind === 'account'
              ? 'Editar conta'
              : titles[kind]}
        </h2>
        <p className="modal-intro">
          {kind === 'transaction'
            ? 'Cada escolha tem seu lugar. Registre os detalhes abaixo.'
            : kind === 'import'
              ? 'Importe, confira e só então confirme seus lançamentos.'
              : 'Um passo de cada vez para deixar tudo em ordem.'}
        </p>
        <form ref={first} onSubmit={submit}>
          {[
            'transaction',
            'account',
            'card',
            'budget',
            'investment',
            'goal',
            'recurring',
            'categorize',
          ].includes(kind) && scopeField}
          {kind === 'transaction' && (
            <>
              <Field label="Tipo de lançamento">
                <select
                  value={txType}
                  onChange={(e) => {
                    setTxType(e.target.value as typeof txType);
                    if (e.target.value !== 'EXPENSE') setSource('account');
                  }}
                >
                  <option value="EXPENSE">Despesa</option>
                  <option value="INCOME">Receita</option>
                  <option value="TRANSFER">Transferência entre contas</option>
                </select>
              </Field>
              <Field label="Descrição">
                <input
                  name="description"
                  defaultValue={existing?.description}
                  required
                  maxLength={120}
                  placeholder="Ex.: mercado da semana"
                />
              </Field>
              <div className="form-grid">
                {amountField(
                  'Valor',
                  'amount',
                  existing ? (existing.amountCents / 100).toFixed(2).replace('.', ',') : undefined,
                )}
                <Field label="Data">
                  <input
                    name="occurredAt"
                    type="date"
                    defaultValue={existing?.occurredAt ?? today()}
                    required
                  />
                </Field>
              </div>
              {categoryField}
              {txType === 'EXPENSE' && (
                <Field label="Forma de pagamento">
                  <select value={source} onChange={(e) => setSource(e.target.value)}>
                    <option value="account">Conta bancária / carteira</option>
                    <option value="card">Cartão de crédito</option>
                  </select>
                </Field>
              )}
              {source === 'card' && txType === 'EXPENSE' ? (
                <>
                  <Field label="Cartão">
                    <select name="cardId" defaultValue={existing?.cardId} required>
                      <option value="">Selecione</option>
                      {editableCards.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} · {c.last4}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Parcelas">
                    <input
                      name="installments"
                      type="number"
                      min="1"
                      max="48"
                      defaultValue="1"
                      required
                    />
                  </Field>
                </>
              ) : (
                accountField
              )}
              {txType === 'TRANSFER' && (
                <Field label="Conta de destino">
                  <select
                    name="destinationAccountId"
                    defaultValue={existing?.destinationAccountId}
                    required
                  >
                    <option value="">Selecione</option>
                    {editableAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <div className="form-grid">
                <Field label="Situação">
                  <select name="status" defaultValue={existing?.status}>
                    <option value="PAID">Confirmado / realizado</option>
                    <option value="PENDING">A pagar / a receber</option>
                  </select>
                </Field>
                <Field label="Vencimento (opcional)">
                  <input name="dueDate" type="date" defaultValue={existing?.dueDate} />
                </Field>
              </div>
              {scope === 'COUPLE' && txType === 'EXPENSE' && (
                <div className="callout">
                  <Field label="Quem pagou?">
                    <select
                      name="paidByUserId"
                      defaultValue={existing?.paidByUserId ?? data.user.slug}
                    >
                      <option value="CAS">Cassiano</option>
                      <option value="KET">Kethellen</option>
                    </select>
                  </Field>
                  <Field
                    label="Parte do Cassiano (%)"
                    hint="Kethellen fica com o restante. O rateio preserva todos os centavos."
                  >
                    <input
                      name="casPercent"
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      defaultValue={
                        existing?.coupleSplit ? existing.coupleSplit.casShareBps / 100 : 50
                      }
                      required
                    />
                  </Field>
                </div>
              )}
            </>
          )}
          {kind === 'account' && (
            <>
              <Field label="Nome da conta">
                <input
                  name="name"
                  required
                  defaultValue={currentAccount?.name}
                  placeholder="Ex.: conta principal"
                />
              </Field>
              <Field label="Instituição">
                <input
                  name="institution"
                  required
                  defaultValue={currentAccount?.institution}
                  placeholder="Nome do banco ou carteira"
                />
              </Field>
              <Field label="Tipo">
                <select name="type" defaultValue={currentAccount?.type}>
                  <option value="CHECKING">Conta corrente</option>
                  <option value="SAVINGS">Poupança / reserva</option>
                  <option value="WALLET">Carteira</option>
                </select>
              </Field>
              {amountField(
                'Saldo inicial',
                'amount',
                currentAccount
                  ? (currentAccount.balanceCents / 100).toFixed(2).replace('.', ',')
                  : undefined,
              )}
              <p className="form-note">
                O saldo inicial deve ser anterior aos lançamentos que você vai registrar, para
                evitar dupla contagem.
              </p>
            </>
          )}
          {kind === 'card' && (
            <>
              <Field label="Nome do cartão">
                <input name="name" required placeholder="Ex.: cartão principal" />
              </Field>
              <Field label="Últimos quatro dígitos">
                <input
                  name="last4"
                  pattern="\d{4}"
                  maxLength={4}
                  inputMode="numeric"
                  required
                  placeholder="0000"
                />
              </Field>
              {amountField('Limite total')}
              <div className="form-grid">
                <Field label="Dia de fechamento">
                  <input
                    name="closingDay"
                    type="number"
                    min="1"
                    max="31"
                    defaultValue="20"
                    required
                  />
                </Field>
                <Field label="Dia de vencimento">
                  <input name="dueDay" type="number" min="1" max="31" defaultValue="27" required />
                </Field>
              </div>
              <Field
                label="Cashback (%)"
                hint="Estimativa configurada; confira elegibilidade e teto com o emissor."
              >
                <input name="cashback" defaultValue="0" inputMode="decimal" required />
              </Field>
            </>
          )}
          {kind === 'budget' && (
            <>
              {categoryField}
              {amountField('Limite para o mês')}
              <p className="form-note">
                Período: {data.month}. Salvar uma categoria existente atualiza seu limite.
              </p>
            </>
          )}
          {kind === 'investment' && (
            <>
              <Field label="Nome do investimento">
                <input name="name" required placeholder="Ex.: reserva de emergência" />
              </Field>
              <Field label="Tipo de ativo">
                <select value={investmentType} onChange={(e) => setInvestmentType(e.target.value)}>
                  <option value="CDB_CDI">CDB / Caixinha CDI</option>
                  <option value="TESOURO">Tesouro</option>
                  <option value="FII_ACOES">Ações / FIIs</option>
                  <option value="GLOBAL">Carteira exterior (valor em BRL)</option>
                  <option value="RESERVA_CASAL">Reserva do casal</option>
                </select>
              </Field>
              <div className="form-grid">
                {amountField('Total aplicado', 'principal')}
                {amountField('Saldo observado', 'current')}
              </div>
              <Field
                label="Remuneração contratada (% do CDI)"
                hint="Não é promessa de rentabilidade; use 0 se não se aplica."
              >
                <input name="cdi" inputMode="decimal" defaultValue="100" required />
              </Field>
              <Field label="Data da posição">
                <input name="valuationDate" type="date" required defaultValue={today()} />
              </Field>
              {['CDB_CDI', 'RESERVA_CASAL'].includes(investmentType) && (
                <label className="checkbox">
                  <input type="checkbox" name="fgc" />
                  Confirmei que este instrumento é elegível ao FGC
                </label>
              )}
              <p className="form-note">
                Posição informada por você. O sistema não contrata investimentos nem garante
                rendimentos.
              </p>
            </>
          )}
          {kind === 'valueInvestment' && (
            <>
              <p className="callout">{investment?.name}</p>
              {amountField('Saldo atual observado')}
              <Field label="Data da posição">
                <input name="valuationDate" type="date" required defaultValue={today()} />
              </Field>
            </>
          )}
          {kind === 'goal' && (
            <>
              <Field label="Nome do plano">
                <input name="name" required placeholder="Ex.: nossa próxima viagem" />
              </Field>
              <div className="form-grid">
                {amountField('Quanto queremos juntar', 'target')}
                {amountField('Já reservado', 'saved', '0,00')}
              </div>
              <Field label="Data desejada">
                <input name="targetDate" type="date" required />
              </Field>
              <p className="form-note">
                Metas organizam dinheiro já existente. Não aumentam o patrimônio nem movimentam
                contas.
              </p>
            </>
          )}
          {kind === 'contributeGoal' && (
            <>
              {amountField('Valor adicional reservado')}
              <p className="form-note">
                Atualiza somente o acompanhamento da meta. Não representa depósito ou transferência.
              </p>
            </>
          )}
          {kind === 'recurring' && (
            <>
              <Field label="Nome da conta">
                <input name="name" required placeholder="Ex.: internet da casa" />
              </Field>
              {categoryField}
              <div className="form-grid">
                {amountField()}
                <Field label="Dia de vencimento">
                  <input name="dueDay" type="number" min="1" max="31" defaultValue="10" required />
                </Field>
              </div>
            </>
          )}
          {kind === 'settle' && (
            <>
              <div className="callout">
                {data.summary.coupleDebtCents > 0
                  ? 'Kethellen deve acertar com Cassiano'
                  : 'Cassiano deve acertar com Kethellen'}
                : <strong>{brl(Math.abs(data.summary.coupleDebtCents))}</strong>.
              </div>
              {amountField(
                'Quanto foi acertado',
                'amount',
                (Math.abs(data.summary.coupleDebtCents) / 100).toFixed(2).replace('.', ','),
              )}
              <p className="form-note">
                Confirme apenas depois de vocês realizarem o acerto. Este registro não transfere
                dinheiro nem cria outra despesa.
              </p>
            </>
          )}
          {kind === 'payInvoice' && (
            <>
              <div className="callout">
                Fatura {data.cards.find((c) => c.id === id)?.name} · {data.month}
                <br />
                <strong>{brl(data.cards.find((c) => c.id === id)?.invoiceCents ?? 0)}</strong>
              </div>
              {accountField}
              <p className="form-note">
                O valor sai da conta e liquida a fatura no controle, sem contar a despesa duas
                vezes. Não efetua um pagamento no banco.
              </p>
            </>
          )}
          {kind === 'payRecurring' && (
            <>
              <div className="callout">
                {currentBill?.name}
                <br />
                <strong>{brl(currentBill?.amountCents ?? 0)}</strong>
              </div>
              {accountField}
              <Field label="Competência do pagamento">
                <input
                  type="month"
                  name="paymentMonth"
                  defaultValue={today().slice(0, 7)}
                  required
                />
              </Field>
              <p className="form-note">
                Confirme depois do pagamento no banco. O controle registra a despesa uma única vez
                nesta competência.
              </p>
            </>
          )}
          {kind === 'categorize' && (
            <>
              <p className="callout">{existing?.description}</p>
              {categoryField}
              <label className="checkbox">
                <input
                  type="checkbox"
                  name="learn"
                  defaultChecked={existing?.paidByUserId === data.user.slug}
                />
                Aplicar a mesma categoria nas próximas importações deste estabelecimento
              </label>
            </>
          )}
          {kind === 'import' && (
            <>
              <Field label="Conta ou cartão do extrato">
                <select name="accountId" required>
                  <option value="">Selecione o destino</option>
                  <optgroup label="Contas bancárias">
                    {editableAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Cartões (compras com valor negativo)">
                    {editableCards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.last4}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </Field>
              <Field label="Extrato .OFX ou .CSV (até 2 MB)">
                <input
                  type="file"
                  accept=".ofx,.csv"
                  required
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </Field>
              <p className="form-note">
                CSV padrão: Data;Descrição;Valor;ID. Despesas têm valor negativo. No cartão, importe
                somente compras; pagamentos e estornos usam os fluxos próprios. Você também pode
                mapear as colunas abaixo.
              </p>
              <details>
                <summary>Meu CSV usa outros nomes de coluna</summary>
                <div className="form-grid">
                  <Field label="Coluna da data">
                    <input name="dateColumn" placeholder="Data" />
                  </Field>
                  <Field label="Coluna da descrição">
                    <input name="descriptionColumn" placeholder="Descrição" />
                  </Field>
                  <Field label="Coluna do valor">
                    <input name="amountColumn" placeholder="Valor" />
                  </Field>
                  <Field label="Coluna do identificador">
                    <input name="idColumn" placeholder="ID (opcional)" />
                  </Field>
                </div>
                <Field label="Formato decimal">
                  <select name="decimalFormat">
                    <option value="">Detectar pelo separador</option>
                    <option value="br">Brasileiro: 1.234,56</option>
                    <option value="decimal">Decimal: 1234.56</option>
                  </select>
                </Field>
              </details>
              <div className="callout">
                Nenhum valor entra no saldo antes da sua aprovação. A importação repetida da mesma
                origem não duplica os identificadores já encontrados.
              </div>
            </>
          )}
          {kind === 'bank' && (
            <>
              <div className="callout">
                Conecte seus bancos no Meu Pluggy e autorize o conector MeuPluggy no Dashboard. As
                consultas seguem a atualização diária do serviço.
              </div>
              <Field label="Client ID">
                <input name="clientId" required autoComplete="off" />
              </Field>
              <Field label="Client Secret">
                <input name="clientSecret" type="password" required autoComplete="new-password" />
              </Field>
              <Field label="itemIds (um por linha ou separados por vírgula)">
                <textarea name="itemIds" rows={3} required spellCheck={false} />
              </Field>
              <p className="form-note">
                Credenciais criptografadas com AES-256-GCM no servidor. Não são exibidas ao outro
                perfil. Sem ativar plano pago.
              </p>
            </>
          )}
          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
          <div className="form-actions">
            <button type="button" className="button secondary" onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button className="button" disabled={busy}>
              {busy
                ? 'Salvando…'
                : kind === 'import'
                  ? 'Importar para revisão'
                  : kind === 'bank'
                    ? 'Salvar conexão'
                    : 'Confirmar registro'}
              <Icon name="arrow" size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
