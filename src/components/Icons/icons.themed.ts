import { Icons } from "./icons";
import { withThemeVariant } from "../Icons/IconTheme";

export const ThemedIcons = {
  ...Icons,
  import: withThemeVariant(Icons.import),
};