import { Link, useRouterState } from "@tanstack/react-router";
import { Home, History, User, Ruler } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Analyze", icon: Home },
  { to: "/profiles", label: "Profiles", icon: User },
  { to: "/history", label: "History", icon: History },
  { to: "/sizes", label: "Sizes", icon: Ruler },
] as const;

export function MobileNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {items.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? path === "/" : path.startsWith(to);
          return (
            <li key={to}>
              <Link
                to={to}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "scale-110")} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
