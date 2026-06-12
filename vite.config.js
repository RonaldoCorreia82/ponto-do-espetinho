import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  server: {
    port: 5173,
    strictPort: false,   // se 5173 estiver ocupado, tenta a próxima automaticamente
  },
  build: {
    rollupOptions: {
      input: {
        main:       resolve(__dirname, 'index.html'),
        fiado:      resolve(__dirname, 'fiado.html'),
        adminLogin: resolve(__dirname, 'admin/login.html'),
        adminPanel: resolve(__dirname, 'admin/index.html'),
        cardapio:   resolve(__dirname, 'cardapio/index.html'),
      },
    },
  },
})
