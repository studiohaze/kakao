import { ReactNode } from 'react';
import LanguageSwitcher from './LanguageSwitcher'; // Import the component

type Props = {
  title: string;
  children: ReactNode;
};

export default function GameFrame({ title, children }: Props) {
  return (
    <div className="w-full max-w-md mx-auto min-h-screen bg-white p-6 text-center shadow-lg">
      <h1 className="text-xl font-bold mb-4">{title}</h1>
      <LanguageSwitcher /> {/* Add the language switcher here */}
      {children}
    </div>
  );
}
