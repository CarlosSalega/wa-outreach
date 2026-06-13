"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, MessageSquare, Megaphone, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/contacts", label: "Contactos", icon: Users },
  { href: "/templates", label: "Templates", icon: MessageSquare },
  { href: "/campaigns", label: "Campaña", icon: Megaphone },
  { href: "/settings", label: "Config", icon: Settings },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {navLinks.map((link) => {
        const isActive =
          pathname === link.href ||
          (link.href !== "/" && pathname.startsWith(link.href));
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1 text-sm text-center rounded-md transition-colors",
              isActive
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:text-primary hover:bg-primary/10",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
