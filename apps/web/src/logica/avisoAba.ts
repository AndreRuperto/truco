import { useEffect, useRef } from 'react';

/**
 * Chama a atenção de quem está em outra aba/app: o título da aba alterna com `mensagem`
 * enquanto `ativo` e a página estiver escondida; ao voltar, o título original volta.
 * Ao ficar `ativo`, o celular vibra curto (se `vibrar` e o aparelho deixar).
 */
export function useAvisoNaAba(ativo: boolean, mensagem: string, vibrar = true): void {
  const original = useRef<string | null>(null);

  useEffect(() => {
    if (!ativo) return;
    if (vibrar) {
      try {
        navigator.vibrate?.(140);
      } catch {
        // sem vibração: segue
      }
    }
    let piscando: ReturnType<typeof setInterval> | null = null;
    const parar = () => {
      if (piscando) clearInterval(piscando);
      piscando = null;
      if (original.current !== null) document.title = original.current;
      original.current = null;
    };
    const comecar = () => {
      if (!document.hidden || piscando) return;
      original.current = document.title;
      let alterna = false;
      document.title = mensagem;
      piscando = setInterval(() => {
        alterna = !alterna;
        document.title = alterna ? original.current ?? 'Truco' : mensagem;
      }, 1_000);
    };
    const visibilidade = () => (document.hidden ? comecar() : parar());
    comecar();
    document.addEventListener('visibilitychange', visibilidade);
    return () => {
      document.removeEventListener('visibilitychange', visibilidade);
      parar();
    };
  }, [ativo, mensagem, vibrar]);
}
