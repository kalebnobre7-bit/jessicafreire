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
  const { mutate, getDb, analysis } = useData();
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

  // Garante o vídeo na biblioteca e devolve o id da referência (existente ou nova)
  const ensureVideoReference = useCallback((videoId: string): string | null => {
    const existing = getDb().references.find((reference) => reference.videoId === videoId);
    if (existing) return existing.id;
    const video = analysis?.videoById.get(videoId);
    if (!video) return null;
    const id = createId();
    mutate((db) => {
      db.references.unshift({ id, kind: 'video', url: `https://www.youtube.com/watch?v=${videoId}`, videoId, image: null, title: video.title, channel: video.channelTitle, note: '', tags: [], savedAt: Date.now() });
    });
    return id;
  }, [analysis, getDb, mutate]);

  const saveReference = useCallback((videoId: string) => {
    const existed = getDb().references.some((reference) => reference.videoId === videoId);
    ensureVideoReference(videoId);
    toast(existed ? 'Esse vídeo já está na Biblioteca.' : 'Salvo na Biblioteca.');
  }, [ensureVideoReference, getDb, toast]);

  return { createPauta: createPautaAndOpen, createReport, saveReference, ensureVideoReference };
}
