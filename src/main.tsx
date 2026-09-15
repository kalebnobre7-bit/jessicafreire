import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { saveAccess } from './lib/github';
import './index.css';

// Links de acesso: #/?conectar=TOKEN (editor) ou #/r?acesso=TOKEN (só leitura, para a Jéssica).
// O token é salvo neste navegador e sai da barra de endereço antes de o app montar.
const hashQuery = window.location.hash.split('?')[1] ?? '';
const params = new URLSearchParams(hashQuery);
const editorToken = params.get('conectar');
const readerToken = params.get('acesso');
if (editorToken || readerToken) {
  saveAccess(editorToken ?? readerToken, editorToken ? 'editor' : 'leitura');
  localStorage.removeItem('jf:db');
  localStorage.removeItem('jf:metrics');
  window.history.replaceState(null, '', `${window.location.pathname}#${editorToken ? '/' : '/r'}`);
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
