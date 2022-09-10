import CMComm from "./CMC.js";
import Logger from "./Logger.js";
import FCAInstance from "./Facebook";
import type { IFCAU_ListenMessage } from "fca-unofficial";
import streamBuffers from "stream-buffers";

import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type EventEmitter from "node:events";
import http from "node:http";
import https from "node:https";
import { fileURLToPath } from "node:url";
import type { Readable } from "node:stream";

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
        listenEvent: EventEmitter & { stopListening: (callback?: () => void) => void },
        appstateLocation?: string
    }
} = {};

let localNameCache: {
    [id: string]: string
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
    if (clients[data.interfaceID]) {
        clients[data.interfaceID].listenEvent.stopListening();
        clients[data.interfaceID].listenEvent.removeAllListeners();
        delete clients[data.interfaceID];
    }

    callback(null, { success: true });
});

cmc.on("api:send_message", async (call_from: string, data: IMessageData, callback: (error?: any, data?: any) => void) => {
    if (!clients[data.interfaceID]) {
        callback("Interface ID does not exist", { success: false });
        return;
    }

    let client = clients[data.interfaceID].instance;
    let fca = client.fca;

    if (!fca) {
        callback("Interface is not logged in???", { success: false });
        return;
    }

    let threadID = data.channelID.split("@")[0];

    let { messageID } = await fca.sendMessage(
        {
            body: data.content,
            attachment: (data.attachments.map((attachment) => {
                if (attachment.url.startsWith("data:")) {
                    // Check if it's base64-encoded or URL-encoded by checking if 
                    // it has ";base64" in "data:<mime>;base64,<data>"
                    if (attachment.url.split(";")[1].startsWith("base64")) {
                        // Base64
                        let buf = Buffer.from(attachment.url.split(",")[1], "base64");
                        let stream = new streamBuffers.ReadableStreamBuffer({
                            initialSize: buf.length
                        });
                        //@ts-ignore
                        stream.path = attachment.filename;
                        stream.put(buf);
                        stream.stop();

                        return stream;
                    } else {
                        // URL-encoded (percent-encoded)
                        let buf = Buffer.from(decodeURIComponent(attachment.url.split(",")[1]));
                        let stream = new streamBuffers.ReadableStreamBuffer({
                            initialSize: buf.length
                        });
                        //@ts-ignore
                        stream.path = attachment.filename;
                        stream.put(buf);
                        stream.stop();

                        return stream;
                    }
                } else {
                    // Parse URL with protocol
                    let parsedURL = new URL(attachment.url);
                    switch (parsedURL.protocol) {
                        case "http:":
                            let httpReq = http.get(parsedURL.toString());
                            httpReq.path = attachment.filename;
                            return httpReq;
                        case "https:":
                            let httpsReq = https.get(parsedURL.toString());
                            httpsReq.path = attachment.filename;
                            return httpsReq;
                        case "file:":
                            let stream = fsSync.createReadStream(fileURLToPath(parsedURL.toString()));
                            return stream;
                        default:
                            return null;
                    }
                }
            })).filter(x => x) as Readable[]
        },
        threadID,
        void 0,
        data.replyMessageID?.split?.("@")?.[0],
        threadID.length >= 16
    );

    callback(null, {
        success: true,
        messageID
    });
});

cmc.on("api:get_userinfo", async (call_from: string, data: {
    interfaceID: number,
    userID: string
}, callback: (error?: any, data?: any) => void) => {
    if (!clients[data.interfaceID]) {
        callback("Interface ID does not exist", { success: false });
        return;
    }

    let client = clients[data.interfaceID].instance;
    let fca = client.fca;

    if (!fca) {
        callback("Interface is not logged in???", { success: false });
        return;
    }

    let userID = data.userID.split("@")[0];

    if (localNameCache[userID]) {
        callback(null, {
            success: true,
            userInfo: localNameCache[userID]
        });
        return;
    } else {
        try {
            let userInfo = await fca.getUserInfo(userID);

            callback(null, {
                success: true,
                name: userInfo[userID].name
            });
        } catch {
            callback(null, {
                success: false,
                name: `Unknown user ${userID}`
            });
        }
    }
});

cmc.on("api:get_channelinfo", async (call_from: string, data: {
    interfaceID: number,
    channelID: string
}, callback: (error?: any, data?: any) => void) => {
    if (!clients[data.interfaceID]) {
        callback("Interface ID does not exist", { success: false });
        return;
    }

    let client = clients[data.interfaceID].instance;
    let fca = client.fca;

    if (!fca) {
        callback("Interface is not logged in???", { success: false });
        return;
    }

    let channelID = data.channelID.split("@")[0];

    if (localNameCache[channelID]) {
        callback(null, {
            success: true,
            channelInfo: localNameCache[channelID]
        });
        return;
    } else {
        try {
            let channelInfo = await fca.getThreadInfo(channelID);

            callback(null, {
                success: true,
                name: channelInfo.threadName
            });
        } catch {
            callback(null, {
                success: false,
                name: `Unknown thread ${channelID}`
            });
        }
    }
});
