import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import BigTitsHome from './BigTitsHome';
import { GovRoutes } from './features/gov/GovRoutes';

/** Single BigTits app: React UI inside Capacitor. Web = UI layer only. */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BigTitsHome />} />
        <Route path="/gov/*" element={<GovRoutes />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}