import { BookOpen, ChevronDown, ChevronUp, LogOut, Plus, Save, Tag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '../background/api-client';
import { tokenManager } from '../background/token-manager';
import AuthForm from '../components/auth/AuthForm';
import { Logo } from '../components/branding/Logo';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { MultiSelect } from '../components/ui/multi-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Separator } from '../components/ui/separator';
import { Toaster } from '../components/ui/sonner';
import type { UserDto } from '../shared/types/api';
import type {
  IResponse,
  LanguageDto,
  LanguageFolderDto,
  LanguageFolderInput,
  SubjectDto,
  SubjectInput,
  WordTypeDto,
} from '../shared/types/vocab';
import { storage } from '../shared/utils/storage';
import {
  cleanupOldUserSettings,
  loadUserConfigFromBackend,
  loadUserSettings as loadUserSettingsUtil,
  saveUserConfigToBackend,
  saveUserSettings as saveUserSettingsUtil
} from '../shared/utils/user-settings';
import {
  validateHexColor,
  validateLanguageCode,
  validateName,
  ValidationError,
} from '../shared/utils/validation';

function Options() {
  const [user, setUser] = useState<UserDto | null>(null);
  const [folders, setFolders] = useState<LanguageFolderDto[]>([]);
  const [subjects, setSubjects] = useState<SubjectDto[]>([]);
  const [languages, setLanguages] = useState<LanguageDto[]>([]);
  const [selectedSourceLang, setSelectedSourceLang] = useState<string>('');
  const [selectedTargetLang, setSelectedTargetLang] = useState<string>('');
  const [, setWordTypes] = useState<WordTypeDto[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string>('');
  const [activeSubjectIds, setActiveSubjectIds] = useState<string[]>([]);
  
  const [error, setError] = useState<string>('');
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isCreateSubjectOpen, setIsCreateSubjectOpen] = useState(false);
  const [folderColor, setFolderColor] = useState('#4CAF50');

  const loadUserSettings = async (userId: string) => {
    try {
      const backendConfig = await loadUserConfigFromBackend();
      
      if (backendConfig && backendConfig.folderId && backendConfig.folderId.trim() !== '') {
        setActiveFolderId(backendConfig.folderId);
        setActiveSubjectIds(backendConfig.subjectIds || []);
        
        await saveUserSettingsUtil(userId, backendConfig.folderId, backendConfig.subjectIds);
        await storage.set('activeFolderId', backendConfig.folderId);
        await storage.set('activeSubjectIds', backendConfig.subjectIds);
      } else {
        const { folderId, subjectIds } = await loadUserSettingsUtil(userId);
        setActiveFolderId(folderId);
        setActiveSubjectIds(subjectIds);
      }
    } catch (error) {
      console.error('Error loading user settings:', error);
      try {
        const { folderId, subjectIds } = await loadUserSettingsUtil(userId);
        setActiveFolderId(folderId);
        setActiveSubjectIds(subjectIds);
      } catch (fallbackError) {
        console.error('Error loading from local storage:', fallbackError);
        setActiveFolderId('');
        setActiveSubjectIds([]);
      }
    }
  };

  useEffect(() => {
    checkAuth();

    const onStorageChanged = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.user) {
        if (changes.user.newValue) {
          const newUser = changes.user.newValue as UserDto;
          setUser(newUser);
          Promise.all([
            loadLanguages(),
            loadFolders(),
            loadSubjects(),
          ]).then(() => loadUserSettings(newUser.id));
        } else {
          setUser(null);
          setFolders([]);
          setSubjects([]);
          setActiveFolderId('');
          setActiveSubjectIds([]);
        }
      }
    };

    chrome.storage.local.onChanged.addListener(onStorageChanged);

    const handleLogoutMessage = () => {
      handleLogout();
    };

    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'LOGOUT') {
        handleLogoutMessage();
      }
    });

    return () => {
      chrome.storage.local.onChanged.removeListener(onStorageChanged); // ← cleanup
      chrome.runtime.onMessage.removeListener(handleLogoutMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAuth = async () => {
    const userData = await storage.get('user');
    if (userData) {
      setUser(userData);
      await Promise.all([
        loadLanguages(),
        loadFolders(),
        loadSubjects(),
      ]);
      await loadUserSettings(userData.id);
    }
  };

  const handleAuthSuccess = async (newUser: UserDto) => {
    setUser(newUser);
    setError('');
    await Promise.all([
      loadLanguages(),
      loadWordTypes(),
      loadFolders(),
      loadSubjects(),
    ]);
    await loadUserSettings(newUser.id);
  };

  const loadFolders = async () => {
    try {
      const data = await apiClient.get<IResponse<LanguageFolderDto>>('/language-folders/my');
      const foldersData = data.items || [];
      setFolders(foldersData);
      await storage.set('cachedFolders', foldersData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error loading folders:', error);
      
      if (errorMessage.includes('Session expired')) {
        await handleLogout();
      }
      
      setFolders([]);
    }
  };

  const loadSubjects = async () => {
    try {
      const data = await apiClient.get<IResponse<SubjectDto>>('/subjects');
      const subjectsData = data.items || [];
      setSubjects(subjectsData);
      await storage.set('cachedSubjects', subjectsData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error loading subjects:', error);
      
      if (errorMessage.includes('Session expired')) {
        await handleLogout();
      }
      
      setSubjects([]);
    }
  };

  const loadLanguages = async () => {
    try {
      const data = await apiClient.get<IResponse<LanguageDto>>('/languages');
      const languagesData = data.items || [];
      setLanguages(languagesData);
      await storage.set('cachedLanguages', languagesData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error loading languages:', error);
      
      if (errorMessage.includes('Session expired')) {
        await handleLogout();
      }
      
      setLanguages([]);
    }
  };

  const loadWordTypes = async () => {
    try {
      const data = await apiClient.get<IResponse<WordTypeDto>>('/word-types');
      const wordTypesData = data.items || [];
      setWordTypes(wordTypesData);
      await storage.set('cachedWordTypes', wordTypesData);
    } catch (error) {
      console.error('Error loading word types:', error);
      setWordTypes([]);
    }
  };

  

  const handleLogout = async () => {
    await tokenManager.clearTokens();
    await storage.clear();
    setUser(null);
    setFolders([]);
    setSubjects([]);
    setActiveFolderId('');
    setActiveSubjectIds([]);
    setIsCreateFolderOpen(false);
    setIsCreateSubjectOpen(false);
  };

  const handleCreateFolder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = formData.get('name') as string;
    const color = formData.get('color') as string || '#4CAF50';
    const sourceLanguageCode = formData.get('sourceLanguage') as string;
    const targetLanguageCode = formData.get('targetLanguage') as string;

    try {
      validateName(name, 'Folder name');
      validateHexColor(color);
      validateLanguageCode(sourceLanguageCode);
      validateLanguageCode(targetLanguageCode);

      const folderData: LanguageFolderInput = {
        name,
        folderColor: color,
        sourceLanguageCode,
        targetLanguageCode,
      };
      const folder = await apiClient.post('/language-folders', folderData);
      setFolders([...folders, folder as LanguageFolderDto]);
      form.reset();
      setSelectedSourceLang('');
      setSelectedTargetLang('');
      setFolderColor('#4CAF50');
      setIsCreateFolderOpen(false);
      toast.success('Folder created successfully');
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create folder');
      }
    }
  };

  const handleCreateSubject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = formData.get('name') as string;

    try {
      validateName(name, 'Subject name');

      const subjectData: SubjectInput = {
        name,
      };
      const subject = await apiClient.post('/subjects', subjectData);
      setSubjects([...subjects, subject as SubjectDto]);
      form.reset();
      setIsCreateSubjectOpen(false);
      toast.success('Subject created successfully');
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create subject');
      }
    }
  };

  const handleSaveSettings = async () => {
    if (!activeFolderId) {
      setError('Please select a folder before saving.');
      return;
    }

    if (!activeSubjectIds || activeSubjectIds.length === 0) {
      setError('Please select at least one subject before saving.');
      return;
    }

    if (!user) {
      setError('User not found. Please login again.');
      return;
    }

    try {
      const userData = await storage.get('user');
      if (!userData) {
        throw new Error('User not found');
      }
      
      await saveUserConfigToBackend(activeFolderId, activeSubjectIds);
      
      await cleanupOldUserSettings(userData.id);
      await saveUserSettingsUtil(user.id, activeFolderId, activeSubjectIds);
      await storage.set('activeFolderId', activeFolderId);
      await storage.set('activeSubjectIds', activeSubjectIds);
      setError('');
      toast.success('Settings saved successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save settings';
      setError(errorMessage);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background p-8">
          <AuthForm variant="options" onSuccess={handleAuthSuccess} />
      </div>
    );
  }

  const selectedFolder = folders.find(f => f.id === activeFolderId);

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Vocab Management Settings
            </h1>
            <p className="mt-1.5 text-muted-foreground">Manage your folders and subjects</p>
          </div>
          <Button
            onClick={handleLogout}
            variant="destructive"
            className="shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
          <div className="flex items-center gap-4">
            <Logo className="h-12 w-12" />
            <div>
              <p className="font-semibold text-foreground text-lg">
                {user.firstName + ' ' + user.lastName || 'User'}
              </p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border border-border p-8 space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Active Folder</h2>
                <p className="text-sm text-muted-foreground">Choose which folder to use for saving new vocabulary</p>
              </div>
            </div>
            
            <div className="mt-4">
              <Select value={activeFolderId} onValueChange={setActiveFolderId}>
                <SelectTrigger className="w-full h-12 text-base">
                  <SelectValue placeholder="Select a folder" />
                </SelectTrigger>
                <SelectContent>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      <div className="flex items-center gap-3 py-1">
                        <div
                          className="w-5 h-5 rounded-full shrink-0 border-2 border-background shadow-sm"
                          style={{ backgroundColor: folder.folderColor }}
                        />
                        <div className="flex-1">
                          <div className="font-medium text-base">{folder.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {folder.sourceLanguageCode.toUpperCase()} → {folder.targetLanguageCode.toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedFolder && (
              <div className="mt-4 p-4 bg-accent rounded-xl border border-border">
                <div className="flex items-center gap-3">
                  <div
                    className="w-6 h-6 rounded-full shrink-0 border-2 border-background shadow-md"
                    style={{ backgroundColor: selectedFolder.folderColor }}
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{selectedFolder.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedFolder.sourceLanguageCode.toUpperCase()} → {selectedFolder.targetLanguageCode.toUpperCase()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator className="my-6" />

          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                <Tag className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Active Subjects</h2>
                <p className="text-sm text-muted-foreground">Choose which subjects to categorize your vocabulary (max 3)</p>
              </div>
            </div>
            
            <div className="mt-4">
              <MultiSelect
                options={subjects.map(s => ({ label: s.name, value: s.id }))}
                onValueChange={setActiveSubjectIds}
                defaultValue={activeSubjectIds}
                placeholder="Select subjects"
                maxCount={3}
                searchable={true}
              />
            </div>

            {activeSubjectIds.length > 0 && (
              <div className="mt-4 p-4 bg-accent rounded-xl border border-border">
                <p className="text-sm font-medium text-foreground mb-2">
                  {activeSubjectIds.length} subject{activeSubjectIds.length > 1 ? 's' : ''} selected
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeSubjectIds.map(id => {
                    const subject = subjects.find(s => s.id === id);
                    return subject ? (
                      <div
                        key={id}
                        className="px-3 py-1.5 bg-background text-foreground rounded-lg text-sm font-medium border border-border"
                      >
                        {subject.name}
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => {
              setIsCreateFolderOpen(!isCreateFolderOpen);
              if (!isCreateFolderOpen) {
                setFolderColor('#4CAF50');
              }
            }}
            className="w-full bg-card rounded-xl shadow-sm border border-border p-4 hover:bg-accent transition-all duration-200 group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-background rounded-lg flex items-center justify-center transition-colors border border-border">
                  <Plus className="w-5 h-5 text-foreground" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-foreground">Create New Folder</h3>
                  <p className="text-sm text-muted-foreground">Add a new language learning folder</p>
                </div>
              </div>
              {isCreateFolderOpen ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
          </button>

          {isCreateFolderOpen && (
            <div className="bg-card rounded-xl shadow-sm border border-border p-6 animate-in slide-in-from-top-2 duration-200">
              <form onSubmit={handleCreateFolder} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-foreground">Folder Name</label>
                    <Input
                      name="name"
                      required
                      placeholder="e.g., English → Vietnamese"
                      className="h-11"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-foreground">Color</label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="color"
                        name="color"
                        value={folderColor}
                        onChange={(e) => setFolderColor(e.target.value)}
                        className="h-11 w-20 cursor-pointer"
                      />
                      <div className="flex-1 h-11 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono flex items-center" style={{ color: folderColor }}>
                        {folderColor.toUpperCase()}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-foreground">Source Language</label>
                    <Select
                      name="sourceLanguage"
                      value={selectedSourceLang}
                      onValueChange={setSelectedSourceLang}
                      required
                    >
                      <SelectTrigger className="w-full h-11">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        {languages.filter(lang => lang.code !== selectedTargetLang).map(lang => (
                          <SelectItem key={lang.id} value={lang.code}>
                            {lang.name} ({lang.code.toUpperCase()})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-foreground">Target Language</label>
                    <Select
                      name="targetLanguage"
                      value={selectedTargetLang}
                      onValueChange={setSelectedTargetLang}
                      required
                    >
                      <SelectTrigger className="w-full h-11">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        {languages.filter(lang => lang.code !== selectedSourceLang).map(lang => (
                          <SelectItem key={lang.id} value={lang.code}>
                            {lang.name} ({lang.code.toUpperCase()})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="w-full">
                  Create Folder
                </Button>
              </form>
            </div>
          )}

          <button
            onClick={() => setIsCreateSubjectOpen(!isCreateSubjectOpen)}
            className="w-full bg-card rounded-xl shadow-sm border border-border p-4 hover:bg-accent transition-all duration-200 group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-background rounded-lg flex items-center justify-center transition-colors border border-border">
                  <Plus className="w-5 h-5 text-foreground" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-foreground">Create New Subject</h3>
                  <p className="text-sm text-muted-foreground">Add a new subject to organize your vocabulary</p>
                </div>
              </div>
              {isCreateSubjectOpen ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
          </button>

          {isCreateSubjectOpen && (
            <div className="bg-card rounded-xl shadow-sm border border-border p-6 animate-in slide-in-from-top-2 duration-200">
              <form onSubmit={handleCreateSubject} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-foreground">Subject Name</label>
                  <Input
                    name="name"
                    required
                    placeholder="e.g., Business, Travel, Technology"
                    className="h-11"
                  />
                </div>
                <Button type="submit" className="w-full">
                  Create Subject
                </Button>
              </form>
            </div>
          )}
        </div>

        <div className="bg-card rounded-2xl shadow-lg border border-border p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold mb-1">Ready to save your settings?</h3>
              <p className="text-sm text-muted-foreground">
                {activeFolderId && activeSubjectIds.length > 0
                  ? 'All required settings are configured'
                  : 'Please select a folder and at least one subject'}
              </p>
            </div>
            <Button
              onClick={handleSaveSettings}
              disabled={!activeFolderId || activeSubjectIds.length === 0}
              className="w-full sm:w-auto px-8 shadow-md"
            >
              <Save className="w-5 h-5" />
              Save Settings
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-accent border border-border rounded-xl p-4 animate-in slide-in-from-top-2 duration-200">
            <p className="text-sm text-destructive font-medium">{error}</p>
          </div>
        )}
      </div>
      <Toaster />
    </div>
  );
}

export default Options;

