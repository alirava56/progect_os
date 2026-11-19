#!/usr/bin/env node
/** Test-only production build, using one process and an OS-assigned port. */
import { createServer } from 'node:http';
import { createServer as createSecureServer } from 'node:https';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import next from 'next';

if (!process.send || !process.env.PROJECTOS_DB_PATH) {
  throw new Error('Run this entry point through the isolated Playwright fixture');
}
process.once('disconnect', () => process.exit(0));

const hostname = '127.0.0.1';
const key = process.env.PROJECTOS_TEST_TLS_KEY;
const cert = process.env.PROJECTOS_TEST_TLS_CERT;
if (Boolean(key) !== Boolean(cert)) throw new Error('Provide both test TLS files');
const server = key && cert ? createSecureServer({key:readFileSync(key),cert:readFileSync(cert)}) : createServer();
server.listen(0, hostname);
await once(server, 'listening');
const { port } = server.address();
const url = `${key ? 'https' : 'http'}://${hostname}:${port}`;
process.env.PROJECTOS_PUBLIC_ORIGIN = url;
const app = next({ dev: false, hostname, port });
await app.prepare();
server.on('request', app.getRequestHandler());
process.send({ url });
