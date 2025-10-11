import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { BrowserRouter, Route, Routes } from 'react-router'
import LessRender from './components/less-render/index.tsx'
import Expensive from './components/less-render/Expensive.tsx'
import ContextTheme from './components/context-theme/index.tsx'
import ZodForm from './components/zod-form/index.tsx'
import Waterfall from './components/waterfall/index.tsx'

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />}>
        <Route path="context-theme" element={<ContextTheme />} />
        <Route path="less-render" element={<LessRender />} />
        <Route path="less-render/expensive" element={<Expensive />} />
        <Route path="zod-form" element={<ZodForm />} />
        <Route path="waterfall" element={<Waterfall />} />
      </Route>
    </Routes>
  </BrowserRouter>
)
