import { Navigate, Route, Routes } from "react-router-dom"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { DashboardLayout } from "@/components/dashboard"
import { LandingPage } from "@/pages/LandingPage"
import { LoginPage } from "@/pages/LoginPage"
import { RegisterPage } from "@/pages/RegisterPage"
import {
  AIAssistantPage,
  AnalyticsPage,
  ConversationsPage,
  CustomersPage,
  DashboardHomePage,
  KnowledgeBasePage,
  SettingsPage,
  TeamPage,
  TicketsPage,
} from "@/pages/dashboard"

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHomePage />} />
        <Route path="conversations" element={<ConversationsPage />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="knowledge-base" element={<KnowledgeBasePage />} />
        <Route path="ai-assistant" element={<AIAssistantPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
