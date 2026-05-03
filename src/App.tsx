import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { MainLayout } from "@/components/layout/main-layout";
import { OverviewPage } from "@/pages/overview-page";
import JokersPage from "@/pages/jokers-page";
import RaritiesPage from "@/pages/rarities-page";
import SealsPage from "@/pages/seals-page";
import ConsumablesPage from "@/pages/consumables-page";
import ConsumableSetsPage from "@/pages/consumable-sets-page";
import DecksPage from "@/pages/decks-page";
import EnhancementsPage from "@/pages/enhancements-page";
import EditionsPage from "@/pages/editions-page";
import BoostersPage from "@/pages/boosters-page";
import VouchersPage from "@/pages/vouchers-page";
import SoundsPage from "@/pages/sounds-page";
import MetadataPage from "@/pages/metadata-page";
import SettingsPage from "@/pages/settings-page";
import VanillaReforgedJokersPage from "@/pages/vanilla-reforged/vanilla-reforged-jokers-page";
import VanillaReforgedConsumablesPage from "@/pages/vanilla-reforged/vanilla-reforged-consumables-page";
import VanillaReforgedBoostersPage from "@/pages/vanilla-reforged/vanilla-reforged-boosters-page";
import VanillaReforgedEnhancementsPage from "@/pages/vanilla-reforged/vanilla-reforged-enhancements-page";
import VanillaReforgedSealsPage from "@/pages/vanilla-reforged/vanilla-reforged-seals-page";
import VanillaReforgedEditionsPage from "@/pages/vanilla-reforged/vanilla-reforged-editions-page";
import VanillaReforgedVouchersPage from "@/pages/vanilla-reforged/vanilla-reforged-vouchers-page";
import VanillaReforgedDecksPage from "@/pages/vanilla-reforged/vanilla-reforged-decks-page";
import { EntityBridgeListener } from "@/components/bridge/entity-bridge-listener";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useEffect } from "react";
import { checkForReleaseUpdateOnLaunch } from "@/lib/release-updater";
import { UpdateDialog } from "@/components/bridge/update-dialog";

import { invoke } from "@tauri-apps/api/core";

function App() {
  useEffect(() => {
    void checkForReleaseUpdateOnLaunch();
  }, []);

  return (
    <Router>
      <UpdateDialog />
      <EntityBridgeListener />
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="h-full w-full">
            <MainLayout>
              <Routes>
                <Route path="/" element={<OverviewPage />} />
                <Route path="/jokers" element={<JokersPage />} />
                <Route path="/rarities" element={<RaritiesPage />} />
                <Route path="/seals" element={<SealsPage />} />
                <Route path="/consumables" element={<ConsumablesPage />} />
                <Route
                  path="/consumable-sets"
                  element={<ConsumableSetsPage />}
                />
                <Route path="/decks" element={<DecksPage />} />
                <Route path="/boosters" element={<BoostersPage />} />
                <Route path="/vouchers" element={<VouchersPage />} />
                <Route path="/enhancements" element={<EnhancementsPage />} />
                <Route path="/sounds" element={<SoundsPage />} />
                <Route path="/editions" element={<EditionsPage />} />
                <Route path="/metadata" element={<MetadataPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route
                  path="/vanilla-reforged/jokers"
                  element={<VanillaReforgedJokersPage />}
                />
                <Route
                  path="/vanilla-reforged/boosters"
                  element={<VanillaReforgedBoostersPage />}
                />
                <Route
                  path="/vanilla-reforged/consumables"
                  element={<VanillaReforgedConsumablesPage />}
                />
                <Route
                  path="/vanilla-reforged/enhancements"
                  element={<VanillaReforgedEnhancementsPage />}
                />
                <Route
                  path="/vanilla-reforged/seals"
                  element={<VanillaReforgedSealsPage />}
                />
                <Route
                  path="/vanilla-reforged/editions"
                  element={<VanillaReforgedEditionsPage />}
                />
                <Route
                  path="/vanilla-reforged/vouchers"
                  element={<VanillaReforgedVouchersPage />}
                />
                <Route
                  path="/vanilla-reforged/decks"
                  element={<VanillaReforgedDecksPage />}
                />
              </Routes>
            </MainLayout>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52 border-border/95 bg-card/98 shadow-[0_18px_35px_-18px_rgba(0,0,0,0.72)] backdrop-blur-md">
          <ContextMenuItem onClick={() => window.location.reload()}>
            Refresh
            <ContextMenuShortcut>F5</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => void invoke("open_devtools")}>
            Developer Tools
            <ContextMenuShortcut>F12</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </Router>
  );
}

export default App;
