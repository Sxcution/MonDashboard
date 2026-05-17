type NoteId = number | string;

interface NotesApiConfig {
  getNotesUrl: string;
  addNoteUrl: string;
  updateNoteBase: string;
  deleteNoteBase: string;
  toggleMarkBase: string;
}

interface NotesNote {
  id: NoteId;
  title?: string;
  title_html?: string;
  content?: string;
  content_html?: string;
  plain_text?: string;
  status?: string;
  marked?: boolean | number;
  is_marked?: boolean | number;
  due_time?: string | null;
  created_at?: string;
  updated_at?: string;
  modified_at?: string;
  [key: string]: unknown;
}

interface NotesReminderState {
  enabled: boolean;
  dueTime?: string | null;
  status?: string;
}

interface NotesEditorState {
  activeNoteId: NoteId | null;
  isDirty: boolean;
  searchQuery: string;
}

interface NotesImageResizeOptions {
  maxW?: number;
  maxH?: number;
  quality?: number;
}

interface NotesMediaHelpers {
  compressImageFile(file: File, options?: NotesImageResizeOptions): Promise<string>;
  makeThumb(dataUrl: string, maxSide?: number, quality?: number): Promise<string>;
}

interface Window {
  NotesMedia: NotesMediaHelpers;
  notesData: NotesNote[];
  filteredNotes: NotesNote[];
  profileColors?: Record<string, string>;
  _lastProfileSpan?: HTMLElement | null;
  _lastProfileSpacer?: Text | null;
  _lastProfileEditor?: Element | null;
  closeDetailPanel?: () => void;
  toggleSplitMode?: (mode: number) => void;
  prepareAddNoteModal?: () => void;
  addNewNoteFromContextMenu?: () => void;
  deleteNoteWrapper?: (id: NoteId, event?: Event) => void | Promise<void>;
}
