import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Panel, Button, Input } from './ui.jsx';

export default function WishlistIdeas() {
  const [wishlist, setWishlist] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [newWish, setNewWish] = useState('');
  const [newIdea, setNewIdea] = useState('');
  const [newIdeaUrl, setNewIdeaUrl] = useState('');

  const load = () => {
    api.listWishlist().then(setWishlist);
    api.listIdeas().then(setIdeas);
  };
  useEffect(() => { load(); }, []);

  const addWish = async () => {
    if (!newWish.trim()) return;
    await api.addWishlist({ name: newWish, priority: 2 });
    setNewWish('');
    load();
  };

  const addIdea = async () => {
    if (!newIdea.trim()) return;
    await api.addIdea({ title: newIdea, source_url: newIdeaUrl });
    setNewIdea('');
    setNewIdeaUrl('');
    load();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Panel title="WISHLIST // FILAMENT" accent="#ffb800">
        <div className="flex gap-2 mb-4">
          <div className="flex-1">
            <Input placeholder="z.B. Sunlu Silk Gold..." value={newWish} onChange={e => setNewWish(e.target.value)} onKeyDown={e => e.key === 'Enter' && addWish()} />
          </div>
          <Button onClick={addWish}>+</Button>
        </div>
        <div className="space-y-2">
          {wishlist.length === 0 && <div className="text-gray-500 text-xs text-center py-4">// LEER</div>}
          {wishlist.map(w => (
            <div key={w.id} className="flex items-center gap-2 p-2 border border-line bg-ink/40 group">
              <span className="text-accent text-xs">▸</span>
              <span className="flex-1 text-sm">{w.name}</span>
              {w.shop_url && (
                <a href={w.shop_url} target="_blank" rel="noreferrer" className="text-[10px] text-accent2 hover:underline">SHOP</a>
              )}
              <button onClick={async () => { await api.deleteWishlist(w.id); load(); }} className="text-gray-600 hover:text-danger opacity-0 group-hover:opacity-100">✕</button>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="DRUCK-IDEEN" accent="#00d9ff">
        <div className="space-y-2 mb-4">
          <Input placeholder="Was wollt ihr drucken?" value={newIdea} onChange={e => setNewIdea(e.target.value)} />
          <div className="flex gap-2">
            <div className="flex-1">
              <Input placeholder="Link zu Makerworld / Printables (optional)" value={newIdeaUrl} onChange={e => setNewIdeaUrl(e.target.value)} />
            </div>
            <Button onClick={addIdea}>+</Button>
          </div>
        </div>
        <div className="space-y-2">
          {ideas.length === 0 && <div className="text-gray-500 text-xs text-center py-4">// LEER</div>}
          {ideas.map(i => (
            <div key={i.id} className={`flex items-center gap-2 p-2 border border-line bg-ink/40 group ${i.is_done ? 'opacity-50' : ''}`}>
              <input
                type="checkbox"
                checked={!!i.is_done}
                onChange={async () => { await api.toggleIdea(i.id); load(); }}
                className="accent-accent"
              />
              <span className={`flex-1 text-sm ${i.is_done ? 'line-through' : ''}`}>{i.title}</span>
              {i.source_url && (
                <a href={i.source_url} target="_blank" rel="noreferrer" className="text-[10px] text-accent2 hover:underline">LINK</a>
              )}
              <button onClick={async () => { await api.deleteIdea(i.id); load(); }} className="text-gray-600 hover:text-danger opacity-0 group-hover:opacity-100">✕</button>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
