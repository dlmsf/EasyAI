import MenuCLI from "../MenuCLI.js";
import RequirementsMenu from "./RequirementsMenu.js";
import W64 from "./W64.js";
import PM2 from "../../useful/PM2.js";

const WindowsMenu = () => ({
    title : `⚙️ Windows Requirements | (terminal as an administrator)
`,
options : [
    {
    name : 'w64devkit',
    action : async () => {
        await W64.install()
        MenuCLI.displayMenu(WindowsMenu)
    }
    },
    {
        name : '← Voltar',
        action : async () => {
            let pm2_status = await PM2.Check()
            MenuCLI.displayMenu(RequirementsMenu,{props : {pm2_status : pm2_status}})
            }
        }
     ]

})

export default WindowsMenu