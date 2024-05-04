import MenuCLI from "../MenuCLI.js";
import CentosMenu from "./CentosMenu.js";
import StartMenu from "../StartMenu.js";
import LlamacppRepo from "./LlamacppRepo.js";
import WindowsMenu from "./WindowsMenu.js";

let cpp_options = async () => {
    let final_array = [{
        name : `${LlamacppRepo.directoryExists() ? 'Reinstalar' : 'Instalar'}`,
        action : async () => {
            if(LlamacppRepo.directoryExists){
                await LlamacppRepo.resetRepository()
                MenuCLI.displayMenu(LlamaCPPMenu,{props : {hash : await LlamacppRepo.getCurrentCommitHash(),options : await cpp_options()}})
            } else {
                await LlamacppRepo.cloneRepository()
                MenuCLI.displayMenu(LlamaCPPMenu,{props : {hash : await LlamacppRepo.getCurrentCommitHash(),options : await cpp_options()}})
            }
        }
        }]
    
        if(LlamacppRepo.directoryExists()){
            final_array.push({
                name : 'Definir Head/Commit',
        action : async () => {
            let hash = await MenuCLI.ask('Hash : ')
            await LlamacppRepo.changeHeadToCommit(hash)
            MenuCLI.displayMenu(LlamaCPPMenu,{props : {hash : await LlamacppRepo.getCurrentCommitHash(),options : await cpp_options()}})
            }
            })
        }
    
        final_array.push({
        name : '← Voltar',
        action : () => {
            MenuCLI.displayMenu(RequirementsMenu)
            }
        })
        return final_array
        }

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
        MenuCLI.displayMenu(WindowsMenu)
        }
    },
    {
        name : 'LlamaCPP',
        action : async () => {
            MenuCLI.displayMenu(LlamaCPPMenu,{props : {hash : await LlamacppRepo.getCurrentCommitHash(),options : await cpp_options()}})
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

const LlamaCPPMenu = (props) => ({
    title : `🔍 Requirements | LlamaCPP ${(props.hash) ? `- ${props.hash}` : ''} 
`,
options : props.options

})

export default RequirementsMenu