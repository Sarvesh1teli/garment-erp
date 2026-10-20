import { defineConfig } from 'vite';
import path from 'path';
export default defineConfig({publicDir:false,build:{outDir:'dist-school',emptyOutDir:false,lib:{entry:path.resolve(__dirname,'src/school-push-worker.ts'),name:'SchoolOrderPush',formats:['iife'],fileName:()=> 'firebase-messaging-sw.js'}}});
