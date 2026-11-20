'use client';

// global-error replaces the root layout when it errors, so globals.css is not
// loaded here — styles must be inline and self-contained.
export default function GlobalError({
  reset
}: {
  error?: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang='en'>
      <body
        style={{
          margin: 0,
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
          background: '#FAF8F5',
          color: '#14100C'
        }}
      >
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 600,
              letterSpacing: '-0.015em',
              marginBottom: '0.5rem'
            }}
          >
            Something went wrong
          </h1>
          <p style={{ color: '#5C5650', marginBottom: '1.25rem' }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '0.75rem',
              border: '1px solid #857D72',
              background: '#14100C',
              color: '#FFFFFF',
              minHeight: '44px',
              font: 'inherit',
              cursor: 'pointer'
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
