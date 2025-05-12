// app/api/og/route.tsx
import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';

export async function GET() {
  // Fetch your static image
  const imageData = await fetch(new URL('../../../public/og-image.png', import.meta.url)).then(
    (res) => res.arrayBuffer(),
  );
  
  // Convert to base64
  const base64Image = Buffer.from(imageData).toString('base64');
  
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
        }}
      >
        <img
          src={`data:image/jpeg;base64,${base64Image}`}
          alt="Tiles OpenGraph Image"
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}