import { Route, Routes } from 'react-router-dom'
import { NavBar } from './components/NavBar'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Dashboard } from './pages/Dashboard'
import { History } from './pages/History'
import { Login } from './pages/Login'
import { LogFromMenu } from './pages/LogFromMenu'
import { PhotoLog } from './pages/PhotoLog'
import { Settings } from './pages/Settings'

function App() {
  return (
    <div className="min-h-screen bg-gray-950">
      <NavBar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/log/menu"
          element={
            <ProtectedRoute>
              <LogFromMenu />
            </ProtectedRoute>
          }
        />
        <Route
          path="/log/photo"
          element={
            <ProtectedRoute>
              <PhotoLog />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <History />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  )
}

export default App
