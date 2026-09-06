import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import NewInspectionPage from './pages/NewInspectionPage'
import AnalysisProgressPage from './pages/AnalysisProgressPage'
import ComplianceResultPage from './pages/ComplianceResultPage'
import OcrInspectionPage from './pages/OcrInspectionPage'
import InspectionHistoryPage from './pages/InspectionHistoryPage'
import LoginPage from './pages/LoginPage'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          {/* Protected Routes */}
          <Route path="/" element={<ProtectedRoute><LandingPage /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><InspectionHistoryPage /></ProtectedRoute>} />
          <Route path="/inspections/new" element={<ProtectedRoute><NewInspectionPage /></ProtectedRoute>} />
          <Route path="/inspections/:id/analyze" element={<ProtectedRoute><AnalysisProgressPage /></ProtectedRoute>} />
          <Route path="/inspections/:id/result" element={<ProtectedRoute><ComplianceResultPage /></ProtectedRoute>} />
          <Route path="/products/:id/ocr" element={<ProtectedRoute><OcrInspectionPage /></ProtectedRoute>} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
