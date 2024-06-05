import MenuCLI from "../MenuCLI.js";
import CentosMenu from "./CentosMenu.js";
import StartMenu from "../StartMenu.js";
import LlamacppRepo from "./LlamacppRepo.js";
import WindowsMenu from "./WindowsMenu.js";
import ColorText from "../../useful/ColorText.js";

let hash_options = async (page = 1) => {
let finaloptions = []
let commits_array = await LlamacppRepo.getCommitHashesAndDates(10)
commits_array[page-1].hash_array.forEach((e,i) => {
    if(i < 20){
    finaloptions.push({
        name : `${e.date} | ${e.hash.substring(0,7)}`,
        action : async () => {
            await LlamacppRepo.changeHeadToCommit(e.hash)
            MenuCLI.displayMenu(LlamaCPPMenu,{props : {hash : await LlamacppRepo.getCurrentCommitHash(),options : await cpp_options()}})
        }
    })
}
})

if(page > 1){
    finaloptions.push({
        name : `<- Prev. Page (${page-1})`,
        action : async () => {
            MenuCLI.displayMenu(HashByDate,{props : {page : page-1}}) 
          }
        })
}

if(page < commits_array.length){
finaloptions.push({
    name : `Next Page (${page+1}) ->`,
    action : async () => {
        MenuCLI.displayMenu(HashByDate,{props : {page : page+1}})
        }
    })
}

finaloptions.push({
    name : '← Voltar - LlammaCPP Menu',
    action : async () => {
        MenuCLI.displayMenu(LlamaCPPMenu,{props : {hash : await LlamacppRepo.getCurrentCommitHash(),options : await cpp_options()}})
        }
    })

return finaloptions
}

const HashByDate = async (props) => ({
    title : `🔍 Commits  | ${ColorText.blue(props.page ? `Page ${props.page}` : 'Page 1')}
`,
options : await hash_options(props.page)

})

let cpp_options = async () => {
    let final_array = [{
        name : `${LlamacppRepo.directoryExists() ? 'Reinstalar (Github)' : 'Instalar (Github)'}`,
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

        final_array.push({
            name : `${LlamacppRepo.directoryExists() ? 'Reinstalar (Native)' : 'Instalar (Native)'}`,
            action : async () => {
                if(LlamacppRepo.directoryExists){
                    await LlamacppRepo.resetRepository(true)
                    MenuCLI.displayMenu(LlamaCPPMenu,{props : {hash : await LlamacppRepo.getCurrentCommitHash(),options : await cpp_options()}})
                } else {
                    await LlamacppRepo.Extract()
                    MenuCLI.displayMenu(LlamaCPPMenu,{props : {hash : await LlamacppRepo.getCurrentCommitHash(),options : await cpp_options()}})
                }
            }
            })
    
        if(LlamacppRepo.directoryExists()){
            final_array.push({
                name : 'Definir Head/Commit',
        action : async () => {

            let waytochange = await MenuCLI.displayMenuFromOptions(`Do you want ${ColorText.yellow('Type')} the hash or select by ${ColorText.cyan('Date')} ?`,[ColorText.yellow('Type'),ColorText.cyan('Date')])

            if(waytochange.toLowerCase() == ColorText.cyan('Date').toLowerCase()){
                MenuCLI.displayMenu(HashByDate)
            } else {
                const hash = await MenuCLI.ask('Hash : ')
                await LlamacppRepo.changeHeadToCommit(hash)
                MenuCLI.displayMenu(LlamaCPPMenu,{props : {hash : await LlamacppRepo.getCurrentCommitHash(),options : await cpp_options()}})
            }

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