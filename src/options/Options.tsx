import { useState, useEffect } from 'react';
import { LogIn, FolderTree, Tag, LogOut, Save, BookOpen } from 'lucide-react';
import { apiClient } from '../background/api-client';
import { storage } from '../shared/utils/storage';
import { tokenManager } from '../background/token-manager';
import type { UserDto, SignInInput } from '../shared/types/api';
import type {
  LanguageFolderDto,
  SubjectDto,
  WordTypeDto,
  LanguageFolderInput,
  SubjectInput,
} from '../shared/types/vocab';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { MultiSelect } from '../components/ui/multi-select';

type Tab = 'login' | 'folders' | 'subjects';

function Options() {
  const [activeTab, setActiveTab] = useState<Tab>('login');
  const [user, setUser] = useState<UserDto | null>(null);
  const [folders, setFolders] = useState<LanguageFolderDto[]>([]);
  const [subjects, setSubjects] = useState<SubjectDto[]>([]);
  const [, setWordTypes] = useState<WordTypeDto[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string>('');
  const [activeSubjectIds, setActiveSubjectIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    checkAuth();
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAuth = async () => {
    const userData = await storage.get('user');
    if (userData) {
      setUser(userData);
      await loadFolders();
      await loadSubjects();
    }
  };

  const loadSettings = async () => {
    const [folderId, subjectIds, legacySubjectId] = await Promise.all([
      storage.get('activeFolderId'),
      storage.get('activeSubjectIds'),
      storage.get('activeSubjectId'),
    ]);
    setActiveFolderId(folderId || '');
    
    if (subjectIds && Array.isArray(subjectIds)) {
      setActiveSubjectIds(subjectIds);
    } else if (legacySubjectId) {
      setActiveSubjectIds([legacySubjectId]);
      await storage.set('activeSubjectIds', [legacySubjectId]);
      await storage.remove(['activeSubjectId']);
    } else {
      setActiveSubjectIds([]);
    }
  };

  const loadFolders = async () => {
    try {
      const data = await apiClient.get('/language-folders/my');
      const foldersData = Array.isArray((data as { data: LanguageFolderDto[] }).data) 
        ? (data as { data: LanguageFolderDto[] }).data 
        : Array.isArray(data) 
          ? data 
          : [];
      setFolders(foldersData);
      await storage.set('cachedFolders', foldersData);
    } catch (error) {
      console.error('Error loading folders:', error);
      setFolders([]);
    }
  };

  const loadSubjects = async () => {
    try {
      const data = await apiClient.get('/subjects');
      const subjectsData = Array.isArray((data as { data: SubjectDto[] }).data) 
        ? (data as { data: SubjectDto[] }).data 
        : Array.isArray(data) 
          ? data 
          : [];
      setSubjects(subjectsData);
      await storage.set('cachedSubjects', subjectsData);
    } catch (error) {
      console.error('Error loading subjects:', error);
      setSubjects([]);
    }
  };

  const loadWordTypes = async () => {
    try {
      const data = await apiClient.get('/word-types');
      const wordTypesData = Array.isArray((data as { data: WordTypeDto[] }).data) 
        ? (data as { data: WordTypeDto[] }).data 
        : Array.isArray(data) 
          ? data 
          : [];
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

      const verifyResponse = await apiClient.get('/auth/verify');
      const userData = verifyResponse as UserDto;
      await storage.set('user', userData);
      setUser(userData);

      // Auto-create default folder and subject if needed
      await ensureDefaultSettings();

      await loadWordTypes();
      setActiveTab('folders');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
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

  const ensureDefaultSettings = async () => {
    // First, try to fetch existing folders and subjects
    await loadFolders();
    await loadSubjects();
    
    // Get fresh data from storage to avoid stale state
    const [cachedFolders, cachedSubjects] = await Promise.all([
      storage.get('cachedFolders'),
      storage.get('cachedSubjects'),
    ]);
    
    const currentFolders = Array.isArray(cachedFolders) ? cachedFolders : [];
    const currentSubjects = Array.isArray(cachedSubjects) ? cachedSubjects : [];

    // Check if default folder exists
    if (currentFolders.length === 0) {
      const defaultFolder: LanguageFolderInput = {
        name: 'Default',
        folderColor: '#4CAF50',
        sourceLanguageCode: 'en',
        targetLanguageCode: 'vi',
      };

      try {
        const folder = await apiClient.post('/language-folders', defaultFolder);
        const folderData = folder as LanguageFolderDto;
        await storage.set('activeFolderId', folderData.id);
        setActiveFolderId(folderData.id);
        const updatedFolders = [...currentFolders, folderData];
        setFolders(updatedFolders);
        await storage.set('cachedFolders', updatedFolders);
      } catch (error) {
        console.error('Error creating default folder:', error);
      }
    } else {
      setActiveFolderId(currentFolders[0].id);
    }

    // Check if default subject exists
    const defaultSubjectExists = currentSubjects.find(s => s.name === 'Default');
    
    if (!defaultSubjectExists) {
      const defaultSubject: SubjectInput = {
        name: 'Default',
      };

      try {
        const subject = await apiClient.post('/subjects', defaultSubject);
        const subjectData = subject as SubjectDto;
        await storage.set('activeSubjectIds', [subjectData.id]);
        setActiveSubjectIds([subjectData.id]);
        const updatedSubjects = [...currentSubjects, subjectData];
        setSubjects(updatedSubjects);
        await storage.set('cachedSubjects', updatedSubjects);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('already exists') || errorMessage.includes('409')) {
          const subjectsData = await apiClient.get('/subjects');
          const subjectsList = Array.isArray((subjectsData as { data: SubjectDto[] }).data) 
            ? (subjectsData as { data: SubjectDto[] }).data 
            : Array.isArray(subjectsData) 
              ? subjectsData 
              : [];
          const existingDefault = subjectsList.find(s => s.name === 'Default');
          if (existingDefault) {
            await storage.set('activeSubjectIds', [existingDefault.id]);
            setActiveSubjectIds([existingDefault.id]);
            setSubjects(subjectsList);
            await storage.set('cachedSubjects', subjectsList);
          }
        } else {
          console.error('Error creating default subject:', error);
        }
      }
    } else {
      setActiveSubjectIds([defaultSubjectExists.id]);
    }
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
    await storage.set('activeFolderId', activeFolderId);
    await storage.set('activeSubjectIds', activeSubjectIds);
    alert('Settings saved successfully!');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-linear-to-b from-slate-50 to-slate-100 p-8">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <BookOpen className="w-7 h-7 text-white" />
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
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-slate-700">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none"
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 p-8">
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
                <p className="font-semibold text-slate-900">{user.name || 'User'}</p>
                <p className="text-sm text-slate-600">{user.email}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="flex border-b border-slate-200">
              {(['folders', 'subjects'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-6 py-4 border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-blue-600 text-blue-600 font-semibold'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab === 'folders' ? (
                    <span className="flex items-center justify-center gap-2">
                      <FolderTree className="w-4 h-4" />
                      Folders
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Tag className="w-4 h-4" />
                      Subjects
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="p-6">
            {activeTab === 'folders' && (
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
                              className="w-4 h-4 rounded-full flex-shrink-0"
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
                        <input
                          type="text"
                          name="name"
                          required
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none"
                          placeholder="e.g., English → Vietnamese"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-900">Color</label>
                        <input
                          type="color"
                          name="color"
                          defaultValue="#4CAF50"
                          className="w-full h-11 rounded-lg border border-slate-300 cursor-pointer"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-900">Source Language</label>
                        <input
                          type="text"
                          name="sourceLanguage"
                          placeholder="en"
                          required
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-900">Target Language</label>
                        <input
                          type="text"
                          name="targetLanguage"
                          placeholder="vi"
                          required
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none"
                        />
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
            )}

            {activeTab === 'subjects' && (
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
                  />
                </div>

                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-lg font-semibold mb-3 text-slate-900">Create New Subject</h3>
                  <p className="text-sm text-slate-600 mb-4">Add a new subject to organize your vocabulary</p>
                  <form onSubmit={handleCreateSubject} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-slate-900">Name</label>
                      <input
                        type="text"
                        name="name"
                        required
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none"
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
            )}
            </div>

            <div className="border-t border-slate-200 p-6">
              <button
                onClick={handleSaveSettings}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center justify-center gap-2 shadow-sm"
              >
                <Save className="w-5 h-5" />
                Save Settings
              </button>
            </div>
          </div>
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

