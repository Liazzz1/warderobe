import type { LookLayer, ClothingItem, Category } from '../types';

const CANVAS_CSS_WIDTH = 480;
const CANVAS_CSS_HEIGHT = 380;
const RENDER_SCALE = 2; // рендерим в 2x для чёткости превью
const PADDING = 18;
const GAP = 12;

// "Человеческий" порядок вещей в раскладке — сверху то, что носится поверх/выше.
const CATEGORY_ORDER: Category[] = ['outerwear', 'dress', 'top', 'bottom', 'shoes', 'accessory'];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Важно: без этого drawImage с картинкой с другого домена (например, R2/CDN)
    // "заражает" canvas, и toDataURL() падает с SecurityError. Ошибка тихо
    // ловится в вызывающем коде (.catch(() => undefined)), из-за чего
    // previewUrl оставался пустым, и в библиотеке лука показывалась emoji-заглушка.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function pickGridCols(count: number): number {
  if (count <= 2) return count;
  if (count === 3) return 3;
  if (count === 4) return 2;
  return 3;
}

/**
 * Строит превью лука как плоскую раскладку ("flat lay") — вещи выстраиваются
 * рядом друг с другом по сетке, а не в тех произвольных координатах,
 * в которых их можно перетаскивать на холсте конструктора. Это даёт читаемую
 * картинку независимо от того, собирался лук по слотам или на холсте-коллаже.
 * Используется вместо эмодзи-заглушки для сохранённых образов.
 */
export async function composeLookPreview(
  layers: LookLayer[],
  items: ClothingItem[]
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_CSS_WIDTH * RENDER_SCALE;
  canvas.height = CANVAS_CSS_HEIGHT * RENDER_SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.fillStyle = '#16161a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Уникальные вещи лука, в порядке "как их носят"
  const seen = new Set<string>();
  const lookItems: ClothingItem[] = [];
  for (const layer of [...layers].sort((a, b) => a.zIndex - b.zIndex)) {
    if (seen.has(layer.itemId)) continue;
    const item = items.find((it) => it.id === layer.itemId);
    if (!item) continue;
    seen.add(layer.itemId);
    lookItems.push(item);
  }
  lookItems.sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
  );

  if (lookItems.length === 0) {
    return canvas.toDataURL('image/png', 0.85);
  }

  const cols = pickGridCols(lookItems.length);
  const rows = Math.ceil(lookItems.length / cols);

  const padding = PADDING * RENDER_SCALE;
  const gap = GAP * RENDER_SCALE;
  const cellW = (canvas.width - padding * 2 - gap * (cols - 1)) / cols;
  const cellH = (canvas.height - padding * 2 - gap * (rows - 1)) / rows;

  for (let i = 0; i < lookItems.length; i++) {
    const item = lookItems[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cellX = padding + col * (cellW + gap);
    const cellY = padding + row * (cellH + gap);

    try {
      const img = await loadImage(item.imageUrl);
      const fitScale = Math.min(cellW / img.width, cellH / img.height);
      const drawW = img.width * fitScale * 0.9; // небольшой отступ внутри ячейки
      const drawH = img.height * fitScale * 0.9;
      const dx = cellX + (cellW - drawW) / 2;
      const dy = cellY + (cellH - drawH) / 2;

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 10 * RENDER_SCALE;
      ctx.drawImage(img, dx, dy, drawW, drawH);
      ctx.restore();
    } catch (err) {
      console.warn('Failed to draw item for preview', err);
    }
  }

  return canvas.toDataURL('image/png', 0.85);
}
