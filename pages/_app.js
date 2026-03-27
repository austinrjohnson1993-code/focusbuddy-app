import '../styles/globals.css'
import Head from 'next/head'
import { useEffect } from 'react'

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }
  }, []);

  // Force SW update check on every page load to prevent stale assets
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(reg => reg.update());
      });
    }
  }, []);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ff4d1c" />
        <link rel="icon" type="image/png" href="/icons/icon-192x192.png" />
        <link rel="shortcut icon" type="image/png" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta property="og:title" content="Cinis — Where start meets finished." />
        <meta property="og:description" content="The productivity coach that shows up before you think to ask. AI check-ins, voice capture, focus sessions, and everything in one place." />
        <meta property="og:image" content="https://www.getcinis.app/og-image.png" />
        <meta property="og:url" content="https://www.getcinis.app" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Cinis — Where start meets finished." />
        <meta name="twitter:description" content="The productivity coach that shows up before you think to ask. AI check-ins, voice capture, focus sessions, and everything in one place." />
        <meta name="twitter:image" content="https://www.getcinis.app/og-image.png" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}
