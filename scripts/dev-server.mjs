import { createServer } from 'node:http';
import { resolve } from 'node:path';
import next from 'next';
const port = Number(process.env.PORT || 3000);
const app = next({
  dev: true,
  dir: resolve(import.meta.dirname, '../apps/web'),
  hostname: '0.0.0.0',
  port,
  webpack: true,
});
await app.prepare();
const handler = app.getRequestHandler();
const server = createServer((request, response) => handler(request, response));
server.listen(port, '0.0.0.0', () => console.log(`Entre Contas: http://localhost:${port}`));
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () =>
    server.close(() => {
      void app.close().then(() => process.exit(0));
    }),
  );
