import Link from 'next/link';

export default function Banner() {
  return (
    <div className="bg-yellow-100 border-b border-yellow-200 px-4 py-3">
      <div className="flex items-center justify-center text-sm">
        <span className="text-yellow-800">
          Update: The work on the project has been paused.{' '}
          <Link 
            href="https://ankeshbharti.com/stories/announcing-tiles-notebook-alpha"
            className="text-yellow-900 underline hover:text-yellow-700 font-medium"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn more
          </Link>
        </span>
      </div>
    </div>
  );
} 