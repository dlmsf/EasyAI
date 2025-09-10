import SettingsMenu from "./SettingsMenu.js";
import ColorText from "../../useful/ColorText.js";
import MenuCLI from "../MenuCLI.js";
import ConfigManager from "../../ConfigManager.js";
import ModelSearch from '../../util/ModelSearch.js'
import getFileInstance from "../../util/File.js";
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';


const modelsDir = `${process.env.PWD}/models`;

if (!existsSync(modelsDir)) {
  await mkdir(modelsDir, { recursive: true });
}





// --------------------------------------------------
let models_array = [{type : '',model : '',size : 0,path : ''}]
models_array.splice(0,1)
let load_count = 10





let options_array = async (config = {expanded : false,refresh : false,loadmore : false,reset_loadcount : false}) => {
let expanded = config.expanded || -1
let refresh = config.refresh || false
let loadmore = config.loadmore || false
let reset_loadcount = config.reset_loadcount || false

if(loadmore){
    load_count = load_count+5
}

if(reset_loadcount){load_count = 10}

let final_array = []

let external_count = 0

let old_array = []

models_array.forEach(e => {
if(e.type == 'external'){
    external_count++
    old_array.push(e)
} 
})

models_array = [{type : '',model : '',size : 0,path : ''}]

ModelSearch.GGUF({startPath : `${process.env.PWD}/models`}).forEach(e => {
    models_array.push({type : 'loaded',...e})
})

old_array.forEach(e => {models_array.push(e)})

if(refresh || external_count == 0){
    
    ModelSearch.GGUF({fastMode : false,excludePaths : [`${process.env.PWD}/models`]}).forEach(e => {
        models_array.push({type : 'external',...e})
    })
}


models_array.forEach((e,i) => {
    if(i < load_count && i > 0){
        
        if(e.type == "external"){
            final_array.push({name : (expanded == i ? ColorText.brightYellow(`${e.model} | ${e.size} GB`) : `${e.model} | ${e.size} GB`),action : () => {
                if(expanded == i){
                    MenuCLI.displayMenu(ModelsManagerMenu,{props : {expanded : -1}})
                } else {
                    MenuCLI.displayMenu(ModelsManagerMenu,{props : {expanded : i}})
                }
                
            }})
        } else {
            final_array.push({name : (expanded == i ? ColorText.brightYellow(`${e.model} | ${e.size} GB`) : ColorText.brightGreen(`${e.model} | ${e.size} GB`)),action : () => {
                if(expanded == i){
                    MenuCLI.displayMenu(ModelsManagerMenu,{props : {expanded : -1}})
                } else {
                    MenuCLI.displayMenu(ModelsManagerMenu,{props : {expanded : i}})
                }
                
            }})
        }
        

        if(expanded == i){
         final_array.push([{name : (e.type == 'external') ? ColorText.green('Internal Save') : ColorText.red('Remove') ,action : async () => {
            
            if(e.type == 'external'){
                let file = getFileInstance(e.path)
                await file.copy(`${process.env.PWD}/models`)
                MenuCLI.displayMenu(ModelsManagerMenu,{props : {expanded : -1}})
            } else {
                let file = getFileInstance(e.path)
                await file.delete()
                MenuCLI.displayMenu(ModelsManagerMenu,{props : {expanded : -1}})
            }
            
        
         }}])
        }
    }
   
})

final_array.push([{
    name : 'Refresh',
    action : async () => {
        await MenuCLI.displayMenu(ModelsManagerMenu,{props : {refresh : true}})
        }
    },
    {
        name : 'Load More',
        action : async () => {
            await MenuCLI.displayMenu(ModelsManagerMenu,{props : {loadmore : true}})
            }
        },

])
final_array.push({
    name : '← Back',
    action : () => {
        MenuCLI.displayMenu(MiscMenu)
        }
    })


return final_array
}

const ModelsManagerMenu = async (props) => {

    let obj_final = {
    title : '',
    options : await options_array(props)
    }

    return obj_final
}
// --------------------------------------------------



const MiscMenu =  async () => ({
    title : `Misc`,
options : [
    {
        name : 'Models Manager',
        action : async () => {
            await MenuCLI.displayMenu(ModelsManagerMenu,{props : {reset_loadcount : true}})
            }
        },
        {
        name : 'Data Manager',
        action : () => {
            MenuCLI.displayMenu(SettingsMenu)
            }
        },
        {
            name : `${ColorText.red('EasyAI Reinstall')}`,
            action : () => {
                MenuCLI.displayMenu(SettingsMenu)
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

export default MiscMenu
