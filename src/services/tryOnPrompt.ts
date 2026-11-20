/** Rasio yang didukung model image, dipakai agar framing hasil sama dengan foto asli. */
export type TryOnAspectRatio =
  | '21:9'
  | '16:9'
  | '4:3'
  | '3:2'
  | '1:1'
  | '2:3'
  | '3:4'
  | '9:16'
  | '9:21';

const ASPECT_RATIOS: { label: TryOnAspectRatio; value: number }[] = [
  { label: '21:9', value: 21 / 9 },
  { label: '16:9', value: 16 / 9 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:2', value: 3 / 2 },
  { label: '1:1', value: 1 },
  { label: '2:3', value: 2 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '9:16', value: 9 / 16 },
  { label: '9:21', value: 9 / 21 },
];

/** Rasio yang benar-benar diterima Gemini image; 9:21/21:9 diganti tetangga terdekat. */
const GEMINI_ASPECT_RATIOS: TryOnAspectRatio[] = [
  '1:1',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '9:16',
  '16:9',
];

/** Pilih rasio terdekat supaya model tidak mengubah framing foto pengguna. */
export function pickTryOnAspectRatio(width: number, height: number): TryOnAspectRatio | undefined {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }

  const target = width / height;
  let closest = ASPECT_RATIOS[0];

  for (const ratio of ASPECT_RATIOS) {
    if (
      Math.abs(Math.log(ratio.value) - Math.log(target)) <
      Math.abs(Math.log(closest.value) - Math.log(target))
    ) {
      closest = ratio;
    }
  }

  return closest.label;
}

/** Versi aman untuk Gemini: hanya rasio yang didukung modelnya. */
export function pickGeminiAspectRatio(
  width: number,
  height: number,
): TryOnAspectRatio | undefined {
  const picked = pickTryOnAspectRatio(width, height);
  if (!picked) {
    return undefined;
  }
  if (GEMINI_ASPECT_RATIOS.includes(picked)) {
    return picked;
  }

  const target = width / height;
  return GEMINI_ASPECT_RATIOS.reduce((best, candidate) => {
    const [bw, bh] = best.split(':').map(Number);
    const [cw, ch] = candidate.split(':').map(Number);
    const bestDelta = Math.abs(Math.log(bw / bh) - Math.log(target));
    const candidateDelta = Math.abs(Math.log(cw / ch) - Math.log(target));
    return candidateDelta < bestDelta ? candidate : best;
  }, GEMINI_ASPECT_RATIOS[0]);
}

/**
 * Prompt try-on dipakai bersama oleh Gemini dan Fal, supaya hasil kedua penyedia
 * sama-sama mengunci identitas wajah dan latar belakang foto asli.
 */
export function buildTryOnPrompt(namaGaya: string, promptVisual: string): string {
  return [
    'Edit the provided photo. Replace ONLY the hairstyle; everything else must stay identical.',
    '',
    `Target hairstyle: ${namaGaya}.`,
    promptVisual.trim(),
    '',
    'Hard requirements:',
    '- Keep the exact same person: identical face shape, facial features, eyes, nose, mouth, jawline, facial hair, expression, skin tone, age, and gender.',
    '- Keep the exact same background, clothing, head pose, camera angle, framing, and lighting as the input photo. Ignore any conflicting camera or lighting suggestion above.',
    '- Change only the hair: match the target length, silhouette, texture, and direction. Keep a natural hairline, realistic strands, and believable shadows.',
    '- The result must look photorealistic and unstyled, like a real photo of this same person with the new haircut.',
    '- Do not add text, watermarks, accessories, extra people, or a different environment.',
  ].join('\n');
}
