import MenuCLI from "../MenuCLI.js"
import ColorText from '../../useful/ColorText.js'
import ConfigManager from '../../ConfigManager.js'
import SettingsMenu from "./SettingsMenu.js"
import ServerSaves from "../ServerSaves.js"

const FlashWebGPT = () => ({
    title : `WebGPT Command-line Configuration
`,
options : [
    {
    name : `💾 Default Save ${ConfigManager.getKey('defaultwebgptsave') ? `| ${ColorText.cyan(ConfigManager.getKey('defaultwebgptsave'))}` : '' }`,
    action : async () => {
          const saves = await ServerSaves.List()
          let options = []
          saves.forEach(e => {
            options.push(e)
          })
          options.push('OpenAI')
          options.push(['← Cancel |','🗑️ Clear'])
          
         let result = await MenuCLI.displayMenuFromOptions(`Choose the save ${ConfigManager.getKey('defaultwebgptsave') ? `| ${ColorText.cyan(ConfigManager.getKey('defaultwebgptsave'))}` : '' }`,options,{clear : true})

         if(result != '← Cancel |' && !undefined && result != '🗑️ Clear'){
            ConfigManager.setKey('defaultwebgptsave',result)
            MenuCLI.displayMenu(FlashWebGPT)
         } else {
            if(result == '🗑️ Clear'){ConfigManager.deleteKey('defaultwebgptsave')}
            MenuCLI.displayMenu(FlashWebGPT)
         }
         }
    },
    {
    name : '← Back',
    action : () => {
        MenuCLI.displayMenu(FlashMenu)
            }
        }
]
})

const FlashGenerate = () => ({
    title : `Generate Command-line Configuration
`,
options : [
    {
    name : `💾 Default Save ${ConfigManager.getKey('defaultgeneratesave') ? `| ${ColorText.cyan(ConfigManager.getKey('defaultgeneratesave'))}` : '' }`,
    action : async () => {
          const saves = await ServerSaves.List()
          let options = []
          saves.forEach(e => {
            options.push(e)
          })
          options.push('OpenAI')
          options.push(['← Cancel |','🗑️ Clear'])
        
         let result = await MenuCLI.displayMenuFromOptions(`Choose the save ${ConfigManager.getKey('defaultgeneratesave') ? `| ${ColorText.cyan(ConfigManager.getKey('defaultgeneratesave'))}` : '' }`,options,{clear : true})

         if(result != '← Cancel |' && !undefined && result != '🗑️ Clear'){
            ConfigManager.setKey('defaultgeneratesave',result)
            MenuCLI.displayMenu(FlashGenerate)
         } else {
            if(result == '🗑️ Clear'){ConfigManager.deleteKey('defaultgeneratesave')}
            MenuCLI.displayMenu(FlashGenerate)
         }
         }
    },
    {
    name : '← Back',
    action : () => {
        MenuCLI.displayMenu(FlashMenu)
            }
        }
]
})

const FlashChat = () => ({
    title : `Chat Command-line Configuration
`,
options : [
    {
    name : `💾 Default Save ${ConfigManager.getKey('defaultchatsave') ? `| ${ColorText.cyan(ConfigManager.getKey('defaultchatsave'))}` : '' }`,
    action : async () => {
          const saves = await ServerSaves.List()
          let options = []
          saves.forEach(e => {
            options.push(e)
          })

          options.push('OpenAI')
          options.push(['← Cancel |','🗑️ Clear'])
          
         let result = await MenuCLI.displayMenuFromOptions(`Choose the save ${ConfigManager.getKey('defaultchatsave') ? `| ${ColorText.cyan(ConfigManager.getKey('defaultchatsave'))}` : '' }`,options,{clear : true})

         if(result != '← Cancel |' && !undefined && result != '🗑️ Clear'){
            ConfigManager.setKey('defaultchatsave',result)
            MenuCLI.displayMenu(FlashChat)
         } else {
            if(result == '🗑️ Clear'){ConfigManager.deleteKey('defaultchatsave')}
            MenuCLI.displayMenu(FlashChat)
         }
         }
    },
    {
    name : '← Back',
    action : () => {
        MenuCLI.displayMenu(FlashMenu)
            }
        }
]
})

const FlashMenu = () => ({
    title : `⚡ Flash Commands
`,
options : [
    {
    name : 'chat',
    action : () => {
        MenuCLI.displayMenu(FlashChat)
        }
    },
    {
    name : 'generate',
    action : () => {
        MenuCLI.displayMenu(FlashGenerate)
        }
    },
    {
    name : 'webgpt',
    action : () => {
        MenuCLI.displayMenu(FlashWebGPT)
            }
        },
        {
    name : 'do',
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

export default FlashMenu