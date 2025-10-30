import { useCallback, useEffect, useState } from "react";
import { Settings, User, Save } from "lucide-react";
import { storage } from "../shared/utils/storage";
import type { UserDto } from "../shared/types/api";
import type { LanguageFolderDto, SubjectDto } from "../shared/types/vocab";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { MultiSelect } from "../components/ui/multi-select";
import { Button } from "@/components/ui/button";
import AuthForm from "../components/auth/AuthForm";

function Popup() {
  const [user, setUser] = useState<UserDto | null>(null);
  const [folder, setFolder] = useState<LanguageFolderDto | null>(null);
  const [subjects, setSubjects] = useState<SubjectDto[]>([]);
  const [folders, setFolders] = useState<LanguageFolderDto[]>([]);
  const [allSubjects, setAllSubjects] = useState<SubjectDto[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string>("");
  const [activeSubjectIds, setActiveSubjectIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadData();

    // Listen for storage changes
    const listener = () => {
      loadData();
    };

    chrome.storage.onChanged.addListener(listener);

    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);

  const getUserSettingsKey = (userId: string, key: string) =>
    `${key}_${userId}`;

  const loadData = useCallback(async () => {
    const userData = await storage.get("user");
    setUser(userData || null);

    if (!userData) {
      setFolder(null);
      setSubjects([]);
      setFolders([]);
      setAllSubjects([]);
      setActiveFolderId("");
      setActiveSubjectIds([]);
      return;
    }

    const folderKey = getUserSettingsKey(userData.id, "activeFolderId");
    const subjectIdsKey = getUserSettingsKey(userData.id, "activeSubjectIds");
    const legacySubjectIdKey = getUserSettingsKey(
      userData.id,
      "activeSubjectId"
    );

    try {
      const result = await chrome.storage.local.get([
        folderKey,
        subjectIdsKey,
        legacySubjectIdKey,
      ]);

      if (chrome.runtime.lastError) {
        console.error("Error loading user settings:", chrome.runtime.lastError);
        setFolder(null);
        setSubjects([]);
        setFolders([]);
        setAllSubjects([]);
        setActiveFolderId("");
        setActiveSubjectIds([]);
        return;
      }

      const folderId = result[folderKey] || "";
      const subjectIds = result[subjectIdsKey];
      const legacySubjectId = result[legacySubjectIdKey];

      const cachedFolders = (await storage.get("cachedFolders")) || [];
      const cachedSubjects = (await storage.get("cachedSubjects")) || [];
      setFolders(cachedFolders);
      setAllSubjects(cachedSubjects);

      setActiveFolderId(folderId);

      if (subjectIds && Array.isArray(subjectIds)) {
        setActiveSubjectIds(subjectIds);
      } else if (legacySubjectId) {
        // migrate legacy single subject id to array
        try {
          await chrome.storage.local.set({
            [subjectIdsKey]: [legacySubjectId],
          });
          await chrome.storage.local.remove(legacySubjectIdKey);
        } catch (err) {
          console.error("Error migrating legacy subject ID:", err);
        }
        setActiveSubjectIds([legacySubjectId]);
      } else {
        setActiveSubjectIds([]);
      }

      // derive display models
      if (folderId) {
        const activeFolder =
          cachedFolders.find((f) => f.id === folderId) || null;
        setFolder(activeFolder);
      } else {
        setFolder(null);
      }

      if (Array.isArray(subjectIds) && subjectIds.length > 0) {
        const activeSubjects = cachedSubjects.filter((s) =>
          subjectIds.includes(s.id)
        );
        setSubjects(activeSubjects);
      } else if (legacySubjectId) {
        const migrated = cachedSubjects.filter((s) => s.id === legacySubjectId);
        setSubjects(migrated);
      } else {
        setSubjects([]);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      setFolder(null);
      setSubjects([]);
      setFolders([]);
      setAllSubjects([]);
      setActiveFolderId("");
      setActiveSubjectIds([]);
    }
  }, []);

  const saveUserSettings = async (
    userId: string,
    folderId: string,
    subjectIds: string[]
  ) => {
    const folderKey = getUserSettingsKey(userId, "activeFolderId");
    const subjectIdsKey = getUserSettingsKey(userId, "activeSubjectIds");

    try {
      await chrome.storage.local.set({
        [folderKey]: folderId,
        [subjectIdsKey]: subjectIds,
      });

      if (chrome.runtime.lastError) {
        const msg = chrome.runtime.lastError.message;
        if (msg?.includes("QUOTA_BYTES") || msg?.includes("quota")) {
          // best-effort: remove other users' settings like Options does
          try {
            const allData = await chrome.storage.local.get(null);
            const keysToRemove: string[] = [];
            for (const k in allData) {
              if (
                (k.startsWith("activeFolderId_") ||
                  k.startsWith("activeSubjectIds_")) &&
                !k.endsWith(`_${userId}`)
              ) {
                keysToRemove.push(k);
              }
            }
            if (keysToRemove.length) {
              await chrome.storage.local.remove(keysToRemove);
            }
            await chrome.storage.local.set({
              [folderKey]: folderId,
              [subjectIdsKey]: subjectIds,
            });
            if (chrome.runtime.lastError) {
              throw new Error(
                "Storage quota exceeded. Unable to save settings."
              );
            }
          } catch {
            throw new Error("Unable to save settings. Storage is full.");
          }
        } else {
          throw new Error(msg || "Failed to save settings");
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(message || "Failed to save settings");
    }
  };

  const handleSave = async () => {
    setError("");
    setSuccess("");

    if (!user) {
      setError("User not found. Please login again.");
      return;
    }
    if (!activeFolderId) {
      setError("Please select a folder before saving.");
      return;
    }

    setSaving(true);
    try {
      await saveUserSettings(user.id, activeFolderId, activeSubjectIds);
      await storage.set("activeFolderId", activeFolderId);
      await storage.set("activeSubjectIds", activeSubjectIds);

      const activeFolder = folders.find((f) => f.id === activeFolderId) || null;
      setFolder(activeFolder);
      const selectedSubjects = allSubjects.filter((s) =>
        activeSubjectIds.includes(s.id)
      );
      setSubjects(selectedSubjects);

      setSuccess("Settings saved successfully");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save settings";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  if (!user) {
    return <AuthForm variant="popup" onSuccess={loadData} />;
  }

  return (
    <div className="w-80 bg-gradient-to-b from-slate-50 to-white">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center shadow-md">
            <span className="text-lg font-bold text-white">V</span>
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            Vocab Manager
          </h1>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="flex justify-between gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
          <div className="flex  items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {user.firstName + " " + user.lastName || user.email}
              </p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
          <Button onClick={openOptions} variant="outline" size="icon">
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <div className="space-y-2">
            {(!folder || subjects.length === 0) && (
              <>
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                  <p className="text-xs text-amber-800">
                    Please configure your folder and subject in settings.
                  </p>
                </div>
             
              </>
            )}
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
            Edit Settings
          </div>

          <div>
            <div className="text-xs font-medium text-slate-700 mb-1">
              Folder
            </div>
            <Select value={activeFolderId} onValueChange={setActiveFolderId}>
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="Select a folder" />
              </SelectTrigger>
              <SelectContent>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3.5 h-3.5 rounded-full border"
                        style={{ backgroundColor: f.folderColor }}
                      />
                      <span className="text-sm">{f.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-700 mb-1">
              Subjects
            </div>
            <MultiSelect
              options={allSubjects.map((s) => ({ label: s.name, value: s.id }))}
              onValueChange={setActiveSubjectIds}
              defaultValue={activeSubjectIds}
              placeholder="Select subjects"
              searchable={true}
            />
          </div>

          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded">
              <p className="text-xs text-red-700 font-medium">{error}</p>
            </div>
          )}
          {success && (
            <div className="p-2 bg-emerald-50 border border-emerald-200 rounded">
              <p className="text-xs text-emerald-700 font-medium">{success}</p>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={!activeFolderId || saving}
            className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Popup;
