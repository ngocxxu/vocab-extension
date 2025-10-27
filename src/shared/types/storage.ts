import type {
  UserDto,
  LanguageFolderDto,
  SubjectDto,
  WordTypeDto,
} from "./vocab";

export interface StorageData {
  accessToken?: string;
  refreshToken?: string;
  user?: UserDto;
  activeFolderId?: string;
  activeSubjectId?: string; // Legacy - kept for migration
  activeSubjectIds?: string[]; // New - supports multiple subjects
  activeWordTypeId?: string;
  cachedFolders?: LanguageFolderDto[];
  cachedSubjects?: SubjectDto[];
  cachedWordTypes?: WordTypeDto[];
}
