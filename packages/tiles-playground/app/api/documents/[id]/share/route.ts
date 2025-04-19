import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

// POST /api/documents/[id]/share
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // First verify document exists
    const { rows: docRows } = await sql`
      SELECT id FROM documents 
      WHERE id = ${params.id}
    `;

    if (docRows.length === 0) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    const shareId = nanoid();
    
    const { rows } = await sql`
      INSERT INTO document_shares (id, document_id)
      VALUES (${shareId}, ${params.id})
      RETURNING *
    `;

    // Return the share URL
    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/shared/${shareId}`;
    return NextResponse.json({ shareUrl });
  } catch (error) {
    console.error('Error creating share:', error);
    return NextResponse.json(
      { error: 'Failed to create share' },
      { status: 500 }
    );
  }
} 