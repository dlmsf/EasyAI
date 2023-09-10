import EasyAI_Server from "./core/EasyAI_Server.js"
import LlamaCPP from "./core/LlamaCPP.js"

class EasyAI {
    constructor(){

        this.LlamaCPP = new LlamaCPP()

    }


    
static ModelManager = {

}

static Server = EasyAI_Server

}

export default EasyAI