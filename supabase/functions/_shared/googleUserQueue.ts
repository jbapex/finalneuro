/**
 * Fila por utilizador para chamadas à API Google (Gemini) com chave própria (user_ai_connections).
 * Serializa pedidos do mesmo utilizador (um de cada vez) para reduzir picos simultâneos e padrões
 * que a Google pode tratar como atividade suspeita.
 *
 * Nota: em várias instâncias serverless, cada instância tem a sua própria Map; ainda assim,
 * dentro da mesma instância os pedidos do mesmo user ficam ordenados. Para fila global seria
 * necessário Redis/Postgres — este passo cobre o caso típico de burst no mesmo worker.
 */
const userTails = new Map<string, Promise<unknown>>();

export function enqueueUserGoogle<T>(userId: string, work: () => Promise<T>): Promise<T> {
  const prev = userTails.get(userId) ?? Promise.resolve();
  const job = prev.then(() => work());
  userTails.set(userId, job.catch(() => {}));
  return job;
}
