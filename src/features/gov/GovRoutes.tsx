import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { CaseIntakePage } from './pages/CaseIntakePage';
import { DocumentsPage } from './pages/DocumentsPage';
import { HomePage } from './pages/HomePage';
import { PortalStartPage } from './pages/PortalStartPage';
import { ProfilePage } from './pages/ProfilePage';
import './gov.css';

export function GovRoutes() {
  return (
    <Layout>
      <Routes>
        <Route index element={<HomePage />} />
        <Route path="intake" element={<CaseIntakePage />} />
        <Route path="cases/:caseId/documents" element={<DocumentsPage />} />
        <Route path="cases/:caseId/profile" element={<ProfilePage />} />
        <Route path="cases/:caseId/portal" element={<PortalStartPage />} />
      </Routes>
    </Layout>
  );
}