export type Category = 'top' | 'bottom' | 'shoes' | 'accessory' | 'outerwear' | 'dress';

export const CATEGORY_LABELS: Record<Category, string> = {
  top: 'Верх',
  bottom: 'Низ',
  shoes: 'Обувь',
  accessory: 'Аксессуар',
  outerwear: 'Верхняя одежда',
  dress: 'Платье',
};

export const COLOR_OPTIONS = [
  { label: 'Чёрный', hex: '#1c1c1c' },
  { label: 'Графит', hex: '#4a4a50' },
  { label: 'Серый', hex: '#8e8e93' },
  { label: 'Белый', hex: '#f6f3ec' },
  { label: 'Молочный', hex: '#ede8dd' },
  { label: 'Бежевый', hex: '#c9b790' },
  { label: 'Коричневый', hex: '#5d3a24' },
  { label: 'Хаки', hex: '#5f644b' },
  { label: 'Оливковый', hex: '#41533b' },
  { label: 'Тёмно-синий', hex: '#1d2a44' },
  { label: 'Синий', hex: '#3a4a6b' },
  { label: 'Голубой', hex: '#82a9cf' },
  { label: 'Бордовый', hex: '#631826' },
  { label: 'Терракот', hex: '#e8895f' },
  { label: 'Лавандовый', hex: '#b9a6ff' },
  { label: 'Шалфей', hex: '#8fa89b' },
];

export interface ClothingItem {
  id: string;
  userId: string;
  category: Category;
  color: string;
  brand?: string;
  name: string;
  imageUrl: string;
  thumbUrl?: string;
  createdAt: string;
}

export interface LookLayer {
  itemId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  zIndex: number;
}

export interface Look {
  id: string;
  userId: string;
  name: string;
  layers: LookLayer[];
  previewUrl?: string;
  folderId?: string | null;
  createdAt: string;
  /** В каком режиме собирался образ — нужно, чтобы при редактировании открыть тот же режим */
  mode?: 'slots' | 'canvas';
}

/** Надёжно определяет, является ли образ слотовым (с поддержкой старых записей из БД) */
export function isSlotLook(look: Look): boolean {
  if (look.mode === 'slots') return true;
  if (look.mode === 'canvas') return false;
  return look.name.toLowerCase().includes('слот') || !look.previewUrl;
}

export interface LookFolder {
  id: string;
  userId: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}