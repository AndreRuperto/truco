import { limiteMaoEspecial, type Pontuacao } from '@truco/engine';

/** Cada regra do lobby que tem "?" (a explicação que antes ia entre parênteses, e mais). */
export type IdAjuda =
  | 'privada'
  | 'variante'
  | 'pontuacao'
  | 'familia'
  | 'mao11'
  | 'tempo-familia'
  | 'tempo-jogada'
  | 'humanos'
  | 'bots'
  | 'cacife'
  | 'sinais'
  | 'provocacoes'
  | 'interceptar'
  | 'maoDe10'
  | 'maoLimpa';

/** Texto curto, no tom da mesa: o que a regra faz e o que muda em cada opção. */
export function textoAjuda(id: IdAjuda, pontuacao: Pontuacao): string {
  const limite = limiteMaoEspecial(pontuacao);
  switch (id) {
    case 'privada':
      return 'Só entra quem tiver o link de convite. Você chama a turma e começa quando quiser; as cadeiras vazias ficam com bots.';
    case 'variante':
      return 'Paulista: a vira, a carta virada no meio, define a manilha de cada mão. Mineiro: as manilhas são fixas, as mesmas em toda mão: zap, sete de copas, espadilha e sete de ouros.';
    case 'pontuacao':
      return 'Quanto vale cada pedido. 1, 3, 6, 9, 12: a mão vale 1, o truco 3, depois seis, nove e doze. 2, 4, 8, 10, 12: a mão vale 2, o truco 4, depois oito, dez e doze. Ganha quem chegar a 12.';
    case 'familia':
      return 'Família é ter só Q, J, K e Ás na mão. Quem tem pede e troca as 3 cartas. Aberta: as cartas aparecem para todos. Fechada: ninguém vê, dá para blefar, e a outra dupla decide se confere.';
    case 'mao11':
      return `Quando as duas duplas chegam a ${limite}, todo mundo joga às cegas, sem ver as próprias cartas, e quem levar a mão ganha a partida. Desligada, a mão segue normal.`;
    case 'tempo-familia':
      return 'Depois de dar as cartas, quanto tempo todos têm para pedir família antes da primeira jogada.';
    case 'tempo-jogada':
      return 'Quanto tempo cada um tem para jogar ou responder. Se acabar, o jogo faz a jogada por você. Sem limite só existe na mesa privada.';
    case 'humanos':
      return 'Quantas pessoas vão jogar. As cadeiras que sobrarem ficam com bots. Só eu: você, seu parceiro e os dois adversários são bots.';
    case 'bots':
      return 'Fácil: nunca pede truco e joga o simples. Difícil: pede truco, blefa e conta as cartas que já saíram.';
    case 'cacife':
      return 'Cada pessoa com conta põe essas Fichas na mesa, e quem vencer leva o pote. Se alguém tiver menos saldo, vale o menor.';
    case 'sinais':
      return 'Gestos combinados com o parceiro para contar qual carta forte você tem, como no truco de verdade. Desligado, ninguém sinaliza, nem os bots.';
    case 'provocacoes':
      return 'Toque no nome de alguém da mesa para provocar com a sua moldura: uma animação rápida em cima do nome dele.';
    case 'interceptar':
      return 'A chance de um adversário perceber o sinal que você mandou para o parceiro. Nunca: só o parceiro vê.';
    case 'maoDe10':
      return `Quando só uma dupla chega a ${limite}, ela vê as cartas do parceiro e decide: jogar, e a mão vale truco, ou correr, e a outra dupla leva o valor inicial. Pedir truco nessa mão entrega a mão.`;
    case 'maoLimpa':
      return 'Tira do baralho os 4, 5, 6 e 7 comuns e põe 2 coringas, que ficam entre as manilhas e o 3: perdem para qualquer manilha e ganham de todas as cartas comuns.';
  }
}
