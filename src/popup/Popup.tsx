import { useEffect, useState } from 'react';
import { BookOpen, Settings, User } from 'lucide-react';
import { storage } from '../shared/utils/storage';
import type { UserDto, LanguageFolderDto, SubjectDto } from '../shared/types/vocab';

function Popup() {
  const [user, setUser] = useState<UserDto | null>(null);
  const [folder, setFolder] = useState<LanguageFolderDto | null>(null);
  const [subject, setSubject] = useState<SubjectDto | null>(null);

  useEffect(() => {
    loadData();

    // Listen for storage changes
    const unsubscribe = storage.onChanged.addListener(() => {
      loadData();
    });

    return () => {
      chrome.storage.onChanged.removeListener(unsubscribe);
    };
  }, []);

  const loadData = async () => {
    const [userData, folderId, subjectId] = await Promise.all([
      storage.get('user'),
      storage.get('activeFolderId'),
      storage.get('activeSubjectId'),
    ]);

    setUser(userData || null);

    if (folderId) {
      const folders = await storage.get('cachedFolders') || [];
      const activeFolder = folders.find((f) => f.id === folderId);
      setFolder(activeFolder || null);
    }

    if (subjectId) {
      const subjects = await storage.get('cachedSubjects') || [];
      const activeSubject = subjects.find((s) => s.id === subjectId);
      setSubject(activeSubject || null);
    }
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  if (!user) {
    return (
      <div className="w-80 p-6 bg-gray-50">
        <h1 className="text-xl font-bold mb-4 flex items-center gap-2">
          <BookOpen className="w-6 h-6" />
          Vocab Manager
        </h1>
        <p className="text-sm text-gray-600 mb-4">
          Please log in to start saving vocabulary.
        </p>
        <button
          onClick={openOptions}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center justify-center gap-2"
        >
          <Settings className="w-4 h-4" />
          Open Settings
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 p-6 bg-white">
      <h1 className="text-xl font-bold mb-4 flex items-center gap-2">
        <BookOpen className="w-6 h-6" />
        Vocab Manager
      </h1>

      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded">
          <User className="w-5 h-5 text-gray-600 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user.name || user.email}
            </p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-500">Active Settings</div>
          
          {folder && (
            <div className="p-2 bg-blue-50 rounded text-sm">
              <div className="font-medium">Folder</div>
              <div className="text-gray-600">{folder.name}</div>
            </div>
          )}

          {subject && (
            <div className="p-2 bg-green-50 rounded text-sm">
              <div className="font-medium">Subject</div>
              <div className="text-gray-600">{subject.name}</div>
            </div>
          )}

          {(!folder || !subject) && (
            <p className="text-xs text-gray-500">
              Please configure your folder and subject in settings.
            </p>
          )}
        </div>

        <button
          onClick={openOptions}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center justify-center gap-2"
        >
          <Settings className="w-4 h-4" />
          Open Settings
        </button>
      </div>
    </div>
  );
}

export default Popup;

