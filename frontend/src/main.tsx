import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import './i18n' // i18n 초기화 로드
import App from './App.tsx'
import SharedTrip from './pages/SharedTrip.tsx'

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/share/:token" element={<SharedTrip />} />
    </Routes>
  </BrowserRouter>,
)
