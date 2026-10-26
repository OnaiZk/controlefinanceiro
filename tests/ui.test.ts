import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Donut, Money, Progress, Trend } from '../apps/web/components/ui';
import { seedState, snapshot } from '../packages/shared/src/engine';
const state = seedState(
  [
    { id: 'CAS', slug: 'CAS', name: 'Cassiano', email: 'cas@example.com', passwordHash: 'fixture' },
    {
      id: 'KET',
      slug: 'KET',
      name: 'Kethellen',
      email: 'ket@example.com',
      passwordHash: 'fixture',
    },
  ],
  Date.parse('2026-10-25T15:00:00Z'),
  true,
);
const data = snapshot(
  state,
  'CAS',
  'INDIVIDUAL',
  '2026-10',
  'local',
  Date.parse('2026-10-25T15:00:00Z'),
);
describe('renderização de componentes e privacidade visual', () => {
  it('ocultar valores remove o valor monetário do texto renderizado', () => {
    const html = renderToStaticMarkup(createElement(Money, { value: 123456, hidden: true }));
    expect(html).not.toContain('1.234,56');
    expect(html).toContain('Valor oculto');
  });
  it('rosca vazia apresenta estado útil e rosca com dados tem legenda acessível', () => {
    const empty = renderToStaticMarkup(
      createElement(Donut, { data: { ...data, distribution: [] }, hidden: false }),
    );
    expect(empty).toContain('primeiro gasto');
    const html = renderToStaticMarkup(createElement(Donut, { data, hidden: true }));
    expect(html).toContain('Distribuição dos gastos');
    expect(html).toContain('valor oculto');
  });
  it('barra de orçamento limita o progresso visual a 100%', () => {
    const html = renderToStaticMarkup(
      createElement(Progress, { value: 12000, limit: 10000, warn: true }),
    );
    expect(html).toContain('aria-valuenow="100"');
    expect(html).toContain('danger');
  });
  it('evolução anual possui seleção acessível e tooltip sem revelar moeda quando oculta', () => {
    const html = renderToStaticMarkup(
      createElement(Trend, { data, hidden: true, onMonth: () => {} }),
    );
    expect(html).toContain('Selecionar 2026-10');
    expect(html).toContain('valor oculto');
    expect(html).not.toContain('R$');
  });
});
