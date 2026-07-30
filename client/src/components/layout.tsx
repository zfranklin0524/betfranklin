import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Sun, Moon, Shield, ChevronDown, Flag, Star, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { TeamDot, TeamBadge } from "@/components/team-badge";
import { useApp } from "@/lib/app-context";
import { useTheme } from "@/lib/theme";
import { usePlayers } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const navItems = [
  { path: "/", label: "Lobby" },
  { path: "/30w-pool", label: "30W Pool" },
  { path: "/markets", label: "Markets" },
  { path: "/my-bets", label: "My Bets" },
  { path: "/ledger", label: "Ledger" },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { theme, toggle } = useTheme();
  const { player, setPlayerId, isAdmin } = useApp();
  const { data: players } = usePlayers();

  return (
    <div className="min-h-dvh flex flex-col overflow-x-hidden">
      <header className="sticky top-0 z-40 bg-app-header text-app-header-fg border-b-2 border-accent/30 backdrop-blur">
        {/* Masthead row */}
        <div className="mx-auto max-w-5xl px-3 sm:px-4 h-14 flex items-center gap-2 sm:gap-3">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Logo className="w-7 h-7 text-app-header-fg" />
            <span className="font-display text-base sm:text-lg leading-none text-app-header-fg">
              <span className="text-team-goon">bet</span>Franklin
            </span>
          </Link>

          <div className="flex items-center gap-1.5 ml-1 text-accent hidden sm:flex">
            <Star className="w-3 h-3 fill-current" />
            <Star className="w-3 h-3 fill-current" />
            <Star className="w-3 h-3 fill-current" />
          </div>

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label="Toggle theme"
            data-testid="button-theme"
            className="text-app-header-fg hover:bg-app-header-fg/10"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

          <PlayerPicker />
        </div>

        {/* Pinstripe rule */}
        <div className="h-[3px] pinstripes opacity-70" />

        {/* Desktop program tabs */}
        <div className="bg-app-nav text-app-nav-fg">
        <nav className="hidden sm:flex items-end gap-0 mx-auto max-w-5xl px-4">
          {navItems.map((item) => {
            const active =
              item.path === "/"
                ? location === "/"
                : location.startsWith(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`font-label text-sm px-4 py-2 border-b-[3px] -mb-[2px] transition-colors ${
                  active
                    ? "border-accent text-app-nav-fg"
                    : "border-transparent text-app-nav-fg/70 hover:text-app-nav-fg"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              href="/admin"
              className={`font-label text-sm px-4 py-2 border-b-[3px] -mb-[2px] transition-colors ${
                location.startsWith("/admin")
                  ? "border-accent text-app-nav-fg"
                  : "border-transparent text-app-nav-fg/70 hover:text-app-nav-fg"
              }`}
            >
              Admin
            </Link>
          )}
        </nav>

        {/* mobile nav */}
        <nav className="sm:hidden flex items-stretch gap-1 px-2 pb-2">
          {navItems.map((item) => {
            const active =
              item.path === "/" ? location === "/" : location.startsWith(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`font-label text-sm px-1 py-1.5 flex-1 text-center ${
                  active
                    ? "text-app-nav-fg border-b-2 border-accent"
                    : "text-app-nav-fg/70 border-b-2 border-transparent"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              href="/admin"
              className={`font-label text-sm px-1 py-1.5 flex-1 text-center ${
                location.startsWith("/admin") ? "text-app-nav-fg border-b-2 border-accent" : "text-app-nav-fg/70 border-b-2 border-transparent"
              }`}
            >
              Admin
            </Link>
          )}
        </nav>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6">{children}</main>

      <footer className="border-t-2 border-primary/20 mt-4">
        <div className="h-[3px] pinstripes opacity-50" />
        <div className="py-4 px-4 text-center">
          <div className="mx-auto max-w-5xl flex items-center justify-center gap-2 text-xs text-muted-foreground font-label">
            <Flag className="w-3 h-3" />
            <span>Private group ledger — betFranklin. No payments processed. Settle in person.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PlayerPicker() {
  const { player, setPlayerId, isAdmin } = useApp();
  const { data: players, isLoading, isError, refetch } = usePlayers();
  const [adminOpen, setAdminOpen] = useState(false);

  const hasPlayers = (players ?? []).length > 0;

  const triggerLabel =
    player
      ? undefined
      : isLoading
        ? "Loading names…"
        : isError
          ? "Tap to retry"
          : "Pick name";

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {isError && !hasPlayers ? (
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-[140px] sm:w-[180px] gap-1.5 font-label"
          onClick={() => refetch()}
          data-testid="button-retry-names"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry names
        </Button>
      ) : (
        <Select
        value={player ? String(player.id) : ""}
        onValueChange={(v) => setPlayerId(Number(v))}
      >
        <SelectTrigger className="w-[140px] sm:w-[180px] h-9 bg-card text-foreground border-border/60" data-testid="select-player">
          <SelectValue placeholder={triggerLabel} />
        </SelectTrigger>
        <SelectContent>
          {(players ?? [])
            .filter((p) => p.active)
            .map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                <span className="flex items-center gap-2">
                  <TeamDot team={p.team} />
                  <span className="truncate">{p.name}</span>
                </span>
              </SelectItem>
            ))}
        </SelectContent>
        </Select>
      )}

      {isAdmin ? (
        <Link href="/admin">
          <Button variant="outline" size="sm" className="h-9 gap-1.5">
            <Shield className="w-4 h-4 text-accent" />
            <span className="hidden sm:inline">Admin</span>
          </Button>
        </Link>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setAdminOpen(true)}
          aria-label="Admin"
          data-testid="button-admin"
        >
          <Shield className="w-4 h-4 text-app-header-fg/70" />
        </Button>
      )}

      <AdminGate open={adminOpen} onOpenChange={setAdminOpen} />
    </div>
  );
}

function AdminGate({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { enterAdmin } = useApp();
  const { toast } = useToast();
  const [pin, setPin] = useState("");

  const submit = () => {
    if (enterAdmin(pin)) {
      toast({ title: "Admin mode on" });
      setPin("");
      onOpenChange(false);
    } else {
      toast({ title: "Wrong PIN", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="font-display">Commissioner access</DialogTitle>
          <DialogDescription>
            Enter the PIN to manage markets, settle bets, and edit the roster.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="pin">PIN</Label>
          <Input
            id="pin"
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            data-testid="input-pin"
          />
        </div>
        <DialogFooter>
          <Button onClick={submit} data-testid="button-enter-pin">
            Enter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
