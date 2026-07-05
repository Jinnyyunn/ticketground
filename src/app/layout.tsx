import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const themeBootstrapScript = `
(function () {
  var root = document.documentElement;
  var storageKey = "ticketground:theme";
  var theme = "system";

  try {
    var storedTheme = window.localStorage.getItem(storageKey);
    if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") {
      theme = storedTheme;
    }
  } catch (_) {}

  var systemPrefersDark = false;
  try {
    systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch (_) {}

  var resolvedTheme = theme === "system" ? (systemPrefersDark ? "dark" : "light") : theme;
  function syncThemeControls() {
    var isDark = root.classList.contains("dark");
    var label = isDark ? "라이트 모드 켜기" : "다크 모드 켜기";
    document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
      button.setAttribute("aria-checked", isDark ? "true" : "false");
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
      var spans = button.querySelectorAll("span");
      if (spans[0]) spans[0].classList.toggle("translate-x-7", isDark);
      if (spans[1]) spans[1].classList.toggle("text-ticketground", !isDark);
      if (spans[2]) spans[2].classList.toggle("text-ticketground", isDark);
    });
  }

  function applyResolvedTheme(nextTheme) {
    root.classList.toggle("dark", nextTheme === "dark");
    root.dataset.theme = nextTheme;
    syncThemeControls();
  }

  root.classList.toggle("dark", resolvedTheme === "dark");
  root.dataset.theme = resolvedTheme;
  syncThemeControls();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncThemeControls, { once: true });
  } else {
    syncThemeControls();
  }
  new MutationObserver(syncThemeControls).observe(root, { attributes: true, attributeFilter: ["class", "data-theme"] });
  new MutationObserver(syncThemeControls).observe(document.body, { childList: true, subtree: true });
})();
`;

// TODO(font): enable next/font/local here after adding src/app/fonts/PretendardVariable.woff2.
const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ticketground",
  description: "공연, 콘서트, 뮤지컬, 스포츠 티켓 예매는 Ticketground",
  icons: {
    icon: [
      { url: "/seo/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/seo/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/seo/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" data-scroll-behavior="smooth" className={`${notoSansKr.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background">
        <script id="ticketground-theme-bootstrap" dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        {children}
      </body>
    </html>
  );
}
