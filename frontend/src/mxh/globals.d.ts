type MXHAnyRecord = Record<string, any>;

interface MXHAccount extends MXHAnyRecord {
  id: number;
  card_id?: number | string;
  card_name?: string;
  group_id?: number | string;
  platform?: string;
  username?: string;
  phone?: string;
  email?: string;
  url?: string;
  notes?: string;
  status?: string;
  notice?: string | MXHAnyRecord | null;
  is_primary?: boolean;
  wechat_status?: string;
  wechat_nickname?: string;
  wechat_created_day?: number;
  wechat_created_month?: number;
  wechat_created_year?: number;
  created_at?: string;
  updated_at?: string;
}

interface MXHGroup extends MXHAnyRecord {
  id: number;
  name: string;
  color?: string;
}

type MXHRenderContext = MXHAnyRecord;

declare const bootstrap: any;
declare const MXHState: any;
declare const MXHApi: any;
declare const MXHUtils: any;
declare const MXHAccountRules: any;
declare const MXHBadges: any;
declare const MXHFilters: any;
declare const MXHRender: any;
declare const MXHFlipCard: any;
declare const MXHContextMenu: any;
declare const MXHInlineEdit: any;
declare const MXHPhoneHistory: any;
declare const MXHScanHistory: any;
declare const MXHNoticePreview: any;
declare const MXHModalForms: any;
declare const MXHAccountNotices: any;
declare const MXHAccountActions: any;
declare const MXHContextActions: any;
declare const MXHInit: any;

interface Window {
  interactionPaused: boolean;
  MXHState: any;
  MXHApi: any;
  MXHUtils: any;
  MXHAccountRules: any;
  MXHBadges: any;
  MXHFilters: any;
  MXHRender: any;
  MXHFlipCard: any;
  MXHContextMenu: any;
  MXHInlineEdit: any;
  MXHPhoneHistory: any;
  MXHScanHistory: any;
  MXHNoticePreview: any;
  MXHModalForms: any;
  MXHAccountNotices: any;
  MXHAccountActions: any;
  MXHContextActions: any;
  MXHInit: any;
  handleCardContextMenu: any;
  toggleAccountStatus: any;
  copyPhoneHistory: any;
  saveInlineEdit: any;
  alert: any;
  confirm: any;
}

interface HTMLElement {
  value: string;
  checked: boolean;
  disabled: boolean;
}
