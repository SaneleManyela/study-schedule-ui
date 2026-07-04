import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/academic-truth-engine-ui/' : '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  // Pre-bundle all heavy dependencies upfront so Vite never has to
  // re-optimise mid-session (which forces a full page reload).
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router',
      '@emotion/react',
      '@emotion/styled',
      '@mui/material',
      '@mui/icons-material',
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-collapsible',
      '@radix-ui/react-context-menu',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-hover-card',
      '@radix-ui/react-label',
      '@radix-ui/react-menubar',
      '@radix-ui/react-navigation-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-progress',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-slot',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toggle',
      '@radix-ui/react-toggle-group',
      '@radix-ui/react-tooltip',
      '@tiptap/react',
      '@tiptap/starter-kit',
      'recharts',
      'react-hook-form',
      'react-dnd',
      'react-dnd-html5-backend',
      'motion',
      'lucide-react',
      'sonner',
      'date-fns',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',
      'cmdk',
      'vaul',
      'embla-carousel-react',
    ],
  },

  server: {
    // Forward /api/* to the FastAPI backend in development so all API calls
    // (including the /api/proxy iframe src) use a relative URL and are
    // same-origin with the frontend. This avoids mixed-content blocks when
    // the frontend is served over HTTPS in production.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
    watch: {
      // Exclude backend secrets and Python files from Vite's file watcher
      ignored: ['**/backend/**', '**/*.json', '**/.venv/**'],
    },
  },
})
