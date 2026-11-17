import type { FaceShapeLabel } from '@/services/faceLandmark/types';

export type HairTypeId = 'lurus' | 'ikal' | 'mengembang' | 'kaku' | 'kribo';

export type PreferenceId = 'formal' | 'natural' | 'low-maintenance' | 'trendy';

/** Alias agar layar tidak perlu mengimpor tipe dari folder service. */
export type FaceShape = FaceShapeLabel;

export interface SelectOption<T extends string> {
  id: T;
  label: string;
  hint: string;
}

export const HAIR_TYPE_OPTIONS: SelectOption<HairTypeId>[] = [
  { id: 'lurus', label: 'Lurus', hint: 'Jatuh lurus dan cenderung licin.' },
  { id: 'ikal', label: 'Ikal', hint: 'Gelombang longgar, mudah diberi volume.' },
  { id: 'mengembang', label: 'Mengembang', hint: 'Volume besar, cepat terlihat tebal.' },
  { id: 'kaku', label: 'Kaku / Jigrak', hint: 'Serat keras dan berdiri sendiri.' },
  { id: 'kribo', label: 'Kribo', hint: 'Keriting rapat dengan tekstur padat.' },
];

export const PREFERENCE_OPTIONS: SelectOption<PreferenceId>[] = [
  { id: 'formal', label: 'Rapi & Formal', hint: 'Aman untuk kantor dan acara resmi.' },
  { id: 'natural', label: 'Kasual & Natural', hint: 'Santai, tidak terlihat terlalu dirapikan.' },
  { id: 'low-maintenance', label: 'Pendek Praktis', hint: 'Bangun tidur langsung beres.' },
  { id: 'trendy', label: 'Trendy / Kekinian', hint: 'Fresh dan mengikuti tren barbershop.' },
];

export function getHairTypeLabel(id: HairTypeId): string {
  return HAIR_TYPE_OPTIONS.find((option) => option.id === id)?.label ?? 'Tidak diketahui';
}

export function getPreferenceLabel(id: PreferenceId): string {
  return PREFERENCE_OPTIONS.find((option) => option.id === id)?.label ?? 'Tidak diketahui';
}
