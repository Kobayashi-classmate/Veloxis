import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DataSources from './pages/DataSources';
import { CubeContextWrapper } from './contexts/CubeContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route 
          path="/*" 
          element={
            <ProtectedRoute>
              <CubeContextWrapper>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/data-sources" element={<DataSources />} />
                </Routes>
              </CubeContextWrapper>
            </ProtectedRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
