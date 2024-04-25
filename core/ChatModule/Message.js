import getTime from '../useful/getTime.js'

class Message {
    constructor(sender,content,config = {id : undefined,time : false}){
        (config.id) ? this.ID = config.id : null
        if(config.time){this.Time = getTime()}
        this.Sender = sender
        this.Content = content
    }
}

export default Message