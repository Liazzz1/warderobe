// Извлечение доминирующих цветов из вырезанного изображения (с прозрачным фоном)
export async function extractDominantColors(imageSrc: string, maxColors = 5): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 100;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve([]);
          return;
        }

        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        // Квантование цветов (шаг 24 для группировки близких оттенков)
        const STEP = 24;
        const colorCounts = new Map<string, { count: number; rSum: number; gSum: number; bSum: number }>();

        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          // Пропускаем прозрачные и полупрозрачные пиксели (фон)
          if (a < 140) continue;

          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const keyR = Math.floor(r / STEP) * STEP;
          const keyG = Math.floor(g / STEP) * STEP;
          const keyB = Math.floor(b / STEP) * STEP;
          const key = keyR + ',' + keyG + ',' + keyB;

          const existing = colorCounts.get(key);
          if (existing) {
            existing.count++;
            existing.rSum += r;
            existing.gSum += g;
            existing.bSum += b;
          } else {
            colorCounts.set(key, { count: 1, rSum: r, gSum: g, bSum: b });
          }
        }

        // Сортируем группы по частоте встречаемости
        const sorted = Array.from(colorCounts.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, maxColors * 2);

        const hexColors: string[] = [];
        for (const item of sorted) {
          const avgR = Math.round(item.rSum / item.count);
          const avgG = Math.round(item.gSum / item.count);
          const avgB = Math.round(item.bSum / item.count);
          const hex = '#' + [avgR, avgG, avgB].map((v) => v.toString(16).padStart(2, '0')).join('');

          // Проверяем, чтобы цвета не были слишком похожи друг на друга (разница по расстоянию > 35)
          const isDistinct = hexColors.every((existingHex) => {
            const er = parseInt(existingHex.slice(1, 3), 16);
            const eg = parseInt(existingHex.slice(3, 5), 16);
            const eb = parseInt(existingHex.slice(5, 7), 16);
            const dist = Math.hypot(avgR - er, avgG - eg, avgB - eb);
            return dist > 35;
          });

          if (isDistinct) {
            hexColors.push(hex);
            if (hexColors.length >= maxColors) break;
          }
        }

        resolve(hexColors);
      } catch (err) {
        console.warn('Could not extract dominant colors:', err);
        resolve([]);
      }
    };
    img.onerror = () => resolve([]);
    img.src = imageSrc;
  });
}
