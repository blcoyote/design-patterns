import { lazy, Suspense, useEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { ArchitectureIndexPage } from "@/components/pages/ArchitectureIndexPage";
import { ArchitecturePage } from "@/components/pages/ArchitecturePage";
import { ComparisonIndexPage } from "@/components/pages/ComparisonIndexPage";
import { ComparisonPage } from "@/components/pages/ComparisonPage";
import { HomePage } from "@/components/pages/HomePage";
import { NotFound } from "@/components/pages/NotFound";
import { PatternPage } from "@/components/pages/PatternPage";

// The layout editor is a dev-only tool: behind import.meta.env.DEV the bundler drops the dynamic imports, so production builds contain no editor chunk.
const LayoutEditorIndexPage = import.meta.env.DEV
  ? lazy(() =>
      import("@/components/pages/dev/LayoutEditorIndexPage").then((m) => ({
        default: m.LayoutEditorIndexPage,
      })),
    )
  : null;
const LayoutEditorPage = import.meta.env.DEV
  ? lazy(() =>
      import("@/components/pages/dev/LayoutEditorPage").then((m) => ({
        default: m.LayoutEditorPage,
      })),
    )
  : null;

export function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="min-h-screen">
      <Header onMenu={() => setMenuOpen((o) => !o)} menuOpen={menuOpen} />
      <div className="mx-auto flex max-w-384">
        <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        <main className="min-w-0 flex-1 px-4 pt-6 pb-24 sm:px-8">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/patterns/:slug" element={<PatternPage />} />
            <Route path="/architecture" element={<ArchitectureIndexPage />} />
            <Route path="/architecture/:slug" element={<ArchitecturePage />} />
            <Route path="/compare" element={<ComparisonIndexPage />} />
            <Route path="/compare/:slug" element={<ComparisonPage />} />
            {LayoutEditorIndexPage && LayoutEditorPage && (
              <>
                <Route
                  path="/dev/layout"
                  element={
                    <Suspense fallback={null}>
                      <LayoutEditorIndexPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/dev/layout/:area/:slug"
                  element={
                    <Suspense fallback={null}>
                      <LayoutEditorPage />
                    </Suspense>
                  }
                />
              </>
            )}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
