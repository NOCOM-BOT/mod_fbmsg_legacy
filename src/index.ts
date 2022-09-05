import CMComm from "./CMC.js";
import Logger from "./Logger.js";

let cmc = new CMComm();
let logger = new Logger(cmc);

interface IMessageData {
    interfaceID: number;
    content: string;
    attachments: {
        filename: string,
        url: string
    }[],
    channelID: string;
    replyMessageID?: string,
    additionalInterfaceData?: any
}

cmc.on("api:login", async (call_from: string, data: {
    interfaceID: number;
    loginData: {
        
    }
}, callback: (error?: any, data?: any) => void) => {

});

cmc.on("api:logout", async (call_from: string, data: {
    interfaceID: number
}, callback: (error?: any, data?: any) => void) => {

});

cmc.on("api:send_message", async (call_from: string, data: IMessageData, callback: (error?: any, data?: any) => void) => {
    
});

cmc.on("api:get_userinfo", async (call_from: string, data: {
    interfaceID: number,
    userID: string
}, callback: (error?: any, data?: any) => void) => {
    
});

cmc.on("api:get_channelinfo", async (call_from: string, data: {
    interfaceID: number,
    channelID: string
}, callback: (error?: any, data?: any) => void) => {
    
});
