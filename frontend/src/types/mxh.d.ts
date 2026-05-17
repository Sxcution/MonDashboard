type MXHId = number | string;

interface MXHNotice extends MXHAnyRecord {
  id?: MXHId;
  enabled?: boolean | number;
  title?: string;
  days?: number | string;
  note?: string;
  start_at?: string;
  due_date?: string;
  dueDate?: string;
}

interface MXHAccount extends MXHAnyRecord {
  login_username?: string;
  wechat_scan_count?: number;
  wechat_last_scan_date?: string | null;
  disabled_date?: string | null;
  die_date?: string | null;
}

interface MXHCardState {
  activeAccountId: number | null;
  isFlipped: boolean;
}

interface MXHPhoneHistoryEntry extends MXHAnyRecord {
  id?: MXHId;
  account_id?: MXHId;
  phone?: string;
  created_at?: string;
}

interface MXHScanHistoryEntry extends MXHAnyRecord {
  id?: MXHId;
  account_id?: MXHId;
  result?: string;
  created_at?: string;
}

type MXHRenderContext = MXHAnyRecord;
