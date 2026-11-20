import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { HairTypeId, PreferenceId } from '@/data/hairstyles';
import type { AiRecommendation } from '@/services/geminiService';
import type { FaceAnalysis } from '@/services/faceLandmark/types';

export interface FacePhoto {
  uri: string;
  width: number;
  height: number;
}

interface CutVisionState {
  photo: FacePhoto | null;
  hairType: HairTypeId | null;
  preference: PreferenceId | null;
  analysis: FaceAnalysis | null;
  recommendation: AiRecommendation | null;
}

interface CutVisionContextValue extends CutVisionState {
  setPhoto: (photo: FacePhoto | null) => void;
  setHairType: (hairType: HairTypeId | null) => void;
  setPreference: (preference: PreferenceId | null) => void;
  setAnalysis: (analysis: FaceAnalysis | null) => void;
  setRecommendation: (recommendation: AiRecommendation | null) => void;
  /** Menghapus seluruh data sesi dari memori, termasuk referensi foto wajah. */
  clearSession: () => void;
}

const initialState: CutVisionState = {
  photo: null,
  hairType: null,
  preference: null,
  analysis: null,
  recommendation: null,
};

const CutVisionContext = createContext<CutVisionContextValue | null>(null);

export function CutVisionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CutVisionState>(initialState);

  const setPhoto = useCallback((photo: FacePhoto | null) => {
    setState((current) => {
      // Foto baru membatalkan hasil analisis lama supaya rekomendasi tidak nyangkut
      // ke wajah yang berbeda.
      if (current.photo?.uri === photo?.uri) {
        return { ...current, photo };
      }
      return { ...current, photo, analysis: null, recommendation: null };
    });
  }, []);

  const setHairType = useCallback((hairType: HairTypeId | null) => {
    setState((current) => ({ ...current, hairType }));
  }, []);

  const setPreference = useCallback((preference: PreferenceId | null) => {
    setState((current) => ({ ...current, preference }));
  }, []);

  const setAnalysis = useCallback((analysis: FaceAnalysis | null) => {
    setState((current) => ({ ...current, analysis }));
  }, []);

  const setRecommendation = useCallback((recommendation: AiRecommendation | null) => {
    setState((current) => ({ ...current, recommendation }));
  }, []);

  const clearSession = useCallback(() => {
    // Foto hanya hidup di state React. Tidak ada salinan di AsyncStorage/server,
    // jadi mengosongkan state sudah cukup untuk "menghapus" foto dari sesi.
    setState({ ...initialState });
  }, []);

  const value = useMemo<CutVisionContextValue>(
    () => ({
      ...state,
      setPhoto,
      setHairType,
      setPreference,
      setAnalysis,
      setRecommendation,
      clearSession,
    }),
    [state, setPhoto, setHairType, setPreference, setAnalysis, setRecommendation, clearSession],
  );

  return <CutVisionContext.Provider value={value}>{children}</CutVisionContext.Provider>;
}

export function useCutVision(): CutVisionContextValue {
  const context = useContext(CutVisionContext);
  if (!context) {
    throw new Error('useCutVision harus dipakai di dalam <CutVisionProvider>.');
  }
  return context;
}
