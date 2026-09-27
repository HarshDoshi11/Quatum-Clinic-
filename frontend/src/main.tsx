import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from '@/App'
import { DatasetProvider } from '@/state/dataset'
import { ThemeProvider } from '@/state/theme'
import '@/styles/index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root not found')

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <DatasetProvider>
          <App />
        </DatasetProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
