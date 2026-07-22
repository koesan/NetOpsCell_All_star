import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LoginPage } from "./features/auth/LoginPage";
import { AppShell } from "./components/layout/AppShell";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { HomeRedirect } from "./components/layout/HomeRedirect";

import { NewIncidentPage } from "./features/customer/NewIncidentPage";
import { MyIncidentsPage } from "./features/customer/MyIncidentsPage";

import { AssignedIncidentsPage } from "./features/technician/AssignedIncidentsPage";
import { ProfilePage } from "./features/technician/ProfilePage";

import { NocIncidentsPage } from "./features/noc/IncidentsPage";
import { DashboardPage } from "./features/supervisor/DashboardPage";
import { LeaderboardPage } from "./features/shared/LeaderboardPage";
import { IncidentDetailPage } from "./features/shared/IncidentDetailPage";

import { PersonnelPage } from "./features/admin/PersonnelPage";
import { AuditLogPage } from "./features/admin/AuditLogPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomeRedirect />} />

            <Route element={<ProtectedRoute allow={["MUSTERI"]} />}>
              <Route path="/musteri/yeni-ariza" element={<NewIncidentPage />} />
              <Route path="/musteri/vakalarim" element={<MyIncidentsPage />} />
              <Route path="/musteri/vakalarim/:id" element={<IncidentDetailPage />} />
            </Route>

            <Route element={<ProtectedRoute allow={["SAHA_TEKNISYENI"]} />}>
              <Route path="/saha/vakalarim" element={<AssignedIncidentsPage />} />
              <Route path="/saha/vakalarim/:id" element={<IncidentDetailPage />} />
              <Route path="/saha/profil" element={<ProfilePage />} />
            </Route>

            <Route element={<ProtectedRoute allow={["NOC_OPERATORU", "SUPERVIZOR"]} />}>
              <Route path="/operasyon/vakalar" element={<NocIncidentsPage />} />
              <Route path="/operasyon/vakalar/:id" element={<IncidentDetailPage />} />
              <Route path="/operasyon/liderlik" element={<LeaderboardPage />} />
            </Route>

            <Route element={<ProtectedRoute allow={["SUPERVIZOR"]} />}>
              <Route path="/operasyon/dashboard" element={<DashboardPage />} />
            </Route>

            <Route element={<ProtectedRoute allow={["ADMIN"]} />}>
              <Route path="/yonetim/personel" element={<PersonnelPage />} />
              <Route path="/yonetim/audit-log" element={<AuditLogPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
