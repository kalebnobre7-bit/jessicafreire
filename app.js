const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
const crumb = document.querySelector('#crumb');
const sidebar = document.querySelector('.sidebar');
const toast = document.querySelector('.toast');
const ideaDialog = document.querySelector('#ideaDialog');
const referenceDialog = document.querySelector('#referenceDialog');
const channelDialog = document.querySelector('#channelDialog');
const searchDialog = document.querySelector('#searchDialog');
const titleInput = document.querySelector('#ideaTitle');
const noteInput = document.querySelector('#ideaNote');
const ideasList = document.querySelector('#ideasList');
const youtubeGrid = document.querySelector('#youtubeGrid');
const monitorList = document.querySelector('#monitorList');
const labels = { inicio: 'PAINEL', ideias: 'CONTEÚDO', copys: 'ROTEIRO DO VÍDEO', referencias: 'INSPIRAÇÕES', concorrentes: 'RADAR DE CANAIS' };

function showTab(id) { pages.forEach((page) => page.classList.toggle('active', page.id === id)); navItems.forEach((item) => item.classList.toggle('active', item.dataset.tab === id)); crumb.textContent = labels[id]; sidebar.classList.remove('open'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function showToast(message) { toast.textContent = message; toast.classList.add('show'); window.setTimeout(() => toast.classList.remove('show'), 2800); }
function bindIdeaSave(button) { button.addEventListener('click', () => { const saved = button.classList.toggle('saved'); button.textContent = saved ? '✓' : '↗'; button.setAttribute('aria-label', saved ? 'Remover ideia salva' : 'Salvar ideia'); showToast(saved ? 'Pauta marcada como salva.' : 'Pauta removida dos salvos.'); }); }
function bindIdeaRow(item) {
  bindIdeaSave(item.querySelector('.save-button'));
  const openButton = document.createElement('button');
  openButton.className = 'open-script';
  openButton.type = 'button';
  openButton.textContent = 'Abrir roteiro';
  openButton.addEventListener('click', () => {
    document.querySelector('#scriptTitle').value = item.querySelector('h3').textContent;
    document.querySelector('#scriptBrief').value = item.querySelector('p').textContent;
    showTab('copys');
    showToast('Pauta carregada no roteiro.');
  });
  item.querySelector('div').append(openButton);
}
function updateEmptyIdeas() { document.querySelector('.empty-ideas').hidden = [...ideasList.querySelectorAll('.idea-row')].some((item) => !item.hidden); }
function createVideoCard({ url, title }) {
  const videoId = new URL(url).searchParams.get('v') || url.match(/youtu\.be\/([^?&#/]+)/)?.[1] || '';
  const card = document.createElement('article'); card.className = 'youtube-video user-reference';
  const link = document.createElement('a'); link.className = 'youtube-thumb'; link.href = url; link.target = '_blank'; link.rel = 'noreferrer'; link.setAttribute('aria-label', `Abrir referência: ${title}`);
  if (videoId) { const image = document.createElement('img'); image.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`; image.alt = `Thumbnail da referência ${title}`; link.append(image); } else { link.classList.add('reference-placeholder'); link.textContent = 'LINK SALVO'; }
  const duration = document.createElement('span'); duration.textContent = 'SALVO'; link.append(duration);
  const meta = document.createElement('div'); meta.className = 'youtube-meta'; meta.innerHTML = '<span class="youtube-avatar user">JF</span><div><h3></h3><p>Referência manual</p><p>Adicionada agora</p></div><button class="more-video" aria-label="Remover referência">×</button>'; meta.querySelector('h3').textContent = title; meta.querySelector('.more-video').addEventListener('click', () => { card.remove(); showToast('Referência removida da biblioteca.'); }); card.append(link, meta); youtubeGrid.prepend(card);
}

navItems.forEach((item) => item.addEventListener('click', () => showTab(item.dataset.tab)));
document.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => showTab(button.dataset.go)));
document.querySelector('.menu-toggle').addEventListener('click', () => sidebar.classList.toggle('open'));
document.querySelectorAll('.copy-button').forEach((button) => button.addEventListener('click', () => { const content = button.closest('.copy-card').querySelector('blockquote, h3').textContent.trim(); navigator.clipboard?.writeText(content).catch(() => {}); showToast('Texto copiado para a área de transferência.'); }));
document.querySelectorAll('#newIdea, #newIdea2').forEach((button) => button.addEventListener('click', () => ideaDialog.showModal()));
document.querySelector('#saveReference').addEventListener('click', () => referenceDialog.showModal());
document.querySelector('#addChannel').addEventListener('click', () => channelDialog.showModal());
document.querySelector('#openSearch').addEventListener('click', () => { searchDialog.showModal(); document.querySelector('#searchInput').focus(); });
document.querySelectorAll('dialog .close').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('.idea-row').forEach(bindIdeaRow);
document.querySelectorAll('.more-video').forEach((button) => button.addEventListener('click', () => { button.classList.toggle('saved'); button.textContent = button.classList.contains('saved') ? '✓' : '⋮'; button.setAttribute('aria-label', button.classList.contains('saved') ? 'Referência salva' : 'Salvar referência'); showToast(button.classList.contains('saved') ? 'Referência salva para análise.' : 'Referência removida dos salvos.'); }));
document.querySelectorAll('.monitor-list article button').forEach((button) => button.addEventListener('click', () => showToast('Canal salvo no radar. A sincronização ainda é manual.')));
document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => { const filter = button.dataset.filter; document.querySelectorAll('.filter').forEach((item) => item.classList.toggle('selected', item === button)); ideasList.querySelectorAll('.idea-row').forEach((item) => { item.hidden = filter !== 'todas' && item.dataset.status !== filter; }); updateEmptyIdeas(); }));

document.querySelector('#saveIdea').addEventListener('click', (event) => { event.preventDefault(); if (!titleInput.value.trim()) { titleInput.focus(); return; } const item = document.createElement('article'); item.className = 'idea-row'; item.dataset.status = 'pesquisar'; item.innerHTML = '<span class="number"></span><span class="content-thumb thumb-new">▶</span><div><span class="tag coral">NOVA PAUTA</span><h3></h3><p></p></div><span class="content-visibility">Privado</span><span class="content-status draft">Rascunho</span><button class="save-button" aria-label="Salvar ideia">↗</button>'; item.querySelector('.number').textContent = String(ideasList.querySelectorAll('.idea-row').length + 1).padStart(2, '0'); item.querySelector('h3').textContent = titleInput.value.trim(); item.querySelector('p').textContent = noteInput.value.trim() || 'Ideia adicionada agora.'; bindIdeaRow(item); ideasList.prepend(item); titleInput.value = ''; noteInput.value = ''; ideaDialog.close(); showTab('ideias'); document.querySelector('[data-filter="todas"]').click(); showToast('Vídeo criado na biblioteca de conteúdo.'); });

referenceDialog.querySelector('form').addEventListener('submit', (event) => { event.preventDefault(); const url = document.querySelector('#referenceUrl').value.trim(); const title = document.querySelector('#referenceTitle').value.trim(); if (!url || !title) return; createVideoCard({ url, title }); referenceDialog.close(); referenceDialog.querySelector('form').reset(); showToast('Referência adicionada à biblioteca.'); });
channelDialog.querySelector('form').addEventListener('submit', (event) => { event.preventDefault(); const name = document.querySelector('#channelName').value.trim(); const handle = document.querySelector('#channelHandle').value.trim(); if (!name || !handle) return; const article = document.createElement('article'); article.innerHTML = '<span class="channel-avatar">CH</span><div><strong></strong><small></small></div><div><b>Aguardando primeira coleta</b><small>Sincronize para buscar vídeos</small></div><div class="performance"><strong>NOVO</strong><small>Canal adicionado agora</small></div><button aria-label="Mais opções">•••</button>'; article.querySelector('strong').textContent = name; article.querySelector('small').textContent = handle; article.querySelector('button').addEventListener('click', () => showToast('Canal salvo no radar. A sincronização ainda é manual.')); monitorList.append(article); channelDialog.close(); channelDialog.querySelector('form').reset(); showToast('Canal adicionado ao radar.'); });
document.querySelector('#searchInput').addEventListener('input', (event) => { const query = event.target.value.trim().toLocaleLowerCase('pt-BR'); const results = document.querySelector('#searchResults'); results.replaceChildren(); if (!query) return; const sources = [...[...document.querySelectorAll('.idea-row')].map((item) => ({ tab: 'ideias', title: item.querySelector('h3').textContent, detail: 'Ideia de vídeo' })), ...[...document.querySelectorAll('.youtube-video')].map((item) => ({ tab: 'referencias', title: item.querySelector('h3').textContent, detail: 'Referência' })), ...[...document.querySelectorAll('.monitor-list article')].map((item) => ({ tab: 'concorrentes', title: item.querySelector('strong').textContent, detail: 'Canal monitorado' }))].filter((item) => `${item.title} ${item.detail}`.toLocaleLowerCase('pt-BR').includes(query)); if (!sources.length) { results.textContent = 'Nenhum resultado encontrado.'; return; } sources.slice(0, 7).forEach((item) => { const result = document.createElement('button'); result.type = 'button'; result.innerHTML = '<strong></strong><small></small>'; result.querySelector('strong').textContent = item.title; result.querySelector('small').textContent = item.detail; result.addEventListener('click', () => { searchDialog.close(); showTab(item.tab); }); results.append(result); }); });
document.querySelectorAll('[data-step]').forEach((step) => step.addEventListener('change', () => { const completed = document.querySelectorAll('[data-step]:checked').length; document.querySelector('#scriptProgress').textContent = `${completed}/5`; }));
