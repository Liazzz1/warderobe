import React from 'react';
import { isSlotLook, type Look, type ClothingItem } from '../types';

interface LookThumbnailProps {
  look: Look;
  items: ClothingItem[];
  className?: string;
  showBadge?: boolean;
}

export const LookThumbnail: React.FC<LookThumbnailProps> = ({
  look,
  items,
  className = '',
  showBadge = true,
}) => {
  const isSlot = isSlotLook(look);

  // Список вещей для отображения в коллаже
  const lookItems = look.layers
    .map((layer) => items.find((it) => it.id === layer.itemId))
    .filter(Boolean) as ClothingItem[];

  return (
    <div
      className={`thumb studio-bg ${className}`}
      style={{ height: '100%', borderRadius: 12, position: 'relative' }}
    >
      {isSlot ? (
        /* Живой CSS-коллаж из 4 квадрантов как в референсе (фото 1) */
        <div className="slot-preview-grid">
          {[0, 1, 2, 3].map((idx) => {
            const item = lookItems[idx];
            if (idx === 3 && lookItems.length > 4) {
              return (
                <div key={idx} className="slot-preview-cell slot-preview-more">
                  +{lookItems.length - 3}
                </div>
              );
            }
            return (
              <div key={idx} className="slot-preview-cell">
                {item ? <img src={item.imageUrl} alt={item.name} /> : null}
              </div>
            );
          })}
        </div>
      ) : look.previewUrl ? (
        <img
          src={look.previewUrl}
          alt={look.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        /* Для холста без previewUrl — запасной коллаж из вещей, чтобы никогда не было черного экрана */
        <div className="slot-preview-grid">
          {[0, 1, 2, 3].map((idx) => {
            const item = lookItems[idx];
            return (
              <div key={idx} className="slot-preview-cell">
                {item ? <img src={item.imageUrl} alt={item.name} /> : null}
              </div>
            );
          })}
        </div>
      )}

      {showBadge && (
        <span
          style={{
            position: 'absolute',
            bottom: 5,
            left: 5,
            fontSize: '11px',
            background: 'rgba(0,0,0,0.65)',
            borderRadius: 6,
            padding: '1px 5px',
            lineHeight: '1.6',
            backdropFilter: 'blur(4px)',
            color: '#fff',
            pointerEvents: 'none',
          }}
          title={isSlot ? 'По слотам' : 'Коллаж'}
        >
          {isSlot ? '🔲' : '🎨'}
        </span>
      )}
    </div>
  );
};
