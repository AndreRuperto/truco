/**
 * Qualidade da cena 3D em três níveis (como no Júri): começa pelo aparelho e desce se o FPS medido
 * ficar baixo. Puro, sem three.js: a cena aplica o nível (pixels por ponto e sombra).
 */
export type Nivel = 'alta' | 'media' | 'baixa';

export interface Ajuste {
  /** Teto de pixels por ponto (devicePixelRatio). */
  pixels: number;
  /** Lado do mapa de sombra; 0 = sem sombra. */
  sombra: number;
  /** Sombra suave (PCFSoft) ou simples (PCF). */
  sombraSuave: boolean;
}

export const AJUSTES: Record<Nivel, Ajuste> = {
  alta: { pixels: 2, sombra: 1024, sombraSuave: true },
  media: { pixels: 1.5, sombra: 512, sombraSuave: false },
  // Sem sombra o piso fica lavado e some a luz de boteco (capturas de 2026-11-26): mapa pequeno, mas fica.
  baixa: { pixels: 1, sombra: 256, sombraSuave: false },
};

const ORDEM: Nivel[] = ['alta', 'media', 'baixa'];

export interface Aparelho {
  /** Menor lado da caixa da cena, em pontos. */
  menorLado: number;
  /** navigator.hardwareConcurrency (pode faltar). */
  nucleos?: number;
  /** navigator.deviceMemory em GB (só Chrome; pode faltar). */
  memoria?: number;
  /** `?qualidade=` na URL, para forçar (teste e suporte). */
  pedido?: string | null;
}

/** Nível inicial: forçado pela URL; senão celular (tela pequena) começa em média e aparelho fraco em baixa. */
export function nivelInicial(a: Aparelho): Nivel {
  if (a.pedido === 'alta' || a.pedido === 'media' || a.pedido === 'baixa') return a.pedido;
  if ((a.nucleos !== undefined && a.nucleos <= 2) || (a.memoria !== undefined && a.memoria <= 2)) return 'baixa';
  return a.menorLado < 500 ? 'media' : 'alta';
}

export function nivelAbaixo(n: Nivel): Nivel | null {
  const i = ORDEM.indexOf(n);
  return i < ORDEM.length - 1 ? ORDEM[i + 1] : null;
}

/** Abaixo disso (média de uma janela) a cena desce um nível. */
export const FPS_MINIMO = 24;
/** Janela da medição, em segundos de quadros desenhados. */
export const JANELA_S = 4;

/**
 * Mede o FPS dos quadros desenhados em janelas de `JANELA_S` s e diz quando descer de nível.
 * A primeira janela é descartada (shaders compilando, texturas subindo). Só desce: não sobe de novo
 * na mesma partida, para a cena não ficar trocando de nitidez.
 */
export class MedidorFps {
  private tempo = 0;
  private quadros = 0;
  private janelas = 0;
  constructor(private forcado: boolean) {}

  /** Um quadro desenhado, `dt` segundos depois do anterior. Devolve true quando é hora de descer. */
  registrar(dt: number): boolean {
    if (this.forcado) return false;
    this.tempo += dt;
    this.quadros++;
    if (this.tempo < JANELA_S) return false;
    const fps = this.quadros / this.tempo;
    this.tempo = 0;
    this.quadros = 0;
    this.janelas++;
    return this.janelas > 1 && fps < FPS_MINIMO;
  }

  /** Pausa (aba oculta): recomeça a janela do zero. */
  zerar(): void {
    this.tempo = 0;
    this.quadros = 0;
  }
}
