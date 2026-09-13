import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@fontsource/oxanium/400.css'
import '@fontsource/oxanium/600.css'
import '@fontsource/oxanium/700.css'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <ThemeProvider>
        <App />          
      </ThemeProvider>
    </HashRouter>
  </StrictMode>,
)
