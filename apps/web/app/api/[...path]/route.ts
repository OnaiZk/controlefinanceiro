import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  auditExport,
  authenticate,
  configureBank,
  COOKIE,
  disconnectBank,
  getSnapshot,
  HttpError,
  importFile,
  login,
  logout,
  mutate,
  syncBank,
} from '../../../../api/src/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 8 * 60 * 60,
});
function token(request: NextRequest) {
  const bearer = request.headers.get('authorization');
  return bearer?.startsWith('Bearer ') ? bearer.slice(7) : request.cookies.get(COOKIE)?.value;
}
async function body(request: NextRequest): Promise<unknown> {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new HttpError(415, 'Envie dados em JSON.');
  if (!request.body) throw new HttpError(400, 'Corpo da solicitação ausente.');
  const reader = request.body.getReader();
  let bytes = 0,
    text = '';
  const decoder = new TextDecoder();
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > 2_500_000) {
      await reader.cancel();
      throw new HttpError(413, 'Arquivo ou solicitação maior que o limite.');
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  try {
    return JSON.parse(text + decoder.decode()) as unknown;
  } catch {
    throw new HttpError(400, 'Solicitação JSON inválida.');
  }
}
function checkOrigin(request: NextRequest) {
  if (request.headers.get('authorization')?.startsWith('Bearer ')) return;
  const origin = request.headers.get('origin');
  const expected = process.env.APP_ORIGIN ?? request.nextUrl.origin;
  const allowed = new Set([expected]);
  if (process.env.NODE_ENV !== 'production')
    for (const value of (process.env.DEV_ALLOWED_ORIGINS ?? '').split(','))
      if (value.trim()) allowed.add(value.trim());
  if (!origin || !allowed.has(origin))
    throw new HttpError(403, 'Origem da solicitação não autorizada.');
  if (request.headers.get('sec-fetch-site') === 'cross-site')
    throw new HttpError(403, 'Solicitação externa bloqueada.');
}
function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store, private', Pragma: 'no-cache' },
  });
}
async function handle(request: NextRequest, params: Promise<{ path: string[] }>) {
  const path = (await params).path.join('/');
  try {
    if (request.method === 'GET') {
      if (path === 'health')
        return json({
          ok: true,
          configured: Boolean(process.env.JWT_SECRET),
          database: process.env.DATABASE_MODE ?? 'unconfigured',
        });
      if (path === 'me') {
        const auth = await authenticate(token(request));
        const user = auth.state.users.find((u) => u.slug === auth.actor)!;
        return json({ user: { id: user.id, slug: user.slug, name: user.name, email: user.email } });
      }
      if (path === 'snapshot')
        return json(
          await getSnapshot(
            token(request),
            request.nextUrl.searchParams.get('view') ?? 'INDIVIDUAL',
            request.nextUrl.searchParams.get('month') ?? undefined,
          ),
        );
      throw new HttpError(404, 'Recurso não encontrado.');
    }
    checkOrigin(request);
    if (path === 'auth/login') {
      const result = await login(await body(request));
      const response = json({
        user: result.user,
        ...(request.headers.get('x-client') === 'expo' ? { token: result.token } : {}),
      });
      response.cookies.set(COOKIE, result.token, cookieOptions());
      return response;
    }
    if (path === 'auth/logout') {
      await logout(token(request));
      const response = json({ ok: true });
      response.cookies.set(COOKIE, '', { ...cookieOptions(), maxAge: 0 });
      return response;
    }
    if (path === 'command') return json(await mutate(token(request), await body(request)));
    if (path === 'import') return json(await importFile(token(request), await body(request)));
    if (path === 'bank/configure')
      return json(await configureBank(token(request), await body(request)));
    if (path === 'bank/disconnect') return json(await disconnectBank(token(request)));
    if (path === 'bank/sync') return json(await syncBank(token(request), await body(request)));
    if (path === 'audit/export') return json(await auditExport(token(request)));
    throw new HttpError(404, 'Recurso não encontrado.');
  } catch (error) {
    if (error instanceof z.ZodError)
      return json(
        {
          error: error.issues
            .map((issue) => `${issue.path.join('.') || 'Dados'}: ${issue.message}`)
            .slice(0, 5)
            .join(' '),
        },
        400,
      );
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    const message = error instanceof Error ? error.message : '';
    if (/configur|Configure|Produção exige|Execute a configuração|abrir os dados/i.test(message))
      return json({ error: message }, 503);
    // Business failures are safe, predefined messages. Provider stack traces and raw values are never logged.
    const safe =
      !/https?:|\n|\[Request ID|ConvexError|ECONN/i.test(message) && message.length < 240;
    return json(
      {
        error:
          safe && message
            ? message
            : 'Não foi possível concluir. Verifique a conexão do backend e tente novamente.',
      },
      400,
    );
  }
}
export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handle(request, context.params);
}
export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handle(request, context.params);
}
