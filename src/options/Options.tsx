import { useState, useEffect } from 'react';
import { LogIn, FolderTree, Tag, LogOut, Save } from 'lucide-react';
import { apiClient } from '../background/api-client';
import { storage } from '../shared/utils/storage';
import { tokenManager } from '../background/token-manager';
import type {
  UserDto,
  LanguageFolderDto,
  SubjectDto,
  WordTypeDto,
  SignInInput,
  LanguageFolderInput,
  SubjectInput,
} from '../shared/types/vocab';

type Tab = 'login' | 'folders' | 'subjects';

function Options() {
  const [activeTab, setActiveTab] = useState<Tab>('login');
  const [user, setUser] = useState<UserDto | null>(null);
  const [folders, setFolders] = useState<LanguageFolderDto[]>([]);
  const [subjects, setSubjects] = useState<SubjectDto[]>([]);
  const [wordTypes, setWordTypes] = useState<WordTypeDto[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string>('');
  const [activeSubjectId, setActiveSubjectId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    checkAuth();
    loadSettings();
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
    const [folderId, subjectId] = await Promise.all([
      storage.get('activeFolderId'),
      storage.get('activeSubjectId'),
    ]);
    setActiveFolderId(folderId || '');
    setActiveSubjectId(subjectId || '');
  };

  const loadFolders = async () => {
    try {
      const data = await apiClient.get('/language-folders/my');
      const foldersData = (data as { data: LanguageFolderDto[] }).data || data;
      setFolders(foldersData);
      await storage.set('cachedFolders', foldersData);
    } catch (error) {
      console.error('Error loading folders:', error);
    }
  };

  const loadSubjects = async () => {
    try {
      const data = await apiClient.get('/subjects');
      const subjectsData = (data as { data: SubjectDto[] }).data || data;
      setSubjects(subjectsData);
      await storage.set('cachedSubjects', subjectsData);
    } catch (error) {
      console.error('Error loading subjects:', error);
    }
  };

  const loadWordTypes = async () => {
    try {
      const data = await apiClient.get('/word-types');
      const wordTypesData = (data as { data: WordTypeDto[] }).data || data;
      setWordTypes(wordTypesData);
      await storage.set('cachedWordTypes', wordTypesData);
    } catch (error) {
      console.error('Error loading word types:', error);
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
      const response = await apiClient.post('/auth/signin', loginData);
      const signInResponse = response as any;

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

      await loadFolders();
      await loadSubjects();
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
    setActiveSubjectId('');
    setActiveTab('login');
  };

  const ensureDefaultSettings = async () => {
    // Check if default folder exists
    if (folders.length === 0) {
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
      } catch (error) {
        console.error('Error creating default folder:', error);
      }
    } else {
      setActiveFolderId(folders[0].id);
    }

    // Check if default subject exists
    if (subjects.length === 0) {
      const defaultSubject: SubjectInput = {
        name: 'Default',
      };

      try {
        const subject = await apiClient.post('/subjects', defaultSubject);
        const subjectData = subject as SubjectDto;
        await storage.set('activeSubjectId', subjectData.id);
        setActiveSubjectId(subjectData.id);
      } catch (error) {
        console.error('Error creating default subject:', error);
      }
    } else {
      setActiveSubjectId(subjects[0].id);
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
    await storage.set('activeSubjectId', activeSubjectId);
    alert('Settings saved successfully!');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Vocab Manager Settings</h1>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <LogIn className="w-5 h-5" />
              Login
            </h2>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <input
                  type="password"
                  name="password"
                  required
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              {error && <p className="text-red-600 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Vocab Manager Settings</h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        <div className="flex items-center gap-2 mb-6">
          <p className="text-gray-600">{user.email}</p>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="flex border-b">
            {(['folders', 'subjects'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 border-b-2 ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab === 'folders' ? (
                  <span className="flex items-center gap-2">
                    <FolderTree className="w-4 h-4" />
                    Folders
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Subjects
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === 'folders' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Select Active Folder</h3>
                  <div className="space-y-2">
                    {folders.map((folder) => (
                      <label key={folder.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="radio"
                          name="folder"
                          value={folder.id}
                          checked={activeFolderId === folder.id}
                          onChange={() => setActiveFolderId(folder.id)}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{folder.name}</div>
                          <div className="text-sm text-gray-500">
                            {folder.sourceLanguageCode} → {folder.targetLanguageCode}
                          </div>
                        </div>
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: folder.folderColor }}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Create New Folder</h3>
                  <form onSubmit={handleCreateFolder} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Name</label>
                        <input
                          type="text"
                          name="name"
                          required
                          className="w-full px-3 py-2 border rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Color</label>
                        <input
                          type="color"
                          name="color"
                          defaultValue="#4CAF50"
                          className="w-full h-10"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Source Language</label>
                        <input
                          type="text"
                          name="sourceLanguage"
                          placeholder="en"
                          required
                          className="w-full px-3 py-2 border rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Target Language</label>
                        <input
                          type="text"
                          name="targetLanguage"
                          placeholder="vi"
                          required
                          className="w-full px-3 py-2 border rounded"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
                    >
                      Create Folder
                    </button>
                  </form>
                </div>
              </div>
            )}

            {activeTab === 'subjects' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Select Active Subject</h3>
                  <div className="space-y-2">
                    {subjects.map((subject) => (
                      <label key={subject.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="radio"
                          name="subject"
                          value={subject.id}
                          checked={activeSubjectId === subject.id}
                          onChange={() => setActiveSubjectId(subject.id)}
                        />
                        <span>{subject.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Create New Subject</h3>
                  <form onSubmit={handleCreateSubject} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Name</label>
                      <input
                        type="text"
                        name="name"
                        required
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
                    >
                      Create Subject
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleSaveSettings}
            className="w-full bg-blue-600 text-white py-3 rounded hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            Save Settings
          </button>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-700 rounded">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default Options;

