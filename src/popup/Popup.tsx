import { useEffect, useState } from 'react';
import { BookOpen, Settings, User } from 'lucide-react';
import { storage } from '../shared/utils/storage';
import type { UserDto } from '../shared/types/api';
import type { LanguageFolderDto, SubjectDto } from '../shared/types/vocab';

function Popup() {
  const [user, setUser] = useState<UserDto | null>(null);
  const [folder, setFolder] = useState<LanguageFolderDto | null>(null);
  const [subjects, setSubjects] = useState<SubjectDto[]>([]);

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

  const loadData = async () => {
    const [userData, folderId, subjectIds] = await Promise.all([
      storage.get('user'),
      storage.get('activeFolderId'),
      storage.get('activeSubjectIds'),
    ]);

    setUser(userData || null);

    if (folderId) {
      const folders = await storage.get('cachedFolders') || [];
      const activeFolder = folders.find((f) => f.id === folderId);
      setFolder(activeFolder || null);
    }

    if (subjectIds && Array.isArray(subjectIds) && subjectIds.length > 0) {
      const allSubjects = await storage.get('cachedSubjects') || [];
      const activeSubjects = allSubjects.filter((s) => subjectIds.includes(s.id));
      setSubjects(activeSubjects);
    } else {
      setSubjects([]);
    }
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  if (!user) {
    return (
      <div className="w-80 p-6 bg-linear-to-b from-slate-50 to-white">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Vocab Manager</h1>
        </div>
        
        <div className="mb-6">
          <p className="text-sm text-slate-600 mb-1">
            Please log in to start saving vocabulary.
          </p>
        </div>
        
        <button
          onClick={openOptions}
          className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 shadow-sm"
        >
          <Settings className="w-4 h-4" />
          Open Settings
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 bg-linear-to-b from-slate-50 to-white">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Vocab Manager</h1>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {user.name || user.email}
            </p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
            Active Settings
          </div>
          
          <div className="space-y-2">
            {folder && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <div className="text-xs font-medium text-blue-900 mb-0.5">Folder</div>
                <div className="text-sm font-medium text-blue-700">{folder.name}</div>
                <div className="text-xs text-blue-600 mt-0.5">
                  {folder.sourceLanguageCode} → {folder.targetLanguageCode}
                </div>
              </div>
            )}

            {subjects.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-emerald-900 mb-0.5">
                  Subject{subjects.length > 1 ? 's' : ''}
                </div>
                {subjects.map((subject) => (
                  <div key={subject.id} className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                    <div className="text-sm font-medium text-emerald-700">{subject.name}</div>
                  </div>
                ))}
              </div>
            )}

            {(!folder || subjects.length === 0) && (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                <p className="text-xs text-amber-800">
                  Please configure your folder and subject in settings.
                </p>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={openOptions}
          className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 shadow-sm"
        >
          <Settings className="w-4 h-4" />
          Open Settings
        </button>
      </div>
    </div>
  );
}

export default Popup;

