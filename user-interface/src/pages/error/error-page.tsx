import { useRouteError } from 'react-router-dom';

export default function ErrorPage() {
  const error = useRouteError();
  console.error(error);

  return (
    <div id="error-page" style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>Oops!</h1>
      <p>Sorry, an unexpected error has occurred.</p>
      <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#fdd', color: '#900', borderRadius: '8px' }}>
        <p>
          <i>{(error as any)?.statusText || (error as any)?.message}</i>
        </p>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>{(error as any)?.stack}</pre>
      </div>
    </div>
  );
}
