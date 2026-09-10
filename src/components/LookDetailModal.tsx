import React from 'react';
import { isSlotLook, CATEGORY_LABELS, type Look, type ClothingItem } from '../types';
import { haptic } from '../lib/telegram';

interface LookDetailModalProps {
  look: Look;
  items: ClothingItem[];
  onClose: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

export const LookDetailModal: React.FC<LookDetailModalProps> = ({ look, items, onClose, onDelete, onEdit }) => {
  const isSlots = isSlotLook(look);

  // Слот-режим: нумерованный список вещей из слоёв образа
  const slotItems = look.layers
    .map((l, index) => {
      const item = items.find((i) => i.id === l.itemId);
      if (!item) return null;
      const label = CATEGORY_LABELS[item.category] || 'Вещь';
      return { num: index + 1, label, item };
    })
    .filter(Boolean) as { num: number; label: string; item: ClothingItem }[];

  // Canvas-режим: все вещи по порядку
  const lookItems = look.layers
    .map((l) => items.find((it) => it.id === l.itemId))
    .filter(Boolean) as ClothingItem[];

  return (
    <div
      className="modal-overlay"
      onClick={() => {
        haptic('light');
        onClose();
      }}
    >
      <div className="modal-sheet look-detail-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />

        {/* Заголовок */}
        <div className="look-detail-header">
          <div className="look-detail-name">{look.name}</div>
          <div className="look-detail-meta">
            {isSlots ? '🔲 По слотам' : '🎨 Коллаж'} · {new Date(look.createdAt).toLocaleDateString('ru-RU')}
          </div>
        </div>

        {isSlots ? (
          /* ── Слот-вид: большие пронумерованные карточки ── */
          <div className="slot-cards-list">
            {slotItems.length > 0 ? (
              slotItems.map(({ num, label, item }) => (
                <div key={item.id} className="slot-big-card">
                  <div className="slot-big-card-header">
                    <span className="slot-big-card-num">{num}.</span>
                    <span className="slot-big-card-label">{label.toUpperCase()}</span>
                  </div>
                  <div className="slot-big-card-body studio-bg">
                    <img src={item.imageUrl} alt={item.name} />
                  </div>
                  <div className="slot-big-card-footer">
                    <span className="slot-big-card-item-name">{item.name}</span>
                    <span className="slot-big-card-item-cat">{label}</span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-dim)' }}>
                Вещи не найдены
              </div>
            )}
          </div>
        ) : (
          /* ── Canvas-вид: крупное вертикальное превью + список вещей ── */
          <>
            <div className="canvas-detail-view">
              {look.previewUrl ? (
                <img src={look.previewUrl} alt={look.name} />
              ) : (
                <span style={{ fontSize: '40px' }}>✨</span>
              )}
            </div>
            {lookItems.length > 0 && (
              <>
                <div className="section-divider">Вещи в образе ({lookItems.length})</div>
                <div className="tray" style={{ marginTop: 0 }}>
                  {lookItems.map((item) => (
                    <div key={item.id} className="tray-item studio-bg">
                      <img src={item.imageUrl} alt={item.name} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Действия: Поделиться и сохранить */}
        <div className="look-share-actions">
          <button
            type="button"
            className="btn-share-tg"
            onClick={() => {
              haptic('medium');
              const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } })
                ?.Telegram?.WebApp;
              const text = encodeURIComponent(`Оцени мой образ «${look.name}» в Warderobe! 🧥✨`);
              const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${text}`;
              if (tg?.openTelegramLink) {
                tg.openTelegramLink(shareUrl);
              } else if (navigator.share) {
                navigator.share({ title: look.name, text: `Оцени мой образ «${look.name}»!`, url: window.location.href }).catch(() => {});
              } else {
                window.open(shareUrl, '_blank');
              }
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
            </svg>
            Поделиться
          </button>

          {look.previewUrl && (
            <button
              type="button"
              className="btn-download-look"
              onClick={() => {
                haptic('light');
                const a = document.createElement('a');
                a.href = look.previewUrl!;
                a.download = `${look.name.replace(/\s+/g, '_')}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              В фото
            </button>
          )}
        </div>

        <button
          className="btn-secondary"
          style={{ marginTop: 14, background: 'var(--lav)', color: '#171126', borderColor: 'var(--lav)' }}
          onClick={() => {
            haptic('light');
            onEdit();
          }}
        >
          ✏️ Редактировать
        </button>
        <button
          className="btn-secondary"
          style={{ marginTop: 10, color: 'var(--danger)', borderColor: 'var(--danger)' }}
          onClick={() => {
            haptic('medium');
            onDelete();
            onClose();
          }}
        >
          Удалить образ
        </button>
        <button className="btn-primary" style={{ marginTop: 10 }} onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
};
