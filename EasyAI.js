import EasyAI_Server from "./core/EasyAI_Server.js"
import LlamaCPP from "./core/Llama/LlamaCPP.js"

class EasyAI {
    constructor(config = {llama_model : ''}){

        this.LlamaCPP = new LlamaCPP({modelpath : config.llama_model})

    }

async Generate(prompt = 'Once upon a time',config = {stream : false},tokenCallback = (token) => {}){
    return await this.LlamaCPP.Generate(prompt,config,tokenCallback)
}
    
static ModelManager = {

}

static Sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

static Server = EasyAI_Server

}

export default EasyAI