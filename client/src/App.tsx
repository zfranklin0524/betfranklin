import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { AppProvider } from "@/lib/app-context";
import { BetSlipProvider } from "@/lib/bet-slip";
import { Layout } from "@/components/layout";
import Lobby from "@/pages/lobby";
import Markets from "@/pages/markets";
import MyBets from "@/pages/my-bets";
import Ledger from "@/pages/ledger";
import ThirtyWestPool from "@/pages/thirty-west-pool";
import ScoreEntryPage from "@/pages/score-entry";
import Admin from "@/pages/admin";
import NotFound from "@/pages/not-found";

function AppRouter() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Lobby} />
        <Route path="/markets" component={Markets} />
        <Route path="/my-bets" component={MyBets} />
        <Route path="/ledger" component={Ledger} />
        <Route path="/30w-pool" component={ThirtyWestPool} />
        <Route path="/score/:token" component={ScoreEntryPage} />
        <Route path="/pots" component={ThirtyWestPool} />
        <Route path="/side-bets" component={ThirtyWestPool} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AppProvider>
            <BetSlipProvider>
              <Toaster />
              <Router hook={useHashLocation}>
                <AppRouter />
              </Router>
            </BetSlipProvider>
          </AppProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
