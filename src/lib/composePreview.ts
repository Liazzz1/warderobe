import type { LookLayer, ClothingItem, Category } from '../types';

const CANVAS_CSS_WIDTH = 480;
const CANVAS_CSS_HEIGHT = 380;
const RENDER_SCALE = 2; // рендерим в 2x для чёткости превью
const PADDING = 18;
const GAP = 12;

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


/**
 * Строит превью холста (коллажа) в точности так, как пользователь расставил вещи:
 * с сохранением их точных координат (x, y), масштаба (scale), угла поворота (rotation)
 * и порядка слоёв (zIndex). Это гарантирует 100% совпадение превью с холстом.
 */
export async function composeLookPreview(
  layers: LookLayer[],
  items: ClothingItem[],
  canvasWidth = 380,
  canvasHeight = 380
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth * RENDER_SCALE;
  canvas.height = canvasHeight * RENDER_SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Отрисовываем радиальный градиентный фон холста — точь-в-точь как в .canvas-wrap
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = Math.max(canvas.width, canvas.height) / 1.3;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, '#1e1e24');
  grad.addColorStop(1, '#121214');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (layers.length === 0) {
    return canvas.toDataURL('image/png', 0.9);
  }

  // Сортируем слои по zIndex от нижних к верхним
  const sortedLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex);
  const scale = RENDER_SCALE;

  let successCount = 0;
  for (const layer of sortedLayers) {
    const item = items.find((it) => it.id === layer.itemId);
    if (!item) continue;

    try {
      const img = await loadImage(item.imageUrl);

      // В DOM размер карточки вещи на холсте 120x120px
      // Центр карточки в координатах холста: (layer.x + 60, layer.y + 60)
      const centerX = (layer.x + 60) * scale;
      const centerY = (layer.y + 60) * scale;

      // Пропорциональное вписывание картинки в квадрат 120x120
      const fitScale = Math.min(120 / img.width, 120 / img.height);
      const drawW = img.width * fitScale * scale;
      const drawH = img.height * fitScale * scale;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.scale(layer.scale, layer.scale);

      // Тень как в CSS: filter: drop-shadow(0 10px 16px rgba(0, 0, 0, 0.6))
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 16 * scale;
      ctx.shadowOffsetY = 10 * scale;

      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
      successCount++;
    } catch (err) {
      console.warn('Failed to draw item on canvas preview', err);
    }
  }

  if (successCount === 0) {
    throw new Error('Could not draw any items onto preview canvas');
  }

  return canvas.toDataURL('image/png', 0.9);
}

/**
 * Превью для слот-образов: вещи выстраиваются вертикально (как реальный outfit),
 * в порядке носки — сверху вниз: верхняя одежда → верх/платье → низ → обувь → аксессуар.
 * Это визуально отличается от flat-lay для холста.
 */
export async function composeSlotsPreview(
  slots: Partial<Record<Category, ClothingItem | null>>,
): Promise<string> {
  const SLOT_ORDER: Category[] = ['outerwear', 'top', 'dress', 'bottom', 'shoes', 'accessory'];
  const activeItems = SLOT_ORDER.map((cat) => slots[cat]).filter(Boolean) as ClothingItem[];

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_CSS_WIDTH * RENDER_SCALE;
  canvas.height = CANVAS_CSS_HEIGHT * RENDER_SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.fillStyle = '#16161a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (activeItems.length === 0) {
    return canvas.toDataURL('image/png', 0.85);
  }

  const padding = PADDING * RENDER_SCALE;
  const gap = GAP * RENDER_SCALE;

  // Вертикальная колонка: одна колонка если ≤ 3 вещи, две колонки если > 3
  const cols = activeItems.length <= 3 ? 1 : 2;
  const rows = Math.ceil(activeItems.length / cols);
  const cellW = (canvas.width - padding * 2 - gap * (cols - 1)) / cols;
  const cellH = (canvas.height - padding * 2 - gap * (rows - 1)) / rows;

  for (let i = 0; i < activeItems.length; i++) {
    const item = activeItems[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cellX = padding + col * (cellW + gap);
    const cellY = padding + row * (cellH + gap);

    try {
      const img = await loadImage(item.imageUrl);
      const fitScale = Math.min(cellW / img.width, cellH / img.height);
      const drawW = img.width * fitScale * 0.88;
      const drawH = img.height * fitScale * 0.88;
      const dx = cellX + (cellW - drawW) / 2;
      const dy = cellY + (cellH - drawH) / 2;

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 12 * RENDER_SCALE;
      ctx.drawImage(img, dx, dy, drawW, drawH);
      ctx.restore();
    } catch (err) {
      console.warn('Failed to draw item for slots preview', err);
    }
  }

  return canvas.toDataURL('image/png', 0.85);
}
