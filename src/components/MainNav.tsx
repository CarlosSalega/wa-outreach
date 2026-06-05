"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/contacts", label: "Contactos" },
  { href: "/templates", label: "Templates" },
  { href: "/campaigns", label: "Campaña" },
  { href: "/settings", label: "Config" },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {navLinks.map((link) => {
        const isActive =
          pathname === link.href ||
          (link.href !== "/" && pathname.startsWith(link.href));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "px-3 py-1 text-sm text-center rounded-md transition-colors",
              isActive
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:text-primary hover:bg-primary/10",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
