import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import RegisterPage from './pages/RegisterPage'
import LandingPage from './pages/LandingPage'
import NewInspectionPage from './pages/NewInspectionPage'
import AnalysisProgressPage from './pages/AnalysisProgressPage'
import ComplianceResultPage from './pages/ComplianceResultPage'
import OcrInspectionPage from './pages/OcrInspectionPage'
import InspectionHistoryPage from './pages/InspectionHistoryPage'
import LoginPage from './pages/LoginPage'
import ComplaintFormPage from './pages/ComplaintFormPage'
import MyComplaintsPage from './pages/MyComplaintsPage'
import ComplaintDetailPage from './pages/ComplaintDetailPage'
import ViolationMapPage from './pages/ViolationMapPage'
import NutritionScannerPage from './pages/NutritionScannerPage'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

function PublicHomePage() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <div className="animate-spin h-12 w-12 rounded-full border-b-2 border-emerald-700"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <HomePage />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<PublicHomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Authenticated Dashboard */}
          <Route path="/dashboard" element={<ProtectedRoute><LandingPage /></ProtectedRoute>} />

          {/* Protected Routes */}
          <Route path="/history" element={<ProtectedRoute><InspectionHistoryPage /></ProtectedRoute>} />
          <Route path="/inspections/new" element={<ProtectedRoute><NewInspectionPage /></ProtectedRoute>} />
          <Route path="/inspections/:id/analyze" element={<ProtectedRoute><AnalysisProgressPage /></ProtectedRoute>} />
          <Route path="/inspections/:id/result" element={<ProtectedRoute><ComplianceResultPage /></ProtectedRoute>} />
          <Route path="/products/:id/ocr" element={<ProtectedRoute><OcrInspectionPage /></ProtectedRoute>} />

          {/* P0-A: Complaint & Grievance */}
          <Route path="/complaints/new" element={<ProtectedRoute><ComplaintFormPage /></ProtectedRoute>} />
          <Route path="/complaints" element={<ProtectedRoute><MyComplaintsPage /></ProtectedRoute>} />
          <Route path="/complaints/:id" element={<ProtectedRoute><ComplaintDetailPage /></ProtectedRoute>} />

          {/* P0-B: Violation Intelligence Map */}
          <Route path="/violations/map" element={<ProtectedRoute><ViolationMapPage /></ProtectedRoute>} />

          {/* P1-A: Nutrition Scanner */}
          <Route path="/nutrition" element={<ProtectedRoute><NutritionScannerPage /></ProtectedRoute>} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
