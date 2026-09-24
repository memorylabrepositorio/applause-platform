import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen text-ink-50 lg:flex">
      <Sidebar />
      <main className="min-w-0 flex-1 p-3 sm:p-6">{children}</main>
    </div>
  );
}
