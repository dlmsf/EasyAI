import MenuCLI from "../MenuCLI.js";
import CentosMenu from "./CentosMenu.js";
import LlamacppRepo from "./LlamacppRepo.js";
import WindowsMenu from "./WindowsMenu.js";
import ColorText from "../../useful/ColorText.js";
import PM2 from "../../useful/PM2.js";
import SettingsMenu from "../Settings/SettingsMenu.js";

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

let prevnext = []

if(page > 1){
    prevnext.push({
        name : `<- (${page-1}) Prev. Page`,
        action : async () => {
            MenuCLI.displayMenu(HashByDate,{props : {page : page-1}}) 
          }
        })
}

if(page < commits_array.length){
prevnext.push({
    name : `Next Page (${page+1}) ->`,
    action : async () => {
        MenuCLI.displayMenu(HashByDate,{props : {page : page+1}})
        }
    })
}

finaloptions.push({type : 'options',value : prevnext})

finaloptions.push({
    name : '← Back - LlammaCPP Menu',
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
        name : `${LlamacppRepo.directoryExists() ? 'Reinstall (Github)' : 'Install (Github)'}`,
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
            name : `${LlamacppRepo.directoryExists() ? 'Reinstall (Native)' : 'Install (Native)'}`,
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
                name : 'Select Head/Commit',
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
        name : '← Back',
        action : async () => {
            let pm2_status = await PM2.Check()
            MenuCLI.displayMenu(RequirementsMenu)
            }
        })
        return final_array
        }

const RequirementsMenu = async (props) => ({
    title : `• Settings / Requirements`,
options : [
    {
        name : 'LlamaCPP',
        action : async () => {
            MenuCLI.displayMenu(LlamaCPPMenu,{props : {hash : await LlamacppRepo.getCurrentCommitHash(),options : await cpp_options()}})
            }
        },
        {
            name : await PM2.Check() ? `${ColorText.green('PM2')}`:`${ColorText.red('PM2')} | Install`,
            action : async () => {
                if(await PM2.Check()){
                    MenuCLI.displayMenu(RequirementsMenu)
                } else {
                    await PM2.Install()
                    MenuCLI.displayMenu(RequirementsMenu)
                }
                }
            },
    {
        name : '← Back',
        action : () => {
            MenuCLI.displayMenu(SettingsMenu)
            }
        }
     ]

})

const LlamaCPPMenu = (props) => ({
    title : `• Settings / Requirements / LlamaCPP ${(props.hash) ? `- ${props.hash}` : ''} 
`,
options : props.options

})

export default RequirementsMenu