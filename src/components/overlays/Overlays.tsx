import { useStore } from "../../state/store";
import ThemeMenu from "./ThemeMenu";
import AaPanel from "./AaPanel";
import CommandPalette from "./CommandPalette";
import AddSpaceModal from "./AddSpaceModal";
import AddFeedModal from "./AddFeedModal";
import SettingsPanel from "./SettingsPanel";

/*
 * Aktif overlay'i çizer (README §5.5-5.8). Kapatma/Esc mantığı her overlay'de + useKeyboard'da.
 */
export default function Overlays() {
  const overlay = useStore((s) => s.overlay);
  if (!overlay) return null;
  return (
    <>
      {overlay === "theme" && <ThemeMenu />}
      {overlay === "aa" && <AaPanel />}
      {overlay === "cmd" && <CommandPalette />}
      {overlay === "add" && <AddSpaceModal />}
      {overlay === "addfeed" && <AddFeedModal />}
      {overlay === "settings" && <SettingsPanel />}
    </>
  );
}
