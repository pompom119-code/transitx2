import { AnimatePresence } from 'framer-motion'
import React, { useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Toast } from './components/Ui'
import { AiHomePage, HomePage, LoadingPage, SetupDonePage, SetupPage, TripFormPage } from './pages/HomeAiPages'
import { LoginPage, ProfilePage, SettingsPage, WanderPage } from './pages/OtherPages'
import { EditTripPage, ItineraryPage, MapPage } from './pages/TripPages'
import { BusRoutePage, StopPage, TrafficPage, TrafficSearchPage } from './pages/TransitPages'

const pageTitles = {
  '/': '首頁', '/ai': '智慧旅遊', '/ai/new': '建立旅程', '/ai/loading': '規劃行程中',
  '/ai/setup-complete': '旅行設定完成', '/traffic': '交通', '/traffic/search': '交通搜尋',
  '/wander': '亂晃', '/wander/result': '亂晃結果', '/me': '我的', '/settings': '設定', '/login': '登入／註冊',
}

function App() {
  const location = useLocation()
  const timeout = useRef(null)
  const [toast, setToast] = useState('')
  const notify = (message) => {
    window.clearTimeout(timeout.current); setToast(message); timeout.current = window.setTimeout(() => setToast(''), 2200)
  }
  useEffect(() => {
    const title = location.pathname.startsWith('/ai/setup/') ? `旅行設定 ${location.pathname.split('/').pop()}/8`
      : location.pathname.startsWith('/traffic/routes/') ? '公車路線'
        : location.pathname.startsWith('/traffic/stops/') ? '站牌即時到站'
          : location.pathname.includes('/edit') ? '編輯行程'
            : location.pathname.includes('/map') ? '旅程地圖'
              : location.pathname.startsWith('/trips/') ? '旅程時間軸'
                : pageTitles[location.pathname] || 'TransitX 2.0'
    document.title = `${title} · TransitX 2.0`
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [location.pathname])
  return <main className="app-stage">
    <AnimatePresence mode="wait"><Routes location={location} key={`${location.pathname}${location.search}`}>
      <Route path="/" element={<HomePage />} />
      <Route path="/ai" element={<AiHomePage notify={notify} />} />
      <Route path="/ai/setup/:step" element={<SetupPage />} />
      <Route path="/ai/setup-complete" element={<SetupDonePage />} />
      <Route path="/ai/new" element={<TripFormPage />} />
      <Route path="/ai/loading" element={<LoadingPage />} />
      <Route path="/trips/:tripId" element={<ItineraryPage notify={notify} />} />
      <Route path="/trips/:tripId/map" element={<MapPage notify={notify} />} />
      <Route path="/trips/:tripId/edit" element={<EditTripPage notify={notify} />} />
      <Route path="/traffic" element={<TrafficPage />} />
      <Route path="/traffic/search" element={<TrafficSearchPage />} />
      <Route path="/traffic/routes/:routeId" element={<BusRoutePage notify={notify} />} />
      <Route path="/traffic/stops/:stopId" element={<StopPage notify={notify} />} />
      <Route path="/wander" element={<WanderPage notify={notify} />} />
      <Route path="/wander/result" element={<WanderPage notify={notify} result />} />
      <Route path="/me" element={<ProfilePage />} />
      <Route path="/settings" element={<SettingsPage notify={notify} />} />
      <Route path="/login" element={<LoginPage notify={notify} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></AnimatePresence>
    <Toast message={toast} />
  </main>
}

export default App
