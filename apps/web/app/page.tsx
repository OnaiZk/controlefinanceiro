'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  addMonths,
  dateInMonth,
  parseMoney,
  projectCdi,
  today,
  type Command,
  type PublicUser,
  type Snapshot,
  type Transaction,
  type View,
} from '../../../packages/shared/src/index';
import FinanceForm, { api, type FormKind, type FormSelection } from '../components/forms';
import { Donut, Empty, Icon, Money, Panel, Progress, Trend } from '../components/ui';

const tabs = [
  { id: 'overview', name: 'Visão Geral', short: 'Início', icon: 'overview' },
  { id: 'couple', name: 'Casal & Divisão', short: 'Casal', icon: 'couple' },
  {
    id: 'wealth',
    name: 'Patrimônio & Invest',
    short: 'Patrimônio',
    icon: 'wealth',
  },
  { id: 'cards', name: 'Cartões & Cashback', short: 'Cartões', icon: 'cards' },
  {
    id: 'ledger',
    name: 'Extrato & Conciliação',
    short: 'Extrato',
    icon: 'ledger',
  },
] as const;
type Tab = (typeof tabs)[number]['id'];
const scopeName = (scope: string) =>
  scope === 'CAS' ? 'Cassiano' : scope === 'KET' ? 'Kethellen' : 'Casal';
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  })
    .format(new Date(date + 'T12:00:00Z'))
    .replace('.', '');
function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? 'brand-light' : ''}`}>
      <span className="brand-symbol">
        <span />
        <span />
        <span />
      </span>
      <span>
        entre<span className="brand-serif">contas</span>
      </span>
    </div>
  );
}

function Login({ onLogin }: { onLogin: (user: PublicUser) => void }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [show, setShow] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const result = await api<{ user: PublicUser }>('auth/login', {
        email: String(form.get('email')).trim(),
        password: String(form.get('password')),
      });
      onLogin(result.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível entrar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-shell">
      <section className="login-story">
        <Brand light />
        <div className="login-copy">
          <span className="eyebrow">CASSIANO & KETHELLEN</span>
          <h1>
            Uma vida a dois.
            <br />
            Um futuro
            <br />
            <em>em comum.</em>
          </h1>
          <p>
            Clareza para o seu dinheiro.
            <br />
            Espaço para os planos de vocês.
          </p>
        </div>
        <div className="login-art" aria-hidden="true">
          <div className="art-circle one" />
          <div className="art-circle two" />
          <div className="art-line" />
          <span>01 / ORGANIZAR · PLANEJAR · VIVER</span>
        </div>
        <div className="login-story-footer">
          <span>Finanças com intenção.</span>
          <span>Feito para vocês dois.</span>
        </div>
      </section>
      <section className="login-form-side">
        <div className="login-mobile-brand">
          <Brand />
        </div>
        <div className="login-form-wrap">
          <span className="small-chip">
            <Icon name="shield" size={15} /> ACESSO RESERVADO
          </span>
          <h2>Bom ter você aqui.</h2>
          <p>Entre para cuidar do que vem pela frente.</p>
          <form onSubmit={submit}>
            <label className="field">
              <span>Seu email</span>
              <input
                name="email"
                type="email"
                autoComplete="username"
                placeholder="voce@email.com"
                required
                autoFocus
              />
            </label>
            <label className="field">
              <span>Sua senha</span>
              <div className="password-input">
                <input
                  name="password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Sua senha de acesso"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  <Icon name={show ? 'hidden' : 'eye'} />
                </button>
              </div>
            </label>
            {error && (
              <div className="error-box" role="alert">
                {error}
              </div>
            )}
            <button className="button login-submit" disabled={busy}>
              {busy ? 'Verificando acesso…' : 'Entrar no meu espaço'}
              <Icon name="arrow" size={18} />
            </button>
          </form>
          <div className="login-privacy">
            <Icon name="shield" size={17} />
            <p>
              Um espaço privado para Cassiano e Kethellen.
              <br />
              Seus dados não são usados para treinar IA.
            </p>
          </div>
        </div>
        <footer>
          BRL · PORTUGUÊS DO BRASIL<span>SEU DINHEIRO, COM CLAREZA.</span>
        </footer>
      </section>
    </main>
  );
}

export default function Home() {
  const [user, setUser] = useState<PublicUser | null>(null),
    [boot, setBoot] = useState(true),
    [data, setData] = useState<Snapshot | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  const [view, setView] = useState<View>('INDIVIDUAL'),
    [month, setMonth] = useState(today().slice(0, 7)),
    [tab, setTab] = useState<Tab>('overview');
  const [hidden, setHidden] = useState(false),
    [dark, setDark] = useState(false),
    [modal, setModal] = useState<FormSelection | null>(null),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [settings, setSettings] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    message: string;
    command: Command;
  } | null>(null);
  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      setData(await api<Snapshot>(`snapshot?view=${view}&month=${month}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
  }, [user, view, month]);
  useEffect(() => {
    api<{ user: PublicUser }>('me')
      .then((result) => setUser(result.user))
      .catch(() => {})
      .finally(() => setBoot(false));
    const expired = () => {
      setUser(null);
      setData(null);
      setNotice('');
      setModal(null);
      setConfirmation(null);
      setView('INDIVIDUAL');
      setTab('overview');
    };
    window.addEventListener('session-expired', expired);
    const theme = localStorage.getItem('entre-contas-theme') === 'dark';
    setDark(theme);
    document.documentElement.dataset.theme = theme ? 'dark' : 'light';
    setHidden(localStorage.getItem('entre-contas-hide') === 'true');
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production')
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    return () => window.removeEventListener('session-expired', expired);
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  const open = (kind: FormKind, id?: string) => setModal({ kind, id });
  const saved = async (message: string) => {
    await refresh();
    setNotice(message);
  };
  async function act(command: Command, message = 'Alteração salva.') {
    if (busy) return;
    setBusy(true);
    try {
      await api('command', command);
      await saved(message);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Não foi possível concluir.');
    } finally {
      setBusy(false);
      setConfirmation(null);
    }
  }
  async function doLogout() {
    setBusy(true);
    try {
      await api('auth/logout', {});
      setUser(null);
      setData(null);
      setNotice('');
      setSettings(false);
      setModal(null);
      setConfirmation(null);
      setView('INDIVIDUAL');
      setTab('overview');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Não foi possível encerrar.');
    } finally {
      setBusy(false);
    }
  }
  async function sync(provider: 'MOCK' | 'PLUGGY') {
    if (!data || busy) return;
    const account = data.fundingAccounts.find((a) => a.ownerScope === data.user.slug);
    if (!account && provider === 'MOCK') {
      setNotice('Cadastre uma conta pessoal antes de simular.');
      return;
    }
    if (provider === 'PLUGGY' && !data.bankConnections.configured) {
      open('bank');
      return;
    }
    setBusy(true);
    try {
      const result = await api<{
        imported: number;
        duplicates: number;
        notice?: string;
      }>('bank/sync', { provider, accountId: account?.id });
      await saved(
        `${result.imported} lançamentos para revisar; ${result.duplicates} já existentes.${result.notice ? ' ' + result.notice : ''}`,
      );
      setTab('ledger');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'A sincronização não foi concluída.');
    } finally {
      setBusy(false);
    }
  }
  async function exportCsv() {
    if (!data) return;
    try {
      await api('audit/export', {});
    } catch {
      setNotice('Não foi possível registrar a exportação. Tente novamente.');
      return;
    }
    const escape = (value: string) =>
      '"' + (/^[=+\-@]/.test(value) ? "'" + value : value).replace(/"/g, '""') + '"';
    const rows = [
      ['Data', 'Descrição', 'Categoria', 'Titular', 'Valor em centavos', 'Situação'],
      ...data.transactions.map((t) => [
        t.occurredAt,
        t.description,
        data.categories.find((c) => c.id === t.categoryId)?.name ?? '',
        scopeName(t.ownerScope),
        String(t.type === 'EXPENSE' ? -t.amountCents : t.amountCents),
        t.status,
      ]),
    ];
    const csv = '\uFEFF' + rows.map((row) => row.map(escape).join(';')).join('\r\n');
    const filename = `entre-contas-${view.toLowerCase()}-${month}.csv`;
    const bridge = (
      window as unknown as {
        ReactNativeWebView?: { postMessage: (value: string) => void };
      }
    ).ReactNativeWebView;
    if (bridge) {
      bridge.postMessage(JSON.stringify({ type: 'export-csv', csv, filename }));
      return;
    }
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Extrato exportado em centavos. Guarde o arquivo em local seguro.');
  }
  if (boot)
    return (
      <main className="boot">
        <Brand />
        <span className="loading-line" />
        <p>Preparando seu espaço…</p>
      </main>
    );
  if (!user)
    return <Login onLogin={(nextUser) => { setNotice(''); setError(''); setUser(nextUser); }} />;
  const monthTitle = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(month + '-15T12:00:00Z'));
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">
          NOSSO ESPAÇO<span>FINANÇAS PESSOAIS & A DOIS</span>
        </div>
        <nav aria-label="Navegação principal">
          {tabs.map((item) => (
            <button
              key={item.id}
              className={`rail-item ${tab === item.id ? 'active' : ''}`}
              onClick={() => {
                setTab(item.id);
                setSettings(false);
              }}
              aria-current={tab === item.id ? 'page' : undefined}
            >
              <Icon name={item.icon} />
              <span>{item.name}</span>
              {tab === item.id && <span className="rail-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="serif">
              Pequenas escolhas.
              <br />
              Grandes planos.
            </span>
            <div className="mini-line" />
          </div>
          <button
            className={`rail-item ${settings ? 'active' : ''}`}
            onClick={() => setSettings(!settings)}
          >
            <Icon name="settings" />
            <span>Contas & conexões</span>
          </button>
          <button className="profile" onClick={() => setSettings(!settings)}>
            <span className={`avatar ${user.slug.toLowerCase()}`}>{user.slug.slice(0, 1)}</span>
            <span>
              <strong>{user.name}</strong>
              <small>Meu espaço pessoal</small>
            </span>
            <Icon name="chevron" size={15} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-brand">
            <Brand />
          </div>
          <span className="breadcrumb">
            NOSSO ESPAÇO <span>/</span>{' '}
            {settings ? 'CONTAS & CONEXÕES' : tabs.find((t) => t.id === tab)?.name.toUpperCase()}
          </span>
          <div className="topbar-actions">
            <span className="today-date">
              {new Intl.DateTimeFormat('pt-BR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              }).format(new Date())}
            </span>
            <button
              className="icon-button"
              title={hidden ? 'Mostrar valores' : 'Ocultar valores'}
              aria-label={hidden ? 'Mostrar valores' : 'Ocultar valores'}
              onClick={() => {
                setHidden(!hidden);
                localStorage.setItem('entre-contas-hide', String(!hidden));
              }}
            >
              <Icon name={hidden ? 'hidden' : 'eye'} />
            </button>
            <button
              className="icon-button"
              title="Alternar tema"
              aria-label="Alternar tema"
              onClick={() => {
                setDark(!dark);
                document.documentElement.dataset.theme = !dark ? 'dark' : 'light';
                localStorage.setItem('entre-contas-theme', !dark ? 'dark' : 'light');
              }}
            >
              <Icon name={dark ? 'sun' : 'moon'} />
            </button>
            <button
              className="icon-button mobile-settings"
              aria-label="Contas e configurações"
              onClick={() => setSettings(!settings)}
            >
              <Icon name="settings" />
            </button>
            <button
              className="icon-button"
              title="Sair"
              aria-label="Sair da conta"
              onClick={() => void doLogout()}
              disabled={busy}
            >
              <Icon name="logout" />
            </button>
          </div>
        </header>
        <main className="workspace" aria-busy={loading}>
          <div className="page-heading">
            <div>
              <p className="eyebrow">UM OLHAR PARA O QUE IMPORTA</p>
              <h1>
                {settings ? (
                  'Tudo no seu lugar.'
                ) : tab === 'overview' ? (
                  <>
                    Seu dinheiro, <em>com clareza.</em>
                  </>
                ) : tab === 'couple' ? (
                  <>
                    Planos que <em>se encontram.</em>
                  </>
                ) : tab === 'wealth' ? (
                  <>
                    Hoje é parte <em>do futuro.</em>
                  </>
                ) : tab === 'cards' ? (
                  <>
                    Escolhas <em>sob controle.</em>
                  </>
                ) : (
                  <>
                    Cada movimento, <em>uma história.</em>
                  </>
                )}
              </h1>
              <p className="page-description">
                {settings
                  ? 'Organize suas contas, conexões e preferências de acesso.'
                  : `Olá, ${user.name}. ${view === 'COUPLE' ? 'Um olhar para a vida que vocês constroem juntos.' : view === 'CONSOLIDATED' ? 'Os dois caminhos, reunidos em uma visão.' : 'É bom saber exatamente onde você está.'}`}
              </p>
            </div>
            <button className="button" onClick={() => open('transaction')} disabled={!data}>
              <Icon name="plus" size={18} />
              Novo lançamento
            </button>
          </div>
          <div className="toolbar">
            <div className="view-switch" aria-label="Modo de visualização">
              {(['INDIVIDUAL', 'COUPLE', 'CONSOLIDATED'] as const).map((v) => (
                <button
                  key={v}
                  className={view === v ? 'selected' : ''}
                  onClick={() => {
                    if (view !== v) setData(null);
                    setView(v);
                  }}
                  aria-pressed={view === v}
                >
                  {v === 'INDIVIDUAL' ? 'Individual' : v === 'COUPLE' ? 'Casal' : 'Consolidado'}
                </button>
              ))}
            </div>
            <div className="period-control">
              <button
                className="icon-button"
                aria-label="Mês anterior"
                onClick={() => setMonth(addMonths(`${month}-01`, -1).slice(0, 7))}
              >
                <span className="rotate">
                  <Icon name="chevron" size={15} />
                </span>
              </button>
              <label>
                <Icon name="calendar" size={16} />
                <span>{monthTitle}</span>
                <input
                  aria-label="Selecionar mês"
                  type="month"
                  value={month}
                  onChange={(e) => e.target.value && setMonth(e.target.value)}
                />
              </label>
              <button
                className="icon-button"
                aria-label="Próximo mês"
                onClick={() => setMonth(addMonths(`${month}-01`, 1).slice(0, 7))}
              >
                <Icon name="chevron" size={15} />
              </button>
            </div>
          </div>
          <nav className="section-tabs" aria-label="Áreas do controle financeiro">
            {tabs.map((item) => (
              <button
                key={item.id}
                className={tab === item.id && !settings ? 'active' : ''}
                aria-current={tab === item.id && !settings ? 'page' : undefined}
                onClick={() => {
                  setTab(item.id);
                  setSettings(false);
                }}
              >
                <Icon name={item.icon} size={16} />
                {item.name}
              </button>
            ))}
          </nav>
          {data?.mode === 'local' && (
            <div className="demo-banner">
              <span className="status-dot" />
              <strong>{data.demoEnabled ? 'Demonstração' : 'Ambiente local'}</strong>
              <span>
                {data.demoEnabled ? 'Dados demonstrativos. ' : ''}Alterações salvas somente nesta
                instalação.
              </span>
            </div>
          )}
          {error && (
            <div className="error-box page-error" role="alert">
              {error}
              <button className="text-button" onClick={() => void refresh()}>
                Tentar novamente
              </button>
            </div>
          )}
          {!data ? (
            <div className="skeleton-grid">
              <div />
              <div />
              <div />
              <div />
            </div>
          ) : settings ? (
            <Settings
              data={data}
              hidden={hidden}
              open={open}
              sync={sync}
              busy={busy}
              onDisconnect={async () => {
                try {
                  await api('bank/disconnect', {});
                  await saved('Conexão removida. Seu histórico foi preservado.');
                } catch (e) {
                  setNotice(e instanceof Error ? e.message : 'Falha ao desconectar.');
                }
              }}
            />
          ) : (
            <>
              {tab === 'overview' && (
                <>
                  <div className="overview-top">
                    <section className="balance-card">
                      <div className="balance-top">
                        <span>SALDO DISPONÍVEL HOJE</span>
                        <span className="balance-scope">
                          {view === 'INDIVIDUAL'
                            ? user.slug
                            : view === 'COUPLE'
                              ? 'CNJ'
                              : 'CAS + KET'}
                        </span>
                      </div>
                      <Money
                        value={data.summary.balanceCents}
                        hidden={hidden}
                        className="balance-value"
                      />
                      <p>Um retrato das suas contas, sem contar investimentos.</p>
                      <div className="balance-footer">
                        <span>
                          <i />
                          {data.accounts.length}{' '}
                          {data.accounts.length === 1 ? 'conta acompanhada' : 'contas acompanhadas'}
                        </span>
                        <button onClick={() => setSettings(true)} aria-label="Ver minhas contas">
                          <Icon name="arrow" size={20} />
                        </button>
                      </div>
                      <svg className="balance-art" viewBox="0 0 280 150" aria-hidden="true">
                        <path
                          d="M0 145 50 120 90 133 135 79 180 95 225 38 280 5M0 165 50 140 90 153 135 99 180 115 225 58 280 25M0 185 50 160 90 173 135 119 180 135 225 78 280 45"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1"
                        />
                      </svg>
                    </section>
                    <section className="flow-card">
                      <div>
                        <span className="metric-icon positive">
                          <Icon name="arrow" size={17} />
                        </span>
                        <span className="eyebrow">ENTRADAS DO MÊS</span>
                      </div>
                      <Money value={data.summary.incomeCents} hidden={hidden} />
                      <p>Receitas confirmadas no período</p>
                      <div className="metric-bottom">
                        <span>Seu fluxo de entrada</span>
                        <span className="positive">Recebido</span>
                      </div>
                    </section>
                    <section className="flow-card">
                      <div>
                        <span className="metric-icon expense">
                          <span className="rotate">
                            <Icon name="arrow" size={17} />
                          </span>
                        </span>
                        <span className="eyebrow">SAÍDAS DO MÊS</span>
                      </div>
                      <Money value={data.summary.expenseCents} hidden={hidden} />
                      <p>
                        {data.summary.previousExpenseCents
                          ? `${Math.round(((data.summary.expenseCents - data.summary.previousExpenseCents) * 100) / data.summary.previousExpenseCents)}% em relação ao mês anterior`
                          : 'Seu primeiro período de acompanhamento'}
                      </p>
                      <div className="metric-bottom">
                        <span>Receitas menos despesas</span>
                        <Money
                          value={data.summary.incomeCents - data.summary.expenseCents}
                          hidden={hidden}
                        />
                      </div>
                    </section>
                  </div>
                  <div className="chart-grid">
                    <Panel
                      title="O ritmo das suas escolhas"
                      eyebrow="EVOLUÇÃO NO ANO"
                      action={<span className="subtle-chip">Mensal</span>}
                    >
                      <Trend data={data} hidden={hidden} onMonth={setMonth} />
                    </Panel>
                    <Panel title="Para onde foi seu dinheiro" eyebrow="GASTOS POR CATEGORIA">
                      <Donut data={data} hidden={hidden} />
                    </Panel>
                  </div>
                  <div className="detail-grid">
                    <Panel
                      title="Últimos movimentos"
                      eyebrow="SEU DIA A DIA"
                      action={
                        <button className="text-button" onClick={() => setTab('ledger')}>
                          Ver extrato
                          <Icon name="chevron" size={14} />
                        </button>
                      }
                    >
                      <TransactionList
                        data={data}
                        hidden={hidden}
                        limit={5}
                        busy={busy}
                        open={open}
                        act={act}
                        confirm={setConfirmation}
                      />
                    </Panel>
                    <Panel
                      title="Dentro dos seus planos"
                      eyebrow="ORÇAMENTOS"
                      action={
                        <button
                          className="icon-button"
                          aria-label="Adicionar orçamento"
                          onClick={() => open('budget')}
                        >
                          <Icon name="plus" size={18} />
                        </button>
                      }
                    >
                      <Budgets data={data} hidden={hidden} open={open} />
                    </Panel>
                  </div>
                  <div className="detail-grid">
                    <Panel title="Um segundo olhar" eyebrow="SEUS AGENTES FINANCEIROS">
                      <Alerts data={data} hidden={hidden} busy={busy} act={act} />
                    </Panel>
                    <Upcoming data={data} hidden={hidden} open={open} />
                  </div>
                </>
              )}
              {tab === 'ledger' && (
                <Ledger
                  data={data}
                  hidden={hidden}
                  busy={busy}
                  open={open}
                  act={act}
                  confirm={setConfirmation}
                  sync={sync}
                  exportCsv={exportCsv}
                />
              )}
              {tab === 'couple' && (
                <Couple data={data} hidden={hidden} open={open} setView={setView} />
              )}
              {tab === 'wealth' && <Wealth data={data} hidden={hidden} open={open} />}
              {tab === 'cards' && <Cards data={data} hidden={hidden} open={open} />}
            </>
          )}
          <footer className="workspace-footer">
            <span>
              ENTRE CONTAS <i /> FEITO PARA VOCÊS DOIS.
            </span>
            <span>BRL · Valores em reais</span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Navegação no celular">
        {tabs.map((item) => (
          <button
            key={item.id}
            className={tab === item.id && !settings ? 'active' : ''}
            onClick={() => {
              setTab(item.id);
              setSettings(false);
            }}
          >
            <Icon name={item.icon} size={19} />
            <span>{item.short}</span>
          </button>
        ))}
      </nav>
      {notice && (
        <div className="toast" role="status">
          <Icon name="check" size={18} />
          <span>{notice}</span>
          <button
            className="icon-button"
            onClick={() => setNotice('')}
            aria-label="Fechar mensagem"
          >
            <Icon name="close" size={15} />
          </button>
        </div>
      )}
      {modal && data && (
        <FinanceForm selection={modal} data={data} onClose={() => setModal(null)} onSaved={saved} />
      )}{' '}
      {confirmation && (
        <div className="modal-overlay">
          <div
            className="modal confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <h2 id="confirm-title">{confirmation.title}</h2>
            <p>{confirmation.message}</p>
            <div className="form-actions">
              <button
                className="button secondary"
                autoFocus
                onClick={() => setConfirmation(null)}
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                className="button"
                disabled={busy}
                onClick={() => void act(confirmation.command)}
              >
                {busy ? 'Processando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type SharedProps = {
  data: Snapshot;
  hidden: boolean;
  open: (kind: FormKind, id?: string) => void;
};
type TransactionProps = SharedProps & {
  limit?: number;
  busy: boolean;
  act: (command: Command, message?: string) => Promise<void>;
  confirm: (selection: { title: string; message: string; command: Command }) => void;
  transactions?: Transaction[];
};
function TransactionList({
  data,
  hidden,
  limit,
  busy,
  act,
  open,
  confirm,
  transactions: override,
}: TransactionProps) {
  const list = (override ?? data.transactions).slice(0, limit);
  if (!list.length)
    return (
      <Empty
        title="Espaço para novos movimentos"
        action={
          <button className="text-button" onClick={() => open('transaction')}>
            Registrar lançamento
            <Icon name="plus" size={15} />
          </button>
        }
      >
        Seus registros vão aparecer por aqui.
      </Empty>
    );
  return (
    <div className="transactions-table">
      <div className="table-head">
        <span>Descrição</span>
        <span>Categoria</span>
        <span>Data</span>
        <span>Valor</span>
        <span />
      </div>
      {list.map((t) => {
        const category = data.categories.find((c) => c.id === t.categoryId);
        const editable = t.ownerScope === data.user.slug || t.ownerScope === 'COUPLE';
        return (
          <div
            key={t.id}
            className={`transaction-row ${t.status === 'REJECTED' ? 'rejected' : ''}`}
          >
            <div className="transaction-description">
              <span className={`category-code ${t.type === 'INCOME' ? 'income-code' : ''}`}>
                {t.type === 'TRANSFER' ? 'TRF' : (category?.code ?? 'OUT')}
              </span>
              <div>
                <strong>{t.description}</strong>
                <small>
                  <span className="owner-tag">
                    {t.ownerScope === 'COUPLE' ? 'CNJ' : t.ownerScope}
                  </span>
                  {t.status === 'NEEDS_REVIEW' ? (
                    <span className="status-review">Para revisar</span>
                  ) : t.status === 'PENDING' ? (
                    'Pendente'
                  ) : t.status === 'REJECTED' ? (
                    'Reprovado'
                  ) : t.entryKind === 'REFUND' ? (
                    'Estorno'
                  ) : t.source === 'MOCK' ? (
                    'Demonstração'
                  ) : (
                    'Confirmado'
                  )}
                </small>
              </div>
            </div>
            <span className="transaction-category">{category?.name}</span>
            <span className="transaction-date">{dateLabel(t.occurredAt)}</span>
            <Money
              className={t.type === 'INCOME' ? 'positive' : ''}
              value={t.type === 'EXPENSE' || t.type === 'TRANSFER' ? -t.amountCents : t.amountCents}
              hidden={hidden}
            />
            <div className="row-actions">
              {editable && t.status === 'NEEDS_REVIEW' ? (
                <>
                  <button
                    className="review-button approve"
                    disabled={busy}
                    onClick={() =>
                      void act(
                        { kind: 'review', id: t.id, approve: true },
                        'Lançamento aprovado e incorporado ao saldo.',
                      )
                    }
                    title="Aprovar lançamento"
                    aria-label={`Aprovar ${t.description}`}
                  >
                    <Icon name="check" size={16} />
                  </button>
                  <button
                    className="review-button reject"
                    disabled={busy}
                    onClick={() =>
                      void act(
                        { kind: 'review', id: t.id, approve: false },
                        'Lançamento reprovado.',
                      )
                    }
                    title="Reprovar lançamento"
                    aria-label={`Reprovar ${t.description}`}
                  >
                    <Icon name="reject" size={16} />
                  </button>
                </>
              ) : (
                editable &&
                t.entryKind === 'STANDARD' && (
                  <details className="row-menu">
                    <summary aria-label={`Ações de ${t.description}`}>···</summary>
                    <div>
                      {t.status === 'REJECTED' && (
                        <button
                          onClick={() =>
                            void act(
                              { kind: 'reopenReview', id: t.id },
                              'Lançamento retornou à revisão, sem alterar o saldo.',
                            )
                          }
                        >
                          Reabrir revisão
                        </button>
                      )}
                      {t.status === 'PENDING' && (
                        <button onClick={() => void act({ kind: 'markPaid', id: t.id })}>
                          Marcar como realizado
                        </button>
                      )}
                      {t.source === 'MANUAL' &&
                        t.entryKind === 'STANDARD' &&
                        !t.installmentGroup && (
                          <button onClick={() => open('transaction', t.id)}>
                            Editar lançamento
                          </button>
                        )}
                      {t.type !== 'TRANSFER' && (
                        <button onClick={() => open('categorize', t.id)}>Categoria & regra</button>
                      )}
                      {t.type === 'EXPENSE' &&
                        t.status === 'PAID' &&
                        t.entryKind === 'STANDARD' && (
                          <button
                            onClick={() =>
                              confirm({
                                title: 'Registrar estorno?',
                                message:
                                  'Um crédito vinculado será registrado. Isso não solicita devolução ao banco.',
                                command: { kind: 'refund', id: t.id },
                              })
                            }
                          >
                            Registrar estorno
                          </button>
                        )}
                      {t.entryKind === 'STANDARD' && (
                        <button
                          className="expense"
                          onClick={() =>
                            confirm({
                              title: 'Excluir este lançamento?',
                              message:
                                'O registro será removido do controle e deixará de compor os saldos. A ação ficará na auditoria.',
                              command: { kind: 'deleteTransaction', id: t.id },
                            })
                          }
                        >
                          Excluir lançamento
                        </button>
                      )}
                    </div>
                  </details>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
function Budgets({ data, hidden, open }: SharedProps) {
  return data.budgets.length ? (
    <div className="budgets-list">
      {data.budgets.map((b) => {
        const category = data.categories.find((c) => c.id === b.categoryId);
        const pct = Math.round((b.spentCents * 100) / b.limitCents);
        return (
          <div className="budget-item" key={b.id}>
            <div>
              <strong>{category?.name}</strong>
              <span className={pct >= 100 ? 'expense' : 'muted'}>{pct}%</span>
            </div>
            <Progress value={b.spentCents} limit={b.limitCents} warn />
            <div>
              <span>
                <Money value={b.spentCents} hidden={hidden} />
                <small>
                  {' '}
                  / <Money value={b.limitCents} hidden={hidden} />
                </small>
              </span>
              <span className="owner-tag">{b.ownerScope === 'COUPLE' ? 'CNJ' : b.ownerScope}</span>
            </div>
          </div>
        );
      })}
      <button className="text-button" onClick={() => open('budget')}>
        Ajustar planejamento
        <Icon name="chevron" size={14} />
      </button>
    </div>
  ) : (
    <Empty
      title="Dê um destino ao seu dinheiro"
      action={
        <button className="text-button" onClick={() => open('budget')}>
          Criar orçamento
          <Icon name="plus" size={14} />
        </button>
      }
    >
      Defina limites por categoria para acompanhar seu mês.
    </Empty>
  );
}
function Alerts({
  data,
  hidden,
  act,
  busy,
}: {
  data: Snapshot;
  hidden: boolean;
  act: TransactionProps['act'];
  busy: boolean;
}) {
  return data.alerts.length ? (
    <div className="alerts-list">
      {data.alerts.slice(0, 5).map((a) => (
        <div className={`agent-alert ${a.severity.toLowerCase()}`} key={a.id}>
          <span className="agent-initial">{a.agentId.slice(0, 1)}</span>
          <div>
            <small>
              {a.agentId} <span>· {scopeName(a.targetScope)}</span>
            </small>
            <strong>{a.title}</strong>
            <p>{hidden ? a.message.replace(/R\$[\s\u00a0]*[\d.,]+/g, 'R$ •••••') : a.message}</p>
          </div>
          {(a.targetScope === data.user.slug || a.targetScope === 'COUPLE') && (
            <button
              className="icon-button"
              aria-label={`Dispensar alerta ${a.agentId}`}
              onClick={() => void act({ kind: 'dismissAlert', id: a.id }, 'Alerta dispensado.')}
              disabled={busy}
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
      ))}
    </div>
  ) : (
    <Empty title="Tudo tranquilo por aqui">
      Os agentes avisam quando houver um padrão relevante. Mais histórico melhora as comparações.
    </Empty>
  );
}
function Upcoming({ data, hidden, open }: SharedProps) {
  const [range, setRange] = useState(30);
  const now = today();
  const recurring = data.recurringBills
    .filter((b) => b.active)
    .map((b) => {
      let month = now.slice(0, 7);
      for (let i = 0; i < 12 && b.paidMonths.includes(month); i++)
        month = addMonths(month + '-01', 1).slice(0, 7);
      return {
        id: b.id,
        name: b.name,
        amount: b.amountCents,
        date: dateInMonth(month, b.dueDay),
        scope: b.ownerScope,
        action: 'payRecurring' as FormKind,
      };
    });
  const pending = data.upcomingTransactions.map((t) => ({
    id: t.id,
    name: t.description,
    amount: t.amountCents,
    date: t.dueDate!,
    scope: t.ownerScope,
    action: null,
  }));
  const invoices = data.cards
    .filter((c) => c.invoiceCents > 0)
    .map((c) => ({
      id: c.id,
      name: 'Fatura · ' + c.name,
      amount: c.invoiceCents,
      date: dateInMonth(data.month, c.dueDay),
      scope: c.ownerScope,
      action: 'payInvoice' as FormKind,
    }));
  const items = [...recurring, ...pending, ...invoices]
    .filter((b) => (Date.parse(b.date) - Date.parse(now)) / 86400000 <= range)
    .sort((a, b) => a.date.localeCompare(b.date));
  return (
    <Panel
      title="O que vem pela frente"
      eyebrow="VENCIMENTOS & FATURAS"
      action={
        <select
          className="compact-select"
          aria-label="Janela de vencimentos"
          value={range}
          onChange={(e) => setRange(Number(e.target.value))}
        >
          <option value={7}>7 dias</option>
          <option value={15}>15 dias</option>
          <option value={30}>30 dias</option>
        </select>
      }
    >
      {items.length ? (
        <div className="upcoming-list">
          {items.slice(0, 8).map((item) => (
            <div className="upcoming-item" key={item.id}>
              <span className="calendar-day">
                {item.date.slice(8, 10)}
                <small>{dateLabel(item.date).split(' ')[1]}</small>
              </span>
              <div>
                <strong>{item.name}</strong>
                <small>
                  {scopeName(item.scope)}
                  {item.date < now ? ' · pagamento não registrado' : ''}
                </small>
              </div>
              <Money value={item.amount} hidden={hidden} />
              {item.action && (item.scope === data.user.slug || item.scope === 'COUPLE') && (
                <button
                  className="icon-button"
                  aria-label={'Registrar pagamento de ' + item.name}
                  onClick={() => open(item.action!, item.id)}
                >
                  <Icon name="check" size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty title="Nenhum vencimento próximo">Uma coisa a menos para lembrar.</Empty>
      )}
      <button className="text-button" onClick={() => open('recurring')}>
        Adicionar conta recorrente
        <Icon name="plus" size={14} />
      </button>
    </Panel>
  );
}

function Ledger(
  props: TransactionProps & {
    sync: (provider: 'MOCK' | 'PLUGGY') => Promise<void>;
    exportCsv: () => void;
  },
) {
  const { data, hidden, open, busy, sync, exportCsv } = props;
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState('ALL'),
    [category, setCategory] = useState('ALL');
  const list = data.transactions.filter(
    (t) =>
      (!search ||
        t.description.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))) &&
      (status === 'ALL' || t.status === status) &&
      (category === 'ALL' || t.categoryId === category),
  );
  const pending = data.transactions.filter((t) => t.status === 'NEEDS_REVIEW').length;
  return (
    <>
      <div className="import-banner">
        <div>
          <span className="large-icon">
            <Icon name="upload" size={24} />
          </span>
          <div>
            <h2>Seus bancos, no mesmo lugar.</h2>
            <p>Importe um extrato ou consulte sua conexão. Você confere antes de aprovar.</p>
          </div>
        </div>
        <div className="button-group">
          <button className="button secondary" disabled={busy} onClick={() => void sync('PLUGGY')}>
            <Icon name="refresh" size={16} />
            Consultar bancos
          </button>
          <button className="button" onClick={() => open('import')}>
            <Icon name="upload" size={16} />
            Importar extrato
          </button>
        </div>
      </div>
      {pending > 0 && (
        <div className="review-notice">
          <Icon name="shield" size={20} />
          <div>
            <strong>
              {pending} {pending === 1 ? 'lançamento aguarda' : 'lançamentos aguardam'} sua revisão.
            </strong>
            <p>Esses valores ainda não alteram seu saldo no controle.</p>
          </div>
          <button className="text-button" onClick={() => setStatus('NEEDS_REVIEW')}>
            Revisar agora
            <Icon name="chevron" size={14} />
          </button>
        </div>
      )}
      <Panel
        title="Seu livro de movimentos"
        action={
          <button className="text-button" onClick={exportCsv}>
            <Icon name="download" size={16} />
            Exportar CSV
          </button>
        }
      >
        <div className="table-filters">
          <label className="search-field">
            <Icon name="search" size={17} />
            <input
              placeholder="Buscar no extrato…"
              aria-label="Buscar lançamento"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Filtrar situação"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="ALL">Todas as situações</option>
            <option value="PAID">Confirmados</option>
            <option value="PENDING">Pendentes</option>
            <option value="NEEDS_REVIEW">Para revisar</option>
            <option value="REJECTED">Reprovados</option>
          </select>
          <select
            aria-label="Filtrar categoria"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="ALL">Todas as categorias</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <TransactionList {...props} transactions={list} />
        <div className="table-footer">
          <span>{list.length} registros no período</span>
          <span>O saldo inclui apenas movimentos confirmados.</span>
        </div>
      </Panel>
      <div className="detail-grid">
        <Panel
          title="O planejamento do mês"
          eyebrow="ORÇAMENTOS"
          action={
            <button className="text-button" onClick={() => open('budget')}>
              Adicionar
              <Icon name="plus" size={14} />
            </button>
          }
        >
          <Budgets data={data} hidden={hidden} open={open} />
        </Panel>
        <Panel title="O que o Sherlock aprendeu" eyebrow="REGRAS DE CATEGORIZAÇÃO">
          {data.categoryRules.length ? (
            data.categoryRules.map((rule) => (
              <div className="simple-row" key={rule.id}>
                <span>
                  <strong>{rule.merchantPattern}</strong>
                  <small>{scopeName(rule.ownerScope)} · próximas importações</small>
                </span>
                <span className="subtle-chip">
                  {data.categories.find((c) => c.id === rule.categoryId)?.name}
                </span>
              </div>
            ))
          ) : (
            <Empty title="Seu jeito de organizar">
              Ao corrigir uma categoria, escolha ensinar a regra para as próximas importações.
            </Empty>
          )}
        </Panel>
      </div>
    </>
  );
}
function Couple({ data, hidden, open, setView }: SharedProps & { setView: (view: View) => void }) {
  const shared = data.transactions.filter(
    (t) => t.ownerScope === 'COUPLE' && t.status === 'PAID' && t.type === 'EXPENSE',
  );
  const casPaid = shared
      .filter((t) => t.paidByUserId === 'CAS')
      .reduce((s, t) => s + t.amountCents, 0),
    ketPaid = shared.filter((t) => t.paidByUserId === 'KET').reduce((s, t) => s + t.amountCents, 0);
  const debt = data.summary.coupleDebtCents;
  return (
    <>
      {data.view === 'INDIVIDUAL' && (
        <div className="review-notice">
          <Icon name="couple" />
          <div>
            <strong>Vocês têm um espaço em comum.</strong>
            <p>Selecione a visão Casal para acompanhar despesas compartilhadas.</p>
          </div>
          <button className="button secondary" onClick={() => setView('COUPLE')}>
            Ver nosso espaço
          </button>
        </div>
      )}
      <section className="couple-hero">
        <div>
          <span className="eyebrow">O QUE É NOSSO</span>
          <h2>
            Dividir as contas.
            <br />
            <em>Somar os planos.</em>
          </h2>
          <p>Um combinado claro deixa mais espaço para aproveitar a vida juntos.</p>
          <button className="button pale" onClick={() => open('transaction')}>
            <Icon name="plus" size={17} />
            Registrar despesa
          </button>
        </div>
        <div className="couple-initials" aria-hidden="true">
          <span>C</span>
          <span>K</span>
          <i>DOIS CAMINHOS, UM FUTURO.</i>
        </div>
      </section>
      <div className="three-grid">
        <section className="metric-tile">
          <span className="eyebrow">CASSIANO PAGOU</span>
          <Money value={casPaid} hidden={hidden} />
          <small>Despesas compartilhadas do período</small>
        </section>
        <section className="metric-tile">
          <span className="eyebrow">KETHELLEN PAGOU</span>
          <Money value={ketPaid} hidden={hidden} />
          <small>Despesas compartilhadas do período</small>
        </section>
        <section className="metric-tile settlement-tile">
          <span className="eyebrow">ACERTO DO MÊS</span>
          <Money value={Math.abs(debt)} hidden={hidden} />
          <small>
            {debt === 0
              ? 'Tudo certo entre vocês.'
              : debt > 0
                ? 'Kethellen acerta com Cassiano'
                : 'Cassiano acerta com Kethellen'}
          </small>
          {debt !== 0 && (
            <button className="text-button" onClick={() => open('settle')}>
              Registrar acerto
              <Icon name="arrow" size={14} />
            </button>
          )}
        </section>
      </div>
      <div className="detail-grid">
        <Panel title="O combinado, em cada conta" eyebrow="DESPESAS COMPARTILHADAS">
          {shared.length ? (
            shared.map((t) => (
              <div className="split-row" key={t.id}>
                <div>
                  <strong>{t.description}</strong>
                  <small>
                    {scopeName(t.paidByUserId)} pagou · {dateLabel(t.occurredAt)}
                  </small>
                </div>
                <div>
                  <small>CAS</small>
                  <Money value={t.coupleSplit?.casAmountCents ?? 0} hidden={hidden} />
                </div>
                <div>
                  <small>KET</small>
                  <Money value={t.coupleSplit?.ketAmountCents ?? 0} hidden={hidden} />
                </div>
              </div>
            ))
          ) : (
            <Empty title="Nosso primeiro combinado">
              Lance uma despesa com o escopo Casal para acompanhar o rateio.
            </Empty>
          )}
        </Panel>
        <Goals data={data} hidden={hidden} open={open} />
      </div>
      <Panel title="Acertos registrados" eyebrow="HISTÓRICO DO PERÍODO">
        {data.settlements.length ? (
          data.settlements.map((s) => (
            <div className="simple-row" key={s.id}>
              <span>
                <strong>
                  {scopeName(s.from)} para {scopeName(s.to)}
                </strong>
                <small>
                  {dateLabel(s.paidAt)} · registrado por {scopeName(s.createdBy)}
                </small>
              </span>
              <Money value={s.amountCents} hidden={hidden} />
            </div>
          ))
        ) : (
          <p className="muted padded">
            Nenhum acerto registrado neste período. A quitação no controle não movimenta dinheiro no
            banco.
          </p>
        )}
      </Panel>
    </>
  );
}
function Goals({ data, hidden, open }: SharedProps) {
  return (
    <Panel
      title="O futuro ganha forma"
      eyebrow="METAS & RESERVAS"
      action={
        <button className="icon-button" aria-label="Criar meta" onClick={() => open('goal')}>
          <Icon name="plus" size={18} />
        </button>
      }
    >
      {data.goals.length ? (
        <div className="goals-list">
          {data.goals.map((g) => (
            <div className="goal-item" key={g.id}>
              <div className="goal-heading">
                <span className="large-icon">
                  <Icon name="wealth" size={22} />
                </span>
                <div>
                  <h3>{g.name}</h3>
                  <small>
                    {scopeName(g.ownerScope)} · até {dateLabel(g.targetDate)} de{' '}
                    {g.targetDate.slice(0, 4)}
                  </small>
                </div>
              </div>
              <div className="goal-value">
                <Money value={g.savedCents} hidden={hidden} />
                <small>
                  de <Money value={g.targetCents} hidden={hidden} />
                </small>
              </div>
              <Progress value={g.savedCents} limit={g.targetCents} />
              <div className="goal-footer">
                <small>{Math.round((g.savedCents * 100) / g.targetCents)}% do caminho</small>
                {(g.ownerScope === data.user.slug || g.ownerScope === 'COUPLE') && (
                  <button className="text-button" onClick={() => open('contributeGoal', g.id)}>
                    Atualizar reserva
                    <Icon name="plus" size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="Qual é o próximo plano?"
          action={
            <button className="text-button" onClick={() => open('goal')}>
              Criar nossa meta
              <Icon name="plus" size={14} />
            </button>
          }
        >
          Uma viagem, uma conquista, uma reserva para respirar.
        </Empty>
      )}
      <p className="panel-footnote">Metas não são somadas novamente ao patrimônio.</p>
    </Panel>
  );
}
function Wealth({ data, hidden, open }: SharedProps) {
  const principal = data.investments.reduce((s, i) => s + i.principalCents, 0);
  return (
    <>
      <div className="three-grid">
        <section className="metric-tile">
          <span className="eyebrow">PATRIMÔNIO LÍQUIDO HOJE</span>
          <Money value={data.summary.netWorthCents} hidden={hidden} />
          <small>Contas + investimentos − saldo devedor dos cartões</small>
        </section>
        <section className="metric-tile">
          <span className="eyebrow">POSIÇÕES INFORMADAS</span>
          <Money value={data.summary.investmentCents} hidden={hidden} />
          <small>{data.investments.length} investimentos acompanhados</small>
        </section>
        <section className="metric-tile">
          <span className="eyebrow">VARIAÇÃO SOBRE O APLICADO</span>
          <Money
            value={data.summary.investmentCents - principal}
            hidden={hidden}
            className="positive"
          />
          <small>Diferença das posições informadas, sem previsão</small>
        </section>
      </div>
      <Panel
        title="Cada plano, um horizonte"
        eyebrow="MINHA CARTEIRA"
        action={
          <button className="button secondary" onClick={() => open('investment')}>
            <Icon name="plus" size={16} />
            Adicionar ativo
          </button>
        }
      >
        {data.investments.length ? (
          <div className="investment-table">
            {data.investments.map((i) => (
              <div className="investment-row" key={i.id}>
                <span className="category-code">INV</span>
                <div>
                  <strong>{i.name}</strong>
                  <small>
                    {scopeName(i.ownerScope)} · {i.type.replaceAll('_', ' ')} · posição de{' '}
                    {dateLabel(i.valuationDate)}
                  </small>
                </div>
                <div className="investment-rate">
                  {i.cdiPercentageBps > 0
                    ? `${(i.cdiPercentageBps / 100).toLocaleString('pt-BR')}% do CDI`
                    : 'Posição informada'}
                  <small>
                    {i.hasFgcProtection
                      ? 'FGC informado para o instrumento'
                      : 'Sem indicação de FGC'}
                  </small>
                </div>
                <Money value={i.currentBalanceCents} hidden={hidden} />
                {(i.ownerScope === data.user.slug || i.ownerScope === 'COUPLE') && (
                  <button
                    className="icon-button"
                    title="Atualizar posição"
                    aria-label={`Atualizar ${i.name}`}
                    onClick={() => open('valueInvestment', i.id)}
                  >
                    <Icon name="refresh" size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="Acompanhe o que você está construindo"
            action={
              <button className="text-button" onClick={() => open('investment')}>
                Adicionar investimento
              </button>
            }
          >
            Cadastre uma posição com os valores do seu extrato.
          </Empty>
        )}
        <p className="panel-footnote">
          Saldos informados por você. Taxa contratada não é rendimento garantido; confira o extrato,
          a tributação e a elegibilidade ao FGC com sua instituição.
        </p>
      </Panel>
      <CdiSimulation hidden={hidden} />
      <div className="detail-grid">
        <Goals data={data} hidden={hidden} open={open} />
        <Panel title="Mais constância, menos pressa" eyebrow="UMA VISÃO DE LONGO PRAZO">
          <div className="wealth-editorial">
            <Icon name="wealth" size={52} />
            <h3>
              Seu futuro começa
              <br />
              nas escolhas de hoje.
            </h3>
            <p>
              Atualize as posições com os valores do extrato. Assim, você acompanha seu patrimônio
              com clareza, sem confundir expectativa com dinheiro disponível.
            </p>
            <span className="subtle-chip">SEM RECOMENDAÇÕES AUTOMÁTICAS DE COMPRA</span>
          </div>
        </Panel>
      </div>
    </>
  );
}
function Cards({ data, hidden, open }: SharedProps) {
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Seus cartões, em perspectiva.</h2>
          <p>Limites, faturas e retorno estimado. Tudo à vista.</p>
        </div>
        <button className="button secondary" onClick={() => open('card')}>
          <Icon name="plus" size={16} />
          Adicionar cartão
        </button>
      </div>
      {data.cards.length ? (
        <div className="cards-grid">
          {data.cards.map((card, i) => (
            <section className="card-detail" key={card.id}>
              <div className={`bank-card ${i % 2 ? 'bank-card-stone' : ''}`}>
                <div>
                  <span>ENTRE CONTAS</span>
                  <Icon name="cards" size={23} />
                </div>
                <span className="bank-card-name">{card.name}</span>
                <div className="bank-card-bottom">
                  <span>•••• &nbsp; •••• &nbsp; •••• &nbsp; {card.last4}</span>
                  <span>{scopeName(card.ownerScope).toUpperCase()}</span>
                </div>
              </div>
              <div className="card-detail-body">
                <div className="card-invoice">
                  <div>
                    <span className="eyebrow">FATURA · {data.month}</span>
                    <Money value={card.invoiceCents} hidden={hidden} />
                  </div>
                  <span className="subtle-chip">Vence dia {card.dueDay}</span>
                </div>
                <Progress value={card.usedCents} limit={card.limitCents} warn />
                <div className="card-limits">
                  <span>
                    Utilizado
                    <Money value={card.usedCents} hidden={hidden} />
                  </span>
                  <span>
                    Disponível
                    <Money value={card.availableCents} hidden={hidden} />
                  </span>
                </div>
                <div className="cashback-line">
                  <span>
                    <Icon name="refresh" size={17} />
                    Cashback estimado · {(card.cashbackBps / 100).toLocaleString('pt-BR')}%
                  </span>
                  <Money value={card.cashbackCents} hidden={hidden} className="positive" />
                </div>
                <div className="card-payment">
                  <small>
                    Fecha dia {card.closingDay} · Limite{' '}
                    <Money value={card.limitCents} hidden={hidden} />
                  </small>
                  {(card.ownerScope === data.user.slug || card.ownerScope === 'COUPLE') && (
                    <button
                      className="button secondary"
                      disabled={card.invoiceCents <= 0}
                      onClick={() => open('payInvoice', card.id)}
                    >
                      {card.invoiceCents <= 0 ? 'Sem saldo a quitar' : 'Registrar pagamento'}
                    </button>
                  )}
                </div>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Panel title="Um cartão, todos os detalhes">
          <Empty
            title="Comece pelo seu cartão principal"
            action={
              <button className="button" onClick={() => open('card')}>
                Cadastrar cartão
              </button>
            }
          >
            Não precisamos do número completo, CVV ou senha.
          </Empty>
        </Panel>
      )}
      <div className="info-strip">
        <Icon name="shield" size={19} />
        <p>
          Cashback é uma estimativa baseada na taxa configurada. O crédito real depende das regras
          do emissor e não é somado ao seu saldo antes de ser recebido.
        </p>
      </div>
      <Upcoming data={data} hidden={hidden} open={open} />
    </>
  );
}
function Settings({
  data,
  hidden,
  open,
  sync,
  busy,
  onDisconnect,
}: SharedProps & {
  sync: (provider: 'MOCK' | 'PLUGGY') => Promise<void>;
  busy: boolean;
  onDisconnect: () => Promise<void>;
}) {
  return (
    <>
      <Panel
        title="Suas contas"
        eyebrow="ONDE SEU DINHEIRO ESTÁ"
        action={
          <button className="button secondary" onClick={() => open('account')}>
            <Icon name="plus" size={16} />
            Adicionar conta
          </button>
        }
      >
        {data.accounts.length ? (
          data.accounts.map((a) => (
            <div className="account-row" key={a.id}>
              <span className="large-icon">
                <Icon name="bank" size={23} />
              </span>
              <div>
                <strong>{a.name}</strong>
                <small>
                  {a.institution} · {scopeName(a.ownerScope)}
                </small>
                {a.bankBalanceCents !== undefined && (
                  <small>
                    Informado pelo banco: <Money value={a.bankBalanceCents} hidden={hidden} /> ·
                    referência, antes da conciliação
                  </small>
                )}
              </div>
              <Money value={a.currentBalanceCents} hidden={hidden} />
              {(a.ownerScope === data.user.slug || a.ownerScope === 'COUPLE') && (
                <button
                  className="icon-button"
                  aria-label={`Editar conta ${a.name}`}
                  onClick={() => open('account', a.id)}
                >
                  <Icon name="settings" size={16} />
                </button>
              )}
            </div>
          ))
        ) : (
          <Empty
            title="Seu ponto de partida"
            action={
              <button className="text-button" onClick={() => open('account')}>
                Cadastrar conta
              </button>
            }
          >
            Adicione uma conta com o saldo anterior aos primeiros lançamentos.
          </Empty>
        )}
      </Panel>
      <div className="detail-grid">
        <Panel
          title="Conexão bancária"
          eyebrow="MEU PLUGGY"
          action={
            <span
              className={`connection-status ${data.bankConnections.configured ? 'connected' : ''}`}
            >
              <i />
              {data.bankConnections.configured ? 'Configurado' : 'Não configurado'}
            </span>
          }
        >
          <div className="connection-body">
            <span className="large-icon">
              <Icon name="bank" size={30} />
            </span>
            <h3>Seus dados, sob seu controle.</h3>
            <p>
              Conecte as suas contas no Meu Pluggy e informe suas credenciais pessoais. As consultas
              usam os dados disponibilizados pelo serviço, com atualização diária.
            </p>
            {data.bankConnections.configured && (
              <p className="muted">
                {data.bankConnections.itemCount} conexões configuradas.{' '}
                {data.bankConnections.lastSyncAt
                  ? `Última consulta: ${new Date(data.bankConnections.lastSyncAt).toLocaleString('pt-BR')}.`
                  : 'Nenhuma consulta realizada ainda.'}
              </p>
            )}
            <div className="button-group">
              <button
                className="button"
                onClick={() =>
                  data.bankConnections.configured ? void sync('PLUGGY') : open('bank')
                }
                disabled={busy}
              >
                {data.bankConnections.configured ? 'Consultar meus dados' : 'Configurar conexão'}
                <Icon name="arrow" size={16} />
              </button>
              {data.bankConnections.configured && (
                <button className="text-button" onClick={() => void onDisconnect()} disabled={busy}>
                  Desconectar
                </button>
              )}
            </div>
            {data.demoEnabled && (
              <div className="mock-sync">
                <small>Teste o fluxo sem conectar um banco real.</small>
                <button className="text-button" disabled={busy} onClick={() => void sync('MOCK')}>
                  <Icon name="refresh" size={15} />
                  Importar movimentos simulados
                </button>
              </div>
            )}
          </div>
        </Panel>
        <Panel title="Um espaço reservado" eyebrow="SEU ACESSO">
          <div className="security-row">
            <Icon name="shield" size={22} />
            <div>
              <strong>{data.user.name}</strong>
              <p>{data.user.email}</p>
              <small>Senha protegida com Argon2id. A sessão é validada no servidor.</small>
            </div>
          </div>
          <div className="security-row">
            <Icon name="couple" size={22} />
            <div>
              <strong>Somente Cassiano e Kethellen</strong>
              <p>Individual, Casal e Consolidado.</p>
              <small>
                As chaves bancárias de cada perfil ficam criptografadas e não são exibidas nas
                consultas.
              </small>
            </div>
          </div>
          <div className="security-row">
            <Icon name="ledger" size={22} />
            <div>
              <strong>Rastro de cuidado</strong>
              <p>Ações sensíveis registradas sem valores financeiros nem tokens.</p>
              <small>
                {data.mode === 'local'
                  ? 'Ambiente local de testes. Não substitui a versão hospedada.'
                  : 'Backend hospedado no Convex.'}
              </small>
            </div>
          </div>
        </Panel>
      </div>
      <Panel title="Atividade da conta" eyebrow="AUDITORIA SANITIZADA">
        {data.auditLogs.length ? (
          data.auditLogs.slice(0, 15).map((log) => (
            <div className="audit-row" key={log.id}>
              <span className="owner-tag">{log.actorSlug}</span>
              <span>
                {(
                  {
                    'session.start': 'Acesso iniciado',
                    'session.end': 'Sessão encerrada',
                    'import.staged': 'Extrato enviado para revisão',
                    createTransaction: 'Lançamento criado',
                    review: 'Lançamento revisado',
                    settle: 'Acerto registrado',
                    createAccount: 'Conta cadastrada',
                    createCard: 'Cartão cadastrado',
                    saveBudget: 'Orçamento atualizado',
                    'bank.configure': 'Conexão bancária configurada',
                    'bank.disconnect': 'Conexão removida',
                  } as Record<string, string>
                )[log.action] ?? 'Registro financeiro atualizado'}
              </span>
              <small>{new Date(log.createdAt).toLocaleString('pt-BR')}</small>
            </div>
          ))
        ) : (
          <p className="padded muted">A atividade aparece depois das primeiras ações.</p>
        )}
      </Panel>
    </>
  );
}

function CdiSimulation({ hidden }: { hidden: boolean }) {
  const [result, setResult] = useState<{
      principal: number;
      projected: number;
    } | null>(null),
    [error, setError] = useState('');
  function calculate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const values = new FormData(event.currentTarget);
    try {
      const principal = parseMoney(String(values.get('principal')));
      const projected = projectCdi(
        principal,
        parseMoney(String(values.get('annual'))),
        parseMoney(String(values.get('participation'))),
        Number(values.get('days')),
      );
      setResult({ principal, projected });
    } catch {
      setResult(null);
      setError(
        'Confira os valores: CDI anual entre 0% e 100%, participação até 500% e prazo inteiro de até 2.520 dias úteis.',
      );
    }
  }
  return (
    <Panel title="Um cenário para seus planos" eyebrow="SIMULAÇÃO EM CENTAVOS">
      <form className="simulation-form" onSubmit={calculate}>
        <label className="field">
          <span>Valor aplicado (R$)</span>
          <input name="principal" inputMode="decimal" placeholder="1.000,00" required />
        </label>
        <label className="field">
          <span>CDI anual informado (%)</span>
          <input name="annual" inputMode="decimal" placeholder="Informe a taxa" required />
        </label>
        <label className="field">
          <span>Participação (% do CDI)</span>
          <input name="participation" inputMode="decimal" defaultValue="100" required />
        </label>
        <label className="field">
          <span>Prazo (dias úteis)</span>
          <input name="days" type="number" min="0" max="2520" defaultValue="252" required />
        </label>
        <button className="button secondary">Simular cenário</button>
      </form>
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div className="simulation-result">
          <div>
            <small>Saldo bruto projetado</small>
            <Money value={result.projected} hidden={hidden} />
          </div>
          <div>
            <small>Rendimento bruto estimado</small>
            <Money
              value={result.projected - result.principal}
              hidden={hidden}
              className="positive"
            />
          </div>
        </div>
      )}
      <p className="panel-footnote">
        Taxa fornecida por você, mantida constante no cenário. Capitalização diária em 252 dias
        úteis/ano. Sem IR, IOF, custos ou garantia de retorno. Não altera seu patrimônio registrado.
      </p>
    </Panel>
  );
}
