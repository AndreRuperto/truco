/**
 * Conluio e fazenda na ranqueada (SEC-03, decisão D1 do plano MVP): a partir desta partida entre
 * o mesmo grupo de contas nas últimas 24 h, a partida vale (placar, vitória, estatística), mas o Elo
 * e os pontos de patente não mudam e o pote de Fichas volta para cada um. Conta só ranqueadas
 * terminadas e não abandonadas; "mesmo grupo" é o mesmo conjunto de contas humanas, em qualquer cadeira.
 */
export const LIMITE_MESMO_GRUPO_24H = 5;
