import logoUrl from "@/assets/logo.png";

export default function Logo({ className = "h-8" }: { className?: string }) {
  return <img src={logoUrl} alt="MemoryLab" className={`${className} w-auto`} />;
}
