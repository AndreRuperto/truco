import { useEffect } from 'react';

interface Props {
  /** `tipo: 'aviso'`: informativo (tom de lousa, role=status, mais tempo para ler). */
  erro: { id: number; mensagem: string; tipo?: 'aviso' };
  /**
   * Precisa ter referência estável (ex.: `loja.limparErro`): ela é dependência do efeito,
   * e uma função nova a cada render reiniciaria o timer de 3,5 s sem parar.
   */
  aoFechar: (id: number) => void;
}

export function Toast({ erro, aoFechar }: Props) {
  const aviso = erro.tipo === 'aviso';
  useEffect(() => {
    const t = setTimeout(() => aoFechar(erro.id), aviso ? 6_000 : 3_500);
    return () => clearTimeout(t);
  }, [erro.id, aoFechar, aviso]);
  return (
    <div className={aviso ? 'toast toast-aviso' : 'toast'} role={aviso ? 'status' : 'alert'}>
      <span>{erro.mensagem}</span>
      <button type="button" className="toast-fechar" aria-label="Fechar" onClick={() => aoFechar(erro.id)}>
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
