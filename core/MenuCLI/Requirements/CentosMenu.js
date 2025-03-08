import MenuCLI from "../MenuCLI.js";
import RequirementsMenu from "./RequirementsMenu.js";
import GCC from "./GCC.js";
import CUDA from "./CUDA.js";
import PM2 from "../../useful/PM2.js";
import ColorText from "../../useful/ColorText.js";
import BashrcRefresh from "../../useful/BashrcRefresh.js";
import System from "../../useful/System.js";

let BashAndCheck = async () => {
    if(System() == 'linux'){
        await BashrcRefresh()
    }
    return await GCC.Check()
}

const GCCMenu = async () => ({
    title : `${(await BashAndCheck()) ? ColorText.green('GCC') : ColorText.red('GCC')}
`,
options : [
    {
    name : 'Install',
    action : async () => {
      await GCC.Install()
      MenuCLI.displayMenu(GCCMenu)
    }
    },
    {
        name : '← Back',
        action : () => {
            MenuCLI.displayMenu(CentosMenu)
            }
        }
     ]

})

const CUDAMenu = () => ({
    title : `CUDA Install
`,
options : [
    {
    name : 'Install',
    action : async () => {
      await CUDA.Install()
      MenuCLI.displayMenu(CUDAMenu)
    }
    },
    {
    name : 'Check',
    action : async () => {
       await CUDA.Check()
       MenuCLI.displayMenu(CUDAMenu)
        }
    },
    {
        name : '← Back',
        action : () => {
            MenuCLI.displayMenu(CentosMenu)
            }
        }
     ]

})

const CentosMenu = () => ({
    title : `⚙️ Centos Requirements
`,
options : [
    {
    name : 'GCC',
    action : () => {
        MenuCLI.displayMenu(GCCMenu)
    }
    },
    {
    name : 'CUDA',
    action : () => {
       MenuCLI.displayMenu(CUDAMenu)
        }
    },
    {
        name : '← Back',
        action : async () => {
            let pm2_status = await PM2.Check()
            MenuCLI.displayMenu(RequirementsMenu,{props : {pm2_status : pm2_status}})
            }
        }
     ]

})

export default CentosMenu