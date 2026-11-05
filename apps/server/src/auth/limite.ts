/** Janela deslizante em memória (um processo). Suficiente para o pedido de link. */
export class LimiteTaxa {
  private readonly batidas = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly janelaMs: number,
    private readonly agora: () => number = Date.now,
  ) {}

  permitir(chave: string): boolean {
    const t = this.agora();
    const desde = t - this.janelaMs;
    const lista = (this.batidas.get(chave) ?? []).filter((x) => x > desde);
    if (lista.length >= this.max) {
      this.batidas.set(chave, lista);
      return false;
    }
    lista.push(t);
    this.batidas.set(chave, lista);
    if (this.batidas.size > 10_000) this.limpar(desde);
    return true;
  }

  private limpar(desde: number): void {
    for (const [k, v] of this.batidas) if (v.every((x) => x <= desde)) this.batidas.delete(k);
  }
}

/**
 * Chave do limite por IP. IPv6 agrupa pelo /64 (um provedor entrega o /64 inteiro a um
 * cliente: trocar o fim do endereço não fura o limite); IPv4 mapeado em IPv6 vira IPv4.
 */
export function chaveDeIp(ip: string | undefined | null): string {
  if (!ip) return '?';
  const x = ip.trim().toLowerCase();
  const mapeado = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x);
  if (mapeado) return mapeado[1];
  if (!x.includes(':')) return x;
  const [esq, dir] = x.split('::');
  const a = esq ? esq.split(':') : [];
  const b = dir !== undefined && dir ? dir.split(':') : [];
  const grupos = dir === undefined ? a : [...a, ...Array<string>(Math.max(0, 8 - a.length - b.length)).fill('0'), ...b];
  return `${grupos
    .slice(0, 4)
    .map((g) => (g || '0').replace(/^0+(?=.)/, ''))
    .join(':')}::/64`;
}
