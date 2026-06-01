import { NextRequest, NextResponse } from 'next/server';
import { head } from '@vercel/blob';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Proxy for private Vercel Blob files.
 * Usage: GET /api/blob-proxy?url=<encoded-blob-url>
 * Returns the file content with the correct content-type.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);

    const blobUrl = req.nextUrl.searchParams.get('url');
    if (!blobUrl) {
      return NextResponse.json({ error: 'url param required' }, { status: 400 });
    }

    // Fetch the blob metadata to get content-type
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const meta = await head(blobUrl, { token }).catch(() => null);
    const contentType = meta?.contentType || 'application/octet-stream';

    // Stream the blob content through this route
    const response = await fetch(blobUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch blob' }, { status: response.status });
    }

    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    console.error('Blob proxy error:', err);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
