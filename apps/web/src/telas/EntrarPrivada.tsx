import { type FormEvent, useState } from 'react';
import { gravarApelido } from '../logica/lobby';

interface Props {
  codigo: string;
  nomeInicial: string;
  aoEntrar: (nome: string) => void;
}

export function TelaEntrarPrivada({ codigo, nomeInicial, aoEntrar }: Props) {
  const [nome, setNome] = useState(nomeInicial);
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    gravarApelido(nome.trim());
    aoEntrar(nome.trim() || 'Jogador');
  };
  return (
    <main className="tela-conta">
      <h1>Mesa privada</h1>
      <p>
        Você foi convidado para a mesa <code>{codigo}</code>.
      </p>
      <form className="formulario" onSubmit={enviar}>
        <div className="campo">
          <label htmlFor="apelido-privada">Apelido</label>
          <input id="apelido-privada" type="text" maxLength={20} value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <button type="submit" className="botao-principal">
          Entrar na mesa
        </button>
      </form>
    </main>
  );
}
