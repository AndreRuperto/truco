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
