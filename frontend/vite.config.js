import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Cross-Origin-Opener-Policy: Google Identity Services signs people in via a
// popup that posts the credential back to this window with
// window.postMessage. The default 'same-origin' COOP (which some hosts set,
// and which recent Chrome versions warn about even without an explicit
// header) blocks that postMessage. 'same-origin-allow-popups' keeps the
// isolation benefits for same-origin content while still letting a popup
// you opened talk back to you — which is exactly what Google's sign-in
// button needs.
const coopHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    headers: coopHeaders,
  },
  preview: {
    headers: coopHeaders,
  },
})
