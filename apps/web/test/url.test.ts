import { describe, expect, test } from 'vitest';
import { urlServidor } from '../src/rede/url';

const local = (protocol: string, hostname: string, port = '') => ({ protocol, hostname, host: port ? `${hostname}:${port}` : hostname });

describe('urlServidor', () => {
  test('VITE_SERVIDOR manda', () => {
    expect(urlServidor({ configurada: 'ws://127.0.0.1:2568', dev: true, local: local('http:', 'localhost', '5173') })).toBe('ws://127.0.0.1:2568');
  });

  test('em dev: mesmo host, porta 2567', () => {
    expect(urlServidor({ dev: true, local: local('http:', '192.168.0.10', '5173') })).toBe('ws://192.168.0.10:2567');
  });

  test('em produção: mesma origem, wss se https', () => {
    expect(urlServidor({ dev: false, local: local('https:', 'truco.exemplo.com') })).toBe('wss://truco.exemplo.com');
    expect(urlServidor({ dev: false, local: local('http:', 'localhost', '8080') })).toBe('ws://localhost:8080');
  });
});
