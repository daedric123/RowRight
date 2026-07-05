import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import App from './App'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import CoachDashboard from './pages/CoachDashboard'
import CreateTeam from './pages/CreateTeam'
import LineupsPage from './pages/LineupsPage'
import LineupEditPage from './pages/LineupEditPage'
import RankingsPage from './pages/RankingsPage'
import PendingApproval from './pages/PendingApproval'
import './index.css'

const RootRedirect = () => {
  const { session, authReady } = useAuth();
  if (!authReady) return null;
  return <Navigate to={session ? '/app' : '/login'} replace />;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/app" element={<ProtectedRoute><App /></ProtectedRoute>} />
        <Route path="/create-team" element={<ProtectedRoute><CreateTeam /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><CoachDashboard /></ProtectedRoute>} />
        <Route path="/lineups" element={<ProtectedRoute><LineupsPage /></ProtectedRoute>} />
        <Route path="/lineups/new" element={<ProtectedRoute><LineupEditPage /></ProtectedRoute>} />
        <Route path="/lineups/:id/edit" element={<ProtectedRoute><LineupEditPage /></ProtectedRoute>} />
        <Route path="/rankings" element={<ProtectedRoute><RankingsPage /></ProtectedRoute>} />
        <Route path="/pending" element={<ProtectedRoute><PendingApproval /></ProtectedRoute>} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
)
