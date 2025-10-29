import { BookOpen, FolderTree, LogIn, LogOut, Save, Tag } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
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

type Tab = 'login' | 'folders' | 'subjects';

function Options() {
  const [activeTab, setActiveTab] = useState<Tab>('folders');
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
      setActiveTab('folders');
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
    setActiveTab('login');
  };

  const handleCreateFolder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    const formData = new FormData(e.currentTarget);
    const folderData: LanguageFolderInput = {
      name: formData.get('name') as string,
      folderColor: formData.get('color') as string || '#4CAF50',
      sourceLanguageCode: formData.get('sourceLanguage') as string,
      targetLanguageCode: formData.get('targetLanguage') as string,
    };

    try {
      const folder = await apiClient.post('/language-folders', folderData);
      setFolders([...folders, folder as LanguageFolderDto]);
      e.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    }
  };

  const handleCreateSubject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    const formData = new FormData(e.currentTarget);
    const subjectData: SubjectInput = {
      name: formData.get('name') as string,
    };

    try {
      const subject = await apiClient.post('/subjects', subjectData);
      setSubjects([...subjects, subject as SubjectDto]);
      e.currentTarget.reset();
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
      alert('Settings saved successfully!');
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

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-blue-50/30 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Vocab Manager Settings</h1>
              <p className="mt-2 text-slate-600">Manage your folders and subjects</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">{user.firstName + ' ' + user.lastName || 'User'}</p>
                <p className="text-sm text-slate-600">{user.email}</p>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as Tab)} className="w-full">
            <TabsList className="w-full grid grid-cols-2 rounded-t-xl rounded-b-none">
              <TabsTrigger value="folders" className="flex items-center justify-center gap-2">
                <FolderTree className="w-4 h-4" />
                Folders
              </TabsTrigger>
              <TabsTrigger value="subjects" className="flex items-center justify-center gap-2">
                <Tag className="w-4 h-4" />
                Subjects
              </TabsTrigger>
            </TabsList>

            <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-slate-200">
              <div className="p-6">
              <TabsContent value="folders" className="mt-0">
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-slate-900">Select Active Folder</h3>
                  <p className="text-sm text-slate-600 mb-4">Choose which folder to use for saving new vocabulary</p>
                  <Select value={activeFolderId} onValueChange={setActiveFolderId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a folder" />
                    </SelectTrigger>
                    <SelectContent>
                      {folders.map((folder) => (
                        <SelectItem key={folder.id} value={folder.id}>
                          <div className="flex items-center gap-3">
                            <div
                              className="w-4 h-4 rounded-full shrink-0"
                              style={{ backgroundColor: folder.folderColor }}
                            />
                            <div className="flex-1">
                              <div className="font-medium">{folder.name}</div>
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

                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-lg font-semibold mb-3 text-slate-900">Create New Folder</h3>
                  <p className="text-sm text-slate-600 mb-4">Add a new language learning folder</p>
                  <form onSubmit={handleCreateFolder} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-900">Name</label>
                        <Input
                          name="name"
                          required
                          placeholder="e.g., English → Vietnamese"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-900">Color</label>
                        <Input
                          type="color"
                          name="color"
                          defaultValue="#4CAF50"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-900">Source Language</label>
                        <Select
                          name="sourceLanguage"
                          value={selectedSourceLang}
                          onValueChange={setSelectedSourceLang}
                          required
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                          <SelectContent>
                            {languages.filter(lang => lang.code !== selectedTargetLang).map(lang => (
                              <SelectItem key={lang.id} value={lang.code}>
                                {lang.name} ({lang.code})
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
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                          <SelectContent>
                            {languages.filter(lang => lang.code !== selectedSourceLang).map(lang => (
                              <SelectItem key={lang.id} value={lang.code}>
                                {lang.name} ({lang.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors font-semibold shadow-sm"
                    >
                      Create Folder
                    </button>
                  </form>
                </div>
              </div>
              </TabsContent>

              <TabsContent value="subjects" className="mt-0">
                <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-slate-900">Select Active Subjects</h3>
                  <p className="text-sm text-slate-600 mb-4">Choose which subjects to categorize your vocabulary</p>
                  <MultiSelect
                    options={subjects.map(s => ({ label: s.name, value: s.id }))}
                    onValueChange={setActiveSubjectIds}
                    defaultValue={activeSubjectIds}
                    placeholder="Select subjects"
                    maxCount={3}
                    searchable={true}
                  />
                </div>

                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-lg font-semibold mb-3 text-slate-900">Create New Subject</h3>
                  <p className="text-sm text-slate-600 mb-4">Add a new subject to organize your vocabulary</p>
                  <form onSubmit={handleCreateSubject} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-slate-900">Name</label>
                      <Input
                        name="name"
                        required
                        placeholder="e.g., Business, Travel, Technology"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors font-semibold shadow-sm"
                    >
                      Create Subject
                    </button>
                  </form>
                </div>
              </div>
              </TabsContent>
              </div>
            </div>

            <div className="bg-white rounded-b-xl shadow-sm border border-slate-200 border-t p-6">
              <button
                onClick={handleSaveSettings}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center justify-center gap-2 shadow-sm"
              >
                <Save className="w-5 h-5" />
                Save Settings
              </button>
            </div>
          </Tabs>
        </div>
      </div>

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}
    </div>
  );
}

export default Options;

