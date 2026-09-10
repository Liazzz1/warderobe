import React, { useState } from 'react';
import type { ClothingItem, Category } from '../types';
import { CATEGORY_LABELS, COLOR_OPTIONS } from '../types';
import { haptic, hapticSuccess } from '../lib/telegram';
import { useWardrobeStore } from '../store/useWardrobeStore';

interface ItemDetailModalProps {
  item: ClothingItem;
  onClose: () => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({ item: initialItem, onClose }) => {
  const updateItem = useWardrobeStore((s) => s.updateItem);
  const [item, setItem] = useState<ClothingItem>(initialItem);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(initialItem.name);
  const [brand, setBrand] = useState(initialItem.brand || '');
  const [category, setCategory] = useState<Category>(initialItem.category);
  const [color, setColor] = useState(initialItem.color);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    haptic('heavy');
    try {
      const updated = await updateItem(item.id, {
        name: name.trim(),
        brand: brand.trim() || undefined,
        category,
        color,
      });
      if (updated) {
        setItem(updated);
        hapticSuccess();
        setIsEditing(false);
      }
    } catch (err) {
      console.error(err);
      haptic('rigid');
    } finally {
      setIsSaving(false);
    }
  };

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
        <div className="detail-image studio-bg">
          <img src={item.imageUrl} alt={item.name} />
        </div>

        {!isEditing ? (
          <>
            <div className="detail-title">{item.name}</div>
            <div className="detail-sub">{item.brand || 'Без бренда'}</div>

            <div style={{ marginTop: 14 }}>
              <div className="detail-row">
                <span className="k">Категория</span>
                <span className="v">{CATEGORY_LABELS[item.category]}</span>
              </div>
              <div className="detail-row">
                <span className="k">Цвет</span>
                <span className="v" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: item.color,
                      display: 'inline-block',
                      border: '1px solid var(--line)',
                    }}
                  />
                  {item.color}
                </span>
              </div>
              <div className="detail-row" style={{ borderBottom: 'none' }}>
                <span className="k">Добавлено</span>
                <span className="v">{new Date(item.createdAt).toLocaleDateString('ru-RU')}</span>
              </div>
            </div>

            <button
              type="button"
              className="item-edit-trigger"
              onClick={() => {
                haptic('light');
                setIsEditing(true);
              }}
            >
              ✏️ Редактировать вещь
            </button>

            <button className="btn-primary" style={{ marginTop: 12 }} onClick={onClose}>
              Закрыть
            </button>
          </>
        ) : (
          <div className="edit-item-form">
            <div className="detail-title" style={{ fontSize: '17px', marginBottom: 12 }}>
              Редактирование вещи
            </div>

            <div className="edit-field">
              <label>Название</label>
              <input
                className="text-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Название вещи"
              />
            </div>

            <div className="edit-field">
              <label>Бренд</label>
              <input
                className="text-input"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Например, Zara"
              />
            </div>

            <div className="edit-field">
              <label>Категория</label>
              <div className="field-row">
                {(Object.keys(CATEGORY_LABELS) as Category[]).map((catKey) => (
                  <button
                    key={catKey}
                    type="button"
                    className={`pill-select ${category === catKey ? 'sel' : ''}`}
                    onClick={() => {
                      haptic('light');
                      setCategory(catKey);
                    }}
                  >
                    {CATEGORY_LABELS[catKey]}
                  </button>
                ))}
              </div>
            </div>

            <div className="edit-field">
              <label>Цвет</label>
              <div className="field-row">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    className={`pill-select ${color.toLowerCase() === c.hex.toLowerCase() ? 'sel' : ''}`}
                    onClick={() => {
                      haptic('light');
                      setColor(c.hex);
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: c.hex }} />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn-primary"
              style={{ marginTop: 16 }}
              disabled={!name.trim() || isSaving}
              onClick={handleSave}
            >
              {isSaving ? 'Сохранение…' : 'Сохранить изменения'}
            </button>
            <button
              className="btn-secondary"
              style={{ marginTop: 8, width: '100%' }}
              onClick={() => {
                haptic('light');
                setIsEditing(false);
              }}
            >
              Отмена
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
