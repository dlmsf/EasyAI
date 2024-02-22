import MenuCLI from "../MenuCLI.js";
import RequirementsMenu from "./RequirementsMenu.js";

const CentosMenu = () => ({
    title : `⚙️ Centos Requirements
`,
options : [
    {
    name : 'GCC',
    action : () => {
      
    }
    },
    {
    name : 'CUDA',
    action : () => {
       
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

export default CentosMenu