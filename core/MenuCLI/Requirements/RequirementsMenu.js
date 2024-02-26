import MenuCLI from "../MenuCLI.js";
import CentosMenu from "./CentosMenu.js";
import StartMenu from "../StartMenu.js";
import LlamacppRepo from "./LlamacppRepo.js";

const LlamaCPPMenu = () => ({
    title : `🔍 Requirements
`,
options : [
    {
    name : `${LlamacppRepo.directoryExists() ? 'Reinstalar' : 'Instalar'}`,
    action : async () => {
        if(LlamacppRepo.directoryExists){
            await LlamacppRepo.resetRepository()
            MenuCLI.displayMenu(LlamaCPPMenu)
        } else {
            await LlamacppRepo.cloneRepository()
            MenuCLI.displayMenu(LlamaCPPMenu)
        }
    }
    },
    {
        name : '← Voltar',
        action : () => {
            MenuCLI.displayMenu(RequirementsMenu)
            }
        }
     ]

})

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
        name : 'LlamaCPP',
        action : () => {
            MenuCLI.displayMenu(LlamaCPPMenu)
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