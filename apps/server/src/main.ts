import { MesaRoom } from './MesaRoom';
import { criarServidor } from './servidor';
import { temposDoAmbiente } from './tempos';

MesaRoom.tempos = temposDoAmbiente(process.env);
const porta = Number(process.env.PORT ?? 2567);
await criarServidor().listen(porta);
const modo = process.env.TRUCO_TEMPOS ? ` (tempos: ${process.env.TRUCO_TEMPOS})` : '';
console.log(`truco: servidor ouvindo na porta ${porta}${modo}`);
