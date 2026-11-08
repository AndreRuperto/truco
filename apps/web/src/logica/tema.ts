/** Tema da página: segue o aparelho (automático) ou fica fixo no claro/escuro. */
export type Tema = 'auto' | 'claro' | 'escuro';

/** Mesma chave lida pelo script do `index.html` (aplica o tema antes da página aparecer). */
export const CHAVE_TEMA = 'truco:tema';

export const TEMAS: readonly { valor: Tema; rotulo: string }[] = [
  { valor: 'auto', rotulo: 'Automático' },
  { valor: 'claro', rotulo: 'Claro' },
  { valor: 'escuro', rotulo: 'Escuro' },
];

export function lerTema(): Tema {
  try {
    const t = localStorage.getItem(CHAVE_TEMA);
    return t === 'claro' || t === 'escuro' ? t : 'auto';
  } catch {
    return 'auto';
  }
}

/** Marca o `<html>` (o CSS lê `data-tema`; sem ele vale o tema do aparelho) e lembra a escolha. */
export function aplicarTema(t: Tema): void {
  const html = document.documentElement;
  if (t === 'auto') delete html.dataset.tema;
  else html.dataset.tema = t;
  try {
    if (t === 'auto') localStorage.removeItem(CHAVE_TEMA);
    else localStorage.setItem(CHAVE_TEMA, t);
  } catch {
    // modo privado / storage cheio: vale só nesta visita
  }
}

/** Próximo tema do botão: automático → claro → escuro → automático. */
export function proximoTema(t: Tema): Tema {
  return t === 'auto' ? 'claro' : t === 'claro' ? 'escuro' : 'auto';
}
