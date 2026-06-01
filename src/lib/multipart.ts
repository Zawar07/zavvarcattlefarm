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
      if (value instanceof File && value.size > 0) {
        const buffer = Buffer.from(await value.arrayBuffer());
        file = {
          buffer,
          originalname: value.name,
          mimetype: value.type,
        };
      } else if (typeof value === 'string') {
        fields[key] = value;
      }
    }
    return { fields, file };
  }

  return { fields: {} };
}
