import Head from 'next/head'
import GameFrame from '../components/GameFrame'
import Image from 'next/image'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import type { GetStaticProps, InferGetStaticPropsType } from 'next'
import { useRouter } from 'next/router';
import { DOMAIN_WAR_GAME_ID, getArcadeGamePath } from '../utils/domainWarRoutes';

type Props = {
  // Add custom props here
}

export const getStaticProps: GetStaticProps<Props> = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? 'ko', ['common'])),
  },
})

/**
 * Renders the home page of the application.
 * It displays a welcome message and a button to start playing the game.
 */
export default function Home(_props: InferGetStaticPropsType<typeof getStaticProps>) {
  const { t } = useTranslation('common')
  const router = useRouter();

  const handlePlayButtonClick = () => {
    const targetPath = getArcadeGamePath(DOMAIN_WAR_GAME_ID);
    router.push(targetPath, undefined, { locale: router.locale });
  };

  return (
    <>
      <Head>
        <title>{t('pageTitle')}</title>
        <meta name="description" content={t('pageDescription')} />
      </Head>
      <GameFrame title={t('pageTitle')}>
        {/* 로고 애니메이션 */}
        <div className="flex justify-center mb-6">
          <Image
            src="/logo.png"
            alt={t('logoAltText')}
            width={128}
            height={128}
            className="pop-in"
          />
        </div>

        {/* 소개 텍스트 애니메이션 */}
        <div className="text-base text-left leading-relaxed whitespace-pre-line mb-6 slide-up">
          {t('welcomeMessage')}
        </div>

        <div className="flex flex-col space-y-3">
          <button
            onClick={handlePlayButtonClick}
            className="px-6 py-2 bg-black text-white rounded-md text-center hover:bg-gray-800 transition"
          >
            {t('playDomainWarsButton')}
          </button>
        </div>
      </GameFrame>
    </>
  )
}
