// Central de conteúdo: `state` é o banco (db.json no repositório privado), com cópia local pra abrir instantâneo.
// As métricas vêm do metrics.json, gerado pelo GitHub Actions do repositório de dados.
import { GitHubError, getToken, readJson, setToken, startCollection, writeJson } from './github.js';
import { analyzeMetrics, buildInsights, formatAge, formatNumber, formatScore, matchesQuery } from './insights.js';

const STATE_KEY = 'jf-hub:v2';
const METRICS_KEY = 'jf-hub:metrics';
const EMPTY_STATE = { profile: { name: 'Jéssica Freire', handle: '@jessicafreireff' }, activeIdeaId: null, ideas: [], references: [], channels: [] };
const STATUS = { rascunho: { label: 'Rascunho', tag: 'RASCUNHO', className: 'draft' }, roteiro: { label: 'Em roteiro', tag: 'EM ROTEIRO', className: 'ready' }, publicado: { label: 'Publicado', tag: 'PUBLICADO', className: 'published' } };
const STEPS = [
  { label: 'Referência analisada', action: 'analisar a referência' },
  { label: 'Gancho definido', action: 'definir o gancho' },
  { label: 'Produto / oferta separado', action: 'separar produto / oferta' },
  { label: 'Thumb com hipótese clara', action: 'criar a thumb' },
  { label: 'CTA revisado', action: 'revisar o CTA' },
];
const TONES = { blue: 'sand', green: 'mint', red: 'coral', coral: 'coral', purple: 'lavender' };
const SYNC_LABELS = { local: 'Modo local · conectar banco', loading: 'Carregando dados…', saved: 'Sincronizado', pending: 'Alterações pendentes…', saving: 'Salvando…', error: 'Erro ao salvar · tentar de novo', offline: 'Sem conexão com o banco', auth: 'Token sem acesso · reconectar' };
const labels = { inicio: 'PAINEL', ideias: 'CONTEÚDO', copys: 'ROTEIRO DO VÍDEO', referencias: 'INSPIRAÇÕES', concorrentes: 'RADAR DE CANAIS' };

// Link mágico: #conectar=TOKEN salva o token neste navegador e some da barra de endereço
const connectLink = location.hash.match(/^#conectar=(.+)$/);
if (connectLink) {
  setToken(decodeURIComponent(connectLink[1]));
  history.replaceState(null, '', '#inicio');
}

const $ = (selector) => document.querySelector(selector);
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
const sidebar = $('.sidebar');
const toast = $('.toast');
const ideaDialog = $('#ideaDialog');
const referenceDialog = $('#referenceDialog');
const channelDialog = $('#channelDialog');
const searchDialog = $('#searchDialog');
const connectDialog = $('#connectDialog');
const searchInput = $('#searchInput');
const titleInput = $('#ideaTitle');
const noteInput = $('#ideaNote');
const ideasList = $('#ideasList');
const trendingGrid = $('#trendingGrid');
const youtubeGrid = $('#youtubeGrid');
const monitorList = $('#monitorList');
const insightsList = $('#insightsList');
const topicList = $('#topicList');
const checklist = $('#checklist');
const scriptTitle = $('#scriptTitle');
const scriptBrief = $('#scriptBrief');
const syncButton = $('#syncButton');
const refreshButton = $('#refreshMetrics');

function readLocal(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function normalizeState(value) {
  return {
    ...EMPTY_STATE,
    ...value,
    ideas: (value?.ideas ?? []).map((idea) => ({ ...idea, checklist: STEPS.map((_, index) => Boolean(idea.checklist?.[index])) })),
    references: value?.references ?? [],
    channels: value?.channels ?? [],
  };
}

let state = normalizeState(readLocal(STATE_KEY) ?? EMPTY_STATE);
let metrics = readLocal(METRICS_KEY);
let analysis = null;
let currentFilter = 'todas';
const sync = { sha: null, timer: null, saving: false, dirty: false, lastPull: 0 };

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
function createId() { return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`); }
function formatCount(value) { return String(value).padStart(2, '0'); }
function getInitials(name) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'CH'; }
function findIdea(id) { return state.ideas.find((idea) => idea.id === id); }
// "youtube.com/@Canal", "@canal" ou "canal" → "@canal"; IDs "UC..." ficam como estão
function normalizeHandle(input) {
  const text = input.trim();
  const fromUrl = text.match(/youtube\.com\/(?:channel\/(UC[\w-]+)|(@[\w.-]+))/i);
  if (fromUrl) return fromUrl[1] ?? fromUrl[2].toLowerCase();
  return text.startsWith('UC') ? text : `@${text.replace(/^@/, '')}`.toLowerCase();
}
// Próximo vídeo: o selecionado no roteiro (se não publicado), senão o primeiro em roteiro, senão o primeiro rascunho
function getFeaturedIdea() {
  const active = findIdea(state.activeIdeaId);
  if (active && active.status !== 'publicado') return active;
  return state.ideas.find((idea) => idea.status === 'roteiro') ?? state.ideas.find((idea) => idea.status === 'rascunho');
}
function formatUpdated(timestamp) {
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  return minutes < 1 ? 'Atualizado agora' : `Atualizado ${formatAge(new Date(timestamp).toISOString())}`;
}
function channelData(handle) { return analysis?.channels.get(handle.toLowerCase()) ?? null; }
function avatarHtml(className, image, initials, colorClass = '') {
  return image ? `<img class="${className}" src="${escapeHtml(image)}" alt="" loading="lazy" />` : `<span class="${className} ${colorClass}">${escapeHtml(initials)}</span>`;
}

// ───── Sincronização com o banco ─────
function setSync(status) {
  syncButton.dataset.status = status;
  $('#syncText').textContent = SYNC_LABELS[status];
}
function isAuthError(error) { return error instanceof GitHubError && [401, 403, 404].includes(error.status); }

function persist() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
  if (!getToken()) return;
  sync.dirty = true;
  setSync('pending');
  clearTimeout(sync.timer);
  sync.timer = setTimeout(pushState, 1500);
}

async function pushState() {
  clearTimeout(sync.timer);
  if (sync.saving || !sync.dirty || !getToken()) return;
  sync.saving = true;
  sync.dirty = false;
  setSync('saving');
  try {
    sync.sha = await writeJson('db.json', state, sync.sha, 'Atualiza dados pelo painel');
    setSync(sync.dirty ? 'pending' : 'saved');
  } catch (error) {
    if (error instanceof GitHubError && (error.status === 409 || error.status === 422)) {
      // Outro aparelho salvou antes: fica com a versão do banco pra não sobrescrever o trabalho de ninguém
      sync.saving = false;
      await pullState({ force: true });
      showToast('Os dados mudaram em outro aparelho. Carreguei a versão mais recente; refaça sua última alteração.');
      return;
    }
    sync.dirty = true;
    setSync(isAuthError(error) ? 'auth' : 'error');
    return;
  } finally {
    sync.saving = false;
  }
  if (sync.dirty) sync.timer = setTimeout(pushState, 1500);
}

async function flushState() {
  while (sync.saving) await wait(200);
  if (sync.dirty) await pushState();
}

async function pullState({ force = false } = {}) {
  if (!getToken() || (!force && (sync.dirty || sync.saving))) return false;
  sync.lastPull = Date.now();
  try {
    const db = await readJson('db.json');
    // A pessoa editou enquanto a leitura estava em andamento: não sobrescreve a edição local
    if (!force && (sync.dirty || sync.saving)) return false;
    if (force || db.sha !== sync.sha) {
      state = normalizeState(db.value);
      sync.sha = db.sha;
      sync.dirty = false;
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
      renderAll();
      renderScript();
    }
    setSync('saved');
    return true;
  } catch (error) {
    setSync(isAuthError(error) ? 'auth' : 'offline');
    return false;
  }
}

async function pullMetrics() {
  if (!getToken()) return;
  try {
    metrics = (await readJson('metrics.json')).value;
    localStorage.setItem(METRICS_KEY, JSON.stringify(metrics));
    renderAll();
  } catch (error) {
    if (!(error instanceof GitHubError && error.status === 404)) console.warn('Falha ao ler metrics.json', error);
  }
}

async function requestCollection() {
  if (!getToken() || refreshButton.disabled) return;
  refreshButton.disabled = true;
  refreshButton.textContent = 'Coletando…';
  const before = metrics?.updatedAt;
  try {
    await flushState();
    await startCollection();
    for (let attempt = 0; attempt < 16; attempt += 1) {
      await wait(15000);
      await pullMetrics();
      if (metrics?.updatedAt !== before) { showToast('Métricas atualizadas.'); return; }
    }
    showToast('A coleta está demorando. Os dados aparecem quando ela terminar.');
  } catch (error) {
    showToast(isAuthError(error) ? 'O token precisa da permissão Actions (leitura e escrita) pra iniciar a coleta.' : 'Não foi possível iniciar a coleta.');
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = 'Atualizar agora ↻';
  }
}

// ───── Interface ─────
function showTab(id) {
  pages.forEach((page) => page.classList.toggle('active', page.id === id));
  navItems.forEach((item) => item.classList.toggle('active', item.dataset.tab === id));
  $('#crumb').textContent = labels[id];
  sidebar.classList.remove('open');
  history.replaceState(null, '', `#${id}`);
  if (id === 'copys') renderScript();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 3500);
}

function renderAll() {
  analysis = metrics ? analyzeMetrics(metrics, state) : null;
  renderDashboard();
  renderIdeas();
  renderReferences();
  renderChannels();
}

function renderDashboard() {
  const hour = new Date().getHours();
  $('#greeting').textContent = `${hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'}, ${state.profile.name.split(' ')[0]}`;

  const featured = getFeaturedIdea();
  if (featured) {
    const nextStep = STEPS.find((_, index) => !featured.checklist[index]);
    $('#featuredIdea').innerHTML = `<span class="tag coral">${STATUS[featured.status].tag}</span><h2>${escapeHtml(featured.title)}</h2><div><span class="status-dot"></span> ${nextStep ? `Próxima ação: ${nextStep.action}` : 'Checklist completo, pronto para publicar'} <small>${formatUpdated(featured.updatedAt)}</small></div><button class="open-script" type="button" data-open-script="${featured.id}">Abrir roteiro</button>`;
  } else {
    $('#featuredIdea').innerHTML = '<span class="tag coral">VAZIO</span><h2>Nenhum vídeo em produção</h2><div>Crie um vídeo em Conteúdo para ele aparecer aqui.</div>';
  }

  const profile = analysis?.profile;
  const stat = (value, label, detail) => `<article><span>${escapeHtml(value)}</span><p>${escapeHtml(label)}<br />${escapeHtml(detail)}</p></article>`;
  $('#quickStats').innerHTML = profile
    ? stat(profile.subscribers == null ? '—' : formatNumber(profile.subscribers), 'inscritos', profile.subscribersGrowth == null ? `${profile.videoCount ?? '—'} vídeos no canal` : `${profile.subscribersGrowth >= 0 ? '+' : ''}${formatNumber(profile.subscribersGrowth)} em 7 dias`)
      + stat(formatNumber(profile.baseline), 'views por vídeo', 'mediana recente')
      + stat(profile.uploadEveryDays ? `${Math.round(profile.uploadEveryDays)} dias` : '—', 'entre vídeos', 'ritmo de postagem')
    : stat('—', 'inscritos', 'sem métricas ainda') + stat(formatCount(state.ideas.filter((idea) => idea.status !== 'publicado').length), 'pautas', 'em andamento') + stat(formatCount(state.channels.length), 'canais', 'no radar');

  const colors = ['yellow', 'pink', 'blue'];
  $('#watchlistRows').innerHTML = state.channels.length
    ? state.channels.slice(0, 4).map((channel, index) => {
      const data = channelData(channel.handle);
      const detail = data?.subscribers != null ? `${formatNumber(data.subscribers)} inscritos${data.uploadEveryDays ? ` · 1 vídeo a cada ~${Math.round(data.uploadEveryDays)}d` : ''}` : channel.note || channel.handle;
      return `<div class="radar-row">${avatarHtml('initials', data?.avatar, getInitials(channel.name), colors[index % 3])}<div><strong>${escapeHtml(channel.name)}</strong><small>${escapeHtml(detail)}</small></div><b title="Melhor vídeo recente vs mediana do canal">${data?.top ? formatScore(data.top.score) : '—'}</b></div>`;
    }).join('')
    : '<p class="caption">Nenhum canal no radar ainda.</p>';

  refreshButton.hidden = !getToken();
  $('#metricsUpdated').textContent = analysis ? `Coletado ${formatAge(analysis.updatedAt)}` : '';
  if (!getToken()) {
    insightsList.innerHTML = '<div class="insight"><span class="tag coral">CONECTAR</span><p>Conecte o banco de dados para carregar pautas, roteiros e as métricas do YouTube.</p><div class="insight-actions"><button class="text-button" type="button" data-action="connect">Conectar banco →</button></div></div>';
  } else if (!analysis) {
    insightsList.innerHTML = '<p class="caption">As leituras aparecem depois da primeira coleta de métricas. Clique em Atualizar agora.</p>';
  } else {
    const insights = buildInsights(analysis, state);
    insightsList.innerHTML = insights.length ? insights.map((insight) => `<div class="insight"><span class="tag ${TONES[insight.tone]}">${escapeHtml(insight.tag)}</span><p>${escapeHtml(insight.text)}</p>${insight.actions?.length ? `<div class="insight-actions">${insight.actions.map((item) => `<button class="text-button" type="button" data-action="${item.action}" data-idea-id="${escapeHtml(item.ideaId ?? '')}" data-video-id="${escapeHtml(item.videoId ?? '')}" data-term="${escapeHtml(item.term ?? '')}">${escapeHtml(item.label)}</button>`).join('')}</div>` : ''}</div>`).join('') : '<p class="caption">Nada fora do normal por enquanto.</p>';
  }

  topicList.innerHTML = analysis?.topics.length
    ? analysis.topics.map((topic) => `<button type="button" data-query="${escapeHtml(topic.label)}"># ${escapeHtml(topic.label)} <span>${topic.hits} vídeos acima da média</span></button>`).join('')
    : '<p class="caption">Os temas aparecem quando houver métricas dos canais do radar.</p>';
}

function renderIdeas() {
  const visible = state.ideas.filter((idea) => currentFilter === 'todas' || idea.status === currentFilter);
  ideasList.innerHTML = visible.map((idea) => {
    const options = Object.entries(STATUS).map(([value, status]) => `<option value="${value}" ${value === idea.status ? 'selected' : ''}>${status.label}</option>`).join('');
    const video = idea.videoId ? analysis?.videoById.get(idea.videoId) : null;
    const thumb = idea.videoId ? `<span class="content-thumb" style="background-image:linear-gradient(#0003,#0005),url(https://i.ytimg.com/vi/${encodeURIComponent(idea.videoId)}/mqdefault.jpg)">▶</span>` : `<span class="content-thumb ${idea.thumb}">▶</span>`;
    const visibility = video ? `Público · ${formatNumber(video.views)} views` : idea.videoId ? 'Público' : 'Privado';
    return `<article class="idea-row" data-id="${idea.id}"><span class="number">${formatCount(state.ideas.indexOf(idea) + 1)}</span>${thumb}<div><span class="tag ${idea.tagColor}">${escapeHtml(idea.tag)}</span><h3>${escapeHtml(idea.title)}</h3>${idea.note ? `<p>${escapeHtml(idea.note)}</p>` : ''}<button class="open-script" type="button" data-open-script="${idea.id}">Abrir roteiro</button></div><span class="content-visibility">${visibility}</span><select class="content-status ${STATUS[idea.status].className}" data-action="status" aria-label="Status do vídeo">${options}</select><button class="remove-button" type="button" data-action="remove" aria-label="Excluir vídeo">×</button></article>`;
  }).join('');
  $('.empty-ideas').hidden = visible.length > 0;
  document.querySelectorAll('.filter').forEach((button) => {
    const filter = button.dataset.filter;
    button.classList.toggle('selected', filter === currentFilter);
    button.querySelector('b').textContent = formatCount(state.ideas.filter((idea) => filter === 'todas' || idea.status === filter).length);
  });
}

function renderScript() {
  const idea = findIdea(state.activeIdeaId);
  scriptTitle.value = idea?.title ?? '';
  scriptBrief.value = idea?.note ?? '';
  scriptTitle.disabled = !idea;
  scriptBrief.disabled = !idea;
  scriptTitle.placeholder = idea ? 'Título do vídeo' : 'Crie ou escolha um vídeo em Conteúdo';
  checklist.innerHTML = STEPS.map((step, index) => `<label><input type="checkbox" data-step="${index}" ${idea?.checklist[index] ? 'checked' : ''} ${idea ? '' : 'disabled'} /> ${step.label}</label>`).join('');
  updateProgress();
}
function updateProgress() {
  const idea = findIdea(state.activeIdeaId);
  $('#scriptProgress').textContent = `${idea ? idea.checklist.filter(Boolean).length : 0}/${STEPS.length}`;
}

function videoCard({ id, url, videoId, title, channel, details, badge, avatar, button }) {
  const thumb = videoId ? `<img src="https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg" alt="Thumbnail: ${escapeHtml(title)}" loading="lazy" />` : 'LINK SALVO';
  return `<article class="youtube-video" data-id="${escapeHtml(id)}"><a class="youtube-thumb ${videoId ? '' : 'reference-placeholder'}" href="${escapeHtml(url)}" target="_blank" rel="noreferrer" aria-label="Abrir vídeo: ${escapeHtml(title)}">${thumb}<span>${escapeHtml(badge)}</span></a><div class="youtube-meta">${avatar}<div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(channel)}</p><p>${escapeHtml(details)}</p></div>${button}</div></article>`;
}

function renderReferences() {
  const savedIds = new Set(state.references.map((reference) => reference.videoId));
  trendingGrid.innerHTML = analysis?.trending.length
    ? analysis.trending.slice(0, 6).map((video) => videoCard({
      id: video.id,
      url: `https://www.youtube.com/watch?v=${video.id}`,
      videoId: video.id,
      title: video.title,
      channel: video.channelTitle,
      details: `${formatNumber(video.views)} visualizações · ${formatAge(video.published)}`,
      badge: formatScore(video.score),
      avatar: avatarHtml('youtube-avatar', channelData(video.channelHandle)?.avatar, getInitials(video.channelTitle), 'user'),
      button: savedIds.has(video.id) ? '<button class="more-video saved" type="button" aria-label="Já salvo" disabled>✓</button>' : `<button class="more-video" type="button" data-action="save-reference" data-video-id="${escapeHtml(video.id)}" aria-label="Salvar nas referências">＋</button>`,
    })).join('')
    : `<p class="caption">${getToken() ? 'Os vídeos em alta aparecem depois da primeira coleta de métricas.' : 'Conecte o banco para ver os vídeos em alta dos canais do radar.'}</p>`;

  youtubeGrid.innerHTML = state.references.length
    ? state.references.map((reference) => {
      const video = reference.videoId ? analysis?.videoById.get(reference.videoId) : null;
      return videoCard({
        ...reference,
        details: video ? `${formatNumber(video.views)} visualizações · ${formatAge(video.published)}` : reference.details || 'Referência salva',
        badge: video?.score != null ? formatScore(video.score) : reference.badge || 'SALVO',
        avatar: avatarHtml('youtube-avatar', video ? channelData(video.channelHandle)?.avatar : null, reference.initials, reference.avatar),
        button: '<button class="more-video" type="button" data-action="remove" aria-label="Remover referência">×</button>',
      });
    }).join('')
    : '<p class="caption">Nenhuma referência salva. Use o ＋ nos vídeos em alta ou o botão Salvar link.</p>';
}

function renderChannels() {
  monitorList.innerHTML = state.channels.map((channel, index) => {
    const data = channelData(channel.handle);
    const subtitle = [channel.handle, data?.subscribers != null ? `${formatNumber(data.subscribers)} inscritos` : channel.note].filter(Boolean).join(' · ');
    const best = data?.top
      ? `<b><a href="https://www.youtube.com/watch?v=${encodeURIComponent(data.top.id)}" target="_blank" rel="noreferrer">${escapeHtml(data.top.title)}</a></b><small>${formatNumber(data.top.views)} views · ${formatScore(data.top.score)} a mediana · ${formatAge(data.top.published)}</small>`
      : `<b>${data?.error ? 'Erro na coleta' : 'Aguardando coleta'}</b><small>${data?.error ? 'Confira se o @ do canal está certo' : 'Entra na próxima atualização de métricas'}</small>`;
    const rhythm = data?.uploadEveryDays
      ? `<strong>A CADA ~${Math.round(data.uploadEveryDays)} ${Math.round(data.uploadEveryDays) === 1 ? 'DIA' : 'DIAS'}</strong><small>mediana de ${formatNumber(data.baseline)} views</small>`
      : '<strong>NOVO</strong><small>sem dados ainda</small>';
    return `<article data-id="${channel.id}">${avatarHtml(`channel-avatar c${(index % 3) + 1}`, data?.avatar, getInitials(channel.name))}<div><strong>${escapeHtml(channel.name)}</strong><small>${escapeHtml(subtitle)}</small></div><div>${best}</div><div class="performance">${rhythm}</div><button type="button" data-action="remove" aria-label="Remover canal">×</button></article>`;
  }).join('');
}

// Salva (local + banco) e atualiza tudo, exceto o editor de roteiro (evita perder o cursor enquanto a pessoa digita)
function commit() { persist(); renderAll(); }

function openScript(id) {
  state.activeIdeaId = id;
  commit();
  showTab('copys');
  showToast('Pauta carregada no roteiro.');
}
function touchActiveIdea(change) {
  const idea = findIdea(state.activeIdeaId);
  if (!idea) return;
  change(idea);
  idea.updatedAt = Date.now();
  commit();
}
function saveReferenceFromVideo(videoId) {
  const video = analysis?.videoById.get(videoId);
  if (!video) return;
  if (state.references.some((reference) => reference.videoId === videoId)) { showToast('Esse vídeo já está nas suas referências.'); return; }
  state.references.unshift({ id: createId(), url: `https://www.youtube.com/watch?v=${videoId}`, videoId, title: video.title, channel: video.channelTitle, details: '', badge: '', avatar: 'user', initials: getInitials(video.channelTitle) });
  commit();
  showToast('Salvo nas suas referências.');
}
function openConnect() {
  $('#tokenInput').value = '';
  $('#disconnect').hidden = !getToken();
  connectDialog.showModal();
}

// ───── Eventos ─────
navItems.forEach((item) => item.addEventListener('click', () => showTab(item.dataset.tab)));
document.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => showTab(button.dataset.go)));
window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (labels[id]) showTab(id); });
$('.menu-toggle').addEventListener('click', () => sidebar.classList.toggle('open'));
document.addEventListener('click', (event) => {
  if (sidebar.classList.contains('open') && !sidebar.contains(event.target) && !event.target.closest('.menu-toggle')) sidebar.classList.remove('open');
  const openButton = event.target.closest('[data-open-script]');
  if (openButton) openScript(openButton.dataset.openScript);
});
document.querySelectorAll('dialog .close').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));

// Painel
refreshButton.addEventListener('click', requestCollection);
insightsList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, ideaId, videoId, term } = button.dataset;
  const idea = findIdea(ideaId);
  if (action === 'connect') openConnect();
  if (action === 'save-reference') saveReferenceFromVideo(videoId);
  if (action === 'link-video' && idea) {
    Object.assign(idea, { status: 'publicado', videoId, updatedAt: Date.now() });
    commit();
    showToast('Pauta marcada como publicada e ligada ao vídeo.');
  }
  if (action === 'ignore-match' && idea) {
    idea.ignoredVideoIds = [...(idea.ignoredVideoIds ?? []), videoId];
    commit();
  }
  if (action === 'create-idea') {
    ideaDialog.querySelector('form').reset();
    noteInput.value = `Tema em alta no radar: ${term}`;
    ideaDialog.showModal();
  }
});
topicList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-query]');
  if (!button) return;
  searchInput.value = button.dataset.query;
  searchInput.dispatchEvent(new Event('input'));
  searchDialog.showModal();
});

// Conteúdo
document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => { currentFilter = button.dataset.filter; renderIdeas(); }));
ideasList.addEventListener('change', (event) => {
  if (event.target.dataset.action !== 'status') return;
  const idea = findIdea(event.target.closest('.idea-row').dataset.id);
  Object.assign(idea, { status: event.target.value, updatedAt: Date.now() });
  commit();
  showToast(`Status alterado para "${STATUS[idea.status].label}".`);
});
ideasList.addEventListener('click', (event) => {
  if (event.target.dataset.action !== 'remove') return;
  const idea = findIdea(event.target.closest('.idea-row').dataset.id);
  if (!window.confirm(`Excluir "${idea.title}"? O roteiro e o checklist dele também serão apagados.`)) return;
  state.ideas = state.ideas.filter((item) => item !== idea);
  if (state.activeIdeaId === idea.id) state.activeIdeaId = getFeaturedIdea()?.id ?? state.ideas[0]?.id ?? null;
  commit();
  showToast('Vídeo excluído.');
});
document.querySelectorAll('#newIdea, #newIdea2').forEach((button) => button.addEventListener('click', () => ideaDialog.showModal()));
$('#saveIdea').addEventListener('click', (event) => {
  event.preventDefault();
  if (!titleInput.value.trim()) { titleInput.focus(); return; }
  state.ideas.unshift({ id: createId(), title: titleInput.value.trim(), note: noteInput.value.trim(), tag: 'NOVA PAUTA', tagColor: 'coral', thumb: 'thumb-new', status: 'rascunho', checklist: STEPS.map(() => false), updatedAt: Date.now() });
  currentFilter = 'todas';
  commit();
  ideaDialog.querySelector('form').reset();
  ideaDialog.close();
  showTab('ideias');
  showToast('Vídeo criado na biblioteca de conteúdo.');
});

// Roteiro
scriptTitle.addEventListener('input', () => touchActiveIdea((idea) => { idea.title = scriptTitle.value; }));
scriptBrief.addEventListener('input', () => touchActiveIdea((idea) => { idea.note = scriptBrief.value; }));
checklist.addEventListener('change', (event) => {
  const index = Number(event.target.dataset.step);
  touchActiveIdea((idea) => { idea.checklist[index] = event.target.checked; });
  updateProgress();
});
document.querySelectorAll('.copy-button').forEach((button) => button.addEventListener('click', () => {
  const content = button.closest('.copy-card, .outline article').querySelector('blockquote, h3, p').textContent.trim();
  if (!navigator.clipboard) { showToast('Não foi possível copiar neste navegador.'); return; }
  navigator.clipboard.writeText(content).then(() => showToast('Texto copiado para a área de transferência.')).catch(() => showToast('Não foi possível copiar o texto.'));
}));

// Inspirações
$('#saveReference').addEventListener('click', () => referenceDialog.showModal());
referenceDialog.querySelector('form').addEventListener('submit', (event) => {
  event.preventDefault();
  const url = $('#referenceUrl').value.trim();
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) { showToast('Use um link que comece com http ou https.'); return; }
  const videoId = parsed.searchParams.get('v') || url.match(/(?:youtu\.be\/|\/shorts\/)([^?&#/]+)/)?.[1] || '';
  state.references.unshift({ id: createId(), url, videoId, title: $('#referenceTitle').value.trim(), channel: 'Referência manual', details: `Adicionada em ${new Date().toLocaleDateString('pt-BR')}`, badge: 'SALVO', avatar: 'user', initials: 'JF' });
  commit();
  referenceDialog.close();
  referenceDialog.querySelector('form').reset();
  showToast('Referência adicionada à biblioteca.');
});
trendingGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action="save-reference"]');
  if (button) saveReferenceFromVideo(button.dataset.videoId);
});
youtubeGrid.addEventListener('click', (event) => {
  if (event.target.dataset.action !== 'remove') return;
  const id = event.target.closest('.youtube-video').dataset.id;
  state.references = state.references.filter((reference) => reference.id !== id);
  commit();
  showToast('Referência removida da biblioteca.');
});

// Radar de canais
$('#addChannel').addEventListener('click', () => channelDialog.showModal());
channelDialog.querySelector('form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = $('#channelName').value.trim();
  const handle = normalizeHandle($('#channelHandle').value);
  if (!name || handle === '@') return;
  if (state.channels.some((channel) => channel.handle.toLowerCase() === handle.toLowerCase())) { showToast('Esse canal já está no radar.'); return; }
  state.channels.push({ id: createId(), name, handle, note: '' });
  commit();
  channelDialog.close();
  channelDialog.querySelector('form').reset();
  if (!getToken()) { showToast('Canal adicionado ao radar.'); return; }
  showToast('Canal adicionado. Buscando as métricas dele (leva ~1 min)…');
  await requestCollection();
});
monitorList.addEventListener('click', (event) => {
  if (event.target.dataset.action !== 'remove') return;
  const id = event.target.closest('article').dataset.id;
  state.channels = state.channels.filter((channel) => channel.id !== id);
  commit();
  showToast('Canal removido do radar.');
});

// Busca
$('#openSearch').addEventListener('click', () => { searchDialog.showModal(); searchInput.focus(); });
searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim();
  const results = $('#searchResults');
  results.replaceChildren();
  if (!query) return;
  const sources = [
    ...state.ideas.map((idea) => ({ tab: 'ideias', title: idea.title, keywords: idea.tag, detail: 'Ideia de vídeo' })),
    ...state.references.map((reference) => ({ tab: 'referencias', title: reference.title, keywords: reference.channel, detail: `Referência · ${reference.channel}` })),
    ...(analysis?.trending ?? []).map((video) => ({ tab: 'referencias', title: video.title, keywords: video.channelTitle, detail: `Em alta · ${video.channelTitle} · ${formatScore(video.score)}` })),
    ...state.channels.map((channel) => ({ tab: 'concorrentes', title: channel.name, keywords: channel.handle, detail: 'Canal monitorado' })),
  ].filter((item) => matchesQuery(`${item.title} ${item.keywords}`, query));
  if (!sources.length) { results.textContent = 'Nenhum resultado encontrado.'; return; }
  sources.slice(0, 8).forEach((item) => {
    const result = document.createElement('button');
    result.type = 'button';
    result.innerHTML = '<strong></strong><small></small>';
    result.querySelector('strong').textContent = item.title;
    result.querySelector('small').textContent = item.detail;
    result.addEventListener('click', () => { searchDialog.close(); showTab(item.tab); });
    results.append(result);
  });
});
searchDialog.querySelector('form').addEventListener('submit', (event) => { event.preventDefault(); $('#searchResults button')?.click(); });

// Conexão com o banco
syncButton.addEventListener('click', () => {
  if (syncButton.dataset.status === 'error') { sync.dirty = true; pushState(); return; }
  openConnect();
});
connectDialog.querySelector('form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const previousToken = getToken();
  setToken($('#tokenInput').value.trim());
  setSync('loading');
  if (await pullState({ force: true })) {
    connectDialog.close();
    showToast('Banco conectado. Dados carregados do jessicafreire-data.');
    await pullMetrics();
    return;
  }
  setToken(previousToken);
  setSync(previousToken ? 'auth' : 'local');
  showToast('Esse token não tem acesso ao repositório jessicafreire-data.');
});
$('#disconnect').addEventListener('click', () => {
  setToken(null);
  [STATE_KEY, METRICS_KEY].forEach((key) => localStorage.removeItem(key));
  state = normalizeState(EMPTY_STATE);
  metrics = null;
  sync.sha = null;
  setSync('local');
  renderAll();
  renderScript();
  connectDialog.close();
  showToast('Desconectado. Os dados deste navegador foram apagados; o banco continua intacto.');
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { if (sync.dirty) pushState(); return; }
  if (Date.now() - sync.lastPull > 30000) { pullState(); pullMetrics(); }
});
window.addEventListener('beforeunload', (event) => { if (sync.dirty || sync.saving) event.preventDefault(); });

// ───── Inicialização ─────
setSync(getToken() ? 'loading' : 'local');
renderAll();
renderScript();
const initialTab = location.hash.slice(1);
if (labels[initialTab]) showTab(initialTab);
if (getToken()) {
  pullState({ force: true });
  pullMetrics();
}
