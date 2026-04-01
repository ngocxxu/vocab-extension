import { useTheme } from "next-themes";
import * as React from "react";

type LogoProps = {
  alt?: string;
  className?: string;
};

export function Logo({ alt = "Vocab", className }: Readonly<LogoProps>) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const src = isDark
    ? "/assets/logo/logo-dark-mode.png"
    : "/assets/logo/logo-light-mode.png";

  return <img src={src} alt={alt} className={className} />;
}

