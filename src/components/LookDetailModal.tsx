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

const SLOT_CONFIG: { category: Category; label: string }[] = [
  { category: 'outerwear', label: 'Верхняя одежда' },
  { category: 'top', label: 'Верх' },
  { category: 'dress', label: 'Платье' },
  { category: 'bottom', label: 'Низ' },
  { category: 'shoes', label: 'Обувь' },
  { category: 'accessory', label: 'Аксессуар' },
];

export const LookDetailModal: React.FC<LookDetailModalProps> = ({ look, items, onClose, onDelete, onEdit }) => {
  const isSlots = look.mode === 'slots';

  // Слот-режим: нумерованный список вещей по категориям
  const slotItems: { num: number; label: string; item: ClothingItem }[] = [];
  if (isSlots) {
    let num = 1;
    for (const slot of SLOT_CONFIG) {
      const layer = look.layers.find((l) => {
        const it = items.find((i) => i.id === l.itemId);
        return it?.category === slot.category;
      });
      if (layer) {
        const item = items.find((i) => i.id === layer.itemId);
        if (item) {
          slotItems.push({ num: num++, label: slot.label, item });
        }
      }
    }
  }

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
                  <div className="slot-big-card-body checker-bg">
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
          /* ── Canvas-вид: превью картинка + список вещей ── */
          <>
            <div className="detail-image checker-bg">
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
                    <div key={item.id} className="tray-item checker-bg">
                      <img src={item.imageUrl} alt={item.name} />
                    </div>
                  ))}
                </div>
              </>
            )}
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
