import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AppLayout } from "@/components/layout";
import { ProtectedRoute } from "@/auth/protected-route";
import { LoginPage } from "@/pages/login-page";
import { DialogsPage } from "@/pages/dialogs-page";
import { NewDialogPage } from "@/pages/new-dialog-page";
import { DialogDetailPage } from "@/pages/dialog-detail-page";
import { PresetsPage } from "@/pages/presets-page";
import { SubmissionDetailPage } from "@/pages/submission-detail-page";
import { ValidatorsPage } from "@/pages/validators-page";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<DialogsPage />} />
              <Route path="dialogs/new" element={<NewDialogPage />} />
              <Route path="dialogs/:dialogId" element={<DialogDetailPage />} />
              <Route path="submissions/:submissionId" element={<SubmissionDetailPage />} />
              <Route path="validators" element={<ValidatorsPage />} />
              <Route path="presets" element={<PresetsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
