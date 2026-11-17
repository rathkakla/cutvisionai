#!/usr/bin/env node
/**
 * Mock server untuk menguji CutVision AI tanpa memakai kuota DeepSeek/Fal.ai.
 *
 * Menyediakan dua API:
 *   POST /chat/completions   → tiruan DeepSeek Chat Completions
 *   ANY  /fal-api            → tiruan antrean Fal.ai (lewat EXPO_PUBLIC_FAL_PROXY_URL)
 *
 * Endpoint kontrol (buka di browser atau curl):
 *   GET /health              → status & jumlah request
 *   GET /set?mode=ok|fail|slow|invalid   → atur mode DeepSeek
 *   GET /fal/set?mode=ok|fail|slow|invalid → atur mode Fal
 *   GET /last                → payload DeepSeek terakhir (ringkas)
 *   GET /fal/last            → payload Fal terakhir (ringkas)
 *
 * Jalankan: `npm run mock:ai` (default port 8787, ubah dengan env PORT).
 */

const http = require('http');
const zlib = require('zlib');

const PORT = Number(process.env.PORT || 8787);
const FAL_PROXY_PATH = (process.env.FAL_PROXY_PATH || '/fal-api').replace(/\/+$/, '');
const IMAGE_WIDTH = 480;
const IMAGE_HEIGHT = 600;

const RECOMMENDATIONS = [
  {
    namaGaya: 'Textured French Crop',
    alasanCocok:
      'Potongan ini menambah tinggi di atas tanpa melebarkan sisi wajah, jadi proporsinya lebih seimbang. Karena rambutmu kaku, seratnya justru dipakai sebagai tekstur alami, bukan dipaksa jatuh rata. Perawatannya juga cuma butuh clay sebentar di pagi hari.',
    panduanBarber:
      'Samping dan belakang taper fade #1 ke #2, jangan naik terlalu tinggi. Atas sisakan 4-5 cm dengan point cutting dan layer ringan di mahkota. Bagian depan 3 cm, dibuat sedikit bergerigi. Finishing garis leher dengan razor, jangan terlalu melengkung.',
    promptVisual:
      'Photorealistic portrait of the same man with a textured French crop haircut, short tapered sides, 4 cm textured fringe, natural matte finish, preserved facial identity, soft studio lighting, three-quarter view, 85mm lens.',
  },
  {
    namaGaya: 'Short Taper dengan Tekstur',
    alasanCocok:
      'Bagian atas yang pendek membuat rambut kaku tidak berdiri seperti sikat. Sisi yang di-taper menjaga wajah tetap terlihat rapi tanpa menambah lebar. Cocok banget kalau kamu ingin bangun tidur langsung beres.',
    panduanBarber:
      'Gunakan clipper guard #2 di samping dengan taper fade dari #0.5 di bawah. Atas 3 cm, teksturkan dengan thinning shear 20 persen. Bagian depan dibuat rata namun tidak kaku, lalu rapikan sideburn lurus.',
    promptVisual:
      'Photorealistic portrait of the same man with a short tapered haircut, 3 cm textured top, clean taper fade sides, natural finish, preserved facial features, soft studio light, three-quarter angle.',
  },
  {
    namaGaya: 'Modern Side Part Rendah',
    alasanCocok:
      'Belahan rendah memberi arah yang jelas tanpa memaksa rambut kaku jatuh sempurna. Volume kecil di atas membantu wajah terlihat lebih panjang. Untuk tampilan formal, ini masih bisa disisir rapi dengan pomade ringan.',
    panduanBarber:
      'Samping taper fade #1 ke #2, garis belahan dibuat 2 cm dari tengah. Atas sisakan 5 cm agar masih bisa disisir miring. Keringkan ke arah belakang sebelum styling, lalu tambahkan layer tipis agar tidak terlalu kaku. Finishing dengan pomade water-based.',
    promptVisual:
      'Photorealistic portrait of the same man with a modern low side part haircut, 5 cm top, tapered sides, neatly combed with light pomade, preserved facial identity, editorial studio lighting, three-quarter view.',
  },
];

const MODES = new Set(['ok', 'fail', 'slow', 'invalid', 'locked', 'unauthorized']);

const state = {
  deepseekMode: 'ok',
  deepseekCount: 0,
  lastDeepseek: null,
  falMode: 'ok',
  falSubmitCount: 0,
  falStatusCount: 0,
  falRequestCount: 0,
  lastFal: null,
};

/* ---------------------------------- PNG ---------------------------------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

/** Membuat PNG gradasi sederhana sebagai "hasil render" tiruan. */
function createMockImage(variant) {
  const tint = [
    [217, 130, 43],
    [120, 170, 210],
    [170, 140, 210],
  ][variant % 3];

  const raw = Buffer.alloc((IMAGE_WIDTH * 3 + 1) * IMAGE_HEIGHT);
  let offset = 0;

  for (let y = 0; y < IMAGE_HEIGHT; y += 1) {
    raw[offset] = 0; // filter type: none
    offset += 1;

    for (let x = 0; x < IMAGE_WIDTH; x += 1) {
      const t = y / IMAGE_HEIGHT;
      const dx = (x - IMAGE_WIDTH / 2) / (IMAGE_WIDTH * 0.3);
      const dy = (y - IMAGE_HEIGHT * 0.44) / (IMAGE_HEIGHT * 0.32);
      const inHead = dx * dx + dy * dy <= 1;

      const base = inHead ? 0.55 : 0.16;
      const shade = base + t * 0.25;

      raw[offset] = Math.round(tint[0] * shade + 26 * (1 - shade));
      raw[offset + 1] = Math.round(tint[1] * shade + 26 * (1 - shade));
      raw[offset + 2] = Math.round(tint[2] * shade + 26 * (1 - shade));
      offset += 3;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(IMAGE_WIDTH, 0);
  header.writeUInt32BE(IMAGE_HEIGHT, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // color type: truecolor
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const MOCK_IMAGES = [createMockImage(0), createMockImage(1), createMockImage(2)];

/* --------------------------------- helper -------------------------------- */

function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Headers',
    req.headers['access-control-request-headers'] || 'authorization, content-type',
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '600');
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

function summarizeDeepSeek(body) {
  try {
    const parsed = JSON.parse(body);
    const user = (parsed.messages || []).find((message) => message.role === 'user');
    return {
      model: parsed.model,
      responseFormat: parsed.response_format,
      maxTokens: parsed.max_tokens,
      userPrompt: String(user?.content ?? '').slice(0, 400),
    };
  } catch {
    return { parseError: true, raw: body.slice(0, 200) };
  }
}

function summarizeFal(body) {
  try {
    const parsed = JSON.parse(body);
    const image = typeof parsed.image_url === 'string' ? parsed.image_url : '';
    return {
      promptPreview: String(parsed.prompt ?? '').slice(0, 180),
      promptLength: String(parsed.prompt ?? '').length,
      aspectRatio: parsed.aspect_ratio,
      syncMode: parsed.sync_mode,
      outputFormat: parsed.output_format,
      numImages: parsed.num_images,
      hasDataUri: image.startsWith('data:image/'),
      imageBytes: image.length,
    };
  } catch {
    return { parseError: true, raw: body.slice(0, 200) };
  }
}

/* -------------------------------- DeepSeek ------------------------------- */

async function handleDeepSeek(req, res) {
  const raw = await readBody(req);
  state.deepseekCount += 1;
  state.lastDeepseek = summarizeDeepSeek(raw);

  if (state.deepseekMode === 'slow') {
    await delay(4000);
  }

  if (state.deepseekMode === 'fail') {
    json(res, 500, { error: { message: 'mock DeepSeek 500: kuota habis' } });
    return;
  }

  // Meniru key yang salah/tidak valid.
  if (state.deepseekMode === 'unauthorized') {
    json(res, 401, {
      error: {
        message: 'Authentication Fails, Your api key is invalid',
        type: 'authentication_error',
        code: 'invalid_request_error',
      },
    });
    return;
  }

  if (state.deepseekMode === 'invalid') {
    json(res, 200, {
      id: `mock-${state.deepseekCount}`,
      object: 'chat.completion',
      model: 'deepseek-chat',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'Maaf, ini bukan JSON sama sekali.' },
          finish_reason: 'stop',
        },
      ],
    });
    return;
  }

  const userContent = String(state.lastDeepseek?.userPrompt ?? '');
  const shapeMatch = userContent.match(/"bentukWajah"\s*:\s*"([^"]+)"/);

  json(res, 200, {
    id: `mock-${state.deepseekCount}`,
    object: 'chat.completion',
    model: 'deepseek-chat',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: JSON.stringify({
            bentukWajah: shapeMatch ? shapeMatch[1] : 'Oval',
            rekomendasi: RECOMMENDATIONS,
          }),
        },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 1200, completion_tokens: 800, total_tokens: 2000 },
  });
}

/* ---------------------------------- Fal ---------------------------------- */

async function handleFal(req, res) {
  const raw = req.method === 'POST' ? await readBody(req) : '';
  const target = String(req.headers['x-fal-target-url'] || '');
  const targetUrl = target ? new URL(target) : null;
  const targetPath = targetUrl?.pathname ?? '';

  // Submit: POST .../fal-ai/flux-pro/kontext
  if (req.method === 'POST') {
    state.falSubmitCount += 1;
    state.lastFal = summarizeFal(raw);

    if (state.falMode === 'fail') {
      json(res, 500, { detail: 'mock Fal 500: model gagal dijalankan' });
      return;
    }

    // Meniru Fal asli saat saldo habis: 403 + detail "User is locked".
    if (state.falMode === 'locked') {
      json(res, 403, {
        detail: 'User is locked. Reason: Exhausted balance. Top up your balance at fal.ai/dashboard/billing.',
      });
      return;
    }

    state.falRequestCount += 1;
    state.falStatusCount = 0;

    json(res, 200, {
      request_id: `mock-${state.falRequestCount}`,
      status: 'IN_QUEUE',
      response_url: `${target}`,
      status_url: `${target}/requests/mock-${state.falRequestCount}/status`,
    });
    return;
  }

  // Status: GET .../requests/:id/status
  if (targetPath.endsWith('/status')) {
    state.falStatusCount += 1;
    const stillRunning = state.falMode === 'slow' && state.falStatusCount <= 2;

    json(res, 200, {
      status: stillRunning ? 'IN_PROGRESS' : 'COMPLETED',
      request_id: `mock-${state.falRequestCount}`,
    });
    return;
  }

  // Result: GET .../requests/:id
  if (/\/requests\/[^/]+$/.test(targetPath)) {
    if (state.falMode === 'invalid') {
      json(res, 200, { images: [], prompt: '', seed: 0, has_nsfw_concepts: [] });
      return;
    }

    const image = MOCK_IMAGES[(state.falRequestCount - 1) % MOCK_IMAGES.length];

    json(res, 200, {
      images: [
        {
          url: `data:image/png;base64,${image.toString('base64')}`,
          width: IMAGE_WIDTH,
          height: IMAGE_HEIGHT,
          content_type: 'image/png',
        },
      ],
      prompt: state.lastFal?.promptPreview ?? '',
      seed: 42,
      has_nsfw_concepts: [false],
      timings: null,
    });
    return;
  }

  json(res, 404, { detail: `Mock tidak mengenali request ${req.method} ${targetPath}` });
}

/* --------------------------------- Server -------------------------------- */

const server = http.createServer(async (req, res) => {
  cors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    json(res, 200, {
      ok: true,
      deepseekMode: state.deepseekMode,
      deepseekCount: state.deepseekCount,
      falMode: state.falMode,
      falSubmitCount: state.falSubmitCount,
      falProxyPath: FAL_PROXY_PATH,
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/set') {
    const mode = url.searchParams.get('mode') || 'ok';
    state.deepseekMode = MODES.has(mode) ? mode : 'ok';
    json(res, 200, { mode: state.deepseekMode });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/fal/set') {
    const mode = url.searchParams.get('mode') || 'ok';
    state.falMode = MODES.has(mode) ? mode : 'ok';
    state.falStatusCount = 0;
    json(res, 200, { mode: state.falMode });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/last') {
    json(res, 200, {
      mode: state.deepseekMode,
      requestCount: state.deepseekCount,
      lastBody: state.lastDeepseek,
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/fal/last') {
    json(res, 200, {
      mode: state.falMode,
      submitCount: state.falSubmitCount,
      lastInput: state.lastFal,
    });
    return;
  }

  if (url.pathname === `${FAL_PROXY_PATH}` || url.pathname.startsWith(`${FAL_PROXY_PATH}/`)) {
    await handleFal(req, res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/chat/completions') {
    await handleDeepSeek(req, res);
    return;
  }

  json(res, 404, { error: { message: `Rute ${req.method} ${url.pathname} tidak ada di mock.` } });
});

server.listen(PORT, () => {
  console.log(`Mock AI siap di http://localhost:${PORT}`);
  console.log(`  DeepSeek : http://localhost:${PORT}/chat/completions`);
  console.log(`  Fal proxy: http://localhost:${PORT}${FAL_PROXY_PATH}`);
  console.log(`  Kesehatan: http://localhost:${PORT}/health`);
});
