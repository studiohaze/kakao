import type { GetServerSideProps } from 'next';
import { getLegacyDomainWarRedirect, withLocalePrefix } from '../../utils/domainWarRoutes';

export const getServerSideProps: GetServerSideProps = async ({ params, locale, defaultLocale }) => {
  const slug = params?.slug;
  const destination = getLegacyDomainWarRedirect(Array.isArray(slug) ? slug : undefined);

  if (!destination) {
    return { notFound: true };
  }

  return {
    redirect: {
      destination: withLocalePrefix(destination, locale, defaultLocale),
      permanent: true,
    },
  };
};

export default function LegacyDomainWarRedirect() {
  return null;
}
