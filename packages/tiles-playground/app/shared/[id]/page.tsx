import { sql } from '@vercel/postgres';
import { notFound } from 'next/navigation';
import SharedEditor from '@/components/SharedEditor';

export const revalidate = 0; // Disable caching for this page

async function getSharedDocument(shareId: string) {
  const { rows } = await sql`
    SELECT d.* 
    FROM documents d
    JOIN document_shares s ON s.document_id = d.id
    WHERE s.id = ${shareId}
  `;

  if (rows.length === 0) {
    return null;
  }

  return rows[0];
}

export default async function SharedDocumentPage({
  params,
}: {
  params: { id: string };
}) {
  const document = await getSharedDocument(params.id);

  if (!document) {
    notFound();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="w-full max-w-5xl">
        <SharedEditor
          documentId={document.id}
          initialContent={document.content}
        />
      </div>
    </main>
  );
} 