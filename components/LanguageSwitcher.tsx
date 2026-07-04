import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const router = useRouter();

  const changeLanguage = (locale: string) => {
    i18n.changeLanguage(locale);
    router.push({ pathname: router.pathname, query: router.query }, router.asPath, { locale });
  };

  return (
    <div className="flex space-x-2 my-4 justify-center">
      <button
        onClick={() => changeLanguage('ko')}
        className={`px-3 py-1 rounded-md ${
          i18n.language === 'ko' ? 'bg-black text-white' : 'bg-gray-200 text-gray-700'
        } hover:bg-gray-800 hover:text-white transition-colors`}
      >
        한국어
      </button>
      <button
        onClick={() => changeLanguage('en')}
        className={`px-3 py-1 rounded-md ${
          i18n.language === 'en' ? 'bg-black text-white' : 'bg-gray-200 text-gray-700'
        } hover:bg-gray-800 hover:text-white transition-colors`}
      >
        English
      </button>
    </div>
  );
};

export default LanguageSwitcher;
