import { NextRequest } from 'next/server';

export interface ParsedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

export interface ParsedForm {
  fields: Record<string, string>;
  file?: ParsedFile;
}

export async function parseForm(req: NextRequest): Promise<ParsedForm> {
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      if (value !== undefined && value !== null) fields[key] = String(value);
    }
    return { fields };
  }

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    const fields: Record<string, string> = {};
    let file: ParsedFile | undefined;

    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        // Only capture non-empty files; skip empty file inputs
        if (value.size > 0) {
          const buffer = Buffer.from(await value.arrayBuffer());
          file = {
            buffer,
            originalname: value.name || 'upload',
            mimetype: value.type || 'application/octet-stream',
          };
        }
        // Don't add File entries to fields — they're not string values
      } else {
        fields[key] = value;
      }
    }
    return { fields, file };
  }

  // Fallback: try to parse as URL-encoded form
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await req.text().catch(() => '');
    const fields: Record<string, string> = {};
    for (const [key, value] of new URLSearchParams(text)) {
      fields[key] = value;
    }
    return { fields };
  }

  return { fields: {} };
}
