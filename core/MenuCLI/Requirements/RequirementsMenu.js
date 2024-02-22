import MenuCLI from "../MenuCLI.js";
import CentosMenu from "./CentosMenu.js";
import StartMenu from "../StartMenu.js";

const RequirementsMenu = () => ({
    title : `🔍 Requirements
`,
options : [
    {
    name : 'Centos 7x',
    action : () => {
        MenuCLI.displayMenu(CentosMenu)
    }
    },
    {
    name : 'Windows',
    action : () => {
        
        }
    },
    {
        name : '← Voltar',
        action : () => {
            MenuCLI.displayMenu(StartMenu)
            }
        }
     ]

})

export default RequirementsMenu