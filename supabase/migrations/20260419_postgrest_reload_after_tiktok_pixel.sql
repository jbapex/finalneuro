-- Se já aplicaste só o ALTER sem o NOTIFY e o erro do schema cache continua, executa isto
-- (ou corre de novo o ficheiro 20260418 completo). Idempotente.
NOTIFY pgrst, 'reload schema';
