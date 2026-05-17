"use strict";
// Typed media helpers for Notes paste/thumbnail flows.
(function () {
    async function compressImageFile(file, options = {}) {
        const { maxW = 900, maxH = 900, quality = 0.76 } = options;
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                const scale = Math.min(maxW / img.width, maxH / img.height, 1);
                const width = Math.round(img.width * scale);
                const height = Math.round(img.height * scale);
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    URL.revokeObjectURL(url);
                    reject(new Error("Canvas is not available"));
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error("Image compression failed"));
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result || ""));
                    reader.onerror = () => reject(reader.error || new Error("Image read failed"));
                    reader.readAsDataURL(blob);
                }, "image/jpeg", quality);
                URL.revokeObjectURL(url);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("Image load failed"));
            };
            img.src = url;
        });
    }
    async function makeThumb(dataUrl, maxSide = 200, quality = 0.82) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const ratio = Math.min(maxSide / img.width, maxSide / img.height, 1);
                const width = Math.round(img.width * ratio);
                const height = Math.round(img.height * ratio);
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    reject(new Error("Canvas is not available"));
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL("image/jpeg", quality));
            };
            img.onerror = () => reject(new Error("Image thumbnail load failed"));
            img.src = dataUrl;
        });
    }
    window.NotesMedia = {
        compressImageFile,
        makeThumb
    };
})();
