import React from 'react';
import type { Look, ClothingItem, Category } from '../types';
import { haptic } from '../lib/telegram';

interface LookDetailModalProps {
  look: Look;
  items: ClothingItem[];
  onClose: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

const SLOT_CONFIG: { category: Category; label: string; icon: string }[] = [
  { category: 'outerwear', label: 'Верхняя одежда', icon: '🧥' },
  { category: 'top', label: 'Верх', icon: '👕' },
  { category: 'dress', label: 'Платье', icon: '👗' },
  { category: 'bottom', label: 'Низ', icon: '👖' },
  { category: 'shoes', label: 'Обувь', icon: '👟' },
  { category: 'accessory', label: 'Аксессуар', icon: '🧢' },
];

export const LookDetailModal: React.FC<LookDetailModalProps> = ({ look, items, onClose, onDelete, onEdit }) => {
  const isSlots = look.mode === 'slots';

  // Для слот-режима — группируем вещи по категории
  const slotItems: { category: Category; label: string; icon: string; item: ClothingItem }[] = [];
  if (isSlots) {
    for (const slot of SLOT_CONFIG) {
      const layer = look.layers.find((l) => {
        const it = items.find((i) => i.id === l.itemId);
        return it?.category === slot.category;
      });
      if (layer) {
        const item = items.find((i) => i.id === layer.itemId);
        if (item) slotItems.push({ ...slot, item });
      }
    }
  }

  // Для canvas-режима — все вещи по порядку
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
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />

        {isSlots ? (
          /* ── Слот-вид: карточки по категориям ── */
          <div className="slots-detail-view">
            {slotItems.length > 0 ? (
              slotItems.map(({ category, label, icon, item }) => (
                <div key={category} className="slot-detail-row">
                  <div className="slot-detail-icon">{icon}</div>
                  <div className="slot-detail-thumb checker-bg">
                    <img src={item.imageUrl} alt={item.name} />
                  </div>
                  <div className="slot-detail-info">
                    <div className="slot-detail-label">{label}</div>
                    <div className="slot-detail-name">{item.name}</div>
                    {item.brand && <div className="slot-detail-brand">{item.brand}</div>}
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
          /* ── Canvas-вид: превью картинка ── */
          <div className="detail-image checker-bg">
            {look.previewUrl ? (
              <img src={look.previewUrl} alt={look.name} />
            ) : (
              <span style={{ fontSize: '40px' }}>✨</span>
            )}
          </div>
        )}

        <div className="detail-title">{look.name}</div>
        <div className="detail-sub">
          {isSlots ? '🔲 По слотам · ' : '🎨 Коллаж · '}
          {new Date(look.createdAt).toLocaleDateString('ru-RU')}
        </div>

        {/* Для canvas-режима дополнительно показываем список вещей */}
        {!isSlots && lookItems.length > 0 && (
          <>
            <div className="section-divider">Вещи в образе ({lookItems.length})</div>
            <div className="tray" style={{ marginTop: 0 }}>
              {lookItems.map((item) => (
                <div key={item.id} className="tray-item checker-bg">
                  <img src={item.imageUrl} alt={item.name} />
                </div>
              ))}
            </div>
          </>
        )}

        <button
          className="btn-secondary"
          style={{ marginTop: 18, background: 'var(--lav)', color: '#171126', borderColor: 'var(--lav)' }}
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
