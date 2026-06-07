'use client';

import { useState, FormEvent, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBanner from '../components/ErrorBanner';
import api from '../api/axios';
import { formatDate, todayISO } from '../utils/format';
import { proxiedBlobUrl } from '../utils/blobUrl';

const ANIMAL_TYPES = [
  { value: 'bull',    label: 'Bull',    emoji: '🐂', color: 'bg-amber-50  border-amber-300  text-amber-900'  },
  { value: 'cow',     label: 'Cow',     emoji: '🐄', color: 'bg-green-50  border-green-300  text-green-900'  },
  { value: 'goat',    label: 'Goat',    emoji: '🐐', color: 'bg-orange-50 border-orange-300 text-orange-900' },
  { value: 'sheep',   label: 'Sheep',   emoji: '🐑', color: 'bg-sky-50    border-sky-300    text-sky-900'    },
  { value: 'chicken', label: 'Chicken', emoji: '🐓', color: 'bg-yellow-50 border-yellow-300 text-yellow-900' },
] as const;

type AnimalType = typeof ANIMAL_TYPES[number]['value'];

async function compressImage(file: File, maxSizeBytes = 5 * 1024 * 1024): Promise<File> {
  if (file.size <= maxSizeBytes) return file;
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      const maxDim = 1920;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else { width = Math.round((width * maxDim) / height); height = maxDim; }
      }
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        if (blob && blob.size <= maxSizeBytes) {
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
        } else {
          canvas.toBlob(blob2 => {
            resolve(new File([blob2 ?? blob!], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
          }, 'image/jpeg', 0.6);
        }
      }, 'image/jpeg', 0.8);
    };
    img.src = url;
  });
}

export default function EditCattle() {
  const id = useParams()?.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [animalType, setAnimalType] = useState<AnimalType>('bull');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState('');

  const { data: cattle, isLoading } = useQuery({
    queryKey: ['cattle', id],
    queryFn: () => api.get(`/cattle/${id}`).then(r => r.data),
  });

  useEffect(() => {
    if (cattle) {
      setAnimalType((cattle.animal_type as AnimalType) ?? 'bull');
      setPrice(String(Math.round(parseFloat(cattle.purchase_price))));
      setDate(cattle.purchase_date?.split('T')[0] ?? cattle.purchase_date);
      setDescription(cattle.description || '');
    }
  }, [cattle]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { setError('Image must be under 20 MB.'); return; }
    setCompressing(true);
    try {
      const compressed = await compressImage(file);
      setImageFile(compressed);
      setImagePreview(URL.createObjectURL(compressed));
    } finally {
      setCompressing(false);
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append('animal_type', animalType);
      form.append('purchase_price', price);
      form.append('purchase_date', date);
      form.append('description', description);
      if (imageFile) form.append('receipt', imageFile);
      return api.patch(`/cattle/${id}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cattle', id] });
      queryClient.invalidateQueries({ queryKey: ['cattle'] });
      queryClient.invalidateQueries({ queryKey: ['cattle-summary'] });
      queryClient.invalidateQueries({ queryKey: ['bank-balance'] });
      // Use replace so the edit page is removed from history — back button goes to detail, not edit
      router.replace(`/cattle/${id}`);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      setError(msg || 'Failed to update animal.');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!price || parseFloat(price) <= 0) { setError('Valid purchase price is required.'); return; }
    mutation.mutate();
  };

  if (isLoading) return (
    <Layout title="Edit Animal" showBack showViewToggle={false}>
      <div className="flex justify-center py-10"><LoadingSpinner size="lg" /></div>
    </Layout>
  );

  const existingImageUrl = proxiedBlobUrl(cattle?.image_url);
  const selected = ANIMAL_TYPES.find(a => a.value === animalType)!;

  return (
    <Layout title="Edit Animal" showBack showViewToggle={false}>
      <form onSubmit={handleSubmit} className="p-4 space-y-5">
        {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

        {cattle && (
          <div className="card-muted text-xs text-ink-muted">
            Originally added {formatDate(cattle.created_at)} by {cattle.recorded_by_name}
          </div>
        )}

        {/* ── Animal Type ──────────────────────────────────────── */}
        <div>
          <label className="label">Animal Type *</label>
          <div className="grid grid-cols-5 gap-2">
            {ANIMAL_TYPES.map(a => (
              <button
                key={a.value}
                type="button"
                onClick={() => setAnimalType(a.value)}
                className={`flex flex-col items-center gap-1 py-3 rounded-lg border-2 transition-all ${
                  animalType === a.value
                    ? `${a.color} border-2 shadow-sm scale-105`
                    : 'border-surface-border bg-surface-card text-ink-secondary hover:border-ink-muted'
                }`}
              >
                <span className="text-2xl">{a.emoji}</span>
                <span className="text-[10px] font-semibold tracking-wide uppercase">{a.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-secondary">
            Selected: <span className="font-semibold text-ink">{selected.emoji} {selected.label}</span>
          </p>
        </div>

        {/* ── Image ──────────────────────────────────────────── */}
        <div>
          <label className="label">Animal Photo</label>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} className="hidden" />
          {imagePreview ? (
            <div className="relative rounded-lg overflow-hidden border border-surface-border bg-surface-muted">
              <img src={imagePreview} alt="Preview" className="w-full object-contain" style={{ aspectRatio: '16/9' }} />
              <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                className="absolute top-2 right-2 bg-white/90 hover:bg-white text-ink rounded-full w-8 h-8 flex items-center justify-center shadow text-sm font-bold">✕</button>
            </div>
          ) : existingImageUrl ? (
            <div className="relative rounded-lg overflow-hidden border border-surface-border bg-surface-muted">
              <img src={existingImageUrl} alt="Current" className="w-full object-contain" style={{ aspectRatio: '16/9' }} />
              <button type="button" onClick={() => fileRef.current?.click()}
                className="absolute bottom-2 right-2 bg-white/90 hover:bg-white text-ink text-xs font-semibold px-3 py-1.5 rounded-full shadow">
                {compressing ? 'Compressing…' : 'Change Photo'}
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={compressing}
              className="w-full h-32 rounded-lg border-2 border-dashed border-surface-border bg-surface-muted hover:border-ink-muted hover:bg-surface-subtle transition-colors flex flex-col items-center justify-center gap-2 text-ink-muted">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
              </svg>
              <span className="text-sm font-medium">{compressing ? 'Compressing…' : 'Tap to upload photo'}</span>
              <span className="text-xs">Auto-compressed if over 5 MB</span>
            </button>
          )}
        </div>

        {/* ── Price ────────────────────────────────────────────── */}
        <div>
          <label className="label">Purchase Price (PKR) *</label>
          <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" className="input-field" inputMode="numeric" min="1" required />
        </div>

        {/* ── Date ─────────────────────────────────────────────── */}
        <div>
          <label className="label">Purchase Date *</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-field" required />
        </div>

        {/* ── Description ──────────────────────────────────────── */}
        <div>
          <label className="label">Description (optional)</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. 3 years old, healthy" className="input-field resize-none" rows={3} />
        </div>

        <button type="submit" className="btn-primary" disabled={mutation.isPending || compressing}>
          {mutation.isPending ? <LoadingSpinner size="sm" /> : 'Save Changes'}
        </button>
      </form>
    </Layout>
  );
}
