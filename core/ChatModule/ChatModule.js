import Chat from "./Chat.js";

class ChatModule {
    constructor(){
        this.Chats = [new Chat()]
        this.Chats.splice(0,1)
    }

    NewChat(name = 'New Chat',config = {historical : undefined,id : undefined}){
        this.Chats.push(new Chat(name,config))
    }

    NewMessage(chatindex,sender,content,config = {id : undefined,time : false}){
        this.Chats[chatindex].NewMessage(sender,content,config = {id : undefined,time : false})

    }

    NewMessageByID(chatId, sender, content, config = {id: undefined, time: false}) {
        const chat = this.Chats.find(chat => chat.ID === chatId);
        if (chat) {
            chat.NewMessage(sender, content, config)
        }
    }
 
    GetChatHistorical(index){
        return this.Chats[index].Historical
    }

    GetChatHistoricalById(chatId) {
        return this.Chats.find(chat => chat.ID === chatId)?.Historical || null;
    }

}

export default ChatModule