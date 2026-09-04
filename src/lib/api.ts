import { getInitDataRaw } from './telegram';
import { dbGetAll, dbPut, dbDelete, dbUpdate, STORES, migrateFromLocalStorageOnce } from './db';
import type { ClothingItem, Look, Category, LookFolder } from '../types';

const API_URL = import.meta.env.VITE_API_URL as string | undefined;
const USE_MOCKS = !API_URL;

/** Показывает, привязано ли приложение к серверу (а значит — синхронизируется между устройствами). */
export function isSyncEnabled(): boolean {
  return !USE_MOCKS;
}

function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const readyPromise = migrateFromLocalStorageOnce();

/** true, если ошибка похожа на обрыв сети (а не на осмысленный ответ сервера, например 401/404). */
function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError; // fetch бросает TypeError при отсутствии сети/CORS-обрыве
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const headers: Record<string, string> = {
    Authorization: `tma ${getInitDataRaw()}`,
    ...(init?.headers as Record<string, string>),
  };

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`API ${path} failed (${res.status}): ${errText}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Читает список с сервера и параллельно кладёт его в локальный кэш (IndexedDB),
 * чтобы приложение работало и без сети. Если запрос к серверу не удался из-за
 * обрыва сети — отдаём последнюю закэшированную версию вместо ошибки.
 */
async function fetchWithCache<T extends { id: string }>(
  path: string,
  store: string
): Promise<T[]> {
  await readyPromise;
  try {
    const fresh = await request<T[]>(path);
    // фоновая синхронизация кэша, не блокируем возврат данных
    void Promise.all(fresh.map((row) => dbPut(store, row))).catch(() => {});
    return fresh;
  } catch (err) {
    if (isNetworkError(err)) {
      const cached = await dbGetAll<T>(store);
      if (cached.length > 0) return cached;
    }
    throw err;
  }
}

export const api = {
  async listItems(category?: Category): Promise<ClothingItem[]> {
    if (USE_MOCKS) {
      await readyPromise;
      const items = await dbGetAll<ClothingItem>(STORES.items);
      items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return category ? items.filter((i) => i.category === category) : items;
    }
    const qs = category ? `?category=${category}` : '';
    const items = await fetchWithCache<ClothingItem>(`/items${qs}`, STORES.items);
    items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return items;
  },

  async uploadItem(
    file: File | Blob,
    meta: { category: Category; color: string; brand?: string; name: string }
  ): Promise<ClothingItem> {
    if (USE_MOCKS) {
      await readyPromise;
      const base64Url = await fileToBase64(file);
      const item: ClothingItem = {
        id: crypto.randomUUID(),
        userId: 'local_user',
        imageUrl: base64Url,
        createdAt: new Date().toISOString(),
        ...meta,
      };
      await dbPut(STORES.items, item);
      return item;
    }
    const form = new FormData();
    form.append('file', file, 'item.png');
    form.append('category', meta.category);
    form.append('color', meta.color);
    form.append('name', meta.name);
    if (meta.brand) form.append('brand', meta.brand);
    const saved = await request<ClothingItem>('/items/upload', { method: 'POST', body: form });
    void dbPut(STORES.items, saved).catch(() => {});
    return saved;
  },

  async deleteItem(id: string): Promise<void> {
    if (USE_MOCKS) {
      await readyPromise;
      await dbDelete(STORES.items, id);
      return;
    }
    await request<void>(`/items/${id}`, { method: 'DELETE' });
    void dbDelete(STORES.items, id).catch(() => {});
  },

  async listLooks(): Promise<Look[]> {
    if (USE_MOCKS) {
      await readyPromise;
      const looks = await dbGetAll<Look>(STORES.looks);
      looks.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return looks;
    }
    const looks = await fetchWithCache<Look>('/looks', STORES.looks);
    looks.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return looks;
  },

  async saveLook(look: Omit<Look, 'id' | 'userId' | 'createdAt'>): Promise<Look> {
    if (USE_MOCKS) {
      await readyPromise;
      const saved: Look = {
        id: crypto.randomUUID(),
        userId: 'local_user',
        createdAt: new Date().toISOString(),
        folderId: look.folderId ?? null,
        ...look,
      };
      await dbPut(STORES.looks, saved);
      return saved;
    }
    const saved = await request<Look>('/looks', { method: 'POST', body: JSON.stringify(look) });
    void dbPut(STORES.looks, saved).catch(() => {});
    return saved;
  },

  async updateLook(id: string, patch: Partial<Omit<Look, 'id' | 'userId' | 'createdAt'>>): Promise<Look | undefined> {
    if (USE_MOCKS) {
      await readyPromise;
      return dbUpdate<Look>(STORES.looks, id, (look) => ({ ...look, ...patch }));
    }
    const updated = await request<Look>(`/looks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    void dbPut(STORES.looks, updated).catch(() => {});
    return updated;
  },

  async deleteLook(id: string): Promise<void> {
    if (USE_MOCKS) {
      await readyPromise;
      await dbDelete(STORES.looks, id);
      return;
    }
    await request<void>(`/looks/${id}`, { method: 'DELETE' });
    void dbDelete(STORES.looks, id).catch(() => {});
  },

  async moveLook(id: string, folderId: string | null): Promise<Look | undefined> {
    if (USE_MOCKS) {
      await readyPromise;
      return dbUpdate<Look>(STORES.looks, id, (look) => ({ ...look, folderId }));
    }
    const updated = await request<Look>(`/looks/${id}`, { method: 'PATCH', body: JSON.stringify({ folderId }) });
    void dbPut(STORES.looks, updated).catch(() => {});
    return updated;
  },

  async listFolders(): Promise<LookFolder[]> {
    if (USE_MOCKS) {
      await readyPromise;
      const folders = await dbGetAll<LookFolder>(STORES.folders);
      folders.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return folders;
    }
    const folders = await fetchWithCache<LookFolder>('/folders', STORES.folders);
    folders.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return folders;
  },

  async createFolder(name: string, parentId: string | null): Promise<LookFolder> {
    if (USE_MOCKS) {
      await readyPromise;
      const folder: LookFolder = {
        id: crypto.randomUUID(),
        userId: 'local_user',
        name,
        parentId,
        createdAt: new Date().toISOString(),
      };
      await dbPut(STORES.folders, folder);
      return folder;
    }
    const folder = await request<LookFolder>('/folders', { method: 'POST', body: JSON.stringify({ name, parentId }) });
    void dbPut(STORES.folders, folder).catch(() => {});
    return folder;
  },

  async deleteFolder(id: string): Promise<void> {
    if (USE_MOCKS) {
      await readyPromise;
      await dbDelete(STORES.folders, id);
      return;
    }
    await request<void>(`/folders/${id}`, { method: 'DELETE' });
    void dbDelete(STORES.folders, id).catch(() => {});
  },
};
