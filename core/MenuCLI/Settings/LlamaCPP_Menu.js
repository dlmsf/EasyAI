import ConfigManager from "../../ConfigManager.js"
import ColorText from '../../useful/ColorText.js'
import MenuCLI from "../MenuCLI.js"
import RequirementsMenu from "../Requirements/RequirementsMenu.js"
import TextGeneration_Menu from "./TextGeneration_Menu.js"
import { cpus } from 'os';
import LlamaCPP_InstancesView from "../../util/LlamaCPP_InstancesView.js"
import readline from 'readline';

export class ThreadDetector {
    static getSystemThreads() {
        try {
            const logicalCores = cpus().length; // Each logical core can handle a thread
            return logicalCores;
        } catch (error) {
            console.error('Error detecting system threads:', error.message);
            return false; // Return false if there's an issue
        }
    }
}

const LlamaCPP_Menu = () => ({
    title : `• Settings / TextGeneration / LlamaCPP Menu`,
options : [
    {
        name : `Install | ${ConfigManager.getKey('gh-llama') ? ColorText.brightYellow('GitHub') : ColorText.green('Native')}`,
        action : () => {
            if(ConfigManager.getKey('gh-llama')){
                ConfigManager.deleteKey('gh-llama')
            } else {
                ConfigManager.setKey('gh-llama',true)
            }
            MenuCLI.displayMenu(LlamaCPP_Menu)
        } 
        },
        {
            name : `Server Command-line | ${ConfigManager.getKey('old-llama-server') ?  ColorText.yellow('server') : ColorText.cyan('llama-server')}`,
            action : () => {
                if(ConfigManager.getKey('old-llama-server')){
                    ConfigManager.deleteKey('old-llama-server')
                } else {
                    ConfigManager.setKey('old-llama-server',true)
                }
                MenuCLI.displayMenu(LlamaCPP_Menu)
            } 
            },
            {
                name : `Fast Build | ${(  ConfigManager.getKey('jbuild') ?  (ConfigManager.getKey('jbuild-threads') ? ColorText.green(ConfigManager.getKey('jbuild-threads')) : ColorText.green('ON') ) : ColorText.red('OFF')   )}`,
                action : async () => {

                    const Threads = ThreadDetector.getSystemThreads()

                    if(Threads){

                        if(ConfigManager.getKey('jbuild-threads')){

                            let jbuild_threads = Number(ConfigManager.getKey('jbuild-threads'))
                                
                            if(jbuild_threads == Threads){

                                ConfigManager.deleteKey('jbuild')
                                ConfigManager.deleteKey('jbuild-threads')
                                
                                
                            } else {

                                jbuild_threads = jbuild_threads+1
                                ConfigManager.setKey('jbuild-threads',jbuild_threads)

                            }

                        } else {

                                ConfigManager.setKey('jbuild',true)
                                ConfigManager.setKey('jbuild-threads',1)
                        
                        }

                    } else {

                        if(ConfigManager.getKey('jbuild')){
                            ConfigManager.deleteKey('jbuild')
                        } else {
                            ConfigManager.setKey('jbuild',true)
                        }

                    }

                    MenuCLI.displayMenu(LlamaCPP_Menu)
                    
                }
                },
                {
                    name : ColorText.orange('Instances Monitor'),
                    action : () => {
                        console.clear()
                        MenuCLI.close
                        LlamaCPP_InstancesView(() => {
                            MenuCLI.rl = readline.createInterface({
                                input: process.stdin,
                                output: process.stdout
                              });
                            MenuCLI.displayMenu(LlamaCPP_Menu)
                        })
                        
                        }
                    },
                    {
                        name : `Start ${ColorText.cyan('w/Instances Log')} | ${(ConfigManager.getKey('start-llamacpp-instanceslog') ? ColorText.green('ON') : ColorText.red('OFF'))}`,
                        action : () => {
                            if(ConfigManager.getKey('start-llamacpp-instanceslog')){
                                ConfigManager.deleteKey('start-llamacpp-instanceslog')
                            } else {
                                ConfigManager.setKey('start-llamacpp-instanceslog',true)
                                ConfigManager.setKey('log',true)
                            }
                            MenuCLI.displayMenu(LlamaCPP_Menu)
                        }
                        },
            {
                name : 'Install (Requirements Menu)',
                action : () => {
                    MenuCLI.displayMenu(RequirementsMenu)
                    }
                },
            {
                name : '← Back',
                action : () => {
                    MenuCLI.displayMenu(TextGeneration_Menu)
                    }
                }
    ]

})

export default LlamaCPP_Menu