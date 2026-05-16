document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('btn-test-preview');
        const box = document.getElementById('preview');

        // Ảnh mẫu tự tạo (SVG -> data URL), không cần internet
        function makeSampleImageDataURL() {
            const svg = `
        <svg xmlns='http://www.w3.org/2000/svg' width='1560' height='1040'>
          <rect width='100%' height='100%' fill='#ffffff'/>
          <g font-family='Inter,Segoe UI,Arial' fill='#000'>
            <text x='50%' y='48%' font-size='64' dominant-baseline='middle' text-anchor='middle' opacity='0.9'>
              SAMPLE PREVIEW
            </text>
            <text x='50%' y='58%' font-size='28' dominant-baseline='middle' text-anchor='middle' opacity='0.75'>
              1560×1040 → fit vào khung 200×200 (object-fit: contain)
            </text>
          </g>
        </svg>`;
            return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        }

        function showPreview(imgSrc) {
            const box = document.getElementById('preview');
            // KHÓA khung bằng inline style (độ ưu tiên cao hơn class bên ngoài)
            box.style.width = '300px';
            box.style.height = '300px';
            box.style.border = '5px solid #ff0000';
            box.style.background = '#0f1115';
            box.style.display = 'flex';
            box.style.alignItems = 'center';
            box.style.justifyContent = 'center';
            box.style.boxSizing = 'border-box';

            box.innerHTML = '';
            const img = new Image();
            img.alt = 'sample-preview';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.onload = () => box.appendChild(img);
            img.src = imgSrc;
        }

        btn.addEventListener('mouseenter', () => {
            const dataUrl = makeSampleImageDataURL();
            showPreview(dataUrl);
        });

        btn.addEventListener('mouseleave', () => {
            const box = document.getElementById('preview');
            box.innerHTML = '<span class="text-muted">Chưa có ảnh</span>';
        });
});
