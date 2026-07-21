import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@/context/ThemeProvider";
import { MarketingLayout, RequireAuth } from "@/components/layout/MarketingLayout";
import { PermissionsProvider } from "@/context/PermissionsContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { AboutPage, ContactPage, HomePage, PrivacyPage, TermsPage } from "@/pages/marketing/MarketingPages";
import { LoginPage, SignupPage } from "@/pages/auth/AuthPages";
import { DashboardPage } from "@/pages/app/DashboardPage";
import { FixLogPage } from "@/pages/app/FixLogPage";
import { SettingsPage } from "@/pages/app/SettingsPage";
import { StatusPage } from "@/pages/app/StatusPage";
import { ProfilePage } from "@/pages/app/ProfilePage";
import { IssueRecordsPage } from "@/pages/app/IssueRecordsPage";
import { AuditTrailPage } from "@/pages/app/AuditTrailPage";
import { ChangelogPage } from "@/pages/app/ChangelogPage";
import { ReportsPage } from "@/pages/app/ReportsPage";
import { OrganizationPage } from "@/pages/app/OrganizationPage";
import { ProjectsPage } from "@/pages/app/ProjectsPage";
import { RolesPage } from "@/pages/app/RolesPage";
import { RoadmapPage } from "@/pages/app/RoadmapPage";

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<MarketingLayout />}>
            <Route index element={<HomePage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="privacy" element={<PrivacyPage />} />
            <Route path="terms" element={<TermsPage />} />
          </Route>
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
          <Route
            path="app"
            element={
              <RequireAuth>
                <PermissionsProvider>
                  <AppLayout />
                </PermissionsProvider>
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="fix-log" element={<FixLogPage />} />
            <Route path="issues" element={<IssueRecordsPage />} />
            <Route path="audit" element={<AuditTrailPage />} />
            <Route path="status" element={<StatusPage />} />
            <Route path="changelog" element={<ChangelogPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="organization" element={<OrganizationPage />} />
            <Route path="roles" element={<RolesPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="roadmap" element={<RoadmapPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

