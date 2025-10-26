export const API_BASE_URL = "http://localhost:3000";

export const STORAGE_KEYS = {
  ACCESS_TOKEN: "accessToken",
  REFRESH_TOKEN: "refreshToken",
  USER: "user",
  ACTIVE_FOLDER_ID: "activeFolderId",
  ACTIVE_SUBJECT_ID: "activeSubjectId",
  ACTIVE_WORD_TYPE_ID: "activeWordTypeId",
} as const;

export const API_ENDPOINTS = {
  AUTH: {
    SIGNIN: "/auth/signin",
    VERIFY: "/auth/verify",
    REFRESH: "/auth/refresh",
    SIGNOUT: "/auth/signout",
  },
  FOLDERS: {
    MY: "/language-folders/my",
    CREATE: "/language-folders",
  },
  SUBJECTS: {
    LIST: "/subjects",
    CREATE: "/subjects",
  },
  WORD_TYPES: {
    LIST: "/word-types",
  },
  VOCABS: {
    CREATE: "/vocabs",
  },
} as const;
