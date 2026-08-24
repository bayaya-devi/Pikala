import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('sitepikala');
const html = await readFile(resolve(root, 'index.html'), 'utf8');
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
assert(ids.length === new Set(ids).size, 'Les identifiants HTML doivent être uniques.');
assert((html.match(/<h1\b/g) || []).length === 1, 'La homepage doit contenir exactement un H1.');
assert(!/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*?<button\b/i.test(html), 'Aucun bouton ne doit être imbriqué dans un lien.');
assert(!/data-count=|>\s*(18|124)\s*</.test(html), 'Aucune statistique statique historique ne doit subsister.');

for (const match of html.matchAll(/<img\b([^>]+)>/g)) {
  const attributes = match[1];
  assert(/\bwidth="\d+"/.test(attributes) && /\bheight="\d+"/.test(attributes), 'Chaque image doit réserver ses dimensions.');
  assert(/\balt="[^"]+"/.test(attributes), 'Chaque image de contenu doit avoir un texte alternatif.');
}

const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
for (const href of hrefs) {
  if (href.startsWith('#')) assert(ids.includes(href.slice(1)), `Ancre introuvable : ${href}`);
  if (!href.startsWith('#') && !href.startsWith('http') && !href.startsWith('mailto:') && href.endsWith('.html')) {
    try { await readFile(resolve(root, href), 'utf8'); } catch { failures.push(`Route locale introuvable : ${href}`); }
  }
}

const requiredCtas = ['inscription.html', 'connexion.html', '#stations', '#fonctionnement', '#tarifs', '#aide'];
requiredCtas.forEach((href) => assert(hrefs.includes(href), `CTA ou navigation manquant : ${href}`));

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
console.log(`Homepage valide : ${new Set(hrefs).size} destinations vérifiées, ${ids.length} ancres uniques.`);
