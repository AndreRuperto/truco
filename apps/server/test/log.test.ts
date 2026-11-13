import { describe, expect, test } from 'vitest';
import { criarLog, linhaDeLog } from '../src/log';

/** F5.3 do plano MVP: log em JSON de uma linha, sem dado sensível. */
const AGORA = new Date('2026-11-13T12:00:00Z');

describe('log estruturado', () => {
  test('uma linha de JSON com nível, evento, ts e os campos', () => {
    const l = linhaDeLog('info', 'servidor_ouvindo', { porta: 2567 }, AGORA);
    expect(l).not.toContain('\n');
    expect(JSON.parse(l)).toEqual({ nivel: 'info', evento: 'servidor_ouvindo', ts: '2026-11-13T12:00:00.000Z', porta: 2567 });
  });

  test('mascara token, e-mail, cookie, authorization e apiKey, em qualquer profundidade e com qualquer caixa', () => {
    const l = JSON.parse(
      linhaDeLog(
        'aviso',
        'teste',
        {
          token: 'abc',
          email: 'ana@x.com',
          Cookie: 'truco_sessao=xyz',
          headers: { Authorization: 'Bearer zzz', 'x-ok': 1 },
          resend: { apiKey: 're_123' },
          tokenReconexao: 't',
          lista: [{ emailDoUsuario: 'b@x.com' }],
          apelido: 'ana',
        },
        AGORA,
      ),
    );
    const texto = JSON.stringify(l);
    for (const segredo of ['abc', 'ana@x.com', 'xyz', 'zzz', 're_123', 'b@x.com']) expect(texto).not.toContain(segredo);
    expect(l.apelido).toBe('ana');
    expect(l.headers['x-ok']).toBe(1);
    expect(l.token).toBe('[oculto]');
  });

  test('erro vira mensagem, nome e pilha curta (não um objeto vazio)', () => {
    const e = new TypeError('quebrou');
    const l = JSON.parse(linhaDeLog('erro', 'falha', { erro: e }, AGORA));
    expect(l.erro.mensagem).toBe('quebrou');
    expect(l.erro.nome).toBe('TypeError');
    expect(l.erro.pilha.length).toBeLessThanOrEqual(2_000);
  });

  test('criarLog: info/aviso no fluxo normal e erro no de erro; aceita um erro solto', () => {
    const saida: string[] = [];
    const erros: string[] = [];
    const log = criarLog({ saida: (s) => saida.push(s), erro: (s) => erros.push(s), agora: () => AGORA });
    log.info('a', { x: 1 });
    log.aviso('b');
    log.erro('c', new Error('ruim'));
    expect(saida.map((s) => JSON.parse(s).evento)).toEqual(['a', 'b']);
    expect(JSON.parse(erros[0])).toMatchObject({ nivel: 'erro', evento: 'c', erro: { mensagem: 'ruim' } });
  });

  test('não quebra com referência circular', () => {
    const a: Record<string, unknown> = { nome: 'a' };
    a.eu = a;
    expect(() => JSON.parse(linhaDeLog('info', 'circ', { a }, AGORA))).not.toThrow();
  });
});
