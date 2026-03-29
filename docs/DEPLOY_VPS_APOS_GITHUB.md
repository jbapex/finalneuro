# O que fazer na VPS depois de subir mudanças no GitHub

Quando você fizer **push** das alterações para o GitHub (incluindo mudanças nas **Edge Functions** do NeuroDesign ou de outras funções), a VPS **não atualiza sozinha**. É preciso atualizar o código na VPS e reiniciar os serviços que rodam as funções.

Siga estes passos **na sua VPS**.

---

## Deploy completo a partir de neuroapice (recomendado)

Se o código que você quer colocar online está em **`/root/neuroapice`** (sem usar outro repositório), use o script que faz build do front e sincroniza **todas** as Edge Functions para o volume do Docker:

```bash
cd /root/neuroapice
chmod +x deploy-from-neuroapice.sh
./deploy-from-neuroapice.sh
```

O script:
1. Executa `npm run build` em `/root/neuroapice` (saída em `neuroapice/dist`)
2. Copia todas as pastas de `neuroapice/supabase/functions/` para `/root/supabase/docker/volumes/functions/`
3. Executa `docker service update --force supabase_supabase_functions`
4. **Opcional:** se definires `NEUROAPICE_DIST_TARGET` (ex.: diretório que o nginx monta), o script copia o conteúdo de `dist/` para lá — caso contrário o site público pode continuar com **JavaScript antigo** (ex.: validações antigas no formulário de Clientes).

Exemplo com publicação do front:

```bash
NEUROAPICE_DIST_TARGET=/caminho/do/teu/html NEUROAPICE_DEPLOY_UNLOCK=1 ./deploy-from-neuroapice.sh
```

O container ou nginx que serve `neuro.jbapex.com.br` tem de apontar para esse `dist` (ou para o destino onde copiaste). Depois de publicar, usa **hard refresh** (Ctrl+Shift+R) para não ficar com bundle em cache.

---

## 1. Entrar na VPS e ir na pasta do projeto

Conecte por SSH e acesse a pasta onde está o repositório (o mesmo que usa no Supabase / app):

```bash
ssh seu_usuario@ip_da_vps
cd /caminho/para/nero2.0
```

(Substitua `seu_usuario`, `ip_da_vps` e `/caminho/para/nero2.0` pelos seus valores.)

---

## 2. Puxar as mudanças do GitHub

Na pasta do projeto:

```bash
git pull origin main
```

Se aparecer conflito, resolva ou peça ajuda. Em geral, com só você trabalhando, o `git pull` termina sem conflito.

---

## 3. Reiniciar as Edge Functions (Supabase self-hosted)

As Edge Functions rodam em um **serviço/container** do Supabase na VPS. Depois de atualizar os arquivos, esse serviço precisa ser **reiniciado** para carregar o código novo.

### Se você usa Docker / Docker Compose (comum no Supabase self-hosted)

Liste os containers para achar o das funções:

```bash
docker ps
```

Procure um container com nome parecido com **functions**, **edge-runtime** ou **supabase-functions**. Depois reinicie:

```bash
# Exemplo se o serviço se chama "functions":
docker compose restart functions

# Ou, se usa docker-compose (com hífen):
docker-compose restart functions
```

Se o nome do serviço for outro (ex.: `edge-runtime`), use o nome correto:

```bash
docker compose restart edge-runtime
```

### Se você não usa Docker

Se as Edge Functions rodam com **systemd** ou outro gerenciador de processos, reinicie o serviço correspondente, por exemplo:

```bash
sudo systemctl restart supabase-edge-runtime
# ou
sudo systemctl restart supabase-functions
```

(O nome exato do serviço depende de como o Supabase foi instalado na VPS.)

### Se não souber qual serviço reiniciar

- Se instalou o Supabase com o **script oficial** ou com **Docker Compose**, em geral existe um arquivo `docker-compose.yml` na pasta do Supabase. Abra e procure um serviço com nome tipo `functions` ou `edge-runtime` e use esse nome no `restart`.
- Se alguém configurou a VPS para você, peça a essa pessoa o comando exato de restart das Edge Functions.

---

## 4. Conferir se está rodando

Depois do restart:

```bash
docker ps
# ou
sudo systemctl status supabase-edge-runtime
```

Veja se o container/serviço está **Up** ou **active (running)**. Se estiver, as funções já estão com o código novo.

---

## Resumo rápido

| Onde      | O que fazer |
|----------|----------------------------------------------|
| No seu PC | `git push origin main` (já feito)           |
| Na VPS   | 1) `cd` na pasta do projeto                  |
| Na VPS   | 2) `git pull origin main`                    |
| Na VPS   | 3) Reiniciar o serviço das Edge Functions (ex.: `docker compose restart functions`) |

Sempre que mudar algo nas pastas **supabase/functions/** e der push no GitHub, repita na VPS: **git pull** e **restart** do serviço das funções.

---

## Alternativa: copiar para o volume do Docker e atualizar o service

Se na sua VPS as funções são servidas a partir do volume `/root/supabase/docker/volumes/functions/` e você usa **Docker Swarm** (ou `docker service`), use este fluxo:

### 1. Atualizar o projeto (se ainda não tiver puxado do GitHub)

```bash
cd /root/neuroapice
git pull origin main
```

### 2. Copiar as funções para o volume das functions

Lista completa de funções (copiar todas para o volume):

```bash
cd /root/neuroapice/supabase/functions
for dir in download-video generate-content generic-ai-chat get-google-models get-openai-models get-openrouter-models get-video-metadata neurodesign-generate neurodesign-generate-google neurodesign-refine neurodesign-refine-google page-analyzer site-builder-assistant; do
  [ -d "$dir" ] && cp -r "$dir" /root/supabase/docker/volumes/functions/
done
```

Ou use o script: `./deploy-from-neuroapice.sh` (faz também o build do front).

### 3. Forçar atualização do serviço das functions

```bash
docker service update --force supabase_supabase_functions
```

Assim o serviço recarrega o código das pastas copiadas. Ajuste os caminhos (`/root/neuroapice`, `/root/supabase/docker/volumes/functions/`) e o nome do service (`supabase_supabase_functions`) se na sua VPS forem diferentes.
