import { Geist, Geist_Mono } from "next/font/google";
import "./styles/globals.css";
import { AccidentProvider } from "@/context/accidentContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Don't Drive Here",
  description: "Drive Safe, Drive Smart",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AccidentProvider>
          {children}
        </AccidentProvider>
      </body>
    </html>
  );
}