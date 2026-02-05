import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { MainLayout } from "@/components/layout/main-layout";
import { OverviewPage } from "@/pages/overview-page";
import JokersPage from "@/pages/jokers-page";
import SealsPage from "@/pages/seals-page";
import ConsumablesPage from "@/pages/consumables-page";
import DecksPage from "@/pages/decks-page";
import EnhancementsPage from "@/pages/enhancements-page";
import EditionsPage from "@/pages/editions-page";
import BoostersPage from "@/pages/boosters-page";
import VouchersPage from "@/pages/vouchers-page";
import SoundsPage from "@/pages/sounds-page";
import MetadataPage from "@/pages/metadata-page";

function App() {
  return (
    <Router>
      <MainLayout>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/jokers" element={<JokersPage />} />
          <Route path="/seals" element={<SealsPage />} />
          <Route path="/consumables" element={<ConsumablesPage />} />
          <Route path="/decks" element={<DecksPage />} />
          <Route path="/enhancements" element={<EnhancementsPage />} />
          <Route path="/editions" element={<EditionsPage />} />
          <Route path="/boosters" element={<BoostersPage />} />
          <Route path="/vouchers" element={<VouchersPage />} />
          <Route path="/sounds" element={<SoundsPage />} />
          <Route path="/metadata" element={<MetadataPage />} />
        </Routes>
      </MainLayout>
    </Router>
  );
}

export default App;
