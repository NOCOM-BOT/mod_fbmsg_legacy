import CMComm from "./CMC.js";
import Logger from "./Logger.js";
import FCAInstance from "./Facebook";
import type { IFCAU_ListenMessage } from "fca-unofficial";

import fs from "node:fs/promises";
import path from "node:path";
import type EventEmitter from "node:events";

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

let clients: {
    [id: string]: {
        instance: FCAInstance,
        listenEvent: EventEmitter,
        appstateLocation?: string
    }
} = {};

let dataPathRequest = await cmc.callAPI("core", "get_data_folder", null);
let dataPath = "";
if (dataPathRequest.exist) {
    dataPath = dataPathRequest.data;
} else {
    process.exit(1);
}

cmc.on("api:login", async (call_from: string, data: {
    interfaceID: number;
    loginData: {
        username?: string;
        password?: string;
        twoFactorSecret?: string;
        appstateLocation?: string;
    }
}, callback: (error?: any, data?: any) => void) => {
    if (clients[data.interfaceID]) {
        callback("Interface ID exists", { success: false });
        return;
    }

    let client = new FCAInstance();
    try {
        let appstate: any = void 0;
        if (data.loginData.appstateLocation) {
            try {
                appstate = JSON.parse(await fs.readFile(path.resolve(dataPath, data.loginData.appstateLocation), "utf-8"));
            } catch {
                logger.warn("facebook_legacy", "Failed to load appstate from specified appstate location.");
            }
        }

        let fca = await client.login({
            state: appstate,
            username: data.loginData.username,
            password: data.loginData.password,
            twoFactorSecret: data.loginData.twoFactorSecret
        });

        logger.info("facebook_legacy", `Interface ${data.interfaceID} logged in.`);

        // Save appstate
        // Do not save if appstateLocation is not specified
        if (data.loginData.appstateLocation) {
            try {
                await fs.writeFile(
                    path.resolve(dataPath, data.loginData.appstateLocation),
                    JSON.stringify(client.fca?.getAppState())
                );
            } catch {
                logger.warn("facebook_legacy", `Failed to save appstate for interface ${data.interfaceID}.`);
            }
        }

        // Listen for messages
        let listenEvent = fca.listenMqtt();
        listenEvent.on("message", (message: IFCAU_ListenMessage) => {
            switch (message.type) {
                case "message":
                case "message_reply":
                    // Broadcast incoming message event for command handlers
                    cmc.callAPI("core", "send_event", {
                        eventName: "interface_message",
                        data: {
                            interfaceID: data.interfaceID,
                            interfaceHandlerName: "Facebook",

                            content: message.body,
                            attachments: message.attachments.map((attachment) => {
                                switch (attachment.type) {
                                    case "audio":
                                    case "video":
                                    case "file":
                                    case "animated_image":
                                        return {
                                            url: attachment.url,
                                            filename: attachment.filename
                                        }
                                    case "photo":
                                        return {
                                            url: attachment.largePreviewUrl,
                                            filename: attachment.filename
                                        }
                                    case "sticker":
                                        return {
                                            url: attachment.url,
                                            filename: (new URL(attachment.url)).pathname.split("/").pop()
                                        }
                                }
                            }).filter(x => x),

                            mentions: Object.fromEntries(
                                Object.entries(message.mentions).map(([userID, mentionString]) => {
                                    return [
                                        `${userID}@User@Facebook`,
                                        {
                                            start: message.body.indexOf(mentionString),
                                            length: mentionString.length
                                        }
                                    ]
                                })
                            ),

                            messageID: message.messageID,
                            formattedMessageID: `${message.messageID}@Message@Facebook`,
                            channelID: message.threadID,
                            formattedChannelID: `${message.threadID}@Thread@Facebook`,
                            // Since Facebook doesn't have a concept of "server" or "guild", we use the thread ID as the server ID
                            guildID: message.threadID,
                            formattedGuildID: `${message.threadID}@Thread@Facebook`,
                            senderID: message.senderID,
                            formattedSenderID: `${message.senderID}@User@Facebook`,

                            additionalInterfaceData: {
                                rawData: message,
                                additionalAttachments: message.attachments.map((attachment) => {
                                    switch (attachment.type) {
                                        case "share":
                                            return {
                                                url: attachment.url,
                                                type: "share"
                                            }
                                        case "location":
                                            return {
                                                location: {
                                                    lat: attachment.latitude,
                                                    lon: attachment.longitude
                                                },
                                                type: "location"
                                            }
                                    }
                                }).filter(x => x),
                                isDM: !message.isGroup,
                                isReply: message.type === "message_reply"
                            }
                        }
                    });
                    break;
            }
        });

        clients[data.interfaceID] = {
            instance: client,
            listenEvent,
            appstateLocation: data.loginData.appstateLocation
        }

        logger.info("facebook_legacy", `Started listening for message on interface ${data.interfaceID}.`);
        callback(null, { success: true });
    } catch (error) {
        logger.error("facebook_legacy", `Interface ${data.interfaceID} login failed.`, String(error));
        callback(String(error), { success: false });
    }
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
