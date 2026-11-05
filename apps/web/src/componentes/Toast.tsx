import { useEffect } from 'react';

interface Props {
  erro: { id: number; mensagem: string };
  aoFechar: (id: number) => void;
}

export function Toast({ erro, aoFechar }: Props) {
  useEffect(() => {
    const t = setTimeout(() => aoFechar(erro.id), 3_500);
    return () => clearTimeout(t);
  }, [erro.id, aoFechar]);
  return (
    <div className="toast" role="alert" onClick={() => aoFechar(erro.id)}>
      {erro.mensagem}
    </div>
  );
}
