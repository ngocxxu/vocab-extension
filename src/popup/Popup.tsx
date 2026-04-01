import { Button } from "@/components/ui/button";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LogOut, Menu, Save, Settings, User } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../background/api-client";
import { tokenManager } from "../background/token-manager";
import AuthForm from "../components/auth/AuthForm";
import { Logo } from "../components/branding/Logo";
import { Card } from "../components/ui/card";
import { MultiSelect } from "../components/ui/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { API_ENDPOINTS } from "../shared/constants";
import type { UserDto } from "../shared/types/api";
import type { LanguageFolderDto, SubjectDto } from "../shared/types/vocab";
import { storage } from "../shared/utils/storage";
import {
  cleanupOldUserSettings,
  loadUserSettings as loadUserSettingsUtil,
  saveUserSettings as saveUserSettingsUtil,
} from "../shared/utils/user-settings";

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

    try {
      const { folderId, subjectIds } = await loadUserSettingsUtil(userData.id);
      const cachedFolders = (await storage.get("cachedFolders")) || [];
      const cachedSubjects = (await storage.get("cachedSubjects")) || [];
      setFolders(cachedFolders);
      setAllSubjects(cachedSubjects);

      setActiveFolderId(folderId);
      setActiveSubjectIds(subjectIds);

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
      await cleanupOldUserSettings(user.id);
      await saveUserSettingsUtil(user.id, activeFolderId, activeSubjectIds);
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

  const handleLogout = async () => {
    try {
      await apiClient.post(API_ENDPOINTS.AUTH.SIGNOUT).catch(() => {});
    } finally {
      await tokenManager.clearTokens();
      setUser(null);
    }
  };

  if (!user) {
    return <AuthForm variant="popup" onSuccess={loadData} />;
  }

  return (
    <div className="w-80 bg-background">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-2">
          <Logo className="h-10 w-10" />
          <h1 className="text-xl font-semibold text-foreground">Vocab Management</h1>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <Card className="py-0 rounded-xl">
          <div className="flex justify-between gap-3 p-3">
          <div className="flex  items-center gap-2">
            <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user.firstName + " " + user.lastName || user.email}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="w-4 h-4" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="bg-popover text-popover-foreground border rounded-md shadow-md p-1"
            >
              <DropdownMenu.Item
                onSelect={openOptions}
                className="px-2 py-1.5 text-sm rounded hover:bg-accent cursor-pointer flex items-center gap-2 outline-none"
              >
              <Settings className="w-4 h-4" />
                Settings
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="h-px my-1 bg-border" />
              <DropdownMenu.Item
                onSelect={handleLogout}
                className="px-2 py-1.5 text-sm rounded hover:bg-accent text-destructive cursor-pointer flex items-center gap-2 outline-none"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
        </Card>

        <div className="space-y-2">
          <div className="space-y-2">
            {(!folder || subjects.length === 0) && (
              <>
                <div className="p-3 bg-accent border border-border rounded-lg">
                  <p className="text-xs text-foreground">
                    Please configure your folder and subject in settings.
                  </p>
                </div>
             
              </>
            )}
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Edit Settings
          </div>

          <div>
            <div className="text-xs font-medium text-foreground mb-1">
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
            <div className="text-xs font-medium text-foreground mb-1">
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
            <div className="p-2 bg-accent border border-border rounded">
              <p className="text-xs text-destructive font-medium">{error}</p>
            </div>
          )}
          {success && (
            <div className="p-2 bg-accent border border-border rounded">
              <p className="text-xs text-foreground font-medium">{success}</p>
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={!activeFolderId || saving}
            className="w-full"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Popup;
