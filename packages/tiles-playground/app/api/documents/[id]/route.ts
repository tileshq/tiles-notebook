import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

// GET /api/documents/[id]
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { rows } = await sql`
      SELECT * FROM documents 
      WHERE id = ${params.id}
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Error fetching document:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}

// PUT /api/documents/[id]
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { content } = body;

    // Ensure content is a string if it's an object
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);

    const { rows } = await sql`
      UPDATE documents 
      SET content = ${contentStr}::jsonb, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${params.id}
      RETURNING *
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Error updating document:', error);
    return NextResponse.json(
      { error: 'Failed to update document' },
      { status: 500 }
    );
  }
} 