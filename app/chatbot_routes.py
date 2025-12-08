from flask import Blueprint, request, jsonify, render_template
import sqlite3
import json
import os
import uuid
from datetime import datetime
from .database import get_db_connection
from app.chatbot_tools import AVAILABLE_TOOLS

chatbot_bp = Blueprint('chatbot', __name__, url_prefix='/api/chat')

# --- Helper Functions ---

def get_ai_settings():
    conn = get_db_connection()
    try:
        settings = conn.execute('SELECT key, value FROM ai_settings').fetchall()
        return {row['key']: row['value'] for row in settings}
    except:
        return {}
    finally:
        conn.close()

def save_ai_setting(key, value):
    conn = get_db_connection()
    conn.execute('INSERT OR REPLACE INTO ai_settings (key, value) VALUES (?, ?)', (key, value))
    conn.commit()
    conn.close()

def get_context_data():
    """Fetch relevant data from Dashboard for AI context"""
    conn = get_db_connection()
    
    # 1. Get Notes (Fix: Sort by modified_at DESC to show latest notes)
    notes = conn.execute('SELECT title_html, content_html, status FROM notes WHERE is_marked = 0 ORDER BY modified_at DESC LIMIT 5').fetchall()
    notes_text = "Recent Notes:\n" + "\n".join([f"- [{n['status']}] {n['title_html']}: {n['content_html']}" for n in notes])
    
    # 2. Get Telegram Sessions Status
    sessions = conn.execute('SELECT filename, status_text, is_live FROM session_metadata LIMIT 10').fetchall()
    sessions_text = "Telegram Sessions:\n" + "\n".join([f"- {s['filename']}: {s['status_text']} (Live: {s['is_live']})" for s in sessions])
    
    # 3. Get MXH Accounts
    accounts = conn.execute('SELECT account_name, username, platform FROM mxh_accounts JOIN mxh_cards ON mxh_accounts.card_id = mxh_cards.id LIMIT 10').fetchall()
    accounts_text = "Social Accounts:\n" + "\n".join([f"- {a['platform']}: {a['account_name']} ({a['username']})" for a in accounts])
    
    conn.close()
    
    return f"{notes_text}\n\n{sessions_text}\n\n{accounts_text}"

# --- API Endpoints ---

@chatbot_bp.route('/sessions', methods=['GET'])
def get_sessions():
    """Get list of chat sessions"""
    try:
        conn = get_db_connection()
        # Ensure table exists (migration check)
        try:
            sessions = conn.execute('SELECT id, title, updated_at FROM chat_sessions ORDER BY updated_at DESC').fetchall()
        except sqlite3.OperationalError:
            # Table might not exist yet if running old DB
            return jsonify({'success': True, 'sessions': []})
            
        conn.close()
        return jsonify({'success': True, 'sessions': [dict(row) for row in sessions]})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@chatbot_bp.route('/new', methods=['POST'])
def new_session():
    """Create a new session"""
    try:
        session_id = str(uuid.uuid4())
        conn = get_db_connection()
        conn.execute('INSERT INTO chat_sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
                     (session_id, 'New Chat', datetime.now().isoformat(), datetime.now().isoformat()))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'session_id': session_id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@chatbot_bp.route('/history/<session_id>', methods=['GET'])
def get_history(session_id):
    """Get history for a specific session"""
    try:
        conn = get_db_connection()
        history = conn.execute('SELECT role, content, timestamp FROM chat_history WHERE session_id = ? ORDER BY id ASC', (session_id,)).fetchall()
        conn.close()
        return jsonify({'success': True, 'history': [dict(row) for row in history]})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@chatbot_bp.route('/delete_session/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    try:
        conn = get_db_connection()
        conn.execute('DELETE FROM chat_sessions WHERE id = ?', (session_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@chatbot_bp.route('/settings', methods=['GET', 'POST'])
def handle_settings():
    if request.method == 'GET':
        return jsonify({'success': True, 'settings': get_ai_settings()})
    
    try:
        data = request.json
        for key, value in data.items():
            save_ai_setting(key, value)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@chatbot_bp.route('/send', methods=['POST'])
def send_message():
    global AVAILABLE_TOOLS
    try:
        data = request.json
        user_message = data.get('message', '')
        session_id = data.get('session_id')
        request_provider = data.get('provider')  # Get provider from request
        request_model = data.get('model')        # Get model from request
        image_data = data.get('image')
        
        if not user_message and not image_data:
            return jsonify({'success': False, 'error': 'Message is required'}), 400
            
        if not user_message and image_data:
            user_message = "Gửi một hình ảnh"

        conn = get_db_connection()
        
        # Create session if not exists or if session_id is missing
        if not session_id:
            session_id = str(uuid.uuid4())
            conn.execute('INSERT INTO chat_sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
                         (session_id, user_message[:30], datetime.now().isoformat(), datetime.now().isoformat()))
        else:
            # Update session timestamp
            conn.execute('UPDATE chat_sessions SET updated_at = ? WHERE id = ?', (datetime.now().isoformat(), session_id))
            
            # Update title if it's "New Chat" (first message)
            current_title = conn.execute('SELECT title FROM chat_sessions WHERE id = ?', (session_id,)).fetchone()
            if current_title and current_title['title'] == 'New Chat':
                conn.execute('UPDATE chat_sessions SET title = ? WHERE id = ?', (user_message[:30], session_id))

        # 1. Save User Message
        conn.execute('INSERT INTO chat_history (role, content, timestamp, session_id) VALUES (?, ?, ?, ?)', 
                     ('user', user_message, datetime.now().isoformat(), session_id))
        conn.commit()

        # 2. Get Settings & Context
        settings = get_ai_settings()
        # Use request provider/model if provided, otherwise fallback to settings
        provider = request_provider if request_provider else settings.get('provider', 'gemini')
        
        # 2. Get System Prompt from Settings (Granular)
        # Default fallback if DB is empty
        default_prompt = """Bạn là Dashboard Assistant - trợ lý thông minh quản lý hệ thống.
        
        QUAN TRỌNG VỀ DỮ LIỆU WECHAT/MXH:
        - Hệ thống lưu trữ theo cấu trúc: Thẻ (Card) -> Tài khoản (Account).
        - Một Thẻ có thể chứa nhiều Tài khoản.
        - Thông tin quan trọng (SĐT, Mật khẩu, Mã 2FA) nằm trong chi tiết Tài khoản.
        - LƯU Ý ĐẶC BIỆT: Thông tin về trạng thái quét QR, ngày tạo, hoặc ghi chú đăng ký thường nằm trong trường 'Notes' của Tài khoản. Hãy đọc kỹ trường này.
        """
        
        general_prompt = settings.get('system_prompt_general', default_prompt)
        mxh_prompt = settings.get('system_prompt_mxh', '')
        notes_prompt = settings.get('system_prompt_notes', '')
        telegram_prompt = settings.get('system_prompt_telegram', '')
        image_prompt = settings.get('system_prompt_image', '')

        # Combine prompts
        base_prompt = general_prompt
        if mxh_prompt: base_prompt += f"\n\n--- SOCIAL MEDIA INSTRUCTIONS ---\n{mxh_prompt}"
        if notes_prompt: base_prompt += f"\n\n--- NOTES INSTRUCTIONS ---\n{notes_prompt}"
        if telegram_prompt: base_prompt += f"\n\n--- TELEGRAM INSTRUCTIONS ---\n{telegram_prompt}"
        if image_prompt: base_prompt += f"\n\n--- IMAGE INSTRUCTIONS ---\n{image_prompt}"
        
        # CRITICAL: Add explicit instruction to NEVER return JSON
        anti_json_instruction = """

QUAN TRỌNG: 
- KHÔNG BAO GIỜ trả lời bằng JSON format
- KHÔNG BAO GIỜ trả về {'action': 'use_tool', ...}
- CHỈ trả lời bằng ngôn ngữ tự nhiên, thân thiện
- Nếu câu hỏi có chứa dữ liệu từ database (trong dấu ngoặc vuông [...]), hãy đọc và tóm tắt cho user
- Trả lời ngắn gọn, súc tích bằng tiếng Việt kèm những icon nếu cần.
"""
        
        system_prompt = base_prompt + anti_json_instruction
        
        # Get context
        context = get_context_data()
        full_system_prompt = f"{system_prompt}\n\nCURRENT DASHBOARD CONTEXT:\n{context}"
        
        # PRE-EXECUTE TOOLS BEFORE CALLING AI
        # Detect and execute tools based on keywords, then inject results into user message
        tool_result_text = ""
        
        # Detect search intent
        # Expanded triggers: tìm, search, có, xem, coi, hiển thị, thấy, biết, check, kiểm tra
        search_triggers = ['tìm', 'search', 'có', 'xem', 'coi', 'hiển thị', 'thấy', 'biết', 'check', 'kiểm tra']
        
        if any(kw in user_message.lower() for kw in search_triggers) and 'ghi chú' in user_message.lower():
            # Smart Keyword Extraction (No Regex)
            import re
            
            def extract_search_keyword(text):
                text = text.lower()
                # 1. If contains "ghi chú" -> take the part after it
                if "ghi chú" in text:
                    parts = text.split("ghi chú", 1)
                    if len(parts) > 1:
                        part = parts[1]
                    else:
                        part = text
                else:
                    part = text

                # 2. Remove stop words
                stop_words = [
                    "tìm", "coi", "xem", "xem thử", "xem coi", "hiển thị", "có", "không",
                    "tên", "nào", "trong", "về", "của", "hay", "hoặc", "đi", "thấy", "biết", "check", "kiểm tra",
                    "là", "gì", "ở", "đâu"
                ]

                # Split by punctuation/spaces
                tokens = re.split(r"[ ,\?\.\-]+", part)
                keywords = [w for w in tokens if w and w not in stop_words]

                # 3. Join remaining words
                return " ".join(keywords).strip()

            search_kw = extract_search_keyword(user_message)
            
            # Execute search if keyword found
            if search_kw:
                with open('debug_log.txt', 'a', encoding='utf-8') as f:
                    f.write(f"\n[SEARCH] Smart Keyword: '{search_kw}'\n")
                
                result = AVAILABLE_TOOLS['search_notes']['function'](search_kw)
                
                if result.get('success'):
                    notes = result.get('notes', [])
                    if notes:
                        tool_result_text = f"\n\n[TÔI ĐÃ TÌM THẤY {len(notes)} GHI CHÚ:\n"
                        for note in notes[:5]:  # Limit to 5 results
                            # Strip HTML tags
                            clean_title = re.sub('<.*?>', '', note['title'])
                            clean_content = re.sub('<.*?>', '', note['content'])
                            
                            # Smart snippet extraction
                            snippet = ""
                            # Find keyword in content (case insensitive)
                            idx = clean_content.lower().find(search_kw.lower())
                            if idx != -1:
                                # Extract around keyword: -100 chars to +400 chars
                                start = max(0, idx - 100)
                                end = min(len(clean_content), idx + 400)
                                snippet = f"...{clean_content[start:end]}..."
                            else:
                                # Keyword in title, show start of content
                                snippet = clean_content[:500] + "..."
                                
                            tool_result_text += f"- Tiêu đề: {clean_title}\n  Nội dung: {snippet}\n"
                        tool_result_text += "]"
                    else:
                        tool_result_text = f"\n\n[TÔI ĐÃ TÌM KIẾM NHƯNG KHÔNG TÌM THẤY GHI CHÚ NÀO VỚI TỪ KHÓA '{search_kw}']"
        
        # Detect "list all notes" intent
        elif any(phrase in user_message.lower() for phrase in ['tất cả ghi chú', 'all notes', 'danh sách ghi chú']):
            result = AVAILABLE_TOOLS['get_all_notes']['function']()
            if isinstance(result, dict) and result.get('success'):
                import re
                notes = result.get('notes', [])
                tool_result_text = f"\n\n[DANH SÁCH {len(notes)} GHI CHÚ:\n"
                for note in notes[:10]:  # Limit to 10
                    clean_title = re.sub('<.*?>', '', note['title'])
                    clean_content = re.sub('<.*?>', '', note['content'])
                    tool_result_text += f"- {clean_title}: {clean_content[:300]}...\n"
                tool_result_text += "]"
        
        # Detect MXH intent 
        elif any(kw in user_message.lower() for kw in ['mxh', 'facebook', 'tiktok', 'social']):
            result = AVAILABLE_TOOLS['get_all_mxh_cards']['function']()
            with open('debug_log.txt', 'a', encoding='utf-8') as f:
                f.write(f"\n[DEBUG] MXH Result Type: {type(result)}\n")
                f.write(f"[DEBUG] MXH Result Value: {result}\n")
            
            if isinstance(result, dict) and result.get('success'):
                cards = result.get('cards', [])
                tool_result_text = f"\n\n[DANH SÁCH {len(cards)} THẺ MXH (KÈM CHI TIẾT TÀI KHOẢN):\n"
                for card in cards[:10]:
                    accounts_text = ""
                    if card.get('accounts'):
                        for acc in card['accounts']:
                            accounts_text += f"    + Account: {acc['account_name']} | User: {acc['username']} | Pass: {acc['password']} | Phone: {acc['phone']} | Notes: {acc['notes']}\n"
                    else:
                        accounts_text = "    (Không có tài khoản chi tiết)\n"
                        
                    tool_result_text += f"- {card['card_name']}\n{accounts_text}"
                tool_result_text += "]"
        
        # Detect Telegram intent
        elif 'telegram' in user_message.lower():
            result = AVAILABLE_TOOLS['get_telegram_sessions']['function']()
            if isinstance(result, dict) and result.get('success'):
                sessions = result.get('sessions', [])
                tool_result_text = f"\n\n[DANH SÁCH {len(sessions)} TELEGRAM SESSIONS:\n"
                for sess in sessions[:10]:
                    tool_result_text += f"- {sess['filename']}: {sess['status_text']} (Live: {sess['is_live']})\n"
                tool_result_text += "]"
        
        # Inject tool results into user message for AI to process
        if tool_result_text:
            user_message = user_message + tool_result_text
        
        # 3. Get History (Last 10 messages for context window)
        history_rows = conn.execute('SELECT role, content FROM chat_history WHERE session_id = ? ORDER BY id DESC LIMIT 10', (session_id,)).fetchall()
        history = [{'role': row['role'], 'content': row['content']} for row in reversed(history_rows)]
        conn.close()
        
        api_key = ''
        model_name = ''
        
        if provider == 'openai':
            api_key = settings.get('openai_api_key', '')
            # Use request model if provided, otherwise use settings, default to gpt-3.5-turbo
            model_name = (request_model if request_model else settings.get('openai_model', 'gpt-3.5-turbo')).strip()
        elif provider == 'gemini':
            api_key = settings.get('gemini_api_key', '')
            # Use request model if provided, otherwise use settings, default to gemini-2.5-flash
            model_name = (request_model if request_model else settings.get('gemini_model', 'gemini-2.5-flash')).strip()

        ai_response = ""

        # 4. Call AI Provider with Tool Loop
        
        # Prepare tools list for Gemini/OpenAI
        # AVAILABLE_TOOLS is imported at module level
        
        # List of actual function objects for Gemini
        gemini_tools = [tool_def['function'] for tool_def in AVAILABLE_TOOLS.values()]
        
        # Helper to convert to OpenAI tools format
        openai_tools = []
        for name, tool_def in AVAILABLE_TOOLS.items():
            openai_tools.append({
                "type": "function",
                "function": {
                    "name": name,
                    "description": tool_def['description'],
                    "parameters": {
                        "type": "object",
                        "properties": tool_def['parameters'],
                        "required": [k for k, v in tool_def['parameters'].items() if not v.get('optional')]
                    }
                }
            })

        max_turns = 5
        turn_count = 0
        final_response_text = ""
        
        # Handle Image Input
        image_data = data.get('image')
        pil_image = None
        if image_data:
            try:
                import base64
                import io
                from PIL import Image
                if 'base64,' in image_data:
                    image_data = image_data.split('base64,')[1]
                image_bytes = base64.b64decode(image_data)
                pil_image = Image.open(io.BytesIO(image_bytes))
                with open('debug_log.txt', 'a', encoding='utf-8') as f:
                    f.write(f"\n[DEBUG] Image decoded successfully. Size: {pil_image.size}\n")
            except Exception as e:
                with open('debug_log.txt', 'a', encoding='utf-8') as f:
                    f.write(f"\n[ERROR] Image decoding failed: {e}\n")
                print(f"Error decoding image: {e}")

        # Initial messages list
        current_messages = [{'role': 'system', 'content': full_system_prompt}] + history
        
        # Add image to OpenAI messages if present
        if pil_image and provider == 'openai':
            # For OpenAI, we need to add the image to the latest user message
            # But here 'user_message' is already in 'history' or we need to construct it
            # The current structure adds 'history' to 'current_messages'
            # We need to append the NEW user message with image
            
            # Re-construct the last user message to include image
            content_part = [{"type": "text", "text": user_message}]
            content_part.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{image_data}"
                }
            })
            # Replace the last message if it was added to history, or append new
            # In this code, we haven't added the current user_message to current_messages yet?
            # Ah, 'history' variable comes from DB, which includes the message we just saved in step 1.
            # So we need to modify the last item of current_messages
            if current_messages and current_messages[-1]['role'] == 'user':
                current_messages[-1]['content'] = content_part
        
        while turn_count < max_turns:
            turn_count += 1
            
            if not api_key:
                 ai_response = f"Please configure your API Key for {provider} in Settings."
                 break
            
            if provider == 'openai':
                try:
                    import openai
                    client = openai.OpenAI(api_key=api_key)
                    
                    completion = client.chat.completions.create(
                        model=model_name,
                        messages=current_messages,
                        tools=openai_tools,
                        tool_choice="auto"
                    )
                    
                    message = completion.choices[0].message
                    
                    # If content, we might be done, but check for tool_calls
                    if message.content:
                        final_response_text = message.content

                    if message.tool_calls:
                        # Append assistant message with tool calls
                        current_messages.append(message)
                        
                        # Execute each tool call
                        for tool_call in message.tool_calls:
                            function_name = tool_call.function.name
                            import json
                            function_args = json.loads(tool_call.function.arguments)
                            
                            # Execute
                            if function_name in AVAILABLE_TOOLS:
                                tool_func = AVAILABLE_TOOLS[function_name]['function']
                                tool_result = tool_func(**function_args)
                                
                                # Append tool result
                                current_messages.append({
                                    "tool_call_id": tool_call.id,
                                    "role": "tool",
                                    "name": function_name,
                                    "content": json.dumps(tool_result, ensure_ascii=False)
                                })
                        # Loop continues to send tool outputs back to model
                    else:
                        # No tool calls, we are done
                        ai_response = final_response_text
                        break
                        
                except Exception as e:
                    ai_response = f"OpenAI Error: {str(e)}"
                    break
                    
            elif provider == 'gemini':
                # Get raw keys string and split by newline
                raw_keys = settings.get('gemini_api_key', '')
                api_keys = [k.strip() for k in raw_keys.split('\n') if k.strip()]
                
                if not api_keys:
                    ai_response = "Gemini API Key is missing. Please add at least one key in Settings."
                    break

                # Try each key until success or all fail
                for key_index, current_api_key in enumerate(api_keys):
                    try:
                        import google.generativeai as genai
                        from google.protobuf import struct_pb2
                        
                        with open('debug_log.txt', 'a', encoding='utf-8') as f:
                            f.write(f"\n[DEBUG] Attempting Gemini with Key #{key_index + 1}...\n")

                        genai.configure(api_key=current_api_key)
                        
                        # Model mapping logic (Updated to use available 2.5 models)
                        model_mapping = {
                            'gemini-pro': 'gemini-2.5-flash',
                            'gemini-1.5-pro': 'gemini-2.5-pro',
                            'gemini-1.5-flash': 'gemini-2.5-flash',
                            'gemini': 'gemini-2.5-flash',
                        }
                        if not model_name or model_name.strip() == '': model_name = 'gemini-2.5-flash'
                        clean_model = model_name.strip().lower()
                        if clean_model in model_mapping: clean_model = model_mapping[clean_model]
                        if clean_model.startswith('models/'): clean_model = clean_model.replace('models/', '', 1)
                        
                        # Initialize model with tools
                        # Fix: Pass system_instruction explicitly for better adherence
                        model = genai.GenerativeModel(clean_model, tools=gemini_tools, system_instruction=full_system_prompt)
                        
                        # Convert history to Gemini format
                        chat_history = []
                        history_to_load = history[:-1] if history else []
                        
                        for msg in history_to_load:
                            role = 'user' if msg['role'] == 'user' else 'model'
                            chat_history.append({'role': role, 'parts': [msg['content']]})
                        
                        # Start chat session
                        chat = model.start_chat(history=chat_history)
                        
                        # Prepare message parts
                        msg_parts = []
                        text_content = user_message
                        # Note: We don't need to prepend system prompt anymore since it's in system_instruction
                        # But we can keep context if needed, or rely on system_instruction containing it.
                        # full_system_prompt already contains context.
                        
                        msg_parts.append(text_content)
                        
                        if pil_image:
                            msg_parts.append(pil_image)
                            
                        # Send message
                        response = chat.send_message(msg_parts)
                        
                        # Check for function calls
                        max_turns = 5
                        turn = 0
                        
                        while turn < max_turns:
                            turn += 1
                            if not response.candidates:
                                ai_response = "Error: No response candidates."
                                break
                                
                            part = response.candidates[0].content.parts[0]
                            fc = part.function_call
                            
                            if fc and fc.name:
                                fn_name = fc.name
                                fn_args = dict(fc.args)
                                
                                if fn_name in AVAILABLE_TOOLS:
                                    tool_func = AVAILABLE_TOOLS[fn_name]['function']
                                    try:
                                        tool_result = tool_func(**fn_args)
                                    except Exception as e:
                                        tool_result = {'error': str(e)}
                                    
                                    # Send result back to model
                                    response = chat.send_message(
                                        genai.protos.Content(
                                            parts=[genai.protos.Part(
                                                function_response=genai.protos.FunctionResponse(
                                                    name=fn_name,
                                                    response={'result': tool_result}
                                                )
                                            )]
                                        )
                                    )
                                else:
                                    ai_response = f"Error: Tool {fn_name} not found."
                                    break
                            else:
                                try:
                                    ai_response = response.text
                                except Exception as e:
                                    ai_response = "Error parsing response: " + str(e)
                                break
                        else:
                             if not ai_response:
                                 ai_response = "Error: Too many function call turns."
                        
                        # If we got here, success! Break the key loop
                        break

                    except Exception as e:
                        error_msg = str(e)
                        with open('debug_log.txt', 'a', encoding='utf-8') as f:
                            f.write(f"[ERROR] Key #{key_index + 1} Failed: {error_msg}\n")
                        
                        # Check if it's a quota error (429) or similar
                        if "429" in error_msg or "quota" in error_msg.lower() or "resource exhausted" in error_msg.lower():
                            if key_index < len(api_keys) - 1:
                                continue # Try next key
                            else:
                                ai_response = "All Gemini API Keys have been exhausted (Rate Limit)."
                                break
                        else:
                            # For other errors, maybe don't retry? Or retry anyway?
                            # Let's retry for safety if multiple keys exist
                            if key_index < len(api_keys) - 1:
                                continue
                            else:
                                ai_response = f"Gemini Error (All keys failed): {error_msg}"
                                break
            else:
                ai_response = f"Unknown provider: {provider}"
                break

        # 5. Save AI Response
        conn = get_db_connection()
        conn.execute('INSERT INTO chat_history (role, content, timestamp, session_id) VALUES (?, ?, ?, ?)', 
                     ('assistant', ai_response, datetime.now().isoformat(), session_id))
        conn.commit()
        conn.close()

        return jsonify({'success': True, 'response': ai_response, 'session_id': session_id})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
