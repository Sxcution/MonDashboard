type ImageEditorMode = "edit" | "collage";

interface ImageTextLayer {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  rotation?: number;
  rainbow?: boolean;
  [key: string]: unknown;
}

interface ImageCollageHistoryItem {
  id: string;
  timestamp?: string;
  date?: string;
  imageCount: number;
  images: string[];
  [key: string]: unknown;
}

type ImageLayoutCell = [number, number, number, number];

interface ImageLayoutTemplate {
  id: string;
  name: string;
  cols: number;
  rows: number;
  maxPhotos: number;
  cells: ImageLayoutCell[];
}

interface ImagePoint {
  x: number;
  y: number;
}

interface ImageRect extends ImagePoint {
  width: number;
  height: number;
}

interface ImageCanvasCell {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ImageHealState {
  active: boolean;
  brushSize: number;
  radius: number;
  opacity: number;
  applied: boolean;
}

interface ImageEditorState {
  mode: ImageEditorMode;
  textLayers: ImageTextLayer[];
  selectedTextLayerId: string | null;
  collageImages: HTMLImageElement[];
  selectedLayout: string | null;
  heal: ImageHealState;
}

type ImageCacheType = "edit" | "collage";

interface ImageStorageHelpers {
  saveImageToCache(data: string | string[], type?: ImageCacheType): void;
  loadImageFromCache(type?: ImageCacheType): string | null;
  clearImageCache(type?: ImageCacheType): void;
  readCollageHistory(): ImageCollageHistoryItem[];
  writeCollageHistory(history: ImageCollageHistoryItem[]): void;
  addCollageHistory(images: string[]): ImageCollageHistoryItem;
}

interface Window {
  ImageEditorStorage: ImageStorageHelpers;
}

declare function showToast(message: string, type?: string, title?: string): void;
declare function handleImageNavClick(event: Event): boolean;
