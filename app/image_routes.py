from flask import Blueprint, render_template, request, jsonify, send_file
import os
import json
import logging
import shutil
import subprocess
import tempfile
from datetime import datetime
import uuid
from PIL import Image
import io

image_bp = Blueprint('image', __name__, url_prefix='/image')
logger = logging.getLogger(__name__)
_simple_lama_model = None


def _load_simple_lama():
    global _simple_lama_model
    if _simple_lama_model is None:
        from simple_lama_inpainting import SimpleLama
        _simple_lama_model = SimpleLama()
    return _simple_lama_model


def _ai_missing_response(feature, details, install_hint):
    return jsonify({
        'success': False,
        'error': f'{feature} is not installed/configured',
        'details': details,
        'install_hint': install_hint
    }), 501


def _find_realesrgan_executable():
    candidates = []
    env_path = os.environ.get('REAL_ESRGAN_NCNN_EXE')
    if env_path:
        candidates.append(env_path)

    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    candidates.extend([
        os.path.join(project_root, 'tools', 'realesrgan-ncnn-vulkan', 'realesrgan-ncnn-vulkan.exe'),
        os.path.join(project_root, 'tools', 'upscayl-ncnn', 'realesrgan-ncnn-vulkan.exe'),
        os.path.join(project_root, 'tools', 'realesrgan-ncnn-vulkan.exe'),
    ])

    shell_path = shutil.which('realesrgan-ncnn-vulkan') or shutil.which('realesrgan-ncnn-vulkan.exe')
    if shell_path:
        candidates.append(shell_path)

    for candidate in candidates:
        if candidate and os.path.exists(candidate):
            return os.path.abspath(candidate)
    return None


def _send_pil_png(image):
    output = io.BytesIO()
    image.save(output, format='PNG')
    output.seek(0)
    return send_file(output, mimetype='image/png')

@image_bp.route('/')
def index():
    """Main Image page with tabs"""
    return render_template('image.html')

@image_bp.route('/edit')
def edit_image():
    """Edit Image tab"""
    return render_template('image.html', active_tab='edit')

@image_bp.route('/collage')
def photo_collage():
    """Photo Collage tab"""
    return render_template('image.html', active_tab='collage')

# API endpoints for image editing
@image_bp.route('/api/upload', methods=['POST'])
def upload_image():
    """Upload image for editing"""
    try:
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'No image file'}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No selected file'}), 400
        
        # Save to image_editor_files folder
        upload_folder = os.path.join('data', 'image_editor_files')
        os.makedirs(upload_folder, exist_ok=True)
        
        filepath = os.path.join(upload_folder, file.filename)
        file.save(filepath)
        
        return jsonify({
            'success': True,
            'filename': file.filename,
            'path': filepath
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# === COLLAGE HISTORY APIs ===
# Note: Collage creation is handled entirely on frontend using HTML Canvas
# for better performance and real-time editing experience
COLLAGE_HISTORY_DIR = os.path.join('data', 'collage_history')
COLLAGE_HISTORY_JSON = os.path.join('data', 'collage_history.json')

# Ensure directories exist
os.makedirs(COLLAGE_HISTORY_DIR, exist_ok=True)

@image_bp.route('/api/save-collage', methods=['POST'])
def save_collage():
    """Save collage and add to history"""
    try:
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'No image file'}), 400
        
        image_file = request.files['image']
        image_count = request.form.get('imageCount', 0)
        layout = request.form.get('layout', 'unknown')
        
        # Generate unique ID
        collage_id = str(uuid.uuid4())
        
        # Save image
        image_path = os.path.join(COLLAGE_HISTORY_DIR, f'{collage_id}.png')
        image_file.save(image_path)
        
        # Load existing history
        history = []
        if os.path.exists(COLLAGE_HISTORY_JSON):
            with open(COLLAGE_HISTORY_JSON, 'r', encoding='utf-8') as f:
                history = json.load(f)
        
        # Add new entry (at beginning for newest first)
        history.insert(0, {
            'id': collage_id,
            'date': datetime.now().strftime('%Y-%m-%d %H:%M'),
            'imageCount': int(image_count),
            'layout': layout,
            'timestamp': datetime.now().timestamp()
        })
        
        # Keep only last 50
        history = history[:50]
        
        # Save history
        with open(COLLAGE_HISTORY_JSON, 'w', encoding='utf-8') as f:
            json.dump(history, f, indent=2)
        
        return jsonify({
            'success': True,
            'id': collage_id
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@image_bp.route('/api/collage-history', methods=['GET'])
def get_collage_history():
    """Get list of saved collages"""
    try:
        if not os.path.exists(COLLAGE_HISTORY_JSON):
            return jsonify({'success': True, 'history': []})
        
        with open(COLLAGE_HISTORY_JSON, 'r', encoding='utf-8') as f:
            history = json.load(f)
        
        return jsonify({
            'success': True,
            'history': history
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@image_bp.route('/api/collage-thumbnail/<collage_id>', methods=['GET'])
def get_collage_thumbnail(collage_id):
    """Get thumbnail image for collage"""
    try:
        image_path = os.path.join(COLLAGE_HISTORY_DIR, f'{collage_id}.png')
        abs_path = os.path.abspath(image_path)
        
        logger.debug(
            "Collage thumbnail request id=%s relative=%s absolute=%s exists=%s",
            collage_id,
            image_path,
            abs_path,
            os.path.exists(abs_path)
        )
        
        if not os.path.exists(abs_path):
            return jsonify({'error': 'Not found', 'path': abs_path}), 404
        
        return send_file(abs_path, mimetype='image/png')
        
    except Exception as e:
        logger.exception("Collage thumbnail error")
        return jsonify({'error': str(e)}), 500

@image_bp.route('/api/collage-data/<collage_id>', methods=['GET'])
def get_collage_data(collage_id):
    """Get collage data for re-editing (currently not supported)"""
    # For now, just return error since we don't store original images
    return jsonify({
        'success': False,
        'error': 'Re-editing is not supported yet'
    }), 501

@image_bp.route('/api/collage-delete/<collage_id>', methods=['DELETE'])
def delete_collage(collage_id):
    """Delete collage from history"""
    try:
        # Delete image file
        image_path = os.path.join(COLLAGE_HISTORY_DIR, f'{collage_id}.png')
        if os.path.exists(image_path):
            os.remove(image_path)
        
        # Update history JSON
        if os.path.exists(COLLAGE_HISTORY_JSON):
            with open(COLLAGE_HISTORY_JSON, 'r', encoding='utf-8') as f:
                history = json.load(f)
            
            history = [item for item in history if item['id'] != collage_id]
            
            with open(COLLAGE_HISTORY_JSON, 'w', encoding='utf-8') as f:
                json.dump(history, f, indent=2)
        
        return jsonify({'success': True})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@image_bp.route('/api/object_remove', methods=['POST'])
def object_remove():
    """Remove painted objects using Simple LaMa inpainting."""
    try:
        if 'image' not in request.files or 'mask' not in request.files:
            return jsonify({'success': False, 'error': 'Image and mask required'}), 400

        try:
            lama = _load_simple_lama()
        except Exception as exc:
            logger.exception("Simple LaMa is not available")
            return _ai_missing_response(
                'Object Remove',
                str(exc),
                'Install PyTorch and simple-lama, then restart the dashboard.'
            )

        image = Image.open(request.files['image'].stream).convert('RGB')
        mask = Image.open(request.files['mask'].stream).convert('L')
        if mask.size != image.size:
            mask = mask.resize(image.size, Image.Resampling.NEAREST)

        mask = mask.point(lambda px: 255 if px > 10 else 0)
        result = lama(image, mask)
        return _send_pil_png(result.convert('RGB'))
    except Exception as e:
        logger.exception("Object remove failed")
        return jsonify({'success': False, 'error': str(e)}), 500


@image_bp.route('/api/upscale_image', methods=['POST'])
def upscale_image():
    """Upscale/enhance using Real-ESRGAN NCNN Vulkan."""
    try:
        f = request.files.get('image')
        if not f:
            return jsonify({'success': False, 'error': 'No image provided'}), 400

        exe = _find_realesrgan_executable()
        if not exe:
            return _ai_missing_response(
                'Upscale/Enhance',
                'realesrgan-ncnn-vulkan executable was not found.',
                'Download Real-ESRGAN NCNN Vulkan or Upscayl NCNN, then set REAL_ESRGAN_NCNN_EXE or place it in tools/realesrgan-ncnn-vulkan/.'
            )

        model = request.form.get('model', 'realesrgan-x4plus')
        allowed_models = {'realesrgan-x4plus', 'realesrnet-x4plus', 'realesrgan-x4plus-anime'}
        if model not in allowed_models:
            model = 'realesrgan-x4plus'

        try:
            scale = int(request.form.get('scale', 2))
        except ValueError:
            scale = 2
        scale = max(2, min(4, scale))

        try:
            tile_size = int(request.form.get('tile_size', 2048))
        except ValueError:
            tile_size = 2048
        tile_size = max(512, min(4096, tile_size))

        with tempfile.TemporaryDirectory(prefix='mon_image_ai_') as tmp:
            input_path = os.path.join(tmp, 'input.png')
            output_path = os.path.join(tmp, 'output.png')
            Image.open(f.stream).convert('RGB').save(input_path)

            subprocess.run(
                [
                    exe,
                    '-i', input_path,
                    '-o', output_path,
                    '-n', model,
                    '-s', str(scale),
                    '-t', str(tile_size),
                    '-f', 'png'
                ],
                cwd=os.path.dirname(exe) or None,
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=300
            )

            result = Image.open(output_path).convert('RGB')
            return _send_pil_png(result)
    except Exception as e:
        logger.exception("Upscale failed")
        return jsonify({'success': False, 'error': str(e)}), 500
