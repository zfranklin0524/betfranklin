import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePlayers } from "./api";
import { playerStorage } from "./player-store";
import { ADMIN_PIN } from "@shared/schema";

export { ADMIN_PIN };

type AppCtx = {
  playerId: number | null;
  player: { id: number; name: string } | null;
  setPlayerId: (id: number | null) => void;
  isAdmin: boolean;
  enterAdmin: (pin: string) => boolean;
  exitAdmin: () => void;
};

const Ctx = createContext<AppCtx>(null as unknown as AppCtx);

export function AppProvider({ children }: { children: ReactNode }) {
  const { data: players } = usePlayers();
  const [playerId, setPlayerIdState] = useState<number | null>(() =>
    playerStorage.read()
  );
  const [isAdmin, setIsAdmin] = useState(false);

  // keep stored selection valid if roster changes
  useEffect(() => {
    if (players && playerId != null && !players.some((p) => p.id === playerId)) {
      setPlayerIdState(null);
      playerStorage.write(null);
    }
  }, [players, playerId]);

  const setPlayerId = (id: number | null) => {
    setPlayerIdState(id);
    playerStorage.write(id);
  };

  const player = useMemo(() => {
    if (!players || playerId == null) return null;
    const p = players.find((x) => x.id === playerId);
    return p ? { id: p.id, name: p.name } : null;
  }, [players, playerId]);

  const value: AppCtx = {
    playerId,
    player,
    setPlayerId,
    isAdmin,
    enterAdmin: (pin: string) => {
      if (pin === ADMIN_PIN) {
        setIsAdmin(true);
        return true;
      }
      return false;
    },
    exitAdmin: () => setIsAdmin(false),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  return useContext(Ctx);
}
