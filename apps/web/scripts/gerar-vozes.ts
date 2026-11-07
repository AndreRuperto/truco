/**
 * Gera as falas da mesa no ElevenLabs (uma vez; os .mp3 vão para public/vozes e entram no git).
 * Rodar da raiz do repositório:  node apps/web/scripts/gerar-vozes.ts
 * Precisa de ELEVENLABS_API_KEY no .env da raiz (que não vai para o git). Arquivo que já existe
 * é pulado: rodar de novo só gera o que falta (apague um .mp3 para refazer só ele).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FALAS, type IdFala, VOZES, VOZES_PESSOAIS } from '../src/som/falas.ts';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..', '..', '..');
const saida = join(aqui, '..', 'public', 'vozes');

const env = Object.fromEntries(
  readFileSync(join(raiz, '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const chave = env.ELEVENLABS_API_KEY;
if (!chave) throw new Error('falta ELEVENLABS_API_KEY no .env da raiz');
mkdirSync(saida, { recursive: true });

/** Gritos de aposta saem mais soltos; o resto, mais firme. */
const GRITOS = new Set<IdFala>(['truco', 'seis', 'nove', 'doze']);

let gerados = 0;
let pulados = 0;
let caracteres = 0;
const todas: [string | number, { nome: string; id: string }][] = [...VOZES.entries(), ...Object.entries(VOZES_PESSOAIS)];
for (const [tipo, voz] of todas) {
  for (const [id, fala] of Object.entries(FALAS) as [IdFala, { ditos: readonly string[] }][]) {
    for (const [n, texto] of fala.ditos.entries()) {
      const arquivo = join(saida, `${tipo}-${id}-${n}.mp3`);
      if (existsSync(arquivo)) {
        pulados++;
        continue;
      }
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voz.id}?output_format=mp3_22050_32`, {
        method: 'POST',
        headers: { 'xi-api-key': chave, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({
          text: texto,
          model_id: 'eleven_multilingual_v2',
          voice_settings: GRITOS.has(id)
            ? { stability: 0.25, similarity_boost: 0.8, style: 0.7, use_speaker_boost: true }
            : { stability: 0.4, similarity_boost: 0.8, style: 0.45, use_speaker_boost: true },
        }),
      });
      if (!r.ok) throw new Error(`${voz.nome} / ${id} ${n}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
      writeFileSync(arquivo, Buffer.from(await r.arrayBuffer()));
      gerados++;
      caracteres += texto.length;
      console.log(`ok  ${voz.nome.padEnd(9)} ${id} ${n}: ${texto}`);
    }
  }
}
console.log(`\n${gerados} gerados (${caracteres} caracteres), ${pulados} já existiam.`);
