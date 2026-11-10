import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

// HTTPS local : cherche un certificat mkcert dans ./certs ou ./certificates
function localHttps() {
  for (const name of ['certs', 'certificates']) {
    const dir = path.resolve(name);
    if (!fs.existsSync(dir)) continue;
    const key = fs.readdirSync(dir).find((f) => f.endsWith('-key.pem'));
    if (!key) continue;
    const cert = key.replace('-key.pem', '.pem');
    if (fs.existsSync(path.join(dir, cert))) {
      return { key: fs.readFileSync(path.join(dir, key)), cert: fs.readFileSync(path.join(dir, cert)) };
    }
  }
  return undefined;
}

export default defineConfig({
  server: { https: localHttps(), host: true },
  build: { target: 'esnext' },
});