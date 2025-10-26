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
  activeSubjectId?: string;
  activeWordTypeId?: string;
  cachedFolders?: LanguageFolderDto[];
  cachedSubjects?: SubjectDto[];
  cachedWordTypes?: WordTypeDto[];
}
