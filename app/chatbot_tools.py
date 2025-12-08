#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Chatbot Tools - Các function mà chatbot có thể sử dụng để tương tác với dashboard
"""

import json
from datetime import datetime
from app.database import get_db_connection

# ===== NOTES TOOLS =====

# ===== NOTES TOOLS =====

def get_all_notes():
    """
    Lấy danh sách tất cả ghi chú.
    Returns:
        dict: {'success': True, 'notes': [...]}
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, title_html, content_html, due_time, status, modified_at, is_marked
            FROM notes
            ORDER BY modified_at DESC
        ''')
        notes = []
        for row in cursor.fetchall():
            notes.append({
                'id': row['id'],
                'title': row['title_html'],
                'content': row['content_html'],
                'due_time': row['due_time'],
                'status': row['status'],
                'modified_at': row['modified_at'],
                'is_marked': row['is_marked']
            })
        conn.close()
        return {'success': True, 'notes': notes}
    except Exception as e:
        return {'success': False, 'error': str(e)}

def search_notes(keyword):
    """
    Tìm kiếm ghi chú theo từ khóa trong tiêu đề hoặc nội dung.
    Args:
        keyword (str): Từ khóa cần tìm.
    Returns:
        dict: {'success': True, 'notes': [...], 'count': int}
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, title_html, content_html, due_time, status, modified_at, is_marked
            FROM notes
            WHERE title_html LIKE ? OR content_html LIKE ?
            ORDER BY modified_at DESC
        ''', (f'%{keyword}%', f'%{keyword}%'))
        notes = []
        for row in cursor.fetchall():
            notes.append({
                'id': row['id'],
                'title': row['title_html'],
                'content': row['content_html'],
                'due_time': row['due_time'],
                'status': row['status'],
                'modified_at': row['modified_at'],
                'is_marked': row['is_marked']
            })
        conn.close()
        return {'success': True, 'notes': notes, 'count': len(notes)}
    except Exception as e:
        return {'success': False, 'error': str(e)}

def add_note(title, content, due_time=None):
    """
    Tạo một ghi chú mới.
    """
    conn = None
    try:
        import uuid
        conn = get_db_connection()
        cursor = conn.cursor()
        note_id = str(uuid.uuid4())
        now = datetime.now().isoformat()
        cursor.execute('''
            INSERT INTO notes (id, title_html, content_html, due_time, status, modified_at, is_marked)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (note_id, title, content, due_time, 'active', now, 0))
        conn.commit()
        return {'success': True, 'note_id': note_id}
    except Exception as e:
        return {'success': False, 'error': str(e)}
    finally:
        if conn:
            conn.close()

def update_note(note_id, title=None, content=None, due_time=None):
    """
    Cập nhật nội dung của một ghi chú đã tồn tại.
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        updates = []
        values = []
        if title is not None:
            updates.append('title_html = ?')
            values.append(title)
        if content is not None:
            updates.append('content_html = ?')
            values.append(content)
        if due_time is not None:
            updates.append('due_time = ?')
            values.append(due_time)
        
        if not updates:
            return {'success': False, 'error': 'No fields to update'}

        updates.append('modified_at = ?')
        values.append(datetime.now().isoformat())
        values.append(note_id)
        query = f"UPDATE notes SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, values)
        conn.commit()
        return {'success': True}
    except Exception as e:
        return {'success': False, 'error': str(e)}
    finally:
        if conn:
            conn.close()

def delete_note(note_id):
    """
    Xóa vĩnh viễn một ghi chú.
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM notes WHERE id = ?', (note_id,))
        conn.commit()
        return {'success': True}
    except Exception as e:
        return {'success': False, 'error': str(e)}
    finally:
        if conn:
            conn.close()

def add_mxh_card(card_name, platform, group_id=None):
    """
    Tạo một thẻ MXH mới.
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        now = datetime.now().isoformat()
        cursor.execute('''
            INSERT INTO mxh_cards (card_name, platform, group_id, created_at, is_muted, is_disabled)
            VALUES (?, ?, ?, ?, 0, 0)
        ''', (card_name, platform, group_id, now))
        card_id = cursor.lastrowid
        conn.commit()
        return {'success': True, 'card_id': card_id}
    except Exception as e:
        return {'success': False, 'error': str(e)}
    finally:
        if conn:
            conn.close()

def update_mxh_card(card_id, card_name=None, platform=None, group_id=None, is_muted=None, is_disabled=None):
    """
    Cập nhật thẻ MXH.
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        updates = []
        values = []
        
        if card_name is not None:
            updates.append('card_name = ?')
            values.append(card_name)
        if platform is not None:
            updates.append('platform = ?')
            values.append(platform)
        if group_id is not None:
            updates.append('group_id = ?')
            values.append(group_id)
        if is_muted is not None:
            updates.append('is_muted = ?')
            values.append(int(is_muted))
        if is_disabled is not None:
            updates.append('is_disabled = ?')
            values.append(int(is_disabled))
            
        if not updates:
            return {'success': False, 'error': 'No fields to update'}
            
        values.append(card_id)
        query = f"UPDATE mxh_cards SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, values)
        conn.commit()
        return {'success': True}
    except Exception as e:
        return {'success': False, 'error': str(e)}
    finally:
        if conn:
            conn.close()

def delete_mxh_card(card_id):
    """
    Xóa thẻ MXH.
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM mxh_cards WHERE id = ?', (card_id,))
        conn.commit()
        return {'success': True}
    except Exception as e:
        return {'success': False, 'error': str(e)}
    finally:
        if conn:
            conn.close()

# ===== MXH TOOLS =====

def get_all_mxh_cards():
    """Lấy tất cả thẻ MXH kèm thông tin tài khoản chi tiết"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # Fetch cards with group info
        cursor.execute('''
            SELECT c.id, c.card_name, c.platform,
                   g.name as group_name, g.color as group_color
            FROM mxh_cards c
            LEFT JOIN mxh_groups g ON c.group_id = g.id
            ORDER BY c.card_name ASC
        ''')
        
        cards_map = {}
        for row in cursor.fetchall():
            cards_map[row['id']] = {
                'id': row['id'],
                'card_name': row['card_name'],
                'platform': row['platform'],
                'group_name': row['group_name'],
                'group_color': row['group_color'],
                'accounts': [] # Initialize accounts list
            }
            
        # Fetch all accounts
        cursor.execute('''
            SELECT card_id, account_name, username, login_username, login_password, phone, notice, wechat_status
            FROM mxh_accounts
        ''')
        
        for row in cursor.fetchall():
            card_id = row['card_id']
            if card_id in cards_map:
                cards_map[card_id]['accounts'].append({
                    'account_name': row['account_name'],
                    'username': row['username'],
                    'password': row['login_password'], # Mapped from login_password
                    'phone': row['phone'],
                    'notes': row['notice'], # Mapped from notice
                    'status': row['wechat_status']
                })
        
        return {'success': True, 'cards': list(cards_map.values())}
    except Exception as e:
        return {'success': False, 'error': str(e)}
    finally:
        if conn:
            conn.close()

def search_mxh_accounts(keyword):
    """Tìm kiếm tài khoản MXH"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT a.*, c.card_name, c.platform
            FROM mxh_accounts a
            JOIN mxh_cards c ON a.card_id = c.id
            WHERE a.account_name LIKE ? OR a.username LIKE ? OR a.email LIKE ?
            ORDER BY a.created_at DESC
        ''', (f'%{keyword}%', f'%{keyword}%', f'%{keyword}%'))
        accounts = []
        for row in cursor.fetchall():
            accounts.append({
                'id': row['id'],
                'card_name': row['card_name'],
                'platform': row['platform'],
                'account_name': row['account_name'],
                'username': row['username'],
                'email': row['email'],
                'phone': row['phone']
            })
        conn.close()
        return {'success': True, 'accounts': accounts}
    except Exception as e:
        return {'success': False, 'error': str(e)}

# ===== TELEGRAM TOOLS =====

def get_telegram_sessions():
    """Lấy danh sách Telegram sessions"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT s.*, g.name as group_name
            FROM session_metadata s
            JOIN session_groups g ON s.group_id = g.id
            ORDER BY s.last_checked DESC
        ''')
        sessions = []
        for row in cursor.fetchall():
            sessions.append({
                'id': row['id'],
                'group_name': row['group_name'],
                'filename': row['filename'],
                'full_name': row['full_name'],
                'username': row['username'],
                'is_live': row['is_live'],
                'status_text': row['status_text'],
                'last_checked': row['last_checked']
            })
        conn.close()
        return {'success': True, 'sessions': sessions}
    except Exception as e:
        return {'success': False, 'error': str(e)}

# ===== TOOL REGISTRY =====

AVAILABLE_TOOLS = {
    'get_all_notes': {
        'function': get_all_notes,
        'description': 'Lấy tất cả ghi chú từ database',
        'parameters': {}
    },
    'search_notes': {
        'function': search_notes,
        'description': 'Tìm kiếm ghi chú theo từ khóa',
        'parameters': {
            'keyword': {'type': 'string', 'description': 'Từ khóa tìm kiếm'}
        }
    },
    'add_note': {
        'function': add_note,
        'description': 'Tạo ghi chú mới',
        'parameters': {
            'title': {'type': 'string', 'description': 'Tiêu đề ghi chú'},
            'content': {'type': 'string', 'description': 'Nội dung ghi chú'},
            'due_time': {'type': 'string', 'optional': True, 'description': 'Thời gian nhắc nhở (ISO format)'}
        }
    },
    'update_note': {
        'function': update_note,
        'description': 'Cập nhật ghi chú',
        'parameters': {
            'note_id': {'type': 'string', 'description': 'ID của ghi chú'},
            'title': {'type': 'string', 'optional': True, 'description': 'Tiêu đề mới'},
            'content': {'type': 'string', 'optional': True, 'description': 'Nội dung mới'},
            'due_time': {'type': 'string', 'optional': True, 'description': 'Thời gian nhắc nhở mới'}
        }
    },
    'delete_note': {
        'function': delete_note,
        'description': 'Xóa ghi chú',
        'parameters': {
            'note_id': {'type': 'string', 'description': 'ID của ghi chú cần xóa'}
        }
    },
    'get_all_mxh_cards': {
        'function': get_all_mxh_cards,
        'description': 'Lấy tất cả thẻ MXH (Facebook, TikTok, etc.)',
        'parameters': {}
    },
    'search_mxh_accounts': {
        'function': search_mxh_accounts,
        'description': 'Tìm kiếm tài khoản MXH',
        'parameters': {
            'keyword': {'type': 'string', 'description': 'Từ khóa tìm kiếm'}
        }
    },
    'add_mxh_card': {
        'function': add_mxh_card,
        'description': 'Tạo thẻ MXH mới (WeChat, Facebook, etc.)',
        'parameters': {
            'card_name': {'type': 'string', 'description': 'Tên thẻ'},
            'platform': {'type': 'string', 'description': 'Nền tảng (wechat, facebook, tiktok...)'},
            'group_id': {'type': 'integer', 'optional': True, 'description': 'ID nhóm'}
        }
    },
    'update_mxh_card': {
        'function': update_mxh_card,
        'description': 'Cập nhật thẻ MXH',
        'parameters': {
            'card_id': {'type': 'integer', 'description': 'ID của thẻ'},
            'card_name': {'type': 'string', 'optional': True, 'description': 'Tên mới'},
            'platform': {'type': 'string', 'optional': True, 'description': 'Nền tảng mới'},
            'is_muted': {'type': 'boolean', 'optional': True, 'description': 'Tắt thông báo'},
            'is_disabled': {'type': 'boolean', 'optional': True, 'description': 'Vô hiệu hóa'}
        }
    },
    'delete_mxh_card': {
        'function': delete_mxh_card,
        'description': 'Xóa thẻ MXH',
        'parameters': {
            'card_id': {'type': 'integer', 'description': 'ID của thẻ cần xóa'}
        }
    },
    'get_telegram_sessions': {
        'function': get_telegram_sessions,
        'description': 'Lấy danh sách Telegram sessions',
        'parameters': {}
    }
}
