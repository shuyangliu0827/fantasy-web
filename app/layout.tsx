import type { Metadata } from "next";
import { LangProvider } from "@/lib/lang";
import "./globals.css";

export const metadata: Metadata = {
  title: "蓝本 - Fantasy 篮球决策平台",
  description: "最专业的中文 Fantasy 篮球平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh">
      <body>
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
