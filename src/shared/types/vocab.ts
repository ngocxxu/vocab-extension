export interface LanguageFolderDto {
  id: string;
  name: string;
  folderColor: string;
  sourceLanguageCode: string;
  targetLanguageCode: string;
  userId: string;
}

export interface LanguageFolderInput {
  name: string;
  folderColor: string;
  sourceLanguageCode: string;
  targetLanguageCode: string;
}

export interface SubjectDto {
  id: string;
  name: string;
  order: number;
}

export interface SubjectInput {
  name: string;
}

export interface WordTypeDto {
  id: string;
  name: string;
}

export interface VocabExampleDto {
  source: string;
  target: string;
}

export interface CreateTextTargetInput {
  wordTypeId?: string;
  textTarget: string;
  grammar: string;
  explanationSource: string;
  explanationTarget: string;
  subjectIds: string[];
  vocabExamples?: VocabExampleDto[];
}

export interface VocabInput {
  textSource: string;
  sourceLanguageCode: string;
  targetLanguageCode: string;
  languageFolderId: string;
  textTargets: CreateTextTargetInput[];
}

export interface VocabDto {
  id: string;
  textSource: string;
  sourceLanguageCode: string;
  targetLanguageCode: string;
  userId: string;
  languageFolderId: string;
  createdAt: Date;
  updatedAt: Date;
}
