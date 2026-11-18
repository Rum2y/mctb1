import './globals.css';

export const metadata = {
  title: 'Missed Call Text-Back',
  description: 'Automatically text back callers you missed.',
};

export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
