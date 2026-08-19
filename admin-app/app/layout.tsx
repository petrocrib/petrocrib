import "./globals.css";

export const metadata = {
  title: "PETROCRIB Admin",
  description: "Operations, sales and analytics dashboard for PETROCRIB"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
