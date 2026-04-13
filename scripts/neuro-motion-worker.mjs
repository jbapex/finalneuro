/**
 * Worker Node: processa jobs `pending` em neuro_motion_render_jobs (Remotion + FFmpeg + Storage).
 *
 * Requisitos no servidor onde roda:
 * - FFmpeg no PATH
 * - Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * - (Opcional) REMOTION_LICENSE_KEY conforme licença Remotion
 *
 * Uso:
 *   npm run neuro-motion:worker              → processa 1 job e termina
 *   npm run neuro-motion:worker:loop         → esvazia a fila (vários jobs)
 *
 * Variáveis opcionais:
 *   NEURO_MOTION_WORKER_LOOP=1|all           → esvaziar fila (equivale ao script :loop)
 *   NEURO_MOTION_RENDER_RETRIES=3            → tentativas por job após falha
 *   NEURO_MOTION_WORKER_MAX_JOBS=10          → limite de jobs por execução (0 = sem limite)
 */
import { createClient } from '@supabase/supabase-js';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { NEURO_MOTION_COMPOSITION_ID } from '../src/lib/neuroMotion/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENTRY_POINT = path.join(PROJECT_ROOT, 'src/remotion/entry.jsx');

const supabaseUrl = process.env.SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const licenseKey = process.env.REMOTION_LICENSE_KEY || process.env.REMOTION_API_KEY || null;

const DRAIN_QUEUE =
  process.env.NEURO_MOTION_WORKER_LOOP === '1' || process.env.NEURO_MOTION_WORKER_LOOP === 'all';
const MAX_RETRIES = Math.max(1, Number(process.env.NEURO_MOTION_RENDER_RETRIES || 3));
const MAX_JOBS_PER_RUN = Math.max(0, Number(process.env.NEURO_MOTION_WORKER_MAX_JOBS || 0));

if (!supabaseUrl || !serviceKey) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchNextPending() {
  const { data, error } = await supabase
    .from('neuro_motion_render_jobs')
    .select('id, user_id, input_props')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) throw error;
  return data?.[0] ?? null;
}

async function claimJob(jobId) {
  const { data, error } = await supabase
    .from('neuro_motion_render_jobs')
    .update({ status: 'processing' })
    .eq('id', jobId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

async function failJob(jobId, message) {
  await supabase
    .from('neuro_motion_render_jobs')
    .update({
      status: 'failed',
      error_message: String(message).slice(0, 2000),
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId);
}

async function completeJob(jobId, outputPath, outputUrl) {
  await supabase
    .from('neuro_motion_render_jobs')
    .update({
      status: 'completed',
      output_path: outputPath,
      output_url: outputUrl,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId);
}

let bundleCache = null;

async function getServeUrl() {
  if (bundleCache) return bundleCache;
  console.log('Bundling Remotion…');
  bundleCache = await bundle({
    entryPoint: ENTRY_POINT,
    rootDir: PROJECT_ROOT,
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...(config.resolve?.alias &&
          typeof config.resolve.alias === 'object' &&
          !Array.isArray(config.resolve.alias)
            ? config.resolve.alias
            : {}),
          '@': path.join(PROJECT_ROOT, 'src'),
        },
      },
    }),
  });
  return bundleCache;
}

async function renderOnce(job, serveUrl, workDir, outFile) {
  const inputProps =
    job.input_props && typeof job.input_props === 'object' && !Array.isArray(job.input_props)
      ? job.input_props
      : {};

  console.log('Selecionando composição…');
  const composition = await selectComposition({
    serveUrl,
    id: NEURO_MOTION_COMPOSITION_ID,
    inputProps,
    logLevel: 'info',
  });

  console.log('Renderizando vídeo (pode demorar)…');
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outFile,
    inputProps,
    logLevel: 'info',
    ...(licenseKey ? { licenseKey } : {}),
  });

  const buffer = await readFile(outFile);
  const storagePath = `${job.user_id}/${job.id}.mp4`;

  const { error: upErr } = await supabase.storage.from('neuromotion').upload(storagePath, buffer, {
    contentType: 'video/mp4',
    upsert: true,
  });
  if (upErr) throw upErr;

  const {
    data: { publicUrl },
  } = supabase.storage.from('neuromotion').getPublicUrl(storagePath);

  await completeJob(job.id, storagePath, publicUrl);
  console.log('Concluído:', publicUrl);
}

async function processJobWithRetries(job) {
  let lastErr;
  const serveUrl = await getServeUrl();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const workDir = await mkdtemp(path.join(tmpdir(), 'neuro-motion-'));
    const outFile = path.join(workDir, 'out.mp4');
    try {
      await renderOnce(job, serveUrl, workDir, outFile);
      await rm(workDir, { recursive: true, force: true });
      return true;
    } catch (err) {
      lastErr = err;
      console.error(`Tentativa ${attempt}/${MAX_RETRIES} falhou:`, err);
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
      if (attempt < MAX_RETRIES) await sleep(1500 * attempt);
    }
  }

  await failJob(job.id, lastErr instanceof Error ? lastErr.message : String(lastErr));
  return false;
}

async function run() {
  let processed = 0;
  let anyJob = false;

  while (true) {
    const job = await fetchNextPending();
    if (!job) break;
    anyJob = true;

    const claimed = await claimJob(job.id);
    if (!claimed) {
      if (!DRAIN_QUEUE) break;
      continue;
    }

    await processJobWithRetries(job);
    processed += 1;

    if (MAX_JOBS_PER_RUN > 0 && processed >= MAX_JOBS_PER_RUN) break;
    if (!DRAIN_QUEUE) break;
  }

  if (!anyJob) console.log('Nenhum job pendente.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
