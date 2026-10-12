import { useCallback, useEffect, useState } from "react";
import { api, initApiBase } from "@/api/client";
import type { SpectrumAnalysisResponse } from "@/api/types";
import { AnalysisConfigDialog } from "@/components/AnalysisConfigDialog";
import { AnalysisResultsDialog } from "@/components/AnalysisResultsDialog";
import { FileSelect } from "@/components/FileSelect";
import { ChannelSelectDialog } from "@/components/ChannelSelectDialog";
import { ZoneDialog } from "@/components/ZoneDialog";
import { SignalCanvas } from "@/components/SignalCanvas";
import { Toolbar } from "@/components/Toolbar";
import { ToolsPanel } from "@/components/ToolsPanel";
import { ChannelPageSlider } from "@/components/ChannelPageSlider";
import { StatusBar } from "@/components/StatusBar";
import { Toast } from "@/components/Toast";
import type { Zone } from "@/api/types";
import { useSessionStore } from "@/store/session";
import { useT } from "@/store/locale";
import { useLocaleSync } from "@/hooks/useLocaleSync";

export default function App() {
  const t = useT();
  useLocaleSync();
  const ready = useSessionStore((s) => s.ready);
  const loading = useSessionStore((s) => s.loading);
  const error = useSessionStore((s) => s.error);
  const fileInfo = useSessionStore((s) => s.fileInfo);
  const pendingOpen = useSessionStore((s) => s.pendingOpen);
  const duration = useSessionStore((s) => s.duration);
  const zoneOnAllChannels = useSessionStore((s) => s.zoneOnAllChannels);
  const selectedChannels = useSessionStore((s) => s.selectedChannels);
  const zones = useSessionStore((s) => s.zones);

  const setReady = useSessionStore((s) => s.setReady);
  const setError = useSessionStore((s) => s.setError);
  const openFile = useSessionStore((s) => s.openFile);
  const confirmSelection = useSessionStore((s) => s.confirmSelection);
  const setPendingOpen = useSessionStore((s) => s.setPendingOpen);
  const resetView = useSessionStore((s) => s.resetView);
  const showAll = useSessionStore((s) => s.showAll);
  const undoZones = useSessionStore((s) => s.undoZones);
  const redoZones = useSessionStore((s) => s.redoZones);
  const saveProject = useSessionStore((s) => s.saveProject);
  const loadProject = useSessionStore((s) => s.loadProject);
  const addZone = useSessionStore((s) => s.addZone);
  const updateZone = useSessionStore((s) => s.updateZone);
  const selectedZoneId = useSessionStore((s) => s.selectedZoneId);
  const setSelectedZoneId = useSessionStore((s) => s.setSelectedZoneId);
  const deleteZone = useSessionStore((s) => s.deleteZone);
  const centerViewOnZone = useSessionStore((s) => s.centerViewOnZone);
  const fetchSegment = useSessionStore((s) => s.fetchSegment);
  const viewRange = useSessionStore((s) => s.viewRange);

  const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [analysisConfigOpen, setAnalysisConfigOpen] = useState(false);
  const [analysisResults, setAnalysisResults] =
    useState<SpectrumAnalysisResponse | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const dismissStatusMsg = useCallback(() => setStatusMsg(null), []);
  const dismissError = useCallback(() => setError(null), [setError]);

  const openNewZoneDialog = useCallback(() => {
    setEditingZone(null);
    setZoneDialogOpen(true);
  }, []);

  const openEditZoneDialog = useCallback((zone: Zone) => {
    setEditingZone(zone);
    setSelectedZoneId(zone.id);
    setZoneDialogOpen(true);
  }, [setSelectedZoneId]);

  const closeZoneDialog = useCallback(() => {
    setZoneDialogOpen(false);
    setEditingZone(null);
  }, []);

  const handleAnalyze = useCallback(() => {
    setAnalysisConfigOpen(true);
  }, []);

  const handleAnalysisRun = useCallback(
    async (fmin: number, fmax: number) => {
      setAnalysisLoading(true);
      setError(null);
      try {
        const result = await api.analyzeSpectrum(fmin, fmax);
        setAnalysisConfigOpen(false);
        setAnalysisResults(result);
      } catch (err) {
        setError(String(err));
      } finally {
        setAnalysisLoading(false);
      }
    },
    [setError],
  );

  useEffect(() => {
    void (async () => {
      await initApiBase();
      try {
        await api.health();
      } catch {
        setError(
          "Сервер анализа недоступен. Закройте вкладку браузера и работайте в окне Electron, либо перезапустите npm run dev.",
        );
      }
      setReady(true);
    })();
  }, [setReady, setError]);

  useEffect(() => {
    if (fileInfo && selectedChannels.length > 0) {
      void fetchSegment(1000);
    }
  }, [fileInfo, selectedChannels.length, viewRange, fetchSegment]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!fileInfo || pendingOpen || zoneDialogOpen || !selectedZoneId) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        void deleteZone(selectedZoneId);
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        centerViewOnZone(selectedZoneId);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    fileInfo,
    pendingOpen,
    zoneDialogOpen,
    selectedZoneId,
    deleteZone,
    centerViewOnZone,
  ]);

  const handleBrowse = useCallback(async () => {
    const path = await window.electronAPI?.openFileDialog();
    if (!path) return;
    try {
      await openFile(path);
    } catch {
      /* error in store */
    }
  }, [openFile]);

  const handleMenu = useCallback(
    async (action: string) => {
      switch (action) {
        case "open-bdf": {
          const path = await window.electronAPI?.openFileDialog();
          if (path) await openFile(path);
          break;
        }
        case "open-project": {
          const path = await window.electronAPI?.openProjectDialog();
          try {
            await loadProject(path);
            setStatusMsg(path ? `${t.projectLoaded}: ${path}` : t.projectLoaded);
          } catch (err) {
            setError(String(err));
          }
          break;
        }
        case "save-project": {
          try {
            const p = await saveProject();
            setStatusMsg(`${t.projectSaved}: ${p}`);
          } catch (err) {
            setError(String(err));
          }
          break;
        }
        case "undo":
          await undoZones();
          break;
        case "redo":
          await redoZones();
          break;
        case "reset-view":
          resetView();
          break;
        case "show-all":
          showAll();
          break;
      }
    },
    [
      openFile,
      loadProject,
      saveProject,
      undoZones,
      redoZones,
      resetView,
      showAll,
      setError,
      t.projectLoaded,
      t.projectSaved,
    ],
  );

  useEffect(() => {
    if (!window.electronAPI?.onMenuAction) return;
    return window.electronAPI.onMenuAction((action) => {
      void handleMenu(action);
    });
  }, [handleMenu]);

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-muted">
        {t.loading}
      </div>
    );
  }

  if (!fileInfo && !pendingOpen) {
    return (
      <div className="relative flex h-full flex-col">
        <FileSelect onBrowse={() => void handleBrowse()} loading={loading} />
        <Toast message={error} variant="error" onDismiss={dismissError} />
      </div>
    );
  }

  const showErrorToast = error && !pendingOpen;

  return (
    <div className="relative flex h-full flex-col">
      {pendingOpen && (
        <ChannelSelectDialog
          groups={pendingOpen.channel_groups}
          duration={pendingOpen.file_info.duration}
          defaultSelected={pendingOpen.selected_channels}
          defaultServiceSelected={pendingOpen.service_channels}
          loading={loading}
          onCancel={() => setPendingOpen(null)}
          onConfirm={(channels, serviceChannels, tmin, tmax, channelsPerPage) =>
            void confirmSelection(
              channels,
              serviceChannels,
              tmin,
              tmax,
              channelsPerPage,
              pendingOpen.saved_zones,
            )
          }
        />
      )}

      {analysisConfigOpen && (
        <AnalysisConfigDialog
          loading={analysisLoading}
          onCancel={() => setAnalysisConfigOpen(false)}
          onRun={(fmin, fmax) => void handleAnalysisRun(fmin, fmax)}
        />
      )}

      {analysisResults && (
        <AnalysisResultsDialog
          results={analysisResults}
          onClose={() => setAnalysisResults(null)}
        />
      )}

      {zoneDialogOpen && fileInfo && (
        <ZoneDialog
          zone={editingZone}
          zones={zones}
          maxTime={duration}
          channels={selectedChannels}
          allChannels={zoneOnAllChannels}
          onCancel={closeZoneDialog}
          onSave={(data) => {
            if (data.id) {
              void updateZone(data.id, {
                name: data.name,
                t_start: data.t_start,
                t_end: data.t_end,
                channel: data.channel,
                epoch_mode: data.epoch_mode,
                epoch_value: data.epoch_value,
                color: data.color,
              });
            } else {
              void addZone({
                name: data.name,
                t_start: data.t_start,
                t_end: data.t_end,
                channel: data.channel,
                epoch_mode: data.epoch_mode,
                epoch_value: data.epoch_value,
                color: data.color,
                visible: true,
              });
            }
            closeZoneDialog();
          }}
        />
      )}

      <Toolbar />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <SignalCanvas onEditZone={openEditZoneDialog} />
          </div>
          <ChannelPageSlider />
        </div>
        <div className="flex min-h-0 w-max max-w-[25vw] shrink-0 flex-col overflow-hidden border-l border-border">
          <ToolsPanel
            onAddZone={openNewZoneDialog}
            onEditZone={openEditZoneDialog}
            onAnalyze={handleAnalyze}
            analyzeDisabled={analysisLoading}
          />
        </div>
      </div>

      <StatusBar
        fileName={fileInfo?.file_name ?? null}
        filePath={fileInfo?.file_path ?? null}
      />

      <Toast
        message={showErrorToast ? error : null}
        variant="error"
        onDismiss={dismissError}
      />
      <Toast
        message={statusMsg}
        variant="success"
        onDismiss={dismissStatusMsg}
      />
    </div>
  );
}
