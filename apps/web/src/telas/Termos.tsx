import { RESPONSAVEL, VIGENCIA } from '../logica/legal';
import { ItensTermosLoja } from './Loja';
import { AvisoRascunho } from './Privacidade';

/** #/termos: termos de uso, em linguagem simples. */
export function TelaTermos() {
  return (
    <main className="tela-conta tela-legal">
      <h1>Termos de uso</h1>
      <AvisoRascunho />
      <p>Valem a partir de {VIGENCIA}. Ao entrar numa conta ou jogar, você concorda com estas regras.</p>

      <h2>Conduta na mesa</h2>
      <ul>
        <li>Nada de xingamento, preconceito, ameaça ou assédio, no chat, no apelido ou na foto.</li>
        <li>Nada de trapaça: combinar jogada com adversário, usar várias contas, programas ou falhas do jogo.</li>
        <li>Na ranqueada, sair no meio da partida conta como derrota e pode bloquear a fila por um tempo.</li>
        <li>
          Viu alguém fora das regras? Use o botão <strong>Denunciar</strong> na mesa.
        </li>
      </ul>

      <h2>Banimento</h2>
      <p>
        Quem desrespeitar estas regras pode ter a conta suspensa, sem aviso prévio nos casos graves. Conta suspensa perde o
        acesso ao ranking, aos saldos e aos itens. Para contestar, escreva para {RESPONSAVEL.email}.
      </p>

      <h2>Ranking</h2>
      <p>
        O ranking e as patentes são calculados pelas partidas ranqueadas. Partidas repetidas entre o mesmo grupo de contas
        em pouco tempo podem não mudar o Elo. Podemos corrigir o ranking se houver trapaça ou erro.
      </p>

      <h2>Fichas e Pila</h2>
      <ul>
        <li>
          Fichas e Pila <strong>não têm valor em dinheiro</strong>: não podem ser sacados, vendidos nem trocados entre si.
        </li>
        <ItensTermosLoja />
      </ul>

      <h2>Disponibilidade</h2>
      <p>
        O Truco é oferecido como está. Ele pode sair do ar para manutenção ou por falha, e uma partida pode acabar se o
        servidor reiniciar. Podemos mudar regras, itens e estes termos; mudanças importantes aparecem no site antes de valer.
      </p>

      <p>
        Veja também a <a href="#/privacidade">Privacidade</a>.
      </p>
    </main>
  );
}
