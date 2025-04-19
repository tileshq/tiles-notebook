import { sql } from '@vercel/postgres';
import { notFound } from 'next/navigation';
import Editor from '@/components/Editor';

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
        <h1 className="text-2xl font-bold mb-4">{document.title}</h1>
        {document.description && (
          <p className="text-gray-600 mb-8">{document.description}</p>
        )}
        <Editor
          documentId={document.id}
          initialContent={JSON.parse(document.content)}
          readOnly
        />
      </div>
    </main>
  );
} 