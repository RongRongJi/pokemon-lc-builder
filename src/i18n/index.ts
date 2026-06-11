import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './en';
import zhCN from './zh-CN';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en,
      'zh-CN': zhCN
    },
    fallbackLng: 'zh-CN',
    supportedLngs: ['en', 'zh-CN'],
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'lc-builder-lang',
      caches: ['localStorage']
    }
  });

export default i18n;
