import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import { spawn } from 'child_process';
import { createReadStream, statSync } from 'fs';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
  origin: ['https://ellmusic.vercel.app', 'http://localhost:8080', 'capacitor://localhost', 'ionic://localhost'],
  credentials: true
}));
app.use(compression());
app.use(express.json());

const YT_DLP_PATH = process.env.YT_DLP_PATH || 'yt-dlp';
const CACHE_DIR = process.env.CACHE_DIR || join(__dirname, '../cache');
const MAX_AGE = 3600;

function validateVideoId(videoId) {
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}

function getStreamUrl(videoId, format = 'bestaudio[ext=m4a]/bestaudio/best') {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

async function getAudioInfo(videoId) {
  return new Promise((resolve, reject) => {
    const proc = spawn(YT_DLP_PATH, [
      '--dump-json',
      '--no-playlist',
      getStreamUrl(videoId)
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp failed: ${stderr}`));
        return;
      }
      try {
        const info = JSON.parse(stdout.trim());
        resolve({
          title: info.title,
          artist: info.uploader || info.channel || 'Unknown',
          duration: info.duration,
          thumbnail: info.thumbnail,
          formats: info.formats
        });
      } catch (e) {
        reject(new Error('Failed to parse yt-dlp output'));
      }
    });
  });
}

function streamAudio(videoId, res, rangeHeader) {
  const url = getStreamUrl(videoId);
  const args = [
    '-f', 'bestaudio[ext=m4a]/bestaudio/best',
    '--no-playlist',
    '-o', '-',
    url
  ];

  const proc = spawn(YT_DLP_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  proc.stderr.on('data', (data) => {
    console.error(`yt-dlp stderr: ${data}`);
  });

  proc.on('error', (err) => {
    console.error('yt-dlp spawn error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Stream failed to start' });
    }
  });

  proc.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`yt-dlp exited with code ${code}`);
    }
  });

  const stream = proc.stdout;

  stream.on('error', (err) => {
    console.error('Stream error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Stream error' });
    }
  });

  res.setHeader('Content-Type', 'audio/mp4');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', `public, max-age=${MAX_AGE}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

  if (rangeHeader) {
    const range = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(range[0], 10);
    const end = range[1] ? parseInt(range[1], 10) : null;

    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end || '*'}/*`);
    res.setHeader('Content-Length', end ? end - start + 1 : undefined);
  }

  pipeline(stream, res).catch((err) => {
    if (err.code !== 'ERR_STREAM_PREMATURE_CLOSE' && err.code !== 'ECONNRESET') {
      console.error('Pipeline error:', err);
    }
  });
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/info/:videoId', async (req, res) => {
  const { videoId } = req.params;

  if (!validateVideoId(videoId)) {
    return res.status(400).json({ error: 'Invalid video ID' });
  }

  try {
    const info = await getAudioInfo(videoId);
    res.json(info);
  } catch (err) {
    console.error('Info error:', err);
    res.status(500).json({ error: 'Failed to get video info' });
  }
});

app.get('/api/stream/:videoId', (req, res) => {
  const { videoId } = req.params;
  const range = req.headers.range;

  if (!validateVideoId(videoId)) {
    return res.status(400).json({ error: 'Invalid video ID' });
  }

  streamAudio(videoId, res, range);
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ELL MUSIC Stream Backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});