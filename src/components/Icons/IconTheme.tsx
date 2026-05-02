import { useTheme } from "../../state/ThemeContext";
import type { IconComponent } from "./icons.types";

export const withThemeVariant = (IconComponent: IconComponent) => {
  return function ThemedIcon(props: any) {
    const { themes, activeThemeName } = useTheme();

    const activeTheme = themes.find(t => t.name === activeThemeName);
    const isLightMode = activeTheme?.tokens["--theme-mode"] === "light";

    return <IconComponent filled={isLightMode} {...props} />;
  };
};