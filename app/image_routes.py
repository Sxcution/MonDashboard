from flask import Blueprint, render_template, request, jsonify, send_file
import os
import json
import logging
import subprocess
import tempfile
from datetime import datetime
import uuid
from PIL import Image, ImageFilter, ImageStat
import io

image_bp = Blueprint('image', __name__, url_prefix='/image')
logger = logging.getLogger(__name__)
_simple_lama_model = None
UPSCAYL_MODELS = {
    'upscayl-standard-4x': 'Upscayl Standard',
    'upscayl-lite-4x': 'Upscayl Lite',
    'high-fidelity-4x': 'High Fidelity',
    'remacri-4x': 'Remacri',
    'ultramix-balanced-4x': 'Ultramix Balanced',
    'ultrasharp-4x': 'Ultrasharp',
    'digital-art-4x': 'Digital Art',
}


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


def _send_pil_png(image):
    output = io.BytesIO()
    image.save(output, format='PNG')
    output.seek(0)
    return send_file(output, mimetype='image/png')


def _is_nearly_black(image):
    sample = image.convert('RGB')
    sample.thumbnail((256, 256))
    stat = ImageStat.Stat(sample)
    return max(stat.mean) < 3


def _pil_upscale_fallback(image, scale):
    width, height = image.size
    result = image.resize((width * scale, height * scale), Image.Resampling.LANCZOS)
    return result.filter(ImageFilter.UnsharpMask(radius=1.2, percent=125, threshold=3))


def _find_upscayl_bin():
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    candidates = []
    env_path = os.environ.get('UPSCAYL_BIN')
    if env_path:
        candidates.append(env_path)

    candidates.extend([
        os.path.join(project_root, 'tools', 'upscayl', 'resources', 'bin', 'upscayl-bin.exe'),
        r'C:\Program Files\Upscayl\resources\bin\upscayl-bin.exe',
        r'C:\Program Files (x86)\Upscayl\resources\bin\upscayl-bin.exe',
        os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Programs', 'Upscayl', 'resources', 'bin', 'upscayl-bin.exe'),
    ])

    for candidate in candidates:
        if candidate and os.path.exists(candidate):
            return os.path.abspath(candidate)
    return None


def _find_upscayl_models_dir():
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    candidates = []
    env_path = os.environ.get('UPSCAYL_MODELS_DIR')
    if env_path:
        candidates.append(env_path)

    candidates.extend([
        os.path.join(project_root, 'tools', 'upscayl', 'resources', 'models'),
        r'C:\Program Files\Upscayl\resources\models',
        r'C:\Program Files (x86)\Upscayl\resources\models',
        os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Programs', 'Upscayl', 'resources', 'models'),
    ])

    for candidate in candidates:
        if candidate and os.path.exists(os.path.join(candidate, 'upscayl-standard-4x.param')):
            return os.path.abspath(candidate)
    return None


def _get_model_scale(model_name):
    lowered = model_name.lower()
    if 'x2' in lowered or '2x' in lowered:
        return 2
    if 'x3' in lowered or '3x' in lowered:
        return 3
    return 4


def _upscayl_upscale(image, scale, model_name, compression='0', tile_size=None):
    exe = _find_upscayl_bin()
    models_dir = _find_upscayl_models_dir()
    if not exe or not models_dir:
        raise FileNotFoundError('Upscayl binary/models were not found')
    if model_name not in UPSCAYL_MODELS:
        model_name = 'upscayl-standard-4x'
    if not os.path.exists(os.path.join(models_dir, f'{model_name}.param')):
        raise FileNotFoundError(f'Upscayl model was not found: {model_name}')

    with tempfile.TemporaryDirectory(prefix='mon_upscayl_') as tmp:
        input_path = os.path.join(tmp, 'input.png')
        output_path = os.path.join(tmp, 'output.png')
        image.convert('RGB').save(input_path, format='PNG')

        command = [
            exe,
            '-i', input_path,
            '-o', output_path,
        ]
        if _get_model_scale(model_name) != scale:
            command.extend(['-s', str(scale)])
        command.extend([
            '-m', models_dir,
            '-n', model_name,
            '-f', 'png',
            '-c', str(compression or '0'),
        ])
        if tile_size:
            command.extend(['-t', str(tile_size)])

        subprocess.run(
            command,
            cwd=os.path.dirname(exe) or None,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8',
            errors='replace',
            timeout=300
        )

        return Image.open(output_path).convert('RGB')


def _find_opencv_superres_model(scale):
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    model_path = os.path.join(project_root, 'tools', 'opencv-superres', f'FSRCNN_x{scale}.pb')
    return model_path if os.path.exists(model_path) else None


def _opencv_superres_upscale(image, scale):
    import cv2
    import numpy as np

    model_path = _find_opencv_superres_model(scale)
    if not model_path:
        raise FileNotFoundError(f'Missing OpenCV super-resolution model for {scale}x')
    if not hasattr(cv2, 'dnn_superres'):
        raise RuntimeError('opencv-contrib-python is required for dnn_superres')

    sr = cv2.dnn_superres.DnnSuperResImpl_create()
    sr.readModel(model_path)
    sr.setModel('fsrcnn', scale)

    rgb = np.array(image.convert('RGB'))
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    result_bgr = sr.upsample(bgr)
    result_rgb = cv2.cvtColor(result_bgr, cv2.COLOR_BGR2RGB)
    result = Image.fromarray(result_rgb)
    return result.filter(ImageFilter.UnsharpMask(radius=0.8, percent=80, threshold=3))

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
        target_folder = request.form.get('targetFolder')
        filename = request.form.get('filename')
        
        # Generate unique ID
        collage_id = str(uuid.uuid4())
        
        saved_on_pc = False
        saved_path = ''
        
        # If target folder is provided and valid, save directly to user's PC folder
        if target_folder and os.path.exists(target_folder) and os.path.isdir(target_folder):
            if not filename:
                date_str = datetime.now().strftime("%d%m%Y")
                filename = f"Image{date_str}.png"
            filename = os.path.basename(filename)
            base_name, ext = os.path.splitext(filename)
            pc_save_path = os.path.join(target_folder, filename)
            
            # Avoid overwriting existing files
            counter = 1
            while os.path.exists(pc_save_path):
                pc_save_path = os.path.join(target_folder, f"{base_name}_{counter}{ext}")
                counter += 1
                
            image_file.save(pc_save_path)
            
            # Copy to history
            history_image_path = os.path.join(COLLAGE_HISTORY_DIR, f'{collage_id}.png')
            import shutil
            shutil.copy2(pc_save_path, history_image_path)
            
            saved_on_pc = True
            saved_path = pc_save_path
        else:
            # Save image to history
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
            'id': collage_id,
            'saved_on_pc': saved_on_pc,
            'saved_path': saved_path
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
        if result.size != image.size:
            result = result.crop((0, 0, image.size[0], image.size[1]))
        return _send_pil_png(result.convert('RGB'))
    except Exception as e:
        logger.exception("Object remove failed")
        return jsonify({'success': False, 'error': str(e)}), 500


@image_bp.route('/api/upscale_image', methods=['POST'])
def upscale_image():
    """Upscale/enhance with Upscayl's bundled models, with safe fallbacks."""
    try:
        f = request.files.get('image')
        if not f:
            return jsonify({'success': False, 'error': 'No image provided'}), 400

        try:
            scale = int(request.form.get('scale', 2))
        except ValueError:
            scale = 2
        scale = max(2, min(4, scale))
        model = request.form.get('model', 'upscayl-standard-4x')
        if model not in UPSCAYL_MODELS:
            model = 'upscayl-standard-4x'
        compression = request.form.get('compression', '0')
        try:
            tile_size = int(request.form.get('tile_size', '') or 0)
        except ValueError:
            tile_size = 0
        tile_size = tile_size if tile_size > 0 else None

        original = Image.open(f.stream).convert('RGB')
        try:
            result = _upscayl_upscale(original, scale, model, compression=compression, tile_size=tile_size)
            if not _is_nearly_black(result):
                return _send_pil_png(result)
            logger.warning("Upscayl returned a black image, using OpenCV fallback")
        except Exception as exc:
            logger.warning("Upscayl failed, using OpenCV fallback: %s", exc)

        try:
            result = _opencv_superres_upscale(original, scale)
            if not _is_nearly_black(result):
                return _send_pil_png(result)
            logger.warning("OpenCV super-resolution returned a black image, using fallback")
        except Exception as exc:
            logger.warning("OpenCV super-resolution failed, using fallback: %s", exc)

        try:
            return _send_pil_png(_pil_upscale_fallback(original, scale))
        except Exception as exc:
            logger.exception("Fallback upscale failed")
            return jsonify({'success': False, 'error': str(exc)}), 500
    except Exception as e:
        logger.exception("Upscale failed")
        return jsonify({'success': False, 'error': str(e)}), 500


@image_bp.route('/api/remove_watermark_dialog', methods=['POST'])
def remove_watermark_dialog():
    """Run Gemini Watermark Remover CLI on selected files or trigger native file selection dialog if none provided."""
    try:
        import sys
        
        # Check if file paths are passed in request body
        req_data = {}
        try:
            req_data = request.get_json(silent=True) or {}
        except Exception:
            pass
            
        file_paths = req_data.get("file_paths", [])
        
        # If no file paths provided, open native file dialog
        if not file_paths:
            script = """
import tkinter as tk
from tkinter import filedialog
import json
import sys

root = tk.Tk()
root.withdraw()
root.attributes('-topmost', True)
file_paths = filedialog.askopenfilenames(
    title="Chọn ảnh để xoá Watermark",
    filetypes=[("Image Files", "*.png *.jpg *.jpeg *.webp *.bmp *.gif *.tiff")]
)
print(json.dumps({"file_paths": list(file_paths)}))
root.destroy()
"""
            # Use python.exe instead of pythonw.exe to ensure stdout is captured correctly on Windows
            python_exe = sys.executable
            if python_exe.lower().endswith("pythonw.exe"):
                python_exe = python_exe.lower().replace("pythonw.exe", "python.exe")

            res = subprocess.run(
                [python_exe, "-c", script],
                capture_output=True,
                text=True,
                timeout=120
            )
            
            if res.returncode != 0:
                return jsonify({'success': False, 'error': f'Dialog process failed: {res.stderr}'}), 500
            
            try:
                dialog_data = json.loads(res.stdout.strip())
            except Exception as e:
                return jsonify({'success': False, 'error': f'Failed to parse dialog output: {res.stdout}'}), 500
                
            file_paths = dialog_data.get("file_paths", [])
            
        if not file_paths:
            return jsonify({'success': False, 'error': 'Không có file nào được chọn'}), 400
            
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
        gwr_path = os.path.join(project_root, 'tools', 'Gemini-watermark-remover', 'bin', 'gwr.mjs')
        if not os.path.exists(gwr_path):
            return jsonify({'success': False, 'error': f'Không tìm thấy công cụ GWR tại: {gwr_path}'}), 500
            
        date_str = datetime.now().strftime("%d%m%Y")
        processed_files = []
        errors = []
        
        for input_path in file_paths:
            if not os.path.exists(input_path):
                errors.append(f"File không tồn tại: {input_path}")
                continue
                
            dir_name = os.path.dirname(input_path)
            base_name_with_ext = os.path.basename(input_path)
            base_name, ext = os.path.splitext(base_name_with_ext)
            
            output_filename = f"RemovedW{date_str}{ext}"
            output_path = os.path.join(dir_name, output_filename)
            
            # Avoid overwriting existing files or other files processed in the same batch
            counter = 1
            while os.path.exists(output_path):
                output_filename = f"RemovedW{date_str}_{counter}{ext}"
                output_path = os.path.join(dir_name, output_filename)
                counter += 1
            
            gwr_cmd = ["node", gwr_path, "remove", input_path, "--output", output_path]
            
            process_res = subprocess.run(
                gwr_cmd,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace'
            )
            
            if process_res.returncode != 0:
                err_msg = process_res.stderr.strip() or f"GWR process failed with exit code {process_res.returncode}"
                errors.append(f"Lỗi khi xử lý {base_name}: {err_msg}")
            elif not os.path.exists(output_path):
                errors.append(f"File kết quả không được tạo ra cho {base_name}")
            else:
                # Tự động xoá file ảnh cũ sau khi xử lý thành công
                deleted_original = False
                try:
                    if os.path.exists(input_path):
                        os.remove(input_path)
                        deleted_original = True
                        logger.info(f"Deleted original image file after watermark removal: {input_path}")
                except Exception as del_err:
                    logger.warning(f"Failed to delete original file {input_path}: {str(del_err)}")
                    
                processed_files.append({
                    'input_path': input_path,
                    'output_path': output_path,
                    'output_filename': output_filename,
                    'deleted_original': deleted_original
                })
                
        if not processed_files and errors:
            return jsonify({'success': False, 'error': "; ".join(errors)}), 500
            
        return jsonify({
            'success': True,
            'processed': processed_files,
            'errors': errors
        })
        
    except Exception as e:
        logger.exception("Watermark removal failed")
        return jsonify({'success': False, 'error': str(e)}), 500


@image_bp.route('/api/select-image-dialog', methods=['POST'])
def select_image_dialog():
    """Trigger native file selection dialog to select images and return absolute paths."""
    try:
        import sys
        script = """
import tkinter as tk
from tkinter import filedialog
import json
import sys

root = tk.Tk()
root.withdraw()
root.attributes('-topmost', True)
file_paths = filedialog.askopenfilenames(
    title="Chọn ảnh",
    filetypes=[("Image Files", "*.png *.jpg *.jpeg *.webp *.bmp *.gif *.tiff")]
)
print(json.dumps({"file_paths": list(file_paths)}))
root.destroy()
"""
        python_exe = sys.executable
        if python_exe.lower().endswith("pythonw.exe"):
            python_exe = python_exe.lower().replace("pythonw.exe", "python.exe")

        res = subprocess.run(
            [python_exe, "-c", script],
            capture_output=True,
            text=True,
            timeout=120
        )
        
        if res.returncode != 0:
            return jsonify({'success': False, 'error': f'Dialog process failed: {res.stderr}'}), 500
        
        try:
            dialog_data = json.loads(res.stdout.strip())
        except Exception as e:
            return jsonify({'success': False, 'error': f'Failed to parse dialog output: {res.stdout}'}), 500
            
        file_paths = dialog_data.get("file_paths", [])
        return jsonify({
            'success': True,
            'file_paths': file_paths
        })
    except Exception as e:
        logger.exception("Select image failed")
        return jsonify({'success': False, 'error': str(e)}), 500



@image_bp.route('/api/list-subfolders', methods=['GET'])
def list_subfolders():
    """List subfolders and image/video files for a given PC path"""
    try:
        path = request.args.get('path', '')
        if not path:
            return jsonify({'success': False, 'error': 'Đường dẫn không được để trống'}), 400
        
        if not os.path.exists(path):
            return jsonify({'success': False, 'error': f'Đường dẫn không tồn tại: {path}'}), 400
            
        if not os.path.isdir(path):
            return jsonify({'success': False, 'error': 'Đường dẫn không phải là thư mục'}), 400
            
        subfolders = []
        files = []
        
        # Allowed extensions
        image_extensions = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff'}
        video_extensions = {'.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv'}
        
        for name in os.listdir(path):
            full_path = os.path.join(path, name)
            if os.path.isdir(full_path):
                if not name.startswith('.'):
                    subfolders.append({
                        'name': name,
                        'path': full_path
                    })
            elif os.path.isfile(full_path):
                _, ext = os.path.splitext(name)
                ext = ext.lower()
                if ext in image_extensions:
                    files.append({
                        'name': name,
                        'path': full_path,
                        'type': 'image'
                    })
                elif ext in video_extensions:
                    files.append({
                        'name': name,
                        'path': full_path,
                        'type': 'video'
                    })
        
        # Sort subfolders alphabetically, sort files by modified time descending
        subfolders.sort(key=lambda x: x['name'].lower())
        files.sort(key=lambda x: os.path.getmtime(x['path']), reverse=True)
        
        return jsonify({
            'success': True,
            'path': path,
            'subfolders': subfolders,
            'files': files
        })
    except Exception as e:
        logger.exception("Failed to list subfolders")
        return jsonify({'success': False, 'error': str(e)}), 500


@image_bp.route('/api/serve-file', methods=['GET'])
def serve_file():
    """Serve a local image or video file by its absolute path"""
    try:
        file_path = request.args.get('path', '')
        if not file_path:
            return jsonify({'success': False, 'error': 'Đường dẫn không được để trống'}), 400
            
        if not os.path.exists(file_path):
            return jsonify({'success': False, 'error': 'File không tồn tại'}), 404
            
        if not os.path.isfile(file_path):
            return jsonify({'success': False, 'error': 'Đường dẫn không phải là file'}), 400
            
        _, ext = os.path.splitext(file_path)
        ext = ext.lower()
        allowed_extensions = {
            # Images
            '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff',
            # Videos
            '.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv'
        }
        if ext not in allowed_extensions:
            return jsonify({'success': False, 'error': 'Định dạng file không được hỗ trợ'}), 403
            
        return send_file(file_path)
    except Exception as e:
        logger.exception("Failed to serve file")
        return jsonify({'success': False, 'error': str(e)}), 500


@image_bp.route('/api/open-folder-explorer', methods=['POST'])
def open_folder_explorer():
    """Open a local directory on Windows File Explorer"""
    try:
        data = request.get_json() or {}
        folder_path = data.get('path', '')
        if not folder_path:
            return jsonify({'success': False, 'error': 'Đường dẫn trống'}), 400
        if not os.path.exists(folder_path):
            return jsonify({'success': False, 'error': 'Thư mục không tồn tại'}), 404
        if not os.path.isdir(folder_path):
            return jsonify({'success': False, 'error': 'Đường dẫn không phải là thư mục'}), 400
        
        # Open in Windows Explorer
        os.startfile(folder_path)
        return jsonify({'success': True})
    except Exception as e:
        logger.exception("Failed to open folder explorer")
        return jsonify({'success': False, 'error': str(e)}), 500


@image_bp.route('/api/delete-file', methods=['POST'])
def delete_file():
    """Delete a local file on the disk"""
    try:
        data = request.get_json() or {}
        file_path = data.get('path', '')
        if not file_path:
            return jsonify({'success': False, 'error': 'Đường dẫn file trống'}), 400
        if not os.path.exists(file_path):
            return jsonify({'success': False, 'error': 'File không tồn tại'}), 404
        if os.path.isdir(file_path):
            return jsonify({'success': False, 'error': 'Đường dẫn là thư mục, không thể xoá'}), 400
            
        os.remove(file_path)
        return jsonify({'success': True})
    except Exception as e:
        logger.exception("Failed to delete file")
        return jsonify({'success': False, 'error': str(e)}), 500



