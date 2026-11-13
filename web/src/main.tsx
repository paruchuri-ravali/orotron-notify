import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { MotionConfig } from "motion/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConfirmProvider } from "./components/ui";
import { ScopeProvider } from "./lib/scope";
import { ThemeProvider, useTheme } from "./lib/theme";
import { router } from "./router";
import "@fontsource-variable/inter";
import "./styles.css";

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: false } } });

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="bottom-right" richColors closeButton />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <ScopeProvider>
          <MotionConfig reducedMotion="user">
            <TooltipProvider delayDuration={200}>
              <ConfirmProvider>
                <RouterProvider router={router} />
              </ConfirmProvider>
            </TooltipProvider>
          </MotionConfig>
          <ThemedToaster />
        </ScopeProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
