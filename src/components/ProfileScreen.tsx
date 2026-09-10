import React, { useEffect } from 'react';
import { useWardrobeStore } from '../store/useWardrobeStore';
import { getTelegramUser } from '../lib/telegram';
import { isSyncEnabled } from '../lib/api';
import { LookThumbnail } from './LookThumbnail';

export const ProfileScreen: React.FC = () => {
  const { items, looks, fetchLooks } = useWardrobeStore();
  const user = getTelegramUser();
  const syncOn = isSyncEnabled();

  useEffect(() => {
    fetchLooks();
  }, [fetchLooks]);

  return (
    <div className="screen-content">
      <div className="profile-hero">
        <div
          className="avatar"
          style={
            user?.photo_url
              ? { backgroundImage: `url(${user.photo_url})`, backgroundSize: 'cover' }
              : undefined
          }
        />
        <div>
          <div style={{ fontWeight: 700, fontSize: '16px' }}>
            {user ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Пользователь TMA'}
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-dim)' }}>
            {user?.username ? `@${user.username}` : 'Гардероб готов'}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          color: syncOn ? 'var(--accent, #7ddc8c)' : 'var(--text-dim)',
          margin: '4px 0 14px',
        }}
      >
        <span
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: syncOn ? '#7ddc8c' : '#c9a13b',
            display: 'inline-block',
          }}
        />
        {syncOn
          ? 'Синхронизировано с аккаунтом Telegram'
          : 'Локальный режим — данные хранятся только на этом устройстве'}
      </div>

      <div className="stat-row">
        <div className="stat-card">
          <div className="n">{items.length}</div>
          <div className="l">Вещей в базе</div>
        </div>
        <div className="stat-card">
          <div className="n">{looks.length}</div>
          <div className="l">Образов</div>
        </div>
      </div>

      {/* Аналитика гардероба */}
      {items.length > 0 && (() => {
        // Подсчёт цветов
        const colorCounts: Record<string, number> = {};
        const catCounts: Record<string, number> = {};
        for (const it of items) {
          const c = it.color.toLowerCase();
          colorCounts[c] = (colorCounts[c] || 0) + 1;
          catCounts[it.category] = (catCounts[it.category] || 0) + 1;
        }

        const sortedColors = Object.entries(colorCounts)
          .map(([hex, count]) => ({ hex, count, pct: Math.round((count / items.length) * 100) }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        const sortedCats = Object.entries(catCounts)
          .map(([cat, count]) => ({ cat, count, pct: Math.round((count / items.length) * 100) }))
          .sort((a, b) => b.count - a.count);

        const categoryNames: Record<string, string> = {
          top: 'Верх',
          bottom: 'Низ',
          shoes: 'Обувь',
          outerwear: 'Верхняя одежда',
          accessory: 'Аксессуары',
          dress: 'Платья',
        };

        return (
          <div className="analytics-card">
            <div className="analytics-title">
              <span>Палитра гардероба</span>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 500 }}>
                {sortedColors.length} осн. оттенков
              </span>
            </div>

            {/* Цветовая полоска */}
            <div className="palette-bar">
              {sortedColors.map((c) => (
                <div
                  key={c.hex}
                  className="palette-segment"
                  style={{
                    width: `${c.pct}%`,
                    backgroundColor: c.hex,
                  }}
                  title={`${c.hex}: ${c.pct}%`}
                />
              ))}
            </div>

            {/* Легенда цветов */}
            <div className="palette-legend">
              {sortedColors.map((c) => (
                <div key={c.hex} className="palette-legend-item">
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: c.hex,
                      display: 'inline-block',
                      border: '1px solid var(--line)',
                    }}
                  />
                  <span>{c.pct}%</span>
                </div>
              ))}
            </div>

            <div className="analytics-title" style={{ marginTop: 18, marginBottom: 8 }}>
              <span>Баланс категорий</span>
            </div>

            {/* Категории */}
            <div className="category-bars">
              {sortedCats.slice(0, 4).map((c) => (
                <div key={c.cat} className="category-bar-row">
                  <div className="category-bar-header">
                    <span>{categoryNames[c.cat] || c.cat}</span>
                    <span style={{ color: 'var(--text-dim)' }}>{c.count} ({c.pct}%)</span>
                  </div>
                  <div className="category-bar-track">
                    <div className="category-bar-fill" style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="sec-label">Сохраненные образы</div>
      {looks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-dim)', fontSize: '13px' }}>
          У вас пока нет сохранённых образов
        </div>
      ) : (
        <div className="grid">
          {looks.map((look) => (
            <div key={look.id} className="item-card look-thumb" style={{ padding: 0, aspectRatio: 1 }}>
              <LookThumbnail look={look} items={items} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};