import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import type { InsightAction } from '@/lib/analytics';
import { useData } from '@/store/data';
import { useUi } from '@/store/ui';
import { useCreate } from './useCreate';

export function useInsightAction() {
  const navigate = useNavigate();
  const { mutate } = useData();
  const { toast } = useUi();
  const { createPauta, saveReference } = useCreate();

  return useCallback((action: InsightAction) => {
    switch (action.type) {
      case 'link-video':
        mutate((db) => {
          const pauta = db.pautas.find((item) => item.id === action.pautaId);
          if (!pauta) return;
          Object.assign(pauta, { stage: 'publicado', videoId: action.videoId, updatedAt: Date.now() });
        });
        toast('Pauta marcada como publicada e ligada ao vídeo.');
        break;
      case 'ignore-match':
        mutate((db) => {
          const pauta = db.pautas.find((item) => item.id === action.pautaId);
          if (pauta) pauta.ignoredVideoIds.push(action.videoId);
        });
        break;
      case 'save-reference':
        saveReference(action.videoId);
        break;
      case 'create-pauta':
        createPauta({ title: `Vídeo sobre ${action.topic}`, tags: [action.topic], notes: `Tema em alta no radar: ${action.topic}` });
        break;
      case 'open-pauta':
        navigate(`/pautas/${action.pautaId}`);
        break;
      case 'open-video':
        navigate(`/videos/${action.videoId}`);
        break;
    }
  }, [createPauta, mutate, navigate, saveReference, toast]);
}
