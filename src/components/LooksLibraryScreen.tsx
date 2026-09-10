import React, { useEffect, useState } from 'react';
import { useWardrobeStore } from '../store/useWardrobeStore';
import { haptic, hapticSuccess } from '../lib/telegram';
import { LookDetailModal } from './LookDetailModal';
import { LookBuilderScreen } from './LookBuilderScreen';
import { LookThumbnail } from './LookThumbnail';
import { isSlotLook, type Look } from '../types';

type BuilderMode = 'slots' | 'canvas';

export const LooksLibraryScreen: React.FC = () => {
  const {
    items,
    looks,
    folders,
    currentFolderId,
    setCurrentFolderId,
    fetchLooks,
    fetchFolders,
    createFolder,
    removeFolder,
    removeLook,
  } = useWardrobeStore();

  const [viewingLook, setViewingLook] = useState<Look | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingLook, setEditingLook] = useState<Look | null>(null);
  const [chosenMode, setChosenMode] = useState<BuilderMode | null>(null);
  // Показывать ли экран выбора режима
  const [showModeSelect, setShowModeSelect] = useState(false);

  useEffect(() => {
    fetchLooks();
    fetchFolders();
  }, [fetchLooks, fetchFolders]);

  // ── Билдер ──
  if (showBuilder) {
    return (
      <div>
        <div style={{ padding: '0 20px', marginTop: '2px' }}>
          <button
            className="btn-secondary"
            style={{ width: 'auto', display: 'inline-flex', padding: '8px 14px', marginBottom: 4 }}
            onClick={() => {
              haptic('light');
              setShowBuilder(false);
              setEditingLook(null);
              setChosenMode(null);
            }}
          >
            ← К образам
          </button>
        </div>
        <LookBuilderScreen
          folderId={editingLook ? editingLook.folderId ?? null : currentFolderId}
          editLook={editingLook}
          initialMode={chosenMode ?? undefined}
          onSaved={() => {
            setShowBuilder(false);
            setEditingLook(null);
            setChosenMode(null);
          }}
        />
      </div>
    );
  }

  const childFolders = folders.filter((f) => f.parentId === currentFolderId);
  const folderLooks = looks.filter((l) => (l.folderId ?? null) === currentFolderId);

  // Хлебные крошки
  const crumbs: { id: string | null; name: string }[] = [{ id: null, name: 'Луки' }];
  let cursor = currentFolderId;
  const chain: { id: string; name: string }[] = [];
  while (cursor) {
    const f = folders.find((fl) => fl.id === cursor);
    if (!f) break;
    chain.unshift({ id: f.id, name: f.name });
    cursor = f.parentId;
  }
  crumbs.push(...chain);

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    haptic('medium');
    await createFolder(name, currentFolderId);
    hapticSuccess();
    setNewFolderName('');
    setShowNewFolder(false);
  };

  return (
    <div className="screen-content" style={{ paddingBottom: 90 }}>
      <div className="breadcrumbs">
        {crumbs.map((c, i) => (
          <React.Fragment key={c.id ?? 'root'}>
            {i > 0 && <span>/</span>}
            <button
              className={i === crumbs.length - 1 ? 'current' : ''}
              onClick={() => {
                haptic('light');
                setCurrentFolderId(c.id);
              }}
            >
              {c.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {!showNewFolder ? (
        <button
          className="btn-secondary"
          style={{ width: 'auto', display: 'inline-flex', padding: '8px 14px', marginBottom: 14 }}
          onClick={() => {
            haptic('light');
            setShowNewFolder(true);
          }}
        >
          📁 Новая папка
        </button>
      ) : (
        <div className="new-folder-row">
          <input
            className="text-input"
            placeholder="Название папки"
            value={newFolderName}
            autoFocus
            onChange={(e) => setNewFolderName(e.target.value)}
          />
          <button className="btn-secondary" style={{ flex: '0 0 auto' }} onClick={handleCreateFolder}>
            ✓
          </button>
          <button
            className="btn-secondary"
            style={{ flex: '0 0 auto' }}
            onClick={() => {
              setShowNewFolder(false);
              setNewFolderName('');
            }}
          >
            ✕
          </button>
        </div>
      )}

      {childFolders.length > 0 && (
        <>
          <div className="section-divider">Папки</div>
          <div className="grid" style={{ marginBottom: 10 }}>
            {childFolders.map((f) => (
              <div
                key={f.id}
                className="folder-card"
                onClick={() => {
                  haptic('light');
                  setCurrentFolderId(f.id);
                }}
              >
                <span className="folder-icon">📁</span>
                <span className="folder-name">{f.name}</span>
                <button
                  className="delete-btn"
                  style={{ position: 'static', width: 22, height: 22, flexShrink: 0 }}
                  title="Удалить папку"
                  onClick={(e) => {
                    e.stopPropagation();
                    haptic('medium');
                    removeFolder(f.id);
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-divider">Образы {folderLooks.length > 0 ? `(${folderLooks.length})` : ''}</div>
      {folderLooks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-dim)', fontSize: '13px' }}>
          Здесь пока нет сохранённых образов
        </div>
      ) : (
        <div className="grid">
          {folderLooks.map((look) => (
            <div
              key={look.id}
              className="item-card look-thumb"
              style={{ padding: 0, aspectRatio: 1 }}
              onClick={() => {
                haptic('light');
                setViewingLook(look);
              }}
            >
              <LookThumbnail look={look} items={items} />
              <div className="look-name">{look.name}</div>
              <button
                className="delete-btn"
                title="Удалить"
                onClick={(e) => {
                  e.stopPropagation();
                  haptic('medium');
                  removeLook(look.id);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* FAB — кнопка добавить образ */}
      <button
        className="fab"
        title="Собрать новый образ"
        onClick={() => {
          haptic('medium');
          setShowModeSelect(true);
        }}
      >
        +
      </button>

      {/* ── Модал выбора режима ── */}
      {showModeSelect && (
        <div
          className="modal-overlay"
          onClick={() => {
            haptic('light');
            setShowModeSelect(false);
          }}
        >
          <div className="modal-sheet mode-select-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="mode-select-title">Как создать образ?</div>

            <button
              className="mode-select-option"
              onClick={() => {
                haptic('medium');
                clearCanvas();
                setEditingLook(null);
                setChosenMode('slots');
                setShowModeSelect(false);
                setShowBuilder(true);
              }}
            >
              <div className="mode-select-icon">🔲</div>
              <div className="mode-select-text">
                <div className="mode-select-name">По слотам</div>
                <div className="mode-select-desc">Выбери вещи по категориям — верх, низ, обувь и т.д.</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <button
              className="mode-select-option"
              onClick={() => {
                haptic('medium');
                clearCanvas();
                setEditingLook(null);
                setChosenMode('canvas');
                setShowModeSelect(false);
                setShowBuilder(true);
              }}
            >
              <div className="mode-select-icon">🎨</div>
              <div className="mode-select-text">
                <div className="mode-select-name">Коллаж (Холст)</div>
                <div className="mode-select-desc">Расставь вещи свободно на холсте как хочешь</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <button
              className="btn-secondary"
              style={{ marginTop: 12 }}
              onClick={() => {
                haptic('light');
                setShowModeSelect(false);
              }}
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {viewingLook && (
        <LookDetailModal
          look={viewingLook}
          items={items}
          onClose={() => setViewingLook(null)}
          onDelete={() => removeLook(viewingLook.id)}
          onEdit={() => {
            setEditingLook(viewingLook);
            setChosenMode(isSlotLook(viewingLook) ? 'slots' : 'canvas');
            setViewingLook(null);
            setShowBuilder(true);
          }}
        />
      )}
    </div>
  );
};
