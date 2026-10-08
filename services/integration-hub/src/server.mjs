import { createServer } from 'node:http';
import { handleRequest } from './app.mjs';

const port = Number(process.env.PORT ?? 8080);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error('PORT must be a valid TCP port');
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://integration-hub.local');
  const routed = await handleRequest({ method: request.method, path: url.pathname });

  response.writeHead(routed.status, routed.headers);
  response.end(routed.body);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[integration-hub] listening on port ${port}`);
});
