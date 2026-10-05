import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({plugins:[react()],base:'/school-orders/',build:{outDir:'dist-school',emptyOutDir:true,rollupOptions:{input:path.resolve(__dirname,'school-index.html')}}});
