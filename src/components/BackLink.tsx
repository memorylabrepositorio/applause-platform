import { Link } from "react-router-dom";
import Logo from "@/components/Logo";

export default function BackLink() {
  return (
    <Link to="/" className="flex items-center gap-2 text-sm text-ink-300 hover:text-ink-50">
      <Logo className="h-5 opacity-80" />
      <span>← Painel principal</span>
    </Link>
  );
}
