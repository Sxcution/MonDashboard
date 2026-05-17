type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiErrorPayload {
  error?: string;
  message?: string;
  detail?: string;
  details?: string;
  install_hint?: string;
  [key: string]: unknown;
}

interface ApiEnvelope<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
  response: Response;
}

interface JsonRequestOptions extends Omit<RequestInit, "body" | "method" | "headers"> {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
}

interface HttpClient {
  request<T = unknown>(url: string, init?: RequestInit): Promise<T>;
  blob(url: string, init?: RequestInit): Promise<Blob>;
  json<T = unknown>(url: string, options?: JsonRequestOptions): Promise<T>;
  raw(url: string, options?: JsonRequestOptions): Promise<Response>;
  postJson<T = unknown>(url: string, body?: unknown, init?: Omit<JsonRequestOptions, "method" | "body">): Promise<T>;
  putJson<T = unknown>(url: string, body?: unknown, init?: Omit<JsonRequestOptions, "method" | "body">): Promise<T>;
  deleteJson<T = unknown>(url: string, init?: Omit<JsonRequestOptions, "method">): Promise<T>;
}

interface Window {
  MonHttp: HttpClient;
  MXHTypedApi: MXHTypedApiClient;
  NotesApiFactory: NotesApiFactory;
  ImageApi: ImageApiClient;
}

interface MXHTypedApiClient {
  getGroups(signal?: AbortSignal): Promise<MXHGroup[]>;
  getAccounts(lastUpdateTime?: string | null, signal?: AbortSignal): Promise<MXHAccount[]>;
  createAccount(payload: Partial<MXHAccount>): Promise<MXHAccount>;
  updateAccount(accountId: MXHId, payload: Partial<MXHAccount>): Promise<MXHAccount>;
  deleteAccount(accountId: MXHId): Promise<unknown>;
  setNotice(accountId: MXHId, payload: MXHNotice): Promise<unknown>;
  deleteNotice(accountId: MXHId): Promise<unknown>;
}

interface NotesApiClient {
  getNotes(): Promise<NotesNote[]>;
  addNote(payload: Partial<NotesNote>): Promise<NotesNote>;
  updateNote(noteId: NoteId, payload: Partial<NotesNote>): Promise<NotesNote>;
  deleteNote(noteId: NoteId, method?: "POST" | "DELETE"): Promise<unknown>;
  toggleMark(noteId: NoteId): Promise<unknown>;
}

interface NotesApiFactory {
  fromConfig(config: NotesApiConfig): NotesApiClient;
}

interface ImageApiClient {
  objectRemove(formData: FormData): Promise<Blob>;
  upscaleImage(formData: FormData): Promise<Blob>;
  saveCollage(formData: FormData): Promise<unknown>;
  collageHistory(): Promise<{ history: ImageCollageHistoryItem[] }>;
  deleteCollage(id: string): Promise<unknown>;
}
