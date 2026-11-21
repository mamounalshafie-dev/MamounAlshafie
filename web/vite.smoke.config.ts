import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
  build: {
    outDir: 'dist-smoke',
    emptyOutDir: true,
    minify: false,
    cssCodeSplit: false,
    lib: { entry: 'src/main.tsx', formats: ['iife'], name: 'NoorApp', fileName: () => 'app.js' },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
