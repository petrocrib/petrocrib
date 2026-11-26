import "./globals.css";

export const metadata = {
  title: "PETROCRIB Admin",
  icons: { icon: "https://www.petrocrib.in/assets/img/favicon.png", apple: "https://www.petrocrib.in/assets/img/favicon.png" },
  description: "Operations, sales and analytics dashboard for PETROCRIB"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
