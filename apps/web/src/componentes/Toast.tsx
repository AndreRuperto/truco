import { useEffect } from 'react';

interface Props {
  erro: { id: number; mensagem: string };
  /**
   * Precisa ter referência estável (ex.: `loja.limparErro`): ela é dependência do efeito,
   * e uma função nova a cada render reiniciaria o timer de 3,5 s sem parar.
   */
  aoFechar: (id: number) => void;
}

export function Toast({ erro, aoFechar }: Props) {
  useEffect(() => {
    const t = setTimeout(() => aoFechar(erro.id), 3_500);
    return () => clearTimeout(t);
  }, [erro.id, aoFechar]);
  return (
    <div className="toast" role="alert">
      <span>{erro.mensagem}</span>
      <button type="button" className="toast-fechar" aria-label="Fechar" onClick={() => aoFechar(erro.id)}>
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
