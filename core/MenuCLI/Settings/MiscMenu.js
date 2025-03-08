import SettingsMenu from "./SettingsMenu.js";
import ColorText from "../../useful/ColorText.js";
import MenuCLI from "../MenuCLI.js";
import ConfigManager from "../../ConfigManager.js";

const MiscMenu = () => ({
    title : `Misc`,
options : [
        {
        name : '← Back',
        action : () => {
            MenuCLI.displayMenu(SettingsMenu)
            }
        }
    ]
})

export default MiscMenu