import Message from './Message.js'

class Chat {
    constructor(id,name = 'New Chat'){
        this.ID = id
        this.Name = name
        this.Historical = [new Message(123,'blank','blank')]
        this.Historical.splice(0,1)
    }

    NewMessage(id,type,content){
        this.Historical.push(new Message(id,type,content))
    }

}

export default Chat