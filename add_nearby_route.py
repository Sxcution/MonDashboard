import sys

content_to_append = ""\"
@mxh_api_bp.route("/nearby_people", methods=["POST"])
def update_nearby_people():
    try:
        data = request.json
        account_id = data.get('account_id')
        action = data.get('action')
        
        if not account_id or not action:
            return jsonify({"success": False, "error": "Missing account_id or action"}), 400
            
        conn = get_db_connection()
        now = datetime.now(timezone.utc)
        
        if action == 'active':
            # Add 7 days
            delta = 7 * 24 * 60 * 60
        elif action == 'cam':
            # Add 30 days
            delta = 30 * 24 * 60 * 60
        else:
            return jsonify({"success": False, "error": "Invalid action"}), 400
            
        until_time = datetime.fromtimestamp(now.timestamp() + delta).isoformat()
        
        conn.execute(
            'UPDATE mxh_accounts SET nearby_people_until = ? WHERE id = ?',
            (until_time, account_id)
        )
        conn.commit()
        conn.close()
        
        return jsonify({"success": True, "nearby_people_until": until_time})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
"\""

with open("app/mxh_api.py", "a", encoding="utf-8") as f:
    f.write("\n" + content_to_append)

print("Appended route to app/mxh_api.py")
