import { BookOpen, ChevronDown, ChevronUp, LogIn, LogOut, Plus, Save, Tag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '../background/api-client';
import { tokenManager } from '../background/token-manager';
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
import type { SignInInput, UserDto } from '../shared/types/api';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isCreateSubjectOpen, setIsCreateSubjectOpen] = useState(false);
  const [folderColor, setFolderColor] = useState('#4CAF50');

  const getUserSettingsKey = (userId: string, key: string) => `${key}_${userId}`;

  const cleanupOldUserSettings = async () => {
    try {
      const userData = await storage.get('user');
      if (!userData) {
        return;
      }
      
      const allData = await chrome.storage.local.get(null);
      if (chrome.runtime.lastError) {
        console.error('Error getting all storage data:', chrome.runtime.lastError);
        return;
      }
      
      const currentUserId = userData.id;
      const userSettingsKeys: string[] = [];
      
      for (const key in allData) {
        if (key.startsWith('activeFolderId_') || key.startsWith('activeSubjectIds_')) {
          const userId = key.split('_')[1];
          if (userId && userId !== currentUserId) {
            userSettingsKeys.push(key);
          }
        }
      }
      
      if (userSettingsKeys.length > 0) {
        await chrome.storage.local.remove(userSettingsKeys);
        if (chrome.runtime.lastError) {
          console.error('Error cleaning up old user settings:', chrome.runtime.lastError);
        }
      }
    } catch (error) {
      console.error('Error cleaning up old user settings:', error);
    }
  };

  const loadUserSettings = async (userId: string) => {
    const folderKey = getUserSettingsKey(userId, 'activeFolderId');
    const subjectIdsKey = getUserSettingsKey(userId, 'activeSubjectIds');
    const legacySubjectIdKey = getUserSettingsKey(userId, 'activeSubjectId');

    try {
      const result = await chrome.storage.local.get([folderKey, subjectIdsKey, legacySubjectIdKey]);
      
      if (chrome.runtime.lastError) {
        console.error('Error loading user settings:', chrome.runtime.lastError);
        setActiveFolderId('');
        setActiveSubjectIds([]);
        return;
      }
      
      const folderId = result[folderKey] || '';
      const subjectIds = result[subjectIdsKey];
      const legacySubjectId = result[legacySubjectIdKey];

      setActiveFolderId(folderId);

      if (subjectIds && Array.isArray(subjectIds)) {
        setActiveSubjectIds(subjectIds);
      } else if (legacySubjectId) {
        setActiveSubjectIds([legacySubjectId]);
        try {
          await chrome.storage.local.set({ [subjectIdsKey]: [legacySubjectId] });
          await chrome.storage.local.remove(legacySubjectIdKey);
          
          if (chrome.runtime.lastError) {
            console.error('Error migrating legacy subject ID:', chrome.runtime.lastError);
          }
        } catch (error) {
          console.error('Error migrating legacy subject ID:', error);
        }
      } else {
        setActiveSubjectIds([]);
      }
    } catch (error) {
      console.error('Error loading user settings:', error);
      setActiveFolderId('');
      setActiveSubjectIds([]);
    }
  };

  const saveUserSettings = async (userId: string, folderId: string, subjectIds: string[]) => {
    const folderKey = getUserSettingsKey(userId, 'activeFolderId');
    const subjectIdsKey = getUserSettingsKey(userId, 'activeSubjectIds');
    
    try {
      await chrome.storage.local.set({
        [folderKey]: folderId,
        [subjectIdsKey]: subjectIds,
      });
      
      if (chrome.runtime.lastError) {
        const errorMessage = chrome.runtime.lastError.message;
        if (errorMessage?.includes('QUOTA_BYTES') || errorMessage?.includes('quota')) {
          await cleanupOldUserSettings();
          
          try {
            await chrome.storage.local.set({
              [folderKey]: folderId,
              [subjectIdsKey]: subjectIds,
            });
            
            if (chrome.runtime.lastError) {
              throw new Error('Storage quota exceeded. Unable to save settings.');
            }
          } catch {
            throw new Error('Unable to save settings. Storage is full.');
          }
        } else {
          throw new Error(errorMessage || 'Failed to save settings');
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('quota') && !errorMessage.includes('QUOTA_BYTES')) {
        throw error;
      }
      throw new Error(errorMessage || 'Storage quota exceeded');
    }
  };

  useEffect(() => {
    checkAuth();

    const handleLogoutMessage = () => {
      handleLogout();
    };

    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'LOGOUT') {
        handleLogoutMessage();
      }
    });

    return () => {
      chrome.runtime.onMessage.removeListener(handleLogoutMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAuth = async () => {
    const userData = await storage.get('user');
    if (userData) {
      setUser(userData);
      await loadLanguages();
      await loadFolders();
      await loadSubjects();
      await loadUserSettings(userData.id);
    }
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

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const loginData: SignInInput = { email, password };
      const response = await apiClient.post<{ accessToken: string; refreshToken: string }>('/auth/signin', loginData);
      const signInResponse = response;

      await tokenManager.setTokens(
        signInResponse.accessToken,
        signInResponse.refreshToken
      );

      const verifyResponse = await apiClient.get<UserDto>('/auth/verify');
      const userData = verifyResponse
      await storage.set('user', userData);
      setUser(userData);

      await Promise.all([
        loadLanguages(),
        loadWordTypes(),
        loadFolders(),
        loadSubjects(),
      ]);

      await loadUserSettings(userData.id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      
      if (errorMessage.includes('Session expired')) {
        await handleLogout();
      }
    } finally {
      setLoading(false);
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
    const folderData: LanguageFolderInput = {
      name: formData.get('name') as string,
      folderColor: formData.get('color') as string || '#4CAF50',
      sourceLanguageCode: formData.get('sourceLanguage') as string,
      targetLanguageCode: formData.get('targetLanguage') as string,
    };

    try {
      const folder = await apiClient.post('/language-folders', folderData);
      setFolders([...folders, folder as LanguageFolderDto]);
      form.reset();
      setSelectedSourceLang('');
      setSelectedTargetLang('');
      setFolderColor('#4CAF50');
      setIsCreateFolderOpen(false);
      toast.success('Folder created successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    }
  };

  const handleCreateSubject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    const form = e.currentTarget;
    const formData = new FormData(form);
    const subjectData: SubjectInput = {
      name: formData.get('name') as string,
    };

    try {
      const subject = await apiClient.post('/subjects', subjectData);
      setSubjects([...subjects, subject as SubjectDto]);
      form.reset();
      setIsCreateSubjectOpen(false);
      toast.success('Subject created successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create subject');
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
      await saveUserSettings(user.id, activeFolderId, activeSubjectIds);
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
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-8">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl font-bold text-white">V</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Vocab Manager</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <LogIn className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-2xl font-semibold text-slate-900">Login</h2>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700">
                  Email
                </label>
                <Input
                  type="email"
                  name="email"
                  required
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700">
                  Password
                </label>
                <Input
                  type="password"
                  name="password"
                  required
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm font-medium">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold shadow-sm"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const selectedFolder = folders.find(f => f.id === activeFolderId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Vocab Manager Settings
            </h1>
            <p className="mt-1.5 text-slate-600">Manage your folders and subjects</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-lg">
                {user.firstName + ' ' + user.lastName || 'User'}
              </p>
              <p className="text-sm text-slate-600">{user.email}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Active Folder</h2>
                <p className="text-sm text-slate-600">Choose which folder to use for saving new vocabulary</p>
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
                          className="w-5 h-5 rounded-full shrink-0 border-2 border-white shadow-sm"
                          style={{ backgroundColor: folder.folderColor }}
                        />
                        <div className="flex-1">
                          <div className="font-medium text-base">{folder.name}</div>
                          <div className="text-xs text-slate-500">
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
              <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                <div className="flex items-center gap-3">
                  <div
                    className="w-6 h-6 rounded-full shrink-0 border-2 border-white shadow-md"
                    style={{ backgroundColor: selectedFolder.folderColor }}
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{selectedFolder.name}</p>
                    <p className="text-xs text-slate-600">
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
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Tag className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Active Subjects</h2>
                <p className="text-sm text-slate-600">Choose which subjects to categorize your vocabulary (max 3)</p>
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
              <div className="mt-4 p-4 bg-purple-50 rounded-xl border border-purple-200">
                <p className="text-sm font-medium text-slate-700 mb-2">
                  {activeSubjectIds.length} subject{activeSubjectIds.length > 1 ? 's' : ''} selected
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeSubjectIds.map(id => {
                    const subject = subjects.find(s => s.id === id);
                    return subject ? (
                      <div
                        key={id}
                        className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium"
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
            className="w-full bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-all duration-200 group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                  <Plus className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-slate-900">Create New Folder</h3>
                  <p className="text-sm text-slate-600">Add a new language learning folder</p>
                </div>
              </div>
              {isCreateFolderOpen ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </div>
          </button>

          {isCreateFolderOpen && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-in slide-in-from-top-2 duration-200">
              <form onSubmit={handleCreateFolder} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-slate-900">Folder Name</label>
                    <Input
                      name="name"
                      required
                      placeholder="e.g., English → Vietnamese"
                      className="h-11"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-slate-900">Color</label>
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
                    <label className="block text-sm font-semibold mb-2 text-slate-900">Source Language</label>
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
                    <label className="block text-sm font-semibold mb-2 text-slate-900">Target Language</label>
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
                <button
                  type="submit"
                  className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-all duration-200 font-semibold shadow-sm hover:shadow-md"
                >
                  Create Folder
                </button>
              </form>
            </div>
          )}

          <button
            onClick={() => setIsCreateSubjectOpen(!isCreateSubjectOpen)}
            className="w-full bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-all duration-200 group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                  <Plus className="w-5 h-5 text-orange-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-slate-900">Create New Subject</h3>
                  <p className="text-sm text-slate-600">Add a new subject to organize your vocabulary</p>
                </div>
              </div>
              {isCreateSubjectOpen ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </div>
          </button>

          {isCreateSubjectOpen && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-in slide-in-from-top-2 duration-200">
              <form onSubmit={handleCreateSubject} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-slate-900">Subject Name</label>
                  <Input
                    name="name"
                    required
                    placeholder="e.g., Business, Travel, Technology"
                    className="h-11"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-orange-600 text-white py-3 rounded-lg hover:bg-orange-700 transition-all duration-200 font-semibold shadow-sm hover:shadow-md"
                >
                  Create Subject
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-lg border border-blue-500/20 p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="text-white">
              <h3 className="text-lg font-bold mb-1">Ready to save your settings?</h3>
              <p className="text-sm text-blue-50">
                {activeFolderId && activeSubjectIds.length > 0
                  ? 'All required settings are configured'
                  : 'Please select a folder and at least one subject'}
              </p>
            </div>
            <button
              onClick={handleSaveSettings}
              disabled={!activeFolderId || activeSubjectIds.length === 0}
              className="w-full sm:w-auto bg-white text-blue-600 py-3 px-8 rounded-lg hover:bg-blue-50 transition-all duration-200 font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              Save Settings
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 animate-in slide-in-from-top-2 duration-200">
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}
      </div>
      <Toaster />
    </div>
  );
}

export default Options;

