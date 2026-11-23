import './style.css';
import { mountHead } from './head';

const host = document.getElementById('head');
if (host) {
  try {
    mountHead(host);
  } catch {
    // No WebGL: the hero still reads fine without the 3D head.
    host.classList.add('no-webgl');
  }
}
