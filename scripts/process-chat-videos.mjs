/**
 * Post-process chat video messages in Supabase Storage.
 *
 * Goal: fix "audio ends early but video continues" by padding audio with silence
 * to match the video duration, then uploading the fixed mp4 back to the same Storage path.
 *
 * Requirements:
 * - Node.js 18+
 * - ffmpeg + ffprobe installed and available in PATH
 * - env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/process-chat-videos.mjs --url "https://.../storage/v1/object/public/chat-media/video/....mp4"
 *
 *   # or process latest N videos found in DB (requires messages table readable by service role):
 *   node scripts/process-chat-videos.mjs --latest 20
 *
 * Notes:
 * - This script intentionally overwrites the original object path (upsert=true),
 *   so existing public URLs keep working.
 * - No new npm dependencies: uses @supabase/supabase-js already present in the project.
 */
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

function parseArgs(argv) {
  const out = { url: null, latest: null, dryRun: false, bucket: 'chat-media', force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') out.url = argv[++i] ?? null;
    else if (a === '--latest') out.latest = Number(argv[++i] ?? '0') || null;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--bucket') out.bucket = argv[++i] ?? out.bucket;
    else if (a === '--force') out.force = true;
  }
  return out;
}

function assertEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (d) => (stdout += d.toString('utf8')));
    p.stderr.on('data', (d) => (stderr += d.toString('utf8')));
    p.on('error', reject);
    p.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exited ${code}\n${stderr}`));
    });
  });
}

function parseStoragePathFromPublicUrl(url, bucket) {
  // Typical:
  // https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
  const m = String(url).match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/i);
  if (!m) return null;
  const urlBucket = decodeURIComponent(m[1]);
  const objectPath = decodeURIComponent(m[2]);
  if (bucket && urlBucket !== bucket) return null;
  return objectPath;
}

async function ffprobeStreams(filePath) {
  const { stdout } = await run('ffprobe', [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_streams',
    '-show_format',
    filePath,
  ]);
  return JSON.parse(stdout);
}

function getDurationSecondsFromProbe(probe) {
  const fmtDur = Number(probe?.format?.duration);
  if (Number.isFinite(fmtDur) && fmtDur > 0) return fmtDur;
  return 0;
}

function pickStream(probe, type) {
  const streams = Array.isArray(probe?.streams) ? probe.streams : [];
  return streams.find((s) => s?.codec_type === type) ?? null;
}

function streamDurationSeconds(stream) {
  const d = Number(stream?.duration);
  if (Number.isFinite(d) && d > 0) return d;
  const tagsDur = Number(stream?.tags?.DURATION);
  if (Number.isFinite(tagsDur) && tagsDur > 0) return tagsDur;
  return 0;
}

async function padAudioToVideoDuration({ input, output, videoDurSec }) {
  // Keep video bitstream, re-encode audio to AAC and pad with silence.
  // -t forces output length to exactly videoDurSec.
  await run('ffmpeg', [
    '-y',
    '-i',
    input,
    '-t',
    String(videoDurSec),
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-af',
    'apad',
    '-movflags',
    '+faststart',
    output,
  ]);
}

async function downloadToFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(destPath, buf);
  return buf.length;
}

async function processOnePublicUrl({ supabase, bucket, url, dryRun, force }) {
  const objectPath = parseStoragePathFromPublicUrl(url, bucket);
  if (!objectPath) throw new Error(`Could not parse storage object path from url (bucket=${bucket})`);

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-video-fix-'));
  const inputPath = path.join(tmpDir, 'in.mp4');
  const outputPath = path.join(tmpDir, 'out.mp4');

  try {
    const bytes = await downloadToFile(url, inputPath);
    console.log('[video-fix] downloaded', bytes, 'bytes', { objectPath });

    const probe = await ffprobeStreams(inputPath);
    const v = pickStream(probe, 'video');
    const a = pickStream(probe, 'audio');
    const fmtDur = getDurationSecondsFromProbe(probe);
    const vDur = Math.max(streamDurationSeconds(v), fmtDur);
    const aDur = a ? Math.max(streamDurationSeconds(a), 0) : 0;

    console.log('[video-fix] durations', {
      format: fmtDur ? Number(fmtDur.toFixed(3)) : 0,
      video: vDur ? Number(vDur.toFixed(3)) : 0,
      audio: aDur ? Number(aDur.toFixed(3)) : 0,
      hasAudio: !!a,
    });

    if (!v) {
      console.log('[video-fix] skip: no video stream');
      return { ok: false, skipped: true, reason: 'no_video_stream' };
    }
    if (!a) {
      console.log('[video-fix] skip: no audio stream (nothing to pad)');
      return { ok: false, skipped: true, reason: 'no_audio_stream' };
    }
    if (!(vDur > 0 && aDur > 0)) {
      console.log('[video-fix] skip: missing duration metadata');
      return { ok: false, skipped: true, reason: 'no_duration' };
    }
    if (!force && aDur + 0.15 >= vDur) {
      console.log('[video-fix] ok: audio already matches video (within 150ms)');
      return { ok: true, skipped: true, reason: 'already_ok' };
    }

    const target = Number(vDur.toFixed(3));
    console.log('[video-fix] padding audio to video duration', target, force ? '(force)' : '');

    if (!dryRun) {
      await padAudioToVideoDuration({ input: inputPath, output: outputPath, videoDurSec: target });
      const outBuf = await fs.readFile(outputPath);

      const { error } = await supabase.storage
        .from(bucket)
        .upload(objectPath, outBuf, { contentType: 'video/mp4', upsert: true });
      if (error) throw new Error(`upload failed: ${error.message}`);
      console.log('[video-fix] uploaded fixed mp4', { objectPath, bytes: outBuf.length });
    } else {
      console.log('[video-fix] dry-run: would upload fixed mp4', { objectPath });
    }

    return { ok: true, skipped: false, reason: 'fixed', objectPath };
  } finally {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.url && !args.latest) {
    console.log('Usage: node scripts/process-chat-videos.mjs --url <publicUrl>');
    console.log('   or: node scripts/process-chat-videos.mjs --latest 20');
    console.log('   add: --force  # remux even when durations look OK');
    process.exit(2);
  }

  const supabaseUrl = assertEnv('SUPABASE_URL');
  const serviceRole = assertEnv('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (args.url) {
    await processOnePublicUrl({ supabase, bucket: args.bucket, url: args.url, dryRun: args.dryRun, force: args.force });
    return;
  }

  // Process latest N video messages from DB. Uses service role, so RLS won't block.
  const n = Math.max(1, Math.min(200, args.latest ?? 20));
  const { data, error } = await supabase
    .from('messages')
    .select('id, media_url, created_at')
    .eq('message_type', 'video')
    .not('media_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(n);
  if (error) throw new Error(error.message);

  const urls = (data ?? [])
    .map((r) => r?.media_url)
    .filter((u) => typeof u === 'string' && u.includes('/storage/v1/object/public/'));

  console.log('[video-fix] found', urls.length, 'video urls');
  for (let i = 0; i < urls.length; i++) {
    const u = urls[i];
    console.log('\n[video-fix] (' + (i + 1) + '/' + urls.length + ')', u);
    try {
      await processOnePublicUrl({ supabase, bucket: args.bucket, url: u, dryRun: args.dryRun, force: args.force });
    } catch (e) {
      console.warn('[video-fix] failed', e?.message ?? String(e));
    }
    // Small delay to avoid hammering storage + CPU if used in a loop.
    await sleep(150);
  }
}

main().catch((e) => {
  console.error('Fatal:', e?.message ?? e);
  process.exit(1);
});

