// Ações de criação usadas no botão "Criar", na busca (⌘K) e nas leituras automáticas
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { createId, createPauta } from '@/lib/database';
import { dateKey, shiftDate } from '@/lib/format';
import type { Pauta } from '@/lib/types';
import { useData } from '@/store/data';
import { useUi } from '@/store/ui';

export function useCreate() {
  const navigate = useNavigate();
  const { mutate, analysis } = useData();
  const { toast } = useUi();

  const createPautaAndOpen = useCallback((partial: Partial<Pauta> = {}) => {
    const pauta = createPauta({ title: 'Nova pauta', ...partial });
    mutate((db) => {
      db.pautas.unshift(pauta);
    });
    navigate(`/pautas/${pauta.id}`);
  }, [mutate, navigate]);

  const createReport = useCallback(() => {
    const to = dateKey(Date.now());
    const from = shiftDate(to, -6);
    const now = Date.now();
    const id = createId();
    mutate((db) => {
      db.reports.unshift({ id, title: 'Relatório semanal', from, to, summary: '', wins: '', recommendations: [''], status: 'rascunho', snapshot: null, createdAt: now, updatedAt: now, publishedAt: null });
    });
    navigate(`/relatorios/${id}`);
  }, [mutate, navigate]);

  const saveReference = useCallback((videoId: string) => {
    const video = analysis?.videoById.get(videoId);
    if (!video) return;
    let added = false;
    mutate((db) => {
      if (db.references.some((reference) => reference.videoId === videoId)) return;
      db.references.unshift({ id: createId(), url: `https://www.youtube.com/watch?v=${videoId}`, videoId, title: video.title, channel: video.channelTitle, note: '', savedAt: Date.now() });
      added = true;
    });
    toast(added ? 'Salvo nas referências do Radar.' : 'Esse vídeo já está nas referências.');
  }, [analysis, mutate, toast]);

  return { createPauta: createPautaAndOpen, createReport, saveReference };
}
