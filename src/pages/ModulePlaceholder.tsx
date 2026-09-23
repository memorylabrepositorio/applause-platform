import { Link } from "react-router-dom";

/**
 * Placeholder de um módulo ainda não portado. Cada caixa do "lego" vira uma
 * página de verdade quando for a vez dela — por ora, isso deixa a navegação
 * e a autenticação já funcionando fim a fim, sem fingir que o módulo existe.
 */
export default function ModulePlaceholder({ title }: { title: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink-900 text-ink-50">
      <p className="text-lg font-medium">{title}</p>
      <p className="max-w-md text-center text-sm text-ink-400">
        Este módulo ainda não foi portado para o sistema novo. Os dados
        continuam no sistema-applause atual até este bloco ser montado aqui.
      </p>
      <Link to="/" className="text-sm text-brand-400 hover:text-brand-300">
        ← Voltar
      </Link>
    </div>
  );
}
