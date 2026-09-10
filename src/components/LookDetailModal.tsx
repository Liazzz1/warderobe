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

        {/* Действие: Сохранить в фото (при наличии превью) */}
        {look.previewUrl && (
          <div className="look-share-actions">
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
              💾 Сохранить в фото
            </button>
          </div>
        )}

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
