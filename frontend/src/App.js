import "@/App.css";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import AttendancePage from "@/pages/AttendancePage";
import AdminLoginPage from "@/pages/AdminLoginPage";
import AdminDashboard from "@/pages/AdminDashboard";
import MarketingDashboard from "@/pages/MarketingDashboard";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AttendancePage />} />
          <Route path="/login" element={<AdminLoginPage />} />
          <Route path="/admin/login" element={<Navigate to="/login?role=admin" replace />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/marketing/login" element={<Navigate to="/login?role=marketing" replace />} />
          <Route path="/marketing" element={<MarketingDashboard />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </div>
  );
}

export default App;
