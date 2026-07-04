import '../styles/globals.css';
import { appWithTranslation } from 'next-i18next';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import Head from 'next/head'; // ✨ next/head에서 Head 컴포넌트 import

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    const handleStart = () => {
      document.body.classList.add('page-transition-active');
    };
    const handleComplete = () => {
      document.body.classList.remove('page-transition-active');
    };

    router.events.on('routeChangeStart', handleStart);
    router.events.on('routeChangeComplete', handleComplete);
    router.events.on('routeChangeError', handleComplete);

    return () => {
      router.events.off('routeChangeStart', handleStart);
      router.events.off('routeChangeComplete', handleComplete);
      router.events.off('routeChangeError', handleComplete);
    };
  }, [router]);

  return (
    // ✨ React Fragment(<>)로 감싸고 Head 컴포넌트 추가
    <>
      <Head>
        <title>kakao.games - Domain War</title>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#fee500" />
        {/* Open Graph / Social Media Meta Tags for kakao.games */}
        <meta property="og:title" content="당신의 도메인이 곧 무기가 되는 곳, kakao.games" />
        <meta property="og:description" content="거대 IT 기업에 맞서 전설의 도메인을 지켜내라! 당신만의 전략으로 새로운 신화를 쓰는 '도메인 전쟁'에 참여해보세요." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://kakao.games" />
        <meta property="og:image" content="https://kakao.games/kakao-og-image.png" />
        <meta property="og:image:width" content="1030" />
        <meta property="og:image:height" content="579" />
        <meta property="og:site_name" content="kakao.games" />

        {/* Twitter Card Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="당신의 도메인이 곧 무기가 되는 곳, kakao.games" />
        <meta name="twitter:description" content="거대 IT 기업에 맞서 전설의 도메인을 지켜내라! 당신만의 전략으로 새로운 신화를 쓰는 '도메인 전쟁'에 참여해보세요." />
        <meta name="twitter:image" content="https://kakao.games/kakao-og-image.png" />
      </Head>

      <div className="page-container">
        <div className="page-content-transition">
          <Component {...pageProps} />
        </div>
      </div>
    </>
  );
}

export default appWithTranslation(MyApp);