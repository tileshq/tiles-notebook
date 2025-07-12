import Link from 'next/link';

export default function Banner() {
  return (
    <div
      style={{
        background: '#EEE',
        borderBottom: '1px solid #027BFF',
        padding: '8px 16px',
        textAlign: 'center',
        color: '#027BFF',
        fontSize: '14px',
      }}
    >
      Work on the project has been paused.{" "}
      <Link
        href="https://ankeshbharti.com/stories/announcing-tiles-notebook-alpha"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#F00', textDecoration: 'underline', fontWeight: 500 }}
      >
        Learn more
      </Link>
    </div>
  );
}