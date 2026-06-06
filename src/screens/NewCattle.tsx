'use client';

import { useState, FormEvent, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBanner from '../components/ErrorBanner';
import api from '../api/axios';
import { todayISO } from '../utils/format';

// ── Image compression ──────────────────────────────────────────────────────
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
      canvas.width = width;
      canvas.height = height;
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

// ── Animal type config ─────────────────────────────────────────────────────
const ANIMAL_TYPES = [
  { value: 'bull',    label: 'Bull',    emoji: '🐂', color: 'bg-amber-50  border-amber-300  text-amber-900'  },
  { value: 'cow',     label: 'Cow',     emoji: '🐄', color: 'bg-green-50  border-green-300  text-green-900'  },
  { value: 'goat',    label: 'Goat',    emoji: '🐐', color: 'bg-orange-50 border-orange-300 text-orange-900' },
  { value: 'sheep',   label: 'Sheep',   emoji: '🐑', color: 'bg-sky-50    border-sky-300    text-sky-900'    },
  { value: 'chicken', label: 'Chicken', emoji: '🐓', color: 'bg-yellow-50 border-yellow-300 text-yellow-900' },
] as const;

type AnimalType = typeof ANIMAL_TYPES[number]['value'];

export default function NewCattle() {
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
  const [warning, setWarning] = useState('');

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
    mutationFn: () => {
      const form = new FormData();
      form.append('animal_type', animalType);
      form.append('purchase_price', price);
      form.append('purchase_date', date);
      if (description) form.append('description', description);
      if (imageFile) form.append('receipt', imageFile);   // field name 'receipt' matches parseForm
      return api.post('/cattle', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['cattle'] });
      queryClient.invalidateQueries({ queryKey: ['cattle-summary'] });
      queryClient.invalidateQueries({ queryKey: ['bank-balance'] });
      if (res.data.warning === 'LOW_BALANCE') {
        setWarning('⚠️ Bank balance is now negative. Please update the balance.');
        return;
      }
      router.push('/cattle');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg || 'Failed to record purchase.');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setWarning('');
    if (!price || parseFloat(price) <= 0) { setError('Valid purchase price is required.'); return; }
    mutation.mutate();
  };

  const selected = ANIMAL_TYPES.find(a => a.value === animalType)!;

  return (
    <Layout title="Register Purchase" showBack showViewToggle={false}>
      <form onSubmit={handleSubmit} className="p-4 space-y-5">
        {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
        {warning && <ErrorBanner message={warning} onDismiss={() => setWarning('')} />}
        {/* ── Animal Type Grid ─────────────────────────────────────────── */}
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
          {/* Selected indicator */}
          <p className="mt-2 text-xs text-ink-secondary">
            Selected: <span className="font-semibold text-ink">{selected.emoji} {selected.label}</span>
          </p>
        </div>

        {/* ── Image Upload ─────────────────────────────────────────────── */}
        <div>
          <label className="label">Animal Photo (optional)</label>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageChange}
            className="hidden"
          />

          {imagePreview ? (
            <div className="relative rounded-lg overflow-hidden border border-surface-border">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full h-48 object-cover"
              />
              <button
                type="button"
                onClick={() => { setImageFile(null); setImagePreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                className="absolute top-2 right-2 bg-white/90 hover:bg-white text-ink rounded-full w-8 h-8 flex items-center justify-center shadow text-sm font-bold"
                aria-label="Remove image"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full h-32 rounded-lg border-2 border-dashed border-surface-border bg-surface-muted hover:border-ink-muted hover:bg-surface-subtle transition-colors flex flex-col items-center justify-center gap-2 text-ink-muted"
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span className="text-sm font-medium">Tap to upload photo</span>
              <span className="text-xs">JPEG, PNG, WebP · max 10 MB</span>
            </button>
          )}
        </div>

        {/* ── Price ────────────────────────────────────────────────────── */}
        <div>
          <label className="label">Purchase Price (PKR) *</label>
          <input
            type="number"
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="0"
            className="input-field"
            inputMode="numeric"
            min="1"
            required
          />
        </div>

        {/* ── Date ─────────────────────────────────────────────────────── */}
        <div>
          <label className="label">Purchase Date *</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="input-field"
            required
          />
        </div>

        {/* ── Description ──────────────────────────────────────────────── */}
        <div>
          <label className="label">Description (optional)</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={`e.g. ${selected.emoji} ${selected.label}, 3 years old, healthy`}
            className="input-field resize-none"
            rows={3}
          />
        </div>

        <button type="submit" className="btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? <LoadingSpinner size="sm" /> : `Record ${selected.emoji} ${selected.label} Purchase`}
        </button>
      </form>
    </Layout>
  );
}
