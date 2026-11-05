import { EventEmitter } from 'node:events';
import { type SalaLike, TIPOS_MENSAGEM } from '../src/rede/loja';

/** Sala Colyseus de mentira: registra o que foi enviado e deixa o teste emitir mensagens. */
export class SalaFalsa extends EventEmitter implements SalaLike {
  roomId = 'r1';
  reconnectionToken = 'r1:t1';
  enviados: [string, unknown][] = [];
  /** Quantos handlers de cada tipo existiam no momento de cada `send`. */
  ouvintesNoEnvio: Record<string, number>[] = [];

  onMessage(tipo: string, cb: (payload: any) => void) {
    this.on(`msg:${tipo}`, cb);
    return () => this.off(`msg:${tipo}`, cb);
  }
  onLeave(cb: (code: number) => void) {
    this.on('leave', cb);
  }
  onDrop(cb: (code: number) => void) {
    this.on('drop', cb);
  }
  onReconnect(cb: () => void) {
    this.on('reconnect', cb);
  }
  send(tipo: string, payload?: unknown) {
    this.ouvintesNoEnvio.push(Object.fromEntries(TIPOS_MENSAGEM.map((t) => [t, this.listenerCount(`msg:${t}`)])));
    this.enviados.push([tipo, payload]);
  }
  async leave() {
    this.emit('leave', 4000);
    return 4000;
  }
  receber(tipo: string, payload: unknown) {
    this.emit(`msg:${tipo}`, payload);
  }
}
