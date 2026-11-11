import { createHolo } from '../../lib/holo.ts';
import { charizard } from './charizard.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#holo')!;
const q = new URLSearchParams(location.search);

try {
  const holo = await createHolo(canvas, charizard);
  if (q.has('t')) holo.seek(Number(q.get('t')));      // ?t=2 freezes the frame at 2 s
  if (q.has('debug')) Object.assign(window, { holo }); // holo.step(1/60) from the console
} catch (err) {
  document.body.classList.add('failed');
  document.querySelector('#error')!.textContent = String(err instanceof Error ? err.message : err)
    + (String(err).includes('could not load') ? ' (run the cutout first, see README)' : '');
}
