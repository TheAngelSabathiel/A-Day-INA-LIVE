import '@fontsource/anton/latin-400.css';
import '@fontsource-variable/instrument-sans/wght.css';
import '@fontsource-variable/instrument-sans/wght-italic.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import './globals.css';

export const metadata = {
  title: 'A Day INA: LIVE',
  description: 'Sumali sa LIVE. Program, botohan, at higit pa.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#6E1423',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fil">
      <body>{children}</body>
    </html>
  );
}
