import { put } from '@vercel/blob';

export async function uploadReceipt(
  buffer: Buffer,
  originalname: string,
): Promise<string> {
  const ext = originalname.split('.').pop()?.toLowerCase() || 'jpg';
  const filename = `receipts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { url } = await put(filename, buffer, {
    access: 'public',
    contentType: getMimeType(ext),
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  return url;
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    pdf: 'application/pdf',
  };
  return map[ext] || 'application/octet-stream';
}
