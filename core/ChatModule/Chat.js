import Message from './Message.js'

class Chat {
    constructor(name = 'New Chat',config = {historical : undefined,id : undefined}){
        if(config.id){this.ID = config.id}
        this.Name = name
        this.Historical = config.historical || [new Message(123,'blank','blank')]
        this.Historical.splice(0,1)
    }

    NewMessage(sender,content,config = {id : undefined,time : false}){
        this.Historical.push(new Message(sender,content,config))
    }

    Reset(){
        this.Historical = []
    }

}

export default Chat