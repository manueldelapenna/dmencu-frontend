// dmencu-frontend/tsup.config.ts

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true, // Generar archivos .d.ts
  clean: true,
  splitting: true,
  sourcemap: true,
  external: ['react', 'react-dom', 'redux-persist', 'react-router-dom', 'frontend-plus-react', 'localforage'],
  // 🎯 Solución al error: Configurar la extensión de salida explícitamente
  outExtension({ format }) {
    if (format === 'esm') {
      return { js: '.mjs' };
    }
    if (format === 'cjs') {
      return { js: '.cjs' };
    }
    return { js: '.js' }; // Para cualquier otro formato (aunque no lo uses)
  },
});