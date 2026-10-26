'use client';
import type { CSSProperties, ReactNode } from 'react';
import { brl, type Snapshot } from '../../../packages/shared/src/index';
export type IconName =
  | 'overview'
  | 'couple'
  | 'wealth'
  | 'cards'
  | 'ledger'
  | 'plus'
  | 'arrow'
  | 'eye'
  | 'hidden'
  | 'sun'
  | 'moon'
  | 'logout'
  | 'download'
  | 'upload'
  | 'settings'
  | 'close'
  | 'check'
  | 'reject'
  | 'chevron'
  | 'shield'
  | 'search'
  | 'calendar'
  | 'refresh'
  | 'bank';
const paths: Record<IconName, ReactNode> = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  couple: (
    <>
      <circle cx="8" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M2 21v-3a6 6 0 0 1 12 0v3M16 15a5 5 0 0 1 6 5" />
    </>
  ),
  wealth: (
    <>
      <path d="M3 20h18M5 16l5-6 4 3 6-9M15 4h5v5" />
      <path d="M6 20v-2M12 20v-3M18 20v-6" />
    </>
  ),
  cards: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M3 10h18M6 15h4" />
    </>
  ),
  ledger: (
    <>
      <rect x="5" y="3" width="15" height="18" rx="1.5" />
      <path d="M2 7h6M2 12h6M2 17h6M12 8h4M12 12h4M12 16h3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 19 19 5M5 5h14v14" />,
  eye: (
    <>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  hidden: (
    <>
      <path d="m3 3 18 18M10 5a13 13 0 0 1 12 7 16 16 0 0 1-3 4M6 6a15 15 0 0 0-4 6s3 7 10 7a12 12 0 0 0 5-1" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2" />
    </>
  ),
  moon: <path d="M20 14A8 8 0 0 1 10 4a8.5 8.5 0 1 0 10 10Z" />,
  logout: (
    <>
      <path d="M10 4H4v16h6M8 12h13m-5-5 5 5-5 5" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V3m-5 5 5-5 5 5M4 17v4h16v-4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="m10 2-1 3-3 1-3-1-2 4 3 2v3l-2 2 3 4 3-1 3 1 1 3h4l1-3 3-1 2-4-2-3 1-3-3-3-3 1-2-2Z" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  check: <path d="m5 12 5 5L20 7" />,
  reject: <path d="m6 6 12 12M6 18 18 6" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  shield: (
    <>
      <path d="m12 2 8 3v6c0 5-8 11-8 11S4 16 4 11V5Z" />
      <path d="m8 11 3 3 5-5" />
    </>
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="6" />
      <path d="m15 15 6 6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 2v6M17 2v6M3 11h18M7 15h3M14 15h3" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7a8 8 0 0 0-14-2L3 8m0-5v5h5M4 17a8 8 0 0 0 14 2l3-3m0 5v-5h-5" />
    </>
  ),
  bank: (
    <>
      <path d="m2 8 10-5 10 5H2Zm3 3v7m7-7v7m7-7v7M2 21h20" />
    </>
  ),
};
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
export function Money({
  value,
  hidden = false,
  className = '',
}: {
  value: number;
  hidden?: boolean;
  className?: string;
}) {
  return (
    <span className={`money ${className}`} aria-label={hidden ? 'Valor oculto' : undefined}>
      {hidden ? 'R$ •••••' : brl(value)}
    </span>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-mark">
        <Icon name="ledger" size={26} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Panel({
  title,
  eyebrow,
  children,
  action,
  className = '',
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
const colors = [
  '#315d49',
  '#a8b99c',
  '#c6a580',
  '#7a8c88',
  '#9c7070',
  '#c4bfac',
  '#8b9275',
  '#b4a5bf',
];
export function Donut({ data, hidden }: { data: Snapshot; hidden: boolean }) {
  const total = data.distribution.reduce((sum, item) => sum + item.amountCents, 0);
  let offset = 0;
  return total ? (
    <div className="donut-layout">
      <div className="donut">
        <svg viewBox="0 0 200 200" role="img" aria-label="Distribuição dos gastos por categoria">
          <circle cx="100" cy="100" r="78" stroke="var(--line)" fill="none" strokeWidth="20" />
          {data.distribution.map((item, i) => {
            const size = (item.amountCents / total) * 490.09;
            const start = offset;
            offset += size;
            return (
              <circle
                key={item.categoryId}
                cx="100"
                cy="100"
                r="78"
                fill="none"
                stroke={colors[i % colors.length]}
                strokeWidth="20"
                strokeDasharray={`${Math.max(0, size - 3)} ${490.09 - Math.max(0, size - 3)}`}
                strokeDashoffset={-start}
                transform="rotate(-90 100 100)"
              >
                <title>
                  {(data.categories.find((c) => c.id === item.categoryId)?.name ?? 'Categoria') +
                    ': ' +
                    (hidden ? 'valor oculto' : brl(item.amountCents))}
                </title>
              </circle>
            );
          })}
        </svg>
        <div className="donut-center">
          <small>Total de saídas</small>
          <Money value={total} hidden={hidden} />
          <span>no período</span>
        </div>
      </div>
      <div className="legend">
        {data.distribution.map((item, i) => (
          <div className="legend-row" key={item.categoryId}>
            <span className="legend-dot" style={{ background: colors[i % colors.length] }} />
            <span>{data.categories.find((c) => c.id === item.categoryId)?.name}</span>
            <strong>{Math.round((item.amountCents * 100) / total)}%</strong>
          </div>
        ))}
      </div>
    </div>
  ) : (
    <Empty title="Um novo começo">
      As categorias aparecem depois do primeiro gasto confirmado.
    </Empty>
  );
}
export function Trend({
  data,
  hidden,
  onMonth,
}: {
  data: Snapshot;
  hidden: boolean;
  onMonth: (month: string) => void;
}) {
  const max = Math.max(...data.trend.map((t) => t.expenseCents), 10000);
  const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const coordinates = data.trend.map((t, i) => ({
    x: 28 + i * 44,
    y: 144 - (t.expenseCents / max) * 112,
  }));
  const curve = coordinates.reduce((path, point, i) => {
    if (i === 0) return `M ${point.x} ${point.y}`;
    const previous = coordinates[i - 1],
      middle = (previous.x + point.x) / 2;
    return path + ` C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`;
  }, '');
  const current = Number(data.month.slice(5, 7)) - 1;
  return (
    <div className="trend">
      <div className="chart-caption">
        <span>
          <i style={{ background: '#315d49' }} />
          Saídas confirmadas
        </span>
        <span className="muted">{data.month.slice(0, 4)}</span>
      </div>
      <svg viewBox="0 0 540 185" role="img" aria-label="Evolução mensal de despesas">
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#86a48a" stopOpacity=".27" />
            <stop offset="100%" stopColor="#86a48a" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[32, 70, 108, 144].map((y) => (
          <line key={y} x1="25" x2="520" y1={y} y2={y} stroke="var(--line)" strokeDasharray="3 5" />
        ))}
        <path d={`${curve} L 512 145 L 28 145 Z`} fill="url(#chart-fill)" />
        <path d={curve} fill="none" stroke="#4e876c" strokeWidth="2.5" strokeLinejoin="round" />
        {data.trend.map((t, i) => (
          <g
            key={t.month}
            className="chart-point"
            tabIndex={0}
            role="button"
            aria-label={`Selecionar ${t.month}`}
            onClick={() => onMonth(t.month)}
            onKeyDown={(e) => e.key === 'Enter' && onMonth(t.month)}
          >
            <rect x={i * 44 + 12} y="18" width="32" height="145" fill="transparent" />
            <circle
              cx={28 + i * 44}
              cy={144 - (t.expenseCents / max) * 112}
              r={i === current ? 5 : 3}
              fill={i === current ? '#1e4d3b' : 'var(--panel)'}
              stroke="#4e876c"
              strokeWidth="2"
            />
            <text
              x={28 + i * 44}
              y="177"
              textAnchor="middle"
              fill={i === current ? 'var(--text)' : 'var(--muted)'}
              fontSize="11"
              fontWeight={i === current ? 700 : 400}
            >
              {months[i]}
            </text>
            <title>{t.month + ': ' + (hidden ? 'valor oculto' : brl(t.expenseCents))}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}
export function Progress({
  value,
  limit,
  warn = false,
}: {
  value: number;
  limit: number;
  warn?: boolean;
}) {
  return (
    <div
      className={`progress ${warn && value >= limit ? 'danger' : ''}`}
      role="progressbar"
      aria-valuenow={Math.min(100, Math.max(0, Math.round((value * 100) / Math.max(1, limit))))}
      aria-valuemin={0}
      aria-valuemax={100}
      style={
        {
          '--progress': `${Math.min(100, Math.max(0, (value * 100) / Math.max(1, limit)))}%`,
        } as CSSProperties
      }
    >
      <span />
    </div>
  );
}
