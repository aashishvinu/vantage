import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        host: true,     // ← allows access from outside (LAN or Ngrok)
        port: 5173      // ← you can change this if needed
    }
})
